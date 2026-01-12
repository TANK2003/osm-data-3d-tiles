import Feature from "ol/Feature.js";
import Polygon from 'ol/geom/Polygon.js';
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Box3, BufferAttribute, BufferAttributeJSON, BufferGeometry, DataArrayTexture, Mesh, NormalBufferAttributes, ShaderMaterial, Sphere, Texture, Vector2, Vector3 } from "three";
import { Builder } from "./building/builder.js";
import { Coordinate } from "ol/coordinate.js";
import { buildingTextures } from "./textures/building_textures.js";
import RenderFeature, { toGeometry } from "ol/render/Feature.js";
import { ensureClockwise, ensureCounterClockwise, flipTriangleWindingNonIndexed } from "./utils/geometry.js";
import { BuildingProperties } from "./building/type.js";
import { createBuildingVectorArea } from "./ring/ring-builder.js";
import { MultiPolygon } from "ol/geom.js";




export function build3dBuildings(
    features: RenderFeature[],
    tileBottomLeftPosition: Vector2,
    tileKey: string,
): {
    tileKey: string;
    geometriesJson: {
        key: string;
        data: BufferAttributeJSON
    }[]
} {

    // Offset buildings coordinates
    const offsetFeatures = features.map((feature) => {

        const flatCoordinates: Array<number> = feature.getFlatCoordinates()

        // offset all the coordinates of the building by the tile position
        const offsetFlatCoordinates = flatCoordinates.slice().map((coord, index) => {
            if (index % 2 == 0) {
                return coord - tileBottomLeftPosition.x
            }
            return coord - tileBottomLeftPosition.y
        })
        // const g = toGeometry(feature)
        // if (g.getType() !== 'Polygon') {
        //     console.log(g.getType(), g, "not polygon")
        // }
        const geometry = (toGeometry(feature) as Polygon | MultiPolygon)

        geometry.setFlatCoordinates('XY', offsetFlatCoordinates)
        if (geometry instanceof Polygon) {
            const clockwiseCoordinates = geometry.getLinearRings().map((ring, index) => {
                let outerRing = ring.getCoordinates();
                if (index == 0) {
                    outerRing = ensureClockwise(outerRing);
                } else {
                    outerRing = ensureCounterClockwise(outerRing);
                }
                return outerRing
            })
            geometry.setCoordinates(clockwiseCoordinates)
        } else if (geometry instanceof MultiPolygon) {
            geometry.getPolygons().forEach((polygon, index) => {
                const clockwiseCoordinates = polygon.getLinearRings().map((ring, index) => {
                    let outerRing = ring.getCoordinates();
                    if (index == 0) {
                        outerRing = ensureClockwise(outerRing);
                    } else {
                        outerRing = ensureCounterClockwise(outerRing);
                    }
                    return outerRing
                })
                polygon.setCoordinates(clockwiseCoordinates)
            })
        }


        return {
            geometry: geometry,
            properties: feature.getProperties() as BuildingProperties
        }
    })


    if (offsetFeatures.length > 0) {

        // convert features to vectors areas
        const vectorsAreas = createBuildingVectorArea(offsetFeatures)

        const buildFeature = []
        const featureOsmIds = []
        for (let index = 0; index < vectorsAreas.length; index++) {
            const element = vectorsAreas[index];
            featureOsmIds.push(element.osmReference)
            // build 3D building
            buildFeature.push(new Builder(element, [tileBottomLeftPosition.x, tileBottomLeftPosition.y, 0], 0, 0).getFeatures())
        }
        const buildingGeometries = buildFeature.map((building, index) => {

            const extrudedBuilding = building.extruded
            const buildingGeometry = new BufferGeometry();

            const colorBuffer = Float32Array.from(extrudedBuilding.colorBuffer);

            buildingGeometry.setAttribute("position", new BufferAttribute((extrudedBuilding.positionBuffer as Float32Array), 3))
            // buildingGeometry.setAttribute("color", new BufferAttribute(colorBuffer.slice().map((v) => { return v / 255 }), 3))
            // buildingGeometry.setAttribute("normal", new BufferAttribute((extrudedBuilding.normalBuffer as Float32Array), 3))
            // buildingGeometry.setAttribute("textureId", new BufferAttribute((extrudedBuilding.textureIdBuffer as Uint8Array), 1))
            buildingGeometry.setAttribute("uv", new BufferAttribute((extrudedBuilding.uvBuffer as Float32Array), 2))
            buildingGeometry.setAttribute("batchId", new BufferAttribute(Uint16Array.from({ length: buildingGeometry.getAttribute("position").count }, () => index), 1));
            // buildingGeometry.setAttribute('uv2', new BufferAttribute((extrudedBuilding.uvBuffer as Float32Array), 2));
            return buildingGeometry
        });

        let buildingGeometry = mergeGeometries(buildingGeometries) as BufferGeometry;

        flipTriangleWindingNonIndexed(buildingGeometry)
        buildingGeometry.computeVertexNormals()

        const geometriesJson = Object.keys(buildingGeometry.attributes).map((key) => {

            return {
                "key": key,
                "data": (buildingGeometry.attributes[key].toJSON() as BufferAttributeJSON)
            }
        })
        return {
            "tileKey": tileKey,
            "geometriesJson": geometriesJson
        }

    }

    return undefined

}
