import { MathUtils } from "three";
import { clipRange, RoofBuilder, RoofGeometry, RoofParams, RoofSkirt, Vert } from "./type.js";
import Tile3DMultipolygon, { StraightSkeletonResult, StraightSkeletonResultPolygon } from "../tile3d-multipolygon.js";
import Vec2 from "../../math/vector2.js";
import earcut from 'earcut';
import { calculateNormal, signedDstToLine } from "./utils.js";
import Vec3 from "../../math/vector3.js";
import { getTileUVTransform } from "../../textures/building_textures.js";


export default class HippedRoofBuilder implements RoofBuilder {
    params: RoofParams
    public build(params: RoofParams): RoofGeometry {
        const { multipolygon, flip } = params;
        this.params = params;
        const skeleton = multipolygon.getStraightSkeleton();

        if (!skeleton) {
            return null;
        }

        const maxSkeletonHeight = this.getSkeletonMaxHeight(skeleton);

        let height: number = params.height;
        let minHeight: number = params.minHeight;
        let facadeHeightOverride: number = null;

        if (params.angle !== null && params.angle !== undefined) {
            height = maxSkeletonHeight * Math.tan(MathUtils.degToRad(params.angle ?? 45));
            minHeight = params.buildingHeight - height;
            facadeHeightOverride = params.buildingHeight - height;
        }

        const { position, uv, skirt } = this.convertSkeletonToVertices({
            multipolygon,
            skeleton,
            minHeight,
            height,
            maxSkeletonHeight,
            flip,
            scaleX: params.scaleX,
            scaleY: params.scaleY
        });
        const normal = this.calculateNormals(position, flip);

        return {
            position: position,
            normal: normal,
            uv: uv,
            addSkirt: !!skirt,
            skirt,
            facadeHeightOverride
        };
    }

    protected getSkeletonMaxHeight(skeleton: StraightSkeletonResult): number {
        let maxHeight = 0;

        for (const polygon of skeleton.polygons) {
            const edgeLine: [Vec2, Vec2] = [polygon.edgeStart, polygon.edgeEnd];

            for (const vertex of polygon.vertices) {
                const dst = this.getVertexHeightFromEdge(vertex, edgeLine, 1, 1);

                maxHeight = Math.max(maxHeight, dst);
            }
        }

        return maxHeight;
    }

    protected convertSkeletonToVertices(
        {
            multipolygon,
            skeleton,
            minHeight,
            height,
            maxSkeletonHeight,
            flip,
            scaleX,
            scaleY
        }: {
            multipolygon: Tile3DMultipolygon;
            skeleton: StraightSkeletonResult;
            minHeight: number;
            height: number;
            maxSkeletonHeight: number;
            flip: boolean;
            scaleX: number;
            scaleY: number;
        }
    ): { position: number[]; uv: number[]; skirt?: RoofSkirt } {
        let positionResult: number[] = [];
        let uvResult: number[] = [];

        for (const polygon of skeleton.polygons) {
            const { position, uv } = this.convertSkeletonPolygonToVertices({
                polygon,
                minHeight,
                height,
                maxSkeletonHeight,
                scaleX,
                scaleY
            });

            if (flip) {
                position.reverse();
            }

            positionResult = positionResult.concat(position);
            uvResult = uvResult.concat(uv);
        }

        return { position: positionResult, uv: uvResult };
    }

    protected convertSkeletonPolygonToVertices(
        {
            polygon,
            minHeight,
            height,
            maxSkeletonHeight,
            scaleX,
            scaleY
        }: {
            polygon: StraightSkeletonResultPolygon;
            minHeight: number;
            height: number;
            maxSkeletonHeight: number;
            scaleX: number;
            scaleY: number;
        }
    ): { position: number[]; uv: number[] } {
        const polygonVertices: number[] = [];

        for (const vertex of polygon.vertices) {
            polygonVertices.push(vertex.x, vertex.y);
        }

        return this.triangulatePolygon(
            polygonVertices,
            minHeight,
            height,
            maxSkeletonHeight,
            [polygon.edgeStart, polygon.edgeEnd],
            scaleX,
            scaleY
        );
    }

