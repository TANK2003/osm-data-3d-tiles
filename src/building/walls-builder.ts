import { MathUtils, Vector2, Vector3 } from "three";
import { calculateNormal } from "./roof/utils.js";
import Vec2 from "../math/vector2.js";
import Vec3 from "../math/vector3.js";
import { getTileUVTransform } from "../textures/building_textures.js";

const BuildingSmoothNormalsThreshold = 30

export default class WallsBuilder {
    public static build(
        {
            vertices,
            minHeight,
            height,
            heightPoints,
            levels,
            windowWidth,
            textureIdWindow,
            textureIdWall,
            uvOffset = new Vec2(0, 0)
        }: {
            vertices: Vec2[];
            minHeight: number;
            height: number;
            heightPoints?: number[];
            levels: number;
            windowWidth: number;
            textureIdWindow: number;
            textureIdWall: number;
            uvOffset?: Vec2;
        }
    ): { position: number[]; uv: number[]; normal: number[]; textureId: number[] } {


        let isClosed = false

        if (vertices[0].equals(vertices[vertices.length - 1])) {
            vertices = vertices.slice(1);
            isClosed = true;

            if (heightPoints) {
                heightPoints = heightPoints.slice(1);
            }
        }

        const edgeSmoothness = this.getEdgeSmoothness(vertices, isClosed);

        const firstNonSmoothEdgeIndex = edgeSmoothness.findIndex((smoothness) => !smoothness);

        if (firstNonSmoothEdgeIndex > 0) {
            for (let i = 0; i < firstNonSmoothEdgeIndex; i++) {
                edgeSmoothness.push(edgeSmoothness.shift());
                vertices.push(vertices.shift());

                if (heightPoints) {
                    heightPoints.push(heightPoints.shift());
                }
            }
        }
        const segmentNormals = this.getSegmentsNormals(vertices, isClosed)
        const rawWalls = this.getWalls(vertices, isClosed, edgeSmoothness, windowWidth)
        const wallUVSegments = this.getWallsUVSegments(rawWalls);


        const positions: number[] = []
        const uvs: number[] = []
        const normals: number[] = []
        const textureIds: number[] = []

        wallUVSegments.forEach(([segIdx, u0, u1, hasWindow]) => {
            const A = vertices[segIdx];
            const B = this.getNextVertex(segIdx, vertices, isClosed)!;
            const texId = hasWindow ? textureIdWindow : textureIdWall;
            const textureFrame = global.diffuseMapImages.getImageFrame(texId)
            const atlasParams = getTileUVTransform(
                textureFrame.x,
                textureFrame.y
            )
            const offX = atlasParams.offset.x
            const offY = atlasParams.offset.y
            const scX = atlasParams.scale.x
            const scY = atlasParams.scale.y

            // segment vectoriel
            const segVec = Vec2.sub(B, A);
            const segLen = Vec2.getLength(segVec);
            const dir = Vec2.normalize(segVec);

            // bornes UV globales pour ce segment
            const [rawStart, rawEnd] = rawWalls[segIdx];
            const totalU = rawEnd - rawStart;
            const uvToWS = segLen / totalU;    // conversion UV→world-space

            // world-space offset & largeur
            const offsetWS = (u0 - rawStart) * uvToWS;
            const widthWS = (u1 - u0) * uvToWS;

            // hauteurs interpolées
            let zAraw: number, zBraw: number
            if (heightPoints) {

                zAraw = heightPoints[segIdx] - minHeight
                zBraw = (heightPoints[segIdx + 1] ?? heightPoints[0]) - minHeight
            } else {
                zAraw = height - minHeight
                zBraw = height - minHeight
            }

            const zBase = minHeight;

            const P0 = Vec2.add(A, Vec2.multiplyScalar(dir, offsetWS));
            const P1 = Vec2.add(A, Vec2.multiplyScalar(dir, offsetWS + widthWS));

            const a0 = offsetWS / segLen;
            const a1 = (offsetWS + widthWS) / segLen;
            const h0 = zAraw + (zBraw - zAraw) * a0;
            const h1 = zAraw + (zBraw - zAraw) * a1;

            // fractions UV horizontales
            let f0 = ((u0 % 1) + 1) % 1;
            let f1 = ((u1 % 1) + 1) % 1;
            if (f1 === 0) f1 = 1;
            const U0 = uvOffset.x + offX + f0 * scX;
            const U1 = uvOffset.x + offX + f1 * scX;

            // 8) Répétition VERTICALE
            for (let iy = 0; iy < levels; iy++) {
                // position UV verticale dans la tuile
                const v0 = iy / levels;
                let v1 = (iy + 1) / levels;
                if (levels < 1) {
                    v1 = 1;
                }
                const uvV0 = uvOffset.y + offY + 0 * scY;
                const uvV1 = uvOffset.y + offY + 1 * scY;

                // hauteurs pour cette tranche
                const y0b = zBase + h0 * v0;   // bas‐gauche
                const y1b = zBase + h1 * v0;   // bas‐droit
                const y0t = zBase + h0 * v1;   // haut‐gauche
                const y1t = zBase + h1 * v1;   // haut‐droit

                // 2 triangles CCW
                positions.push(
                    P1.x, P1.y, y1b,
                    P0.x, P0.y, y0b,
                    P0.x, P0.y, y0t
                );
                positions.push(
                    P1.x, P1.y, y1b,
                    P0.x, P0.y, y0t,
                    P1.x, P1.y, y1t
                );

                // UV correspondantes
                uvs.push(
                    U1, uvV0,
                    U0, uvV0,
                    U0, uvV1,

                    U1, uvV0,
                    U0, uvV1,
                    U1, uvV1
                );

                // normales + textureId
                const n = Vec3.normalize(segmentNormals[segIdx]);
                for (let k = 0; k < 6; k++) {
                    normals.push(n.x, n.y, n.z);
                    textureIds.push(texId);
                }
            }
        });

        return {
            position: positions,
            uv: uvs,
            normal: normals,
            textureId: textureIds
        }
    }

