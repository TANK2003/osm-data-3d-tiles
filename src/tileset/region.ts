import { transform, transformExtent } from "ol/proj.js";
import { enuBasisECEF, lonLatHeightToECEF, mat3FromBasis, TILE_HEIGHT, toRad } from "./utils.js";
import { Matrix3, Matrix4, Vector3 } from "three";
import { Extent } from "ol/extent.js";
import { TileCoord } from "ol/tilecoord.js";

export function createRegionTilesetRoot(extent: Extent) {

    const [minX, minY, maxX, maxY] = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    const lonC = (minX + maxX) * 0.5;
    const latC = (minY + maxY) * 0.5;
    const hC = TILE_HEIGHT / 2;

    const lon = toRad(lonC);
    const lat = toRad(latC);

    const C = lonLatHeightToECEF(lon, lat, hC);
    const basis = enuBasisECEF(lon, lat);

    const B = mat3FromBasis(basis);

    const tileMatrix = new Matrix4().setFromMatrix3(B).setPosition(C.x, C.y, C.z)


    return {
        matrix: tileMatrix,
        content: Object.assign({
            geometricError: 512,
            refine: 'ADD',
            children: [],
            transform: tileMatrix.elements,
        }, getBoundingVolumeRegionFromCenter(extent, TILE_HEIGHT))
    }
}

export function createRegionTilesetContent(tileCoord: TileCoord, extent: Extent, parentTransformMatrix: Matrix4) {
    const z = tileCoord[0]
    const x = tileCoord[1]
    const y = tileCoord[2]

    const [minX3857, minY3857, maxX3857, maxY3857] = extent;
    const x0 = (minX3857 + maxX3857) * 0.5;
    const y0 = (minY3857 + maxY3857) * 0.5;
    const h0 = TILE_HEIGHT / 2;

    const { A, C0: childCenterECEF } = buildA_3857_to_ENU(x0, y0, h0);


    const rootCenterECEF = new Vector3().setFromMatrixPosition(parentTransformMatrix);
    const deltaECEF = new Vector3(
        childCenterECEF.x - rootCenterECEF.x,
        childCenterECEF.y - rootCenterECEF.y,
        childCenterECEF.z - rootCenterECEF.z
    );

    const rootRotScale3 = new Matrix3().setFromMatrix4(parentTransformMatrix);
    const invRootRotScale3 = rootRotScale3.clone().invert();

    const deltaLocal = deltaECEF.clone().applyMatrix3(invRootRotScale3);
    const childTransform = new Matrix4().makeTranslation(deltaLocal.x, deltaLocal.y, deltaLocal.z)


    const te = childTransform.elements;
    const ae = A.elements;

    te[0] = ae[0]; te[1] = ae[1]; te[2] = ae[2];
    te[4] = ae[3]; te[5] = ae[4]; te[6] = ae[5];
    te[8] = ae[6]; te[9] = ae[7]; te[10] = ae[8];

    return Object.assign({
        geometricError: 512,
        refine: 'ADD',
        content: {
            uri: z + "_" + x + "_" + y + ".b3dm"
        },
        transform: childTransform.elements

    }, getBoundingVolumeRegionFromCenter(extent, TILE_HEIGHT),)
}

function getBoundingVolumeRegionFromCenter(extent: Extent, z_max: number) {
    const [westDeg, southDeg, eastDeg, northDeg] = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    return {
        boundingVolume: {
            "region": [
                toRad(westDeg),
                toRad(southDeg),
                toRad(eastDeg),
                toRad(northDeg),
                0,
                z_max
            ]
        }
    };
}


function ecefToEnuDelta(dEcef: Vector3, lonRad: number, latRad: number) {
    const sinLon = Math.sin(lonRad), cosLon = Math.cos(lonRad);
    const sinLat = Math.sin(latRad), cosLat = Math.cos(latRad);

    const E = new Vector3(-sinLon, cosLon, 0);
    const N = new Vector3(-sinLat * cosLon, -sinLat * sinLon, cosLat);
    const U = new Vector3(cosLat * cosLon, cosLat * sinLon, sinLat);

    return new Vector3(
        E.dot(dEcef),
        N.dot(dEcef),
        U.dot(dEcef)
    );
}

function buildA_3857_to_ENU(x0: number, y0: number, h0: number) {
    const [lonDeg0, latDeg0] = transform([x0, y0], "EPSG:3857", "EPSG:4326");
    const lon0 = toRad(lonDeg0);
    const lat0 = toRad(latDeg0);

    const C0 = lonLatHeightToECEF(lon0, lat0, h0);

    const [lonDegX, latDegX] = transform([x0 + 1, y0], "EPSG:3857", "EPSG:4326");
    const CX = lonLatHeightToECEF(toRad(lonDegX), toRad(latDegX), h0);

    const [lonDegY, latDegY] = transform([x0, y0 + 1], "EPSG:3857", "EPSG:4326");
    const CY = lonLatHeightToECEF(toRad(lonDegY), toRad(latDegY), h0);

    const dXecef = new Vector3(CX.x - C0.x, CX.y - C0.y, CX.z - C0.z);
    const dYecef = new Vector3(CY.x - C0.x, CY.y - C0.y, CY.z - C0.z);

    const vx = ecefToEnuDelta(dXecef, lon0, lat0);
    const vy = ecefToEnuDelta(dYecef, lon0, lat0);


    return {
        lon0, lat0, C0, A: new Matrix3().set(
            vx.x, vy.x, 0,
            vx.y, vy.y, 0,
            vx.z, vy.z, 1
        )
    };
}

