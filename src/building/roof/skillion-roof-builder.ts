import { Box3, MathUtils, Vector3 } from "three";
import { RoofGeometry, RoofParams, RoofSkirt, RoofSkirtPolyline, RoofBuilder, clipRange, Vert } from "./type.js";
import Vec2 from "../../math/vector2.js";
import { calculateNormal, getRotationVectorsFromOMBB } from "./utils.js";
import Tile3DMultipolygon from "../tile3d-multipolygon.js";
import Vec3 from "../../math/vector3.js";
import earcut from 'earcut';
import { getTileUVTransform } from "../../textures/building_textures.js";
import { getImageFrame } from "../../textures/helper.js";



const temp_box = new Box3()
export default class SkillionRoofBuilder implements RoofBuilder {
    private getRoofHeightFromAngle(bbox: Box3, angle: number): number {

        return (bbox.max.y - bbox.min.y) * Math.tan(MathUtils.degToRad(angle));
    }

    private getRotation(params: RoofParams): number {
        if (params.direction !== null) {
            return -MathUtils.degToRad(params.direction) - Math.PI / 2;
        }

        const ombb = params.multipolygon.getOMBB();
        const ombbVectors = getRotationVectorsFromOMBB(ombb, params.orientation ?? 'along', null);

        return -Vec2.normalize(ombbVectors.rotVector0).getAngle() - Math.PI / 2;
    }

    private getRotatedMultipolygonAABB(multipolygon: Tile3DMultipolygon, rotation: number): Box3 {
        temp_box.makeEmpty()
        for (const ring of multipolygon.rings) {

            for (const node of ring.nodes) {
                const newNode = Vec2.rotate(new Vec2(node.y, node.x), rotation)
                temp_box.expandByPoint(new Vector3().set(
                    newNode.x,
                    newNode.y,
                    0
                ))
            }
        }

        return temp_box
    }