    private static getNextVertex(vertexIndex: number, vertices: Vec2[], isClosed: boolean): Vec2 | null {
        const index = vertexIndex + 1;

        if (index > vertices.length - 1) {
            if (isClosed) {
                return vertices[0];
            } else {
                return null;
            }
        }

        return vertices[index];
    }

    private static getPreviousVertex(vertexIndex: number, vertices: Vec2[], isClosed: boolean): Vec2 | null {
        const index = vertexIndex - 1;

        if (index < 0) {
            if (isClosed) {
                return vertices[vertices.length - 1];
            } else {
                return null;
            }
        }

        return vertices[index];
    }

    private static getEdgeSmoothness(vertices: Vec2[], isClosed: boolean): boolean[] {
        const edgeSmoothness: boolean[] = [];

        for (let i = 0; i < vertices.length; i++) {
            const vertex = vertices[i];
            const nextVertex = this.getNextVertex(i, vertices, isClosed);
            const prevVertex = this.getPreviousVertex(i, vertices, isClosed);

            if (!nextVertex || !prevVertex) {
                edgeSmoothness.push(false);
                continue;
            }

            const segmentVector = Vec2.normalize(Vec2.sub(nextVertex, vertex));
            const prevSegmentVector = Vec2.normalize(Vec2.sub(vertex, prevVertex));
            const dotProduct = Vec2.dot(segmentVector, prevSegmentVector);


            edgeSmoothness.push(dotProduct > Math.cos(MathUtils.degToRad(BuildingSmoothNormalsThreshold)));
        }

        return edgeSmoothness;
    }


    private static getWallsUVSegments(
        raw: [number, number, boolean][],
    ): Array<[number, number, number, boolean]> {
        const out: Array<[number, number, number, boolean]> = [];

        raw.forEach(([u0, u1, hasWindow], segIdx) => {
            // calcul des frontières entières entre u0 et u1
            const start = u0;
            const end = u1;
            const ceil0 = Math.ceil(start);
            const floor1 = Math.floor(end);

            // on construit le tableau des cuts : [u0, ceil(u0), ..., floor(u1), u1]
            const cuts: number[] = [start];
            for (let b = ceil0; b <= floor1; b++) cuts.push(b);
            if (cuts[cuts.length - 1] !== end) cuts.push(end);

            // on génère un sous-segment par intervalle consécutif
            for (let k = 0; k < cuts.length - 1; k++) {
                const sub0 = cuts[k];
                const sub1 = cuts[k + 1];
                out.push([segIdx, sub0, sub1, hasWindow]);
            }
        });

        return out;
    }

