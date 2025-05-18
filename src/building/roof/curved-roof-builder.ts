import { MathUtils } from "three";
import polylabel from "polylabel";
import earcut from 'earcut';
import Vec2 from "../../math/vector2.js";
import Vec3 from "../../math/vector3.js";
import { Tile3DRingType } from "../tile-3d-ring.js";
import { clipRange, RoofBuilder, RoofGeometry, RoofParams, Vert } from "./type.js";
import { calculateSplitsNormals, signedDstToLine } from "./utils.js";
import { getPolygonCentroid, isPointInsidePolygon } from "../../math/utils.js";
import { getTileUVTransform } from "../../textures/building_textures.js";



export default abstract class CurvedRoofBuilder implements RoofBuilder {
    protected readonly abstract splits: Vec2[];
    protected readonly abstract isEdgy: boolean;
    private splitsNormals: Vec2[];

    public build(params: RoofParams): RoofGeometry {
        this.calculateSplitsNormals();

        const { multipolygon, minHeight, height, scaleX, scaleY } = params;

        const topHeight = minHeight + height;
        const outerRing = multipolygon.rings.find(ring => ring.type === Tile3DRingType.Outer);
        const ringVertices = outerRing.nodes.slice(0, -1);
        const center = this.getCenter(ringVertices);
        const polylines = this.splitPolygon(ringVertices);

        const positions: number[] = [];
        const normals: number[] = [];
        const uvs: number[] = [];

        for (const polyline of polylines) {
            const points = this.getRoofPartPoints(
                polyline,
                topHeight,
                minHeight,
                center
            );

            this.buildRoofPart(
                positions,
                normals,
                uvs,
                points,
                scaleX,
                scaleY,
                params.textureId
            );
        }

        return {
            position: positions,
            normal: normals,
            uv: uvs,
            addSkirt: false,
            canExtendOutsideFootprint: true
        };
    }

    private getRoofPartPoints(
        polyline: Vec2[],
        topHeight: number,
        minHeight: number,
        center: Vec2,
    ): { position: Vec3; normal: Vec3 }[][] {
        const isClosed = polyline[0].equals(polyline[polyline.length - 1]);
        const points: { position: Vec3; normal: Vec3 }[][] = [];

        for (let i = 0; i < polyline.length; i++) {
            const vertex = polyline[i];
            const pointsArray: { position: Vec3; normal: Vec3 }[] = [];

            const scaleX = topHeight - minHeight;
            const scaleY = Vec2.distance(vertex, center);

            let angle: number;

            if (!isClosed && i === 0) {
                const vertexNext = polyline[i + 1];
                const segment = Vec2.sub(vertex, vertexNext);
                angle = Vec2.angleClockwise(new Vec2(1, 0), segment);
            } else if (!isClosed && i === polyline.length - 1) {
                const vertexPrev = polyline[i - 1];
                const segment = Vec2.sub(vertexPrev, vertex);
                angle = Vec2.angleClockwise(new Vec2(1, 0), segment);
            } else {
                angle = Vec2.angleClockwise(new Vec2(0, 1), Vec2.sub(vertex, center));
            }

            for (let j = 0; j < this.splits.length; j++) {
                const split = Vec2.clone(this.splits[j]);
                const position2D = Vec2.lerp(center, vertex, split.y);
                const height = MathUtils.lerp(minHeight, topHeight, split.x);
                const position = new Vec3(position2D.x, position2D.y, height);

                const normalSource = Vec2.clone(this.splitsNormals[j]);
                const normalRotated = Vec3.rotateAroundAxis(
                    new Vec3(normalSource.y / scaleY, normalSource.x / scaleX, 0),
                    new Vec3(0, 0, 1),
                    -angle - Math.PI / 2
                );

                pointsArray.push({
                    position: position,
                    normal: Vec3.normalize(normalRotated)
                });
            }

            points.push(pointsArray);
        }

        return points;
    }

