import { Coordinate } from "ol/coordinate.js";
import { LineString, MultiPoint, MultiLineString, MultiPolygon, Polygon } from "ol/geom.js";
import { GeometryLayout } from "ol/geom/Geometry.js";
import { BufferGeometry } from "three";

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

export function ensureClockwise(coordinates: Coordinate[]) {
    if (signedArea(coordinates) > 0) {
        // If the polygon is counterclockwise, reverse the coordinates
        return coordinates.reverse();
    }
    return coordinates; // Already clockwise
}
export function ensureCounterClockwise(coordinates: Coordinate[]) {
    if (signedArea(coordinates) > 0) {
        // If the polygon is clockwise, reverse the coordinates
        return coordinates;
    }
    return coordinates.reverse();
}


export function flipTriangleWindingNonIndexed(geometry: BufferGeometry) {
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