    private static getWalls(
        vertices: Vec2[],
        isClosed: boolean,
        edgeSmoothness: boolean[],
        windowWidth: number
    )
    // : [number, number, boolean][]
    {
        const uvProgress: [number, number][] = [];
        const segmentCount = isClosed ? vertices.length : (vertices.length - 1);
        let currentProgress = 0;

        for (let i = 0; i < segmentCount; i++) {
            const vertex = vertices[i];
            const nextVertex = this.getNextVertex(i, vertices, isClosed);

            if (!nextVertex) break;

            const segmentLength = Vec2.getLength(Vec2.sub(nextVertex, vertex));

            const isNextVertexSmooth = edgeSmoothness[i + 1] ?? edgeSmoothness[0];

            uvProgress.push([currentProgress, currentProgress + segmentLength]);

            if (!isNextVertexSmooth) {
                currentProgress = 0;
            } else {
                currentProgress += segmentLength
            }
        }

        const processedWalls: [number, number, boolean][] = [];
        let currentWall: [number, number, boolean][] = [];
        let windowsProgress: number = 0;

        for (let i = 0; i < uvProgress.length; i++) {
            const segment = uvProgress[i];
            const nextSegment = uvProgress[i + 1];

            currentWall.push([segment[0], segment[1], false]);

            if (!nextSegment || nextSegment[0] === 0) {
                const wallLength = currentWall[currentWall.length - 1][1];
                const windowCount = Math.round(wallLength / windowWidth);
                const actualWindowWidth = wallLength / windowCount;

                if (windowCount > 0) {
                    for (const segment of currentWall) {
                        segment[0] /= actualWindowWidth;
                        segment[1] /= actualWindowWidth;
                        segment[2] = true;
                    }
                } else {
                    for (const segment of currentWall) {
                        segment[0] /= windowWidth;
                        segment[1] /= windowWidth;
                        segment[2] = false;
                    }
                }

                for (const segment of currentWall) {
                    segment[0] += windowsProgress;
                    segment[1] += windowsProgress;
                }

                processedWalls.push(...currentWall);
                currentWall = [];

                windowsProgress += windowCount;
                windowsProgress = Math.floor(windowsProgress);
            }
        }

        return processedWalls;
    }

    private static getSegmentsNormals(vertices: Vec2[], isClosed: boolean): Vec3[] {
        const normals: Vec3[] = [];
        const segmentCount = isClosed ? vertices.length : (vertices.length - 1);

        for (let i = 0; i < segmentCount; i++) {
            const vertex = vertices[i];
            const nextVertex = this.getNextVertex(i, vertices, isClosed);
            const segmentLength = Vec2.distance(vertex, nextVertex);

            // const normal = calculateNormal(
            //     new Vec3(nextVertex.x, 0, nextVertex.y),
            //     new Vec3(vertex.x, 0, vertex.y),
            //     new Vec3(vertex.x, 1, vertex.y),
            // );
            const normal = calculateNormal(
                new Vec3(vertex.x, 0, vertex.y),
                new Vec3(nextVertex.x, 0, nextVertex.y),
                new Vec3(vertex.x, 1, vertex.y),
            );

            normals.push(Vec3.multiplyScalar(normal, segmentLength));
        }

        return normals;
    }

    private static getNextSegmentNormal(segmentIndex: number, segmentNormals: Vec3[], isClosed: boolean): Vec3 | null {
        const index = segmentIndex + 1;

        if (index > segmentNormals.length - 1) {
            if (isClosed) {
                return segmentNormals[0];
            } else {
                return null;
            }
        }

        return segmentNormals[index];
    }

    private static getPreviousSegmentNormal(segmentIndex: number, segmentNormals: Vec3[], isClosed: boolean): Vec3 | null {
        const index = segmentIndex - 1;

        if (index < 0) {
            if (isClosed) {
                return segmentNormals[segmentNormals.length - 1];
            } else {
                return null;
            }
        }

        return segmentNormals[index];
    }

