import { BaseDescriptor } from "../building/type.js";



export enum VectorAreaRingType {
    Inner,
    Outer
}

export interface VectorAreaRing<T extends BaseDescriptor = BaseDescriptor> {
    nodes: VectorNode<T>[];
    type: VectorAreaRingType;
}

export interface VectorNode<T extends BaseDescriptor = BaseDescriptor> {
    type: 'node';
    osmReference: null;
    descriptor: T;
    x: number;
    y: number;
    rotation: number;
}
export interface VectorArea<T extends BaseDescriptor = BaseDescriptor> {
    type: 'area';
    osmReference: number;
    elevation: number;
    descriptor: T;
    rings: VectorAreaRing<T>[];
    isBuildingPartInRelation?: boolean;
    // featureId: number
}