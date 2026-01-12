import { Matrix3 } from "three";

export const TILE_HEIGHT = 300
export const toRad = deg => deg * Math.PI / 180;

export function mat3FromBasis(basis: { E: any; N: any; U: any }) {
    const X = basis.E; // X local
    const Y = basis.N; // Y local
    const Z = basis.U; // Z local

    return new Matrix3().set(
        X.x, Y.x, Z.x,
        X.y, Y.y, Z.y,
        X.z, Y.z, Z.z
    );
}

export function enuBasisECEF(lonRad: number, latRad: number) {
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);
    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);

    const E = { x: -sinLon, y: cosLon, z: 0 };
    const N = { x: -sinLat * cosLon, y: -sinLat * sinLon, z: cosLat };
    const U = { x: cosLat * cosLon, y: cosLat * sinLon, z: sinLat };

    return { E, N, U };
}

export function lonLatHeightToECEF(lonRad: number, latRad: number, h = 0) {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const e2 = f * (2 - f);

    const sinLat = Math.sin(latRad);
    const cosLat = Math.cos(latRad);
    const sinLon = Math.sin(lonRad);
    const cosLon = Math.cos(lonRad);

    const N = a / Math.sqrt(1 - e2 * sinLat * sinLat);

    const x = (N + h) * cosLat * cosLon;
    const y = (N + h) * cosLat * sinLon;
    const z = (N * (1 - e2) + h) * sinLat;

    return { x, y, z };
}
