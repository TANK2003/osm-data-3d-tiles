import Vec2 from "./vector2.js";

export function getPolygonCentroid(points: Vec2[]): Vec2 {
    //Correction for very small polygons:
    const x0 = points[0].x, y0 = points[0].y;

    let x = 0, y = 0, twiceArea = 0;
    let prev = points[points.length - 1];

    for (const next of points) {
        const x1 = prev.x - x0, y1 = prev.y - y0,
            x2 = next.x - x0, y2 = next.y - y0,
            a = x1 * y2 - x2 * y1;

        twiceArea += a;
        x += (x1 + x2) * a;
        y += (y1 + y2) * a;

        prev = next;
    }

    const factor = 3 * twiceArea;  // 6 * twiceArea/2
    x /= factor;
    y /= factor;

    return new Vec2(x + x0, y + y0);
}

export function isPointInsidePolygon(point: Vec2, vs: Vec2[]): boolean {
    // https://github.com/substack/point-in-polygon

    const { x, y } = point;

    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        const xi = vs[i].x, yi = vs[i].y;
        const xj = vs[j].x, yj = vs[j].y;

        const intersect = ((yi > y) != (yj > y))
            && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }

    return inside;
}

export function lonLatToECEF(lon, lat, height = 0): [number, number, number] {
    const a = 6378137; // WGS84 semi-major axis
    const e2 = 0.00669437999014; // eccentricity squared

    const lambda = lon * Math.PI / 180;
    const phi = lat * Math.PI / 180;

    const cosPhi = Math.cos(phi);
    const sinPhi = Math.sin(phi);
    const cosLambda = Math.cos(lambda);
    const sinLambda = Math.sin(lambda);

    const N = a / Math.sqrt(1 - e2 * sinPhi * sinPhi);

    const x = (N + height) * cosPhi * cosLambda;
    const y = (N + height) * cosPhi * sinLambda;
    const z = (N * (1 - e2) + height) * sinPhi;

    return [x, y, z];
}