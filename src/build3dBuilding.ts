import Feature from "ol/Feature.js";
import Polygon from 'ol/geom/Polygon.js';
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Box3, BufferAttribute, BufferAttributeJSON, BufferGeometry, DataArrayTexture, Mesh, ShaderMaterial, Sphere, Texture, Vector2, Vector3 } from "three";
import { Builder, createBuildingPolygons } from "./building/builder.js";
import { Coordinate } from "ol/coordinate.js";
import { buildingTextures } from "./textures/building_textures.js";

const tmpVec2 = new Vector2();

function flipTriangleWindingNonIndexed(geometry) {
    const positionAttr = geometry.attributes.position;
    const uvAttr = geometry.attributes.uv;

    if (!positionAttr) {
        console.warn('No position attribute found.');
        return;
    }

    const posArray = positionAttr.array;
    const uvArray = uvAttr ? uvAttr.array : null;

    for (let i = 0; i < posArray.length; i += 9) {
        // Swap vertex 0 and vertex 2 for positions
        for (let j = 0; j < 3; j++) {
            const temp = posArray[i + j];
            posArray[i + j] = posArray[i + 6 + j];
            posArray[i + 6 + j] = temp;
        }
    }

    if (uvArray) {
        for (let i = 0; i < uvArray.length; i += 6) {
            // Each triangle has 3 UV points (2 floats per point)
            // Swap UV0 and UV2
            for (let j = 0; j < 2; j++) {
                const temp = uvArray[i + j];
                uvArray[i + j] = uvArray[i + 4 + j];
                uvArray[i + 4 + j] = temp;
            }
        }
        uvAttr.needsUpdate = true;
    }

    positionAttr.needsUpdate = true;
}



/**
 * Flip triangle winding on a BufferGeometry.  
 * - If non-indexed, will first index it via mergeVertices().  
 * - Then for each triangle (3 indices) swap index 0 ⇄ 2.  
 *
 * @param {THREE.BufferGeometry} geometry
 */
function flipTriangleWindingIndexed(geometry) {
    // 1) Ensure indexed
    if (!geometry.index) {
        console.warn('Geometry is non-indexed: merging vertices to create index...');
        // tolerance: 1e-6 world‐units — adjust if needed
        geometry = mergeVertices(geometry, 1e-6);
        if (!geometry.index) {
            console.error('Failed to create index. Aborting winding flip.');
            return geometry;
        }
    }

    // 2) Swap the first and third index of each triangle
    const indexAttr = geometry.index;
    const idx = indexAttr.array;
    for (let i = 0; i < idx.length; i += 3) {
        // [ i, i+1, i+2 ] => swap i <-> i+2
        const tmp = idx[i];
        idx[i] = idx[i + 2];
        idx[i + 2] = tmp;
    }
    indexAttr.needsUpdate = true;



    return geometry;
}


export function build3dBuildings(
    features: { "properties": {}, "flatCoordinates": Array<number>, "ends_": number[] }[],
    worldBuildingPosition: Vector2,
    tile_key: string,
): {
    tile_key: string;
    geometriesJson: {
        key: string;
        data: BufferAttributeJSON
    }[]
} {


    const olFeatures = features.map((feature) => {

        const flatCoordinates: Array<number> = feature.flatCoordinates


        const newFlatCoordinates = flatCoordinates.slice().map((coord, index) => {
            // pair => x
            if (index % 2 == 0) {
                return coord - worldBuildingPosition.x
            }
            return coord - worldBuildingPosition.y
        })

        function signedArea(coordinates: Coordinate[]) {
            let area = 0;
            const len = coordinates.length;
            for (let i = 0; i < len; i++) {
                const [x1, y1] = coordinates[i];
                const [x2, y2] = coordinates[(i + 1) % len];
                area += (x2 - x1) * (y2 + y1);
            }
            return area;
        }

        function ensureClockwise(coordinates: Coordinate[]) {
            if (signedArea(coordinates) > 0) {
                // If the polygon is counterclockwise, reverse the coordinates
                return coordinates.reverse();
            }
            return coordinates; // Already clockwise
        }
        function ensureCounterClockwise(coordinates: Coordinate[]) {
            if (signedArea(coordinates) > 0) {
                // If the polygon is clockwise, reverse the coordinates
                return coordinates;
            }
            return coordinates.reverse();
        }


        const polygon = new Polygon(newFlatCoordinates, 'XY', feature.ends_)
        const newOuterAndInnerCoordinates = polygon.getLinearRings().map((ring, index) => {
            let outerRing = ring.getCoordinates();
            if (index == 0) {
                outerRing = ensureClockwise(outerRing);
            } else {
                outerRing = ensureCounterClockwise(outerRing);
            }
            return outerRing
        })
        polygon.setCoordinates(newOuterAndInnerCoordinates)
        const olFeature = new Feature(polygon)
        olFeature.setProperties(feature.properties)
        return olFeature
    })


    if (olFeatures.length > 0) {


        const vectors_areas = createBuildingPolygons(olFeatures)

        const buildFeature = []
        const featureOsmIds = []
        for (let index = 0; index < vectors_areas.length; index++) {
            const element = vectors_areas[index];
            featureOsmIds.push(element.osmId)
            buildFeature.push(new Builder(element).getFeatures())
        }
        const buildingGeometries = buildFeature.map((building, index) => {

            const extrudedBuilding = building.extruded
            const buildingGeometry = new BufferGeometry();

            const colorBuffer = Float32Array.from(extrudedBuilding.colorBuffer);

            buildingGeometry.setAttribute("position", new BufferAttribute((extrudedBuilding.positionBuffer as Float32Array), 3))
            buildingGeometry.setAttribute("color", new BufferAttribute(colorBuffer.slice().map((v) => { return v / 255 }), 3))
            buildingGeometry.setAttribute("normal", new BufferAttribute((extrudedBuilding.normalBuffer as Float32Array), 3))
            buildingGeometry.setAttribute("textureId", new BufferAttribute((extrudedBuilding.textureIdBuffer as Uint8Array), 1))
            buildingGeometry.setAttribute("uv", new BufferAttribute((extrudedBuilding.uvBuffer as Float32Array), 2))
            buildingGeometry.setAttribute("batchId", new BufferAttribute(Int32Array.from({ length: buildingGeometry.getAttribute("position").count }, () => index), 1));
            buildingGeometry.setAttribute('uv2', new BufferAttribute((extrudedBuilding.uvBuffer as Float32Array), 2));
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
            // "buildingGeometries": buildingGeometries,
            "tile_key": tile_key,
            "geometriesJson": geometriesJson
        }

    }

    return undefined

}

// new Box3()
// function build3dBuildings() {

// }
// export { build3dBuildings }