import { Box3, Vector3 } from "three";
import { MathUtils } from "three/src/math/MathUtils.js";
// import { Extent } from "../../giro-3d-module";
import { getPolygonAreaSigned } from "./roof/utils.js";
import { VectorNode } from "./type.js";
import { VectorAreaRingType } from "./builder.js";
import Vec2 from "../math/vector2.js";
import { isPointInsidePolygon } from "../math/utils.js";


const temp_box = new Box3()

export enum Tile3DRingType {
    Outer,
    Inner
}

export interface VectorAreaRing {
    nodes: VectorNode[];
    type: VectorAreaRingType;
}

export default class Tile3DRing {
    public readonly type: Tile3DRingType;
    public readonly nodes: Vec2[];

    private cachedFlattenVertices: number[];
    private cachedGeoJSONVertices: [number, number][];
    private cachedAABB: Box3;
    private cachedArea: number;

    public constructor(type: Tile3DRingType, nodes: Vec2[]) {
        this.type = type;
        this.nodes = nodes;
    }

    public getFlattenVertices(): number[] {
        if (!this.cachedFlattenVertices) {
            const vertices: number[] = [];

            for (const node of this.nodes) {
                vertices.push(node.x, node.y);
            }

            this.cachedFlattenVertices = vertices;
        }

        return this.cachedFlattenVertices;
    }

    public getGeoJSONVertices(): [number, number][] {
        if (!this.cachedGeoJSONVertices) {
            const vertices: [number, number][] = [];

            for (const node of this.nodes) {
                vertices.push([node.x, node.y]);
            }

            this.cachedGeoJSONVertices = vertices;
        }

        return this.cachedGeoJSONVertices;
    }

    public getAABB(): Box3 {
        if (!this.cachedAABB) {


            for (const node of this.nodes) {
                temp_box.expandByPoint(new Vector3().set(
                    node.x,
                    node.y,
                    0
                ))
                // aabb.includePoint(node);
            }


            this.cachedAABB = temp_box
        }

        return this.cachedAABB;
    }

    public getDistanceToPoint(point: Vec2): number {
        let minDistance = Infinity;

        for (const node of this.nodes) {

            const distance = Vec2.distance(node, point);

            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        return minDistance;
    }

    public isContainsPoints(point: Vec2): boolean {

        return isPointInsidePolygon(point, this.nodes);
    }

    public getArea(): number {
        if (!this.cachedArea) {

            this.cachedArea = getPolygonAreaSigned(this.nodes);
        }

        return this.cachedArea;
    }
}