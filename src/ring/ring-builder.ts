
import { Coordinate } from "ol/coordinate.js";
import { MultiPolygon, Polygon } from "ol/geom.js";
import { getBuildingParams } from "../building/building-params.js";
import { getOMBB } from "../building/ombb-params.js";
import { BuildingDescriptor, BuildingProperties } from "../building/type.js";
import { isRingClockwise, validateRing } from "./ring-helper.js";
import { VectorArea, VectorAreaRing, VectorAreaRingType, VectorNode } from "./ring-type.js";



function inputRingToVectorRing(ring: Array<Coordinate>, type: VectorAreaRingType): VectorAreaRing<BuildingDescriptor> {
    const isClockwise = isRingClockwise(ring);
    const type_ = isClockwise ? VectorAreaRingType.Outer : VectorAreaRingType.Inner;
    // const type = VectorAreaRingType.Outer
    type = type_
    const nodes: Array<VectorNode<BuildingDescriptor>> = ring.map(([x, y]) => {
        return {
            type: 'node',
            x,
            y,
            rotation: 0,
            osmReference: null,
            descriptor: null
        };
    });

    return { type, nodes };
}

function addVectorRing(polygon: Polygon, rings: VectorAreaRing<BuildingDescriptor>[]) {
    const coordinates = polygon.getCoordinates()

    let i = 0;
    for (const ring of coordinates) {
        if (!validateRing(ring)) {
            i++
            throw new Error('Invalid PBF ring');
        }
        let type = VectorAreaRingType.Inner;
        if (i == 0) {
            type = VectorAreaRingType.Outer;
        }

        const vectorRing = inputRingToVectorRing(ring, type);
        rings.push(vectorRing);
        i++
    }
}

export function createBuildingVectorArea(features: {
    geometry: Polygon | MultiPolygon;
    properties: BuildingProperties;
}[]) {
    const areas: VectorArea<BuildingDescriptor>[] = [];

    for (let index = 0; index < features.length; index++) {
        const feature = features[index];
        const rings: VectorAreaRing<BuildingDescriptor>[] = [];
        if (feature.geometry instanceof MultiPolygon) {
            feature.geometry.getPolygons().forEach(polygon => {
                addVectorRing(polygon, rings)
            })
        } else if (feature.geometry instanceof Polygon) {
            addVectorRing(feature.geometry, rings)
        }

        for (const ring of rings) {
            if (ring.type === VectorAreaRingType.Outer) {

                areas.push({
                    type: 'area',
                    rings: [ring],
                    osmReference: feature.geometry["osm_id"],
                    elevation: feature.geometry["elevation"],
                    descriptor: {
                        type: 'building',
                        ombb: getOMBB(feature.properties),
                        ...getBuildingParams(feature.properties)
                    }
                });
            } else {
                if (!areas[areas.length - 1]) {
                    throw new Error('Invalid ring order');
                }

                areas[areas.length - 1].rings.push(ring);
            }
        }
    }


    return areas

}