import { RoofBuilder, RoofGeometry, RoofParams } from "./type.js";
import Vec2 from "../../math/vector2.js";
import earcut from 'earcut';
import { getTileUVTransform } from "../../textures/building_textures.js";
import { getImageFrame } from "../../textures/helper.js";



export default class FlatRoofBuilder implements RoofBuilder {
    public build(params: RoofParams): RoofGeometry {
        const { multipolygon, minHeight, flip } = params;

        // 1) Récupère le footprint (positions 3D, UV locaux et holeIndices)
        const footprint = multipolygon.getFootprintWithHoles({ height: minHeight, flip });
        const holeIndices: number[] = footprint.holeIndices; // indices dans footprint.uvs

        // 2) Construis positions2D[] et uvsLocal[] en Vec2
        const positions2D: Vec2[] = [];
        for (let i = 0; i < footprint.positions.length; i += 3) {
            positions2D.push(new Vec2(
                footprint.positions[i],
                footprint.positions[i + 1]
            ));
        }
        const uvsLocal: Vec2[] = [];
        for (let i = 0; i < footprint.uvs.length; i += 2) {
            uvsLocal.push(new Vec2(
                footprint.uvs[i],
                footprint.uvs[i + 1]
            ));
        }

        // 3) OMBB → origine, angle et scale pour transformer les UV
        const ombb = multipolygon.getOMBB();
        const origin2D = ombb[1];
        const v0 = Vec2.sub(ombb[0], origin2D);
        const v1 = Vec2.sub(ombb[2], origin2D);
        const angle = -Vec2.angleClockwise(new Vec2(1, 0), v0);
        const scale2D = params.isStretched
            ? new Vec2(Vec2.getLength(v0), Vec2.getLength(v1))
            : new Vec2(params.scaleX, params.scaleY);

        // 4) UV projetés = (uvLocal − origin) → rotate(angle) → /scale
        const uvsProj: Vec2[] = uvsLocal.map(u => {
            const t = Vec2.sub(u, origin2D);
            const r = Vec2.rotate(t, angle);
            return new Vec2(r.x / scale2D.x, r.y / scale2D.y);
        });

        // 5) Triangulation initiale en UV-space, en passant holeIndices
        const flatUVAll = uvsProj.flatMap(u => [u.x, u.y]);
        const triIdx = earcut(flatUVAll, holeIndices, 2).reverse();

        // 6) Détermine la plage de cellules UV entières à tester
        let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
        uvsProj.forEach(u => {
            uMin = Math.min(uMin, u.x); uMax = Math.max(uMax, u.x);
            vMin = Math.min(vMin, u.y); vMax = Math.max(vMax, u.y);
        });
        const u0i = Math.floor(uMin), u1i = Math.ceil(uMax);
        const v0i = Math.floor(vMin), v1i = Math.ceil(vMax);


        const textureFrame = getImageFrame(params.textureId)
        const atlasParams = getTileUVTransform(
            textureFrame.x,
            textureFrame.y,
        )

        const offX = atlasParams.offset.x
        const offY = atlasParams.offset.y
        const scX = atlasParams.scale.x
        const scY = atlasParams.scale.y
        // console.log(offX, offY)

        // 8) Helpers de clipping (Sutherland–Hodgman)
        const clipRange = (
            poly: Vec2[],
            axis: 'x' | 'y',
            edge: number,
            keepGreater: boolean,
            strict: boolean
        ): Vec2[] => {
            const out: Vec2[] = [];
            for (let i = 0; i < poly.length; i++) {
                const A = poly[i], B = poly[(i + 1) % poly.length];
                const a = axis === 'x' ? A.x : A.y;
                const b = axis === 'x' ? B.x : B.y;
                const insideA = keepGreater
                    ? (strict ? a > edge : a >= edge)
                    : (strict ? a < edge : a <= edge);
                const insideB = keepGreater
                    ? (strict ? b > edge : b >= edge)
                    : (strict ? b < edge : b <= edge);
                if (insideA && insideB) {
                    out.push(Vec2.clone(B));
                } else if (insideA && !insideB) {
                    const t = (edge - a) / (b - a);
                    out.push(new Vec2(
                        axis === 'x' ? edge : A.x + t * (B.x - A.x),
                        axis === 'y' ? edge : A.y + t * (B.y - A.y)
                    ));
                } else if (!insideA && insideB) {
                    const t = (edge - a) / (b - a);
                    out.push(
                        new Vec2(
                            axis === 'x' ? edge : A.x + t * (B.x - A.x),
                            axis === 'y' ? edge : A.y + t * (B.y - A.y)
                        ),
                        Vec2.clone(B)
                    );
                }
            }
            return out;
        };

        // 9) Buffers finaux
        const finalPos: number[] = [];
        const finalUV: number[] = [];
        const finalNorm: number[] = [];

        // 10) Pour chaque triangle initial
        for (let ti = 0; ti < triIdx.length; ti += 3) {
            const ai = triIdx[ti], bi = triIdx[ti + 1], ci = triIdx[ti + 2];
            const triUV = [Vec2.clone(uvsProj[ai]), Vec2.clone(uvsProj[bi]), Vec2.clone(uvsProj[ci])];

            // 11) teste chaque cellule qu’il chevauche
            // calcule son bbox UV
            let tUmin = Infinity, tUmax = -Infinity, tVmin = Infinity, tVmax = -Infinity;
            triUV.forEach(p => {
                tUmin = Math.min(tUmin, p.x); tUmax = Math.max(tUmax, p.x);
                tVmin = Math.min(tVmin, p.y); tVmax = Math.max(tVmax, p.y);
            });
            const cu0 = Math.floor(tUmin), cu1 = Math.ceil(tUmax);
            const cv0 = Math.floor(tVmin), cv1 = Math.ceil(tVmax);

            for (let iu = cu0; iu < cu1; iu++) {
                for (let iv = cv0; iv < cv1; iv++) {
                    // 12) clippe le triangle dans [iu,iu+1)x[iv,iv+1)
                    let poly = triUV;
                    poly = clipRange(poly, 'x', iu, true, false);
                    poly = clipRange(poly, 'x', iu + 1, false, true);
                    poly = clipRange(poly, 'y', iv, true, false);
                    poly = clipRange(poly, 'y', iv + 1, false, true);
                    if (poly.length < 3) continue;

                    // 13) translate UV→[0,1] et triangule la cellule
                    const flat: number[] = [];
                    poly.forEach(p => flat.push(p.x - iu, p.y - iv));
                    const cellTris = earcut(flat, null, 2).reverse();
                    if (!cellTris.length) continue;

                    // 14) pour chaque sommet généré
                    cellTris.forEach(idx => {
                        const lu = flat[2 * idx], lv = flat[2 * idx + 1];

                        // -> position 3D exact via inversion OMBB
                        const uProj = iu + lu;
                        const vProj = iv + lv;
                        const scaled = new Vec2(uProj * scale2D.x, vProj * scale2D.y);
                        const back = Vec2.rotate(scaled, -angle);
                        const world2 = Vec2.add(back, origin2D);
                        finalPos.push(world2.x, world2.y, minHeight);

                        // -> UV atlas
                        finalUV.push(
                            offX + lu * scX,
                            offY + lv * scY
                        );

                        // -> normale plate
                        finalNorm.push(0, 0, 1);
                    });
                }
            }
        }

        return {
            position: finalPos,
            uv: finalUV,
            normal: finalNorm,
            addSkirt: false
        };
    }
}