    protected triangulatePolygon(
        flatVertices: number[],
        minHeight: number,
        height: number,
        maxSkeletonHeight: number,
        edgeLine: [Vec2, Vec2],
        uvScaleX: number,
        uvScaleY: number,
        dstModifier: (n: number) => number = (n: number): number => n
    ): { position: number[]; uv: number[] } {
        const position: number[] = [];
        const uvOut: number[] = [];

        const textureFrame = global.diffuseMapImages.getImageFrame(this.params.textureId)
        const atlasParams = getTileUVTransform(
            textureFrame.x,
            textureFrame.y,
        )

        const offX = atlasParams.offset.x
        const offY = atlasParams.offset.y
        const scX = atlasParams.scale.x
        const scY = atlasParams.scale.y

        const indices = earcut(flatVertices).reverse();

        const verts: Vert[] = [];
        for (let i = 0; i < flatVertices.length / 2; i++) {
            const x = flatVertices[2 * i], y = flatVertices[2 * i + 1];
            // hauteur interpolée

            const dst = signedDstToLine(new Vec2(x, y), edgeLine);
            const z = minHeight + height * dstModifier(dst / maxSkeletonHeight);

            // UV monde
            const uvWorldX = signedDstToLine(new Vec2(x, y), [
                edgeLine[1],
                Vec2.add(edgeLine[1], Vec2.rotateRight(Vec2.sub(edgeLine[0], edgeLine[1])))
            ]) / uvScaleX;
            const uvWorldY = (dst / Math.sin(Math.atan(maxSkeletonHeight / height))) / uvScaleY;

            verts.push({
                pos: new Vec3(x, y, z),
                uv: new Vec2(uvWorldX, uvWorldY),
                norm: new Vec3(0, 0, 1)
            });
        }

        for (let t = 0; t < indices.length; t += 3) {
            // récupère les 3 sommets
            const tri = [
                verts[indices[t + 0]],
                verts[indices[t + 1]],
                verts[indices[t + 2]]
            ];
            // calcule sa bbox UV
            let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
            tri.forEach(v => {
                uMin = Math.min(uMin, v.uv.x);
                uMax = Math.max(uMax, v.uv.x);
                vMin = Math.min(vMin, v.uv.y);
                vMax = Math.max(vMax, v.uv.y);
            });
            const u0 = Math.floor(uMin), u1 = Math.ceil(uMax);
            const v0 = Math.floor(vMin), v1 = Math.ceil(vMax);

            // clip/triangule dans chaque cellule
            for (let iu = u0; iu < u1; iu++) {
                for (let iv = v0; iv < v1; iv++) {
                    let cell = tri;
                    cell = clipRange(cell, 'x', iu, true, false);
                    cell = clipRange(cell, 'x', iu + 1, false, true);
                    cell = clipRange(cell, 'y', iv, true, false);
                    cell = clipRange(cell, 'y', iv + 1, false, true);
                    if (cell.length < 3) continue;

                    // translate UV→[0,1] et triangule local
                    const flat: number[] = [];
                    cell.forEach(v => flat.push(v.uv.x - iu, v.uv.y - iv));
                    const subTris = earcut(flat, null, 2);
                    if (!subTris.length) continue;

                    // pousse le résultat
                    for (const vi of subTris) {
                        const V = cell[vi];
                        // clamp local
                        let uLoc = V.uv.x - iu;
                        let vLoc = V.uv.y - iv;
                        // uLoc = Math.min(Math.max(uLoc, 0), 1);
                        // vLoc = Math.min(Math.max(vLoc, 0), 1);

                        // position
                        position.push(V.pos.x, V.pos.y, V.pos.z);
                        // UV atlas
                        uvOut.push(
                            offX + uLoc * scX,
                            offY + vLoc * scY
                        );
                    }
                }
            }
        }

        return { "position": position, "uv": uvOut };
    }

    private calculateNormals(vertices: number[], flip: boolean = false): number[] {
        const normals: number[] = [];

        for (let i = 0; i < vertices.length; i += 9) {
            const a = new Vec3(vertices[i], vertices[i + 1], vertices[i + 2]);
            const b = new Vec3(vertices[i + 3], vertices[i + 4], vertices[i + 5]);
            const c = new Vec3(vertices[i + 6], vertices[i + 7], vertices[i + 8]);

            const normal = flip ? calculateNormal(c, b, a) : calculateNormal(a, b, c);
            const normalArray = Vec3.toArray(normal);

            for (let j = i; j < i + 9; j++) {
                normals[j] = normalArray[j % 3];
            }
        }

        return normals;
    }

    protected getVertexHeightFromEdge(vertex: Vec2, edge: [Vec2, Vec2], skeletonHeight: number, roofHeight: number): number {
        const dst = signedDstToLine(vertex, edge);

        return dst / skeletonHeight * roofHeight;
    }
}
