import { Extent } from "ol/extent.js";
import { TileCoord } from "ol/tilecoord.js";
import { Matrix3, Matrix4, Vector3 } from "three";
import { TILE_HEIGHT } from "./utils.js";


export function createBoxTilesetRoot(extent) {
    const [minX, minY, maxX, maxY] = extent;
    const Rlocal4 = new Matrix4()
    const x = (minX + maxX) * 0.5;
    const y = (minY + maxY) * 0.5;

    Rlocal4.setPosition(x, y, 0);

    return {
        matrix: Rlocal4,
        content: Object.assign({
            geometricError: 512,
            refine: 'ADD',
            children: [],
            transform: Rlocal4.elements,
        }, getBoundingVolumeBoxFromExtent(extent, TILE_HEIGHT))
    }
}

export function createBoxTilesetContent(tileCoord: TileCoord, extent: Extent, parentTransformMatrix: Matrix4) {
    const [minX, minY, maxX, maxY] = extent;


    const x = (minX + maxX) * 0.5;
    const y = (minY + maxY) * 0.5;

    const rootCenter = new Vector3().setFromMatrixPosition(parentTransformMatrix);
    const delta = new Vector3(
        x - rootCenter.x,
        y - rootCenter.y,
        0 - rootCenter.z
    );

    const rootRotScale3 = new Matrix3().setFromMatrix4(parentTransformMatrix);
    const invRootRotScale3 = rootRotScale3.clone().invert();

    const deltaLocal = delta.clone().applyMatrix3(invRootRotScale3);
    const childTransform = new Matrix4().makeTranslation(deltaLocal.x, deltaLocal.y, deltaLocal.z)

    return Object.assign({
        geometricError: 512,
        refine: 'ADD',
        content: {
            uri: tileCoord[0] + "_" + tileCoord[1] + "_" + tileCoord[2] + ".b3dm"
        },
        transform: childTransform.elements,

    }, getBoundingVolumeBoxFromExtent(extent, TILE_HEIGHT),)
}

function getBoundingVolumeBoxFromExtent(extent: Extent, zMax: number) {
    const [minX, minY, maxX, maxY] = extent;
    const w = maxX - minX;
    const h = maxY - minY;

    const cx = w * 0.5;
    const cy = h * 0.5;
    const cz = zMax * 0.5;

    const hx = w * 0.5;
    const hy = h * 0.5;
    const hz = zMax * 0.5;

    return {
        boundingVolume: {
            box: [
                cx, cy, cz,
                hx, 0, 0,
                0, hy, 0,
                0, 0, hz
            ]
        },
    };
}