    private static getWallNormals(segmentNormals: Vec3[], edgeSmoothness: boolean[], isClosed: boolean): number[] {
        const normals: number[] = [];

        for (let i = 0; i < segmentNormals.length; i++) {
            const normal = segmentNormals[i];
            const normalNormalized = segmentNormals[i].normalize()

            const nextNormal = this.getNextSegmentNormal(i, segmentNormals, isClosed) ?? normal;
            const prevNormal = this.getPreviousSegmentNormal(i, segmentNormals, isClosed) ?? normal;

            const isSmooth: [boolean, boolean] = [
                edgeSmoothness[i],
                i === edgeSmoothness.length - 1 ? edgeSmoothness[0] : edgeSmoothness[i + 1]
            ];

            const vertexSides: number[] = [1, 0, 0, 1, 0, 1];

            for (let j = 0; j < 6; j++) {
                const side = vertexSides[j];

                if (isSmooth[side]) {
                    const neighborNormal = side === 1 ? nextNormal : prevNormal;

                    normals.push(...Vec3.toArray(Vec3.normalize(Vec3.add(normal, neighborNormal))));
                } else {
                    normals.push(normalNormalized.x, normalNormalized.y, normalNormalized.z);
                }
            }
        }

        return normals;
    }

    private static getWallPositions(
        vertices: Vec2[],
        isClosed: boolean,
        minHeight: number,
        height: number,
        heightPoints?: number[]
    ): number[] {
        const positions: number[] = [];

        const segmentCount = isClosed ? vertices.length : (vertices.length - 1);

        for (let i = 0; i < segmentCount; i++) {
            const vertex = vertices[i];
            const nextVertex = this.getNextVertex(i, vertices, isClosed);


            let vertexHeight: number;
            let nextVertexHeight: number;

            if (heightPoints) {
                vertexHeight = heightPoints[i];
                nextVertexHeight = heightPoints[i + 1] ?? heightPoints[0];
            } else {
                vertexHeight = height;
                nextVertexHeight = height;
            }

            positions.push(nextVertex.x, nextVertex.y, minHeight);
            positions.push(vertex.x, vertex.y, minHeight);
            positions.push(vertex.x, vertex.y, vertexHeight);

            positions.push(nextVertex.x, nextVertex.y, minHeight);
            positions.push(vertex.x, vertex.y, vertexHeight);
            positions.push(nextVertex.x, nextVertex.y, nextVertexHeight);
        }

        return positions;
    }

    private static getWallUVsAndTextureIds(
        {
            vertices,
            isClosed,
            height,
            minHeight,
            heightPoints,
            levels,
            textureIdWall,
            textureIdWindow,
            walls,
            uvOffset
        }: {
            vertices: Vec2[];
            isClosed: boolean;
            height: number;
            minHeight: number;
            heightPoints?: number[];
            levels: number;
            textureIdWall: number;
            textureIdWindow: number;
            walls: [number, number, boolean][];
            uvOffset: Vec2;
        }
    ): {
        uvs: number[];
        textureIds: number[];
    } {


        const uvs: number[] = [];
        const textureIds: number[] = [];
        const segmentCount = isClosed ? vertices.length : (vertices.length - 1);

        for (let i = 0; i < segmentCount; i++) {
            let vertexHeight: number;
            let nextVertexHeight: number;

            if (heightPoints) {
                vertexHeight = heightPoints[i];
                nextVertexHeight = heightPoints[i + 1] ?? heightPoints[0];
            } else {
                vertexHeight = height;
                nextVertexHeight = height;
            }

            vertexHeight -= minHeight;
            nextVertexHeight -= minHeight;


            let [uvXMin, uvXMax, hasWindow] = walls[i];
            const textureId = hasWindow ? textureIdWindow : textureIdWall;

            let uvMax0 = Math.max(nextVertexHeight, vertexHeight) / (height - minHeight) * levels;
            let uvMax1 = uvMax0;

            if (vertexHeight > nextVertexHeight) {
                uvMax1 *= nextVertexHeight / vertexHeight;
            } else if (nextVertexHeight > vertexHeight) {
                uvMax0 *= vertexHeight / nextVertexHeight;
            }

            uvs.push(
                uvOffset.x + uvXMax, uvOffset.y,
                uvOffset.x + uvXMin, uvOffset.y,
                uvOffset.x + uvXMin, uvOffset.y + uvMax0
            );
            uvs.push(
                uvOffset.x + uvXMax, uvOffset.y,
                uvOffset.x + uvXMin, uvOffset.y + uvMax0,
                uvOffset.x + uvXMax, uvOffset.y + uvMax1
            );


            for (let i = 0; i < 6; i++) {
                textureIds.push(textureId);
            }
        }

        return { uvs, textureIds };
    }
}