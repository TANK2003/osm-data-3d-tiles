import Vec2 from "../../math/vector2.js";
import Vec3 from "../../math/vector3.js";
import { OMBBResult } from "../ombb-params.js";
import Tile3DMultipolygon from "../tile3d-multipolygon.js";

export interface RoofSkirtPoint {
    position: Vec2;
    height: number;
}
export type RoofSkirtPolyline = {
    points: RoofSkirtPoint[];
    hasWindows: boolean;
};
export type RoofSkirt = RoofSkirtPolyline[];

export interface RoofBuilder {
    build(params: RoofParams): RoofGeometry;
}

export interface RoofGeometry {
    addSkirt: boolean;
    skirt?: RoofSkirt;
    facadeHeightOverride?: number;
    position: number[];
    normal: number[];
    uv: number[];
    canExtendOutsideFootprint?: boolean;
}

export interface RoofParams {
    multipolygon: Tile3DMultipolygon;
    buildingHeight: number;
    minHeight: number;
    height: number;
    direction: number;
    angle: number;
    orientation: 'along' | 'across';
    flip: boolean;
    scaleX: number;
    scaleY: number;
    isStretched: boolean;
    textureId: number;
}

export interface Vert { uv: Vec2; pos: Vec3; norm: Vec3 }


export function clipRange(
    poly: Vert[],
    axis: 'x' | 'y',
    edge: number,
    keepGreater: boolean,
    strictUpper: boolean
): Vert[] {



    const isInside = (val: number) => {
        if (keepGreater) {
            return strictUpper ? val > edge : val >= edge;
        } else {
            return strictUpper ? val < edge : val <= edge;
        }
    };

    // ==== EARLY EXIT ====
    // Si TOUT le poly est déjà à l'intérieur, on renvoie la copie exacte
    if (poly.every(v => isInside(axis === 'x' ? v.uv.x : v.uv.y))) {
        // on clone juste pour ne pas muter l'original
        return poly.map(v => ({
            uv: Vec2.clone(v.uv),
            pos: Vec3.clone(v.pos),
            norm: Vec3.clone(v.norm)
        }));
    }

    // idem si TOUT est à l'extérieur, on renvoie vide
    if (poly.every(v => !isInside(axis === 'x' ? v.uv.x : v.uv.y))) {
        return [];
    }

    // sinon on fait le clipping habituel
    const out: Vert[] = [];
    for (let i = 0; i < poly.length; i++) {
        const A = poly[i], B = poly[(i + 1) % poly.length];
        const aVal = axis === 'x' ? A.uv.x : A.uv.y;
        const bVal = axis === 'x' ? B.uv.x : B.uv.y;
        const aIn = isInside(aVal);
        const bIn = isInside(bVal);

        const intersect = (): Vert => {
            const t = (edge - aVal) / (bVal - aVal);
            const tt = Math.max(0, Math.min(1, t));
            const uvI = new Vec2(
                axis === 'x' ? edge : A.uv.x + tt * (B.uv.x - A.uv.x),
                axis === 'y' ? edge : A.uv.y + tt * (B.uv.y - A.uv.y)
            );
            const posI = new Vec3(
                A.pos.x + tt * (B.pos.x - A.pos.x),
                A.pos.y + tt * (B.pos.y - A.pos.y),
                A.pos.z + tt * (B.pos.z - A.pos.z)
            );
            const normI = Vec3.normalize(new Vec3(
                A.norm.x + tt * (B.norm.x - A.norm.x),
                A.norm.y + tt * (B.norm.y - A.norm.y),
                A.norm.z + tt * (B.norm.z - A.norm.z)
            ));
            return { uv: uvI, pos: posI, norm: normI };
        };

        if (aIn && bIn) {
            out.push({ uv: Vec2.clone(B.uv), pos: Vec3.clone(B.pos), norm: Vec3.clone(B.norm) });
        } else if (aIn && !bIn) {
            out.push(intersect());
        } else if (!aIn && bIn) {
            out.push(intersect());
            out.push({ uv: Vec2.clone(B.uv), pos: Vec3.clone(B.pos), norm: Vec3.clone(B.norm) });
        }
    }




    return out;
}
