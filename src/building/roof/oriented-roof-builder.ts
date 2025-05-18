import { MathUtils } from "three";
import Vec2 from "../../math/vector2.js";
import Vec3 from "../../math/vector3.js";
import { clipRange, RoofBuilder, RoofGeometry, RoofParams, RoofSkirt, RoofSkirtPolyline, Vert } from "./type.js";
import { splitPolygon, calculateRoofNormals, getIntersectionLineLine, getPointProgressAlongLineSegment, getRotationVectorsFromOMBB, signedDstToLine, calculateSplitsNormals } from "./utils.js";
import Tile3DMultipolygon from "../tile3d-multipolygon.js";
import earcut from 'earcut';
import { getTileUVTransform } from "../../textures/building_textures.js";
interface RoofSlice {
    vertices: [number, number][];
    heightFrom: number;
    heightTo: number;
    length: number;
    line: [Vec2, Vec2];
    uvYFrom: number;
    uvYTo: number;
    flipUV: boolean;
    normalFrom: Vec3;
    normalTo: Vec3;
}

export default abstract class OrientedRoofBuilder implements RoofBuilder {
    protected abstract splits: Vec2[];
    protected abstract isSmooth: boolean;
    protected abstract respectDirection: boolean;
    private splitsNormals: Vec2[];
    params: RoofParams

    public build(params: RoofParams): RoofGeometry {
        this.calculateSplitsNormals();
        this.params = params;

        const { orientation, multipolygon, minHeight, height } = params;
        const ombb = params.multipolygon.getOMBB();

        const { rotVector0, rotVector1, origin } = getRotationVectorsFromOMBB(
            ombb,
            orientation,
            this.respectDirection ? params.direction : null
        );

        const rayOrigin = Vec2.sub(Vec2.add(origin, Vec2.multiplyScalar(rotVector0, 0.5)), rotVector1);
        const verticalLine: [Vec2, Vec2] = [rayOrigin, Vec2.add(rayOrigin, rotVector0)];

        const footprint = multipolygon.getFootprint({
            height: 0,
            flip: false
        });

        const positions: number[] = [];
        const uvs: number[] = [];
        const normals: number[] = [];

        for (let i = 0; i < footprint.positions.length; i += 9) {
            const vertices = footprint.positions;
            const triangle: [number, number][] = [
                [vertices[i], vertices[i + 1]],
                [vertices[i + 3], vertices[i + 4]],
                [vertices[i + 6], vertices[i + 7]]
            ];


            const rings = this.processTriangle(triangle, origin, rotVector0, rotVector1, height);

            for (const ring of rings) {
                this.processRoofRing(
                    ring,
                    minHeight + height * ring.heightFrom,
                    height * (ring.heightTo - ring.heightFrom),
                    verticalLine,
                    params.scaleX,
                    params.scaleY,
                    positions,
                    uvs,
                    normals
                );
            }
        }

        if (!this.isSmooth) {
            const flatNormals = calculateRoofNormals(positions);
            normals.push(...flatNormals);
        }

        const skirt = this.getSkirt({
            multipolygon,
            minHeight,
            height,
            origin: origin,
            rotVector0,
            rotVector1
        });

        return {
            position: positions,
            normal: normals,
            uv: uvs,
            skirt: skirt,
            addSkirt: true,
            canExtendOutsideFootprint: true
        };
    }

    private processTriangle(
        triangle: [number, number][],
        origin: Vec2,
        rotVector0: Vec2,
        rotVector1: Vec2,
        height: number
    ): RoofSlice[] {
        const slices: RoofSlice[] = [];
        let uvY = 0;

        for (let i = 1; i < this.splits.length; i++) {
            const split = this.splits[i];
            const prevSplit = this.splits[i - 1];
            const rayOrigin = Vec2.sub(
                Vec2.add(
                    origin,
                    Vec2.multiplyScalar(rotVector0, split.x)
                ),
                rotVector1
            );
            const rayEnd = Vec2.add(rayOrigin, Vec2.multiplyScalar(rotVector1, 3));
            const splitLine: [Vec2, Vec2] = [rayOrigin, rayEnd];
            const roofLength = Vec2.getLength(rotVector0);

            const uvYStep = Vec2.distance(
                new Vec2(prevSplit.x * roofLength, prevSplit.y * height),
                new Vec2(split.x * roofLength, split.y * height),
            );
            const uvYNext = uvY + uvYStep;
            const isUVReversed = split.y < prevSplit.y;

            const normalFrom2D = this.splitsNormals[i - 1];
            const normalTo2D = this.splitsNormals[i];

            const scaleX = roofLength;
            const scaleY = height;
            const angle = Vec2.angleClockwise(new Vec2(0, 1), rotVector1);

            const normalFromRotated = Vec3.rotateAroundAxis(
                new Vec3(normalFrom2D.x / scaleX, 0, normalFrom2D.y / scaleY),
                new Vec3(0, 0, 1),
                -angle - Math.PI
            );
            const normalToRotated = Vec3.rotateAroundAxis(
                new Vec3(normalTo2D.x / scaleX, 0, normalTo2D.y / scaleY),
                new Vec3(0, 0, 1),
                -angle - Math.PI
            );

            if (i === this.splits.length - 1) {
                slices.push({
                    vertices: triangle,
                    line: splitLine,
                    heightFrom: prevSplit.y,
                    heightTo: split.y,
                    length: (split.x - prevSplit.x) * Vec2.getLength(rotVector0),
                    uvYFrom: uvY,
                    uvYTo: uvYNext,
                    flipUV: isUVReversed,
                    normalFrom: Vec3.normalize(normalFromRotated),
                    normalTo: Vec3.normalize(normalToRotated),
                });

                break;
            }

            const result = this.splitTriangle(triangle, splitLine);

            if (result.verticesBottom.length > 0) {
                slices.push({
                    vertices: result.verticesBottom,
                    line: splitLine,
                    heightFrom: prevSplit.y,
                    heightTo: split.y,
                    length: (split.x - prevSplit.x) * Vec2.getLength(rotVector0),
                    uvYFrom: uvY,
                    uvYTo: uvYNext,
                    flipUV: isUVReversed,
                    normalFrom: Vec3.normalize(normalFromRotated),
                    normalTo: Vec3.normalize(normalToRotated),
                });
            }

            uvY = uvYNext;

            if (result.verticesTop.length > 0) {
                triangle = result.verticesTop;
            } else {
                break;
            }
        }

        return slices;
    }