    public build(params: RoofParams): RoofGeometry {
        const { multipolygon } = params;
        const skirt: RoofSkirt = [];
        const rotation = this.getRotation(params);
        const bbox = this.getRotatedMultipolygonAABB(multipolygon, rotation);


        let facadeHeightOverride: number = null;
        let height = params.height;
        let minHeight = params.minHeight;
        if (params.angle !== null && params.angle !== undefined && params.angle !== 0) {
            height = this.getRoofHeightFromAngle(bbox, params.angle)

            minHeight = params.buildingHeight - height;
            facadeHeightOverride = params.buildingHeight - height;
        }

        const ombb = multipolygon.getOMBB();
        const origin2D = ombb[1]; // Vec2
        const v0 = Vec2.sub(ombb[0], origin2D);
        const v1 = Vec2.sub(ombb[2], origin2D);
        const angle = -Vec2.angleClockwise(new Vec2(1, 0), v0);
        const scale2D = params.isStretched
            ? new Vec2(Vec2.getLength(v0), Vec2.getLength(v1))
            : new Vec2(params.scaleX, params.scaleY);

        const bboxHeight = bbox.max.y - bbox.min.y;
        const uvScaleX = 1 / params.scaleX;
        const uvScaleY = 1 / Math.sin(Math.atan(bboxHeight / height)) / params.scaleY;

        const footprint = multipolygon.getFootprintWithHoles({
            height: 0,
            flip: false
        });
        const holeIndices: number[] = footprint.holeIndices; // indices dans footprint.uvs
        for (let i = 0; i < footprint.positions.length; i += 3) {
            const x = footprint.positions[i], y = footprint.positions[i + 1];
            const vec = Vec2.rotate(new Vec2(y, x), rotation);
            const zNorm = (vec.y - bbox.min.y) / (bbox.max.y - bbox.min.y);
            footprint.positions[i + 2] = minHeight + zNorm * height;
        }

        for (let i = 0; i < footprint.uvs.length; i += 2) {
            const x = footprint.uvs[i], y = footprint.uvs[i + 1];
            const vec = Vec2.rotate(new Vec2(y, x), rotation);
            footprint.uvs[i] = (vec.x - bbox.min.x) * uvScaleX;
            footprint.uvs[i + 1] = (vec.y - bbox.min.y) * uvScaleY;
        }


        const verts: Vert[] = [];
        const rawPos = footprint.positions;
        const rawUV = footprint.uvs;
        const rawNorms = footprint.normals;
        for (let i = 0; i < rawUV.length / 2; i++) {
            verts.push({
                uv: new Vec2(rawUV[2 * i], rawUV[2 * i + 1]),
                pos: new Vec3(rawPos[3 * i], rawPos[3 * i + 1], rawPos[3 * i + 2]),
                norm: new Vec3(rawNorms[3 * i], rawNorms[3 * i + 1], rawNorms[3 * i + 2])
            });
        }
        const flatUV = verts.flatMap(v => [v.uv.x, v.uv.y]);
        const triIdx = earcut(flatUV, null, 2);



        const textureFrame = getImageFrame(params.textureId)
        const atlasParams = getTileUVTransform(
            textureFrame.x,
            textureFrame.y,
        )

        const offX = atlasParams.offset.x
        const offY = atlasParams.offset.y
        const scX = atlasParams.scale.x
        const scY = atlasParams.scale.y

        const finalPos: number[] = [];
        const finalUV: number[] = [];
        const finalNorm: number[] = [];


        for (let t = 0; t < triIdx.length; t += 3) {
            const A = verts[triIdx[t + 0]];
            const B = verts[triIdx[t + 1]];
            const C = verts[triIdx[t + 2]];
            let poly = [A, B, C];

            // calcul bbox UV du triangle
            let uMin = Math.min(A.uv.x, B.uv.x, C.uv.x);
            let uMax = Math.max(A.uv.x, B.uv.x, C.uv.x);
            let vMin = Math.min(A.uv.y, B.uv.y, C.uv.y);
            let vMax = Math.max(A.uv.y, B.uv.y, C.uv.y);
            const u0 = Math.floor(uMin), u1 = Math.ceil(uMax);
            const v0 = Math.floor(vMin), v1 = Math.ceil(vMax);

            for (let iu = u0; iu < u1; iu++) {
                for (let iv = v0; iv < v1; iv++) {
                    let cell = poly;
                    cell = clipRange(cell, 'x', iu, true, false);
                    cell = clipRange(cell, 'x', iu + 1, false, true);
                    cell = clipRange(cell, 'y', iv, true, false);
                    cell = clipRange(cell, 'y', iv + 1, false, true);
                    if (cell.length < 3) continue;

                    const flat: number[] = [];
                    cell.forEach(v => flat.push(v.uv.x - iu, v.uv.y - iv));
                    const tris = earcut(flat, null, 2);
                    if (!tris.length) continue;

                    for (const vi of tris) {
                        const V = cell[vi];
                        let uLoc = V.uv.x - iu;
                        let vLoc = V.uv.y - iv;
                        uLoc = Math.min(Math.max(uLoc, 0), 1);
                        vLoc = Math.min(Math.max(vLoc, 0), 1);

                        finalPos.push(V.pos.x, V.pos.y, V.pos.z);
                        finalNorm.push(V.norm.x, V.norm.y, V.norm.z);

                        finalUV.push(
                            offX + uLoc * scX,
                            offY + vLoc * scY
                        );
                    }
                }
            }
        }

        for (const ring of multipolygon.rings) {
            const skirtPolyline: RoofSkirtPolyline = {
                points: [],
                hasWindows: true
            };
            skirt.push(skirtPolyline);

            for (const node of ring.nodes) {
                const vec = Vec2.rotate(new Vec2(node.y, node.x), rotation);
                const z = (vec.y - bbox.min.y) / (bbox.max.y - bbox.min.y);

                skirtPolyline.points.push({
                    position: node,
                    height: minHeight + z * height
                });
            }
        }

        const p0 = new Vec3(footprint.positions[0], footprint.positions[1], footprint.positions[2]);
        const p1 = new Vec3(footprint.positions[3], footprint.positions[4], footprint.positions[5]);
        const p2 = new Vec3(footprint.positions[6], footprint.positions[7], footprint.positions[8]);
        const normal = calculateNormal(p0, p1, p2);

        for (let i = 0; i < footprint.normals.length; i += 3) {
            footprint.normals[i] = normal.x;
            footprint.normals[i + 1] = normal.y;
            footprint.normals[i + 2] = normal.z;
        }

        return {
            addSkirt: true,
            skirt: skirt,
            facadeHeightOverride: facadeHeightOverride,
            position: finalPos,
            normal: finalNorm,
            uv: finalUV
        };
    }
}