    private buildRoofPart(
        positionOut: number[],
        normalOut: number[],
        uvOut: number[],
        points: { position: Vec3; normal: Vec3 }[][],
        scaleX: number,
        scaleY: number,
        textureId: number
    ): void {

        const textureFrame = global.diffuseMapImages.getImageFrame(textureId)
        const atlasParams = getTileUVTransform(
            textureFrame.x,
            textureFrame.y,
        )

        const offX = atlasParams.offset.x
        const offY = atlasParams.offset.y
        const scX = atlasParams.scale.x
        const scY = atlasParams.scale.y

        const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
        function cloneVert(v: Vert) {
            return {
                uv: Vec2.clone(v.uv),
                pos: Vec3.clone(v.pos),
                norm: Vec3.clone(v.norm)
            };
        }
        function subdivideAndPush(tri: Vert[]) {
            // calcule bbox UV
            let uMin = Infinity, uMax = -Infinity;
            let vMin = Infinity, vMax = -Infinity;
            tri.forEach(v => {
                uMin = Math.min(uMin, v.uv.x);
                uMax = Math.max(uMax, v.uv.x);
                vMin = Math.min(vMin, v.uv.y);
                vMax = Math.max(vMax, v.uv.y);
            });
            const u0 = Math.floor(uMin), u1 = Math.ceil(uMax);
            const v0 = Math.floor(vMin), v1 = Math.ceil(vMax);

            for (let iu = u0; iu < u1; iu++) {
                for (let iv = v0; iv < v1; iv++) {
                    // clone tri pour ne pas polluer l’original
                    let cell: Vert[] = tri.slice().map(v => ({
                        uv: Vec2.clone(v.uv),
                        pos: Vec3.clone(v.pos),
                        norm: Vec3.clone(v.norm)
                    }));

                    // clip sur [iu, iu+1]
                    cell = clipRange(cell, 'x', iu, true, false);
                    cell = clipRange(cell, 'x', iu + 1, false, true);
                    cell = clipRange(cell, 'y', iv, true, false);
                    cell = clipRange(cell, 'y', iv + 1, false, true);
                    if (cell.length < 3) continue;

                    // translate UV dans [0,1]
                    const flat: number[] = [];
                    cell.forEach(v => flat.push(v.uv.x - iu, v.uv.y - iv));
                    const sub = earcut(flat, null, 2);
                    if (!sub.length) continue;

                    // émet chaque sous‐triangle
                    for (const vi of sub) {
                        const V = cloneVert(cell[vi]);
                        const uLoc = clamp01(V.uv.x - iu);
                        const vLoc = clamp01(V.uv.y - iv);
                        // position & normale
                        positionOut.push(V.pos.x, V.pos.y, V.pos.z);
                        normalOut.push(V.norm.x, V.norm.y, V.norm.z);
                        // UV atlas
                        uvOut.push(
                            offX + uLoc * scX,
                            offY + vLoc * scY
                        );
                    }
                }
            }

        }




        let uvProgX = 0;
        for (let i = 0; i < points.length - 1; i++) {
            const row0 = points[i], row1 = points[i + 1];
            const base00 = row0[0].position.xy, base10 = row1[0].position.xy;
            const segVec = Vec2.sub(base10, base00);
            const perp = [base00, Vec2.add(base00, Vec2.rotateRight(segVec))] as [Vec2, Vec2];

            let uvProgY = 0;
            for (let j = 0; j < row0.length - 1; j++) {
                const p0 = row0[j], p1 = row0[j + 1];
                const p2 = row1[j], p3 = row1[j + 1];

                // forme les deux triangles du quad
                const quads = [
                    [p0, p1, p2],
                    [p1, p3, p2]
                ] as [typeof p0, typeof p1, typeof p2][];

                const edgeUVs = [[0, 0], [1, 0], [0, 1]] as [number, number][];

                const quadY = Vec3.distance(p0.position, p1.position);

                for (const triPts of quads) {
                    // build tri Vert[3]
                    const tri: Vert[] = triPts.map((V, iV) => {
                        const uW = (uvProgX + edgeUVs[iV][0] * Vec2.getLength(segVec)) / scaleX;
                        const vW = (uvProgY + edgeUVs[iV][1] * quadY) / scaleY;
                        return {
                            pos: Vec3.clone(V.position),
                            norm: Vec3.clone(V.normal),
                            uv: new Vec2(uW, vW)
                        };
                    });
                    subdivideAndPush(tri);
                }

                uvProgY += quadY;
            }
            uvProgX += Vec2.getLength(segVec);
        }
    }

    private getCenter(ringVertices: Vec2[]): Vec2 {
        let center: Vec2 = getPolygonCentroid(ringVertices);

        if (isPointInsidePolygon(center, ringVertices)) {
            return center;
        }

        const array = ringVertices.map(v => [v.x, v.y]);
        const result = polylabel([array], 1);

        return new Vec2(result[0], result[1]);
    }

    private getPolygonSplitFlags(points: Vec2[]): boolean[] {
        const splitFlags: boolean[] = [];

        for (let i = 0; i < points.length; i++) {
            if (this.isEdgy) {
                splitFlags.push(true);
                continue;
            }

            const point = points[i];
            const prev = points[i - 1] ?? points[points.length - 1];
            const next = points[i + 1] ?? points[0];

            const vecToPrev = Vec2.normalize(Vec2.sub(point, prev));
            const vecToNext = Vec2.normalize(Vec2.sub(next, point));

            const dot = Vec2.dot(vecToPrev, vecToNext);

            splitFlags.push(dot < Math.cos(MathUtils.degToRad(40)));
        }

        return splitFlags;
    }

    private splitPolygon(points: Vec2[]): Vec2[][] {
        const splitFlags = this.getPolygonSplitFlags(points);
        const firstSplitIndex = splitFlags.findIndex(f => f);

        if (firstSplitIndex !== -1) {
            for (let i = 0; i < firstSplitIndex; i++) {
                points.push(points.shift());
                splitFlags.push(splitFlags.shift());
            }
        }

        let currentPolyline: Vec2[] = [points[0]];
        const polylines: Vec2[][] = [];

        for (let i = 1; i < points.length + 1; i++) {
            const point = points[i] ?? points[0];
            const split = splitFlags[i] ?? splitFlags[0];

            currentPolyline.push(point);

            if (split || i === points.length) {
                polylines.push(currentPolyline);
                currentPolyline = [point];
            }
        }

        return polylines;
    }

    private calculateSplitsNormals(): void {
        this.splitsNormals = calculateSplitsNormals(this.splits);
    }
}