    private getSplitLine(
        split: Vec2,
        origin: Vec2,
        rotVector0: Vec2,
        rotVector1: Vec2,
    ): [Vec2, Vec2] {
        const rayOrigin = Vec2.sub(
            Vec2.add(
                origin,
                Vec2.multiplyScalar(rotVector0, split.x)
            ),
            rotVector1
        );
        const rayEnd = Vec2.add(rayOrigin, Vec2.multiplyScalar(rotVector1, 3));

        return [rayOrigin, rayEnd];
    }

    private processRoofRing(
        ring: RoofSlice,
        minHeight: number,
        height: number,
        verticalLine: [Vec2, Vec2],
        scaleX: number,
        scaleY: number,
        positionsOut: number[],
        uvsOut: number[],
        normalsOut: number[]
    ): void {
        if (!ring.length) {
            return;
        }
        const textureFrame = global.diffuseMapImages.getImageFrame(this.params.textureId)
        const atlasParams = getTileUVTransform(
            textureFrame.x,
            textureFrame.y,
        )

        const offX = atlasParams.offset.x
        const offY = atlasParams.offset.y
        const scX = atlasParams.scale.x
        const scY = atlasParams.scale.y

        const lerpVec3 = (a: Vec3, b: Vec3, t: number) =>
            new Vec3(
                a.x + (b.x - a.x) * t,
                a.y + (b.y - a.y) * t,
                a.z + (b.z - a.z) * t
            );
        const baseVerts: Vert[] = [];
        for (let j = 2; j < ring.vertices.length; j++) {
            const triIdx = [0, j - 1, j];
            for (const idx of triIdx) {
                const [x, y] = ring.vertices[idx];
                const nodeVec = new Vec2(x, y);
                const nodeDst = signedDstToLine(nodeVec, ring.line);
                const alpha = 1 - Math.abs(nodeDst) / ring.length;
                const z = minHeight + alpha * height;

                // UV monde avant subdivision
                let uW = signedDstToLine(nodeVec, verticalLine) / scaleX;
                let vW = MathUtils.lerp(ring.uvYFrom, ring.uvYTo, alpha) / scaleY;
                if (ring.flipUV) { uW = -uW; vW = -vW; }

                // Normale
                const n = this.isSmooth
                    ? lerpVec3(ring.normalFrom, ring.normalTo, alpha).normalize()
                    : Vec3.clone(ring.normalFrom);

                baseVerts.push({
                    pos: new Vec3(x, y, z),
                    uv: new Vec2(uW, vW),
                    norm: n
                });
            }
        }

        const flatUV = baseVerts.flatMap(v => [v.uv.x, v.uv.y]);
        const tris = earcut(flatUV, null, 2);
        for (let i = 0; i < tris.length; i += 3) {
            let poly = [
                baseVerts[tris[i + 0]],
                baseVerts[tris[i + 1]],
                baseVerts[tris[i + 2]]
            ];

            // bbox UV
            let uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
            poly.forEach(v => {
                uMin = Math.min(uMin, v.uv.x); uMax = Math.max(uMax, v.uv.x);
                vMin = Math.min(vMin, v.uv.y); vMax = Math.max(vMax, v.uv.y);
            });
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

                    // triangule local
                    const flat: number[] = [];
                    cell.forEach(v => flat.push(v.uv.x - iu, v.uv.y - iv));
                    const sub = earcut(flat, null, 2);
                    if (!sub.length) continue;

                    // push résultat
                    for (const vi of sub) {
                        const V = cell[vi];
                        let uLoc = V.uv.x - iu, vLoc = V.uv.y - iv;
                        uLoc = Math.min(Math.max(uLoc, 0), 1);
                        vLoc = Math.min(Math.max(vLoc, 0), 1);

                        // position
                        positionsOut.push(V.pos.x, V.pos.y, V.pos.z);
                        // UV atlas
                        uvsOut.push(
                            offX + uLoc * scX,
                            offY + vLoc * scY
                        );
                        // normale
                        normalsOut.push(V.norm.x, V.norm.y, V.norm.z);
                    }
                }
            }
        }



    }

    private splitTriangle(triangle: [number, number][], line: [Vec2, Vec2]): {
        verticesTop: [number, number][];
        verticesBottom: [number, number][];
    } {
        const verticesToSplit: [number, number][] = triangle;

        const verticesTop: [number, number][] = [];
        const verticesBottom: [number, number][] = [];
        let split: [number, number][][] = null;

        try {
            split = splitPolygon(
                verticesToSplit,
                Vec2.toArray(line[0]),
                Vec2.toArray(Vec2.sub(line[0], line[1]))
            );
        } catch (e) {

        }

        if (!split || split.length === 1) {
            verticesTop.push(...verticesToSplit);
        } else if (split.length > 1) {
            verticesTop.push(...split[1]);
            verticesBottom.push(...split[0]);
        }

        const bottomMaxDst = this.getSplitRingMaxDstToLine(verticesBottom, line);
        const topMaxDst = this.getSplitRingMaxDstToLine(verticesTop, line);

        const reverseRings = (verticesBottom.length !== 0 && bottomMaxDst > 0.0001) ||
            (verticesTop.length !== 0 && topMaxDst < 0.0001);

        return {
            verticesTop: reverseRings ? verticesBottom : verticesTop,
            verticesBottom: reverseRings ? verticesTop : verticesBottom
        };
    }

    private getSplitRingMaxDstToLine(ring: [number, number][], line: [Vec2, Vec2]): number {
        let maxDst: number = -Infinity;

        for (let j = 0; j < ring.length; j++) {
            const [x, y] = ring[j];
            const dst = signedDstToLine(new Vec2(x, y), line);

            if (dst > maxDst) {
                maxDst = dst;
            }
        }

        return maxDst;
    }

    private getSkirt(
        {
            multipolygon,
            minHeight,
            height,
            origin,
            rotVector0,
            rotVector1
        }: {
            multipolygon: Tile3DMultipolygon;
            minHeight: number;
            height: number;
            origin: Vec2;
            rotVector0: Vec2;
            rotVector1: Vec2;
        }
    ): RoofSkirt {
        const skirt: RoofSkirt = [];

        for (const ring of multipolygon.rings) {
            const skirtPolyline: RoofSkirtPolyline = {
                points: [],
                hasWindows: false
            };
            skirt.push(skirtPolyline);

            for (let i = 0; i < ring.nodes.length; i++) {
                const node = ring.nodes[i];
                const nextNode = ring.nodes[i + 1];
                const heightNormalized = this.getPointHeight(node, origin, rotVector0, rotVector1);

                skirtPolyline.points.push({
                    position: node,
                    height: minHeight + height * Math.abs(heightNormalized)
                });

                if (!nextNode) {
                    continue;
                }

                const intersectionPoints: { position: Vec2; progress: number }[] = [];

                for (let j = 1; j < this.splits.length - 1; j++) {
                    const line = this.getSplitLine(
                        this.splits[j],
                        origin,
                        rotVector0,
                        rotVector1
                    );

                    const intersection = getIntersectionLineLine(
                        [node.x, node.y],
                        [nextNode.x, nextNode.y],
                        [line[0].x, line[0].y],
                        [line[1].x, line[1].y]
                    );

                    if (!intersection) {
                        continue;
                    }

                    const position = new Vec2(intersection[0], intersection[1]);
                    const progress = getPointProgressAlongLineSegment(node, nextNode, position);

                    intersectionPoints.push({
                        position,
                        progress
                    });
                }

                intersectionPoints.sort((a, b) => a.progress - b.progress);

                for (const { position } of intersectionPoints) {
                    const heightNormalized = this.getPointHeight(position, origin, rotVector0, rotVector1);

                    skirtPolyline.points.push({
                        position: position,
                        height: minHeight + height * Math.abs(heightNormalized)
                    });
                }
            }
        }

        return skirt;
    }

    private getPointHeight(
        point: Vec2,
        origin: Vec2,
        rotVector0: Vec2,
        rotVector1: Vec2,
    ): number {
        const split: [Vec2, Vec2] = [origin, Vec2.add(origin, rotVector1)];

        const nodeDst = signedDstToLine(point, split) / Vec2.getLength(rotVector0);

        for (let i = 1; i < this.splits.length; i++) {
            if (nodeDst < this.splits[i].x || i === this.splits.length - 1) {
                const from = this.splits[i - 1];
                const to = this.splits[i];

                return MathUtils.lerp(from.y, to.y, (nodeDst - from.x) / (to.x - from.x));
            }
        }

        return 0;
    }

    private calculateSplitsNormals(): void {
        this.splitsNormals = calculateSplitsNormals(this.splits);
    }
}