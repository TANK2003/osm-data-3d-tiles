import { Coordinate } from "ol/coordinate.js";

export function isRingClockwise(ring: Array<Coordinate>): boolean {
    let sum = 0;

    for (let i = 0; i < ring.length; i++) {
        const point1 = ring[i];
        const point2 = ring[i + 1] ?? ring[0];
        sum += (point2[0] - point1[0]) * (point2[1] + point1[1]);
    }

    return sum < 0;
}


export function validateRing(ring: Array<Coordinate>): boolean {
    const first = ring[0];
    const last = ring[ring.length - 1];

    return first[0] === last[0] && first[1] === last[1];
}
