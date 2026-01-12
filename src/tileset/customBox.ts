import proj4 from "proj4";
import { register } from "ol/proj/proj4.js";
import { Extent } from "ol/extent.js";
import { TileCoord } from "ol/tilecoord.js";
import { Matrix3, Matrix4, Vector3 } from "three";
import { TILE_HEIGHT } from "./utils.js";
import { transform, transformExtent } from "ol/proj.js";


proj4.defs(
    "EPSG:2154",
    "+proj=lcc +lat_1=49 +lat_2=44 +lat_0=46.5 +lon_0=3 " +
    "+x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 " +
    "+units=m +no_defs"
);
register(proj4);

const targetProjection = "EPSG:2154"

export function createCustomBoxTilesetRoot(extent) {

    const [minX, minY, maxX, maxY] = transformExtent(extent, "EPSG:3857", targetProjection);
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

export function createCustomBoxTilesetContent(tileCoord: TileCoord, extent: Extent, parentTransformMatrix: Matrix4) {
    const [minX, minY, maxX, maxY] = extent


    const x = (minX + maxX) * 0.5;
    const y = (minY + maxY) * 0.5;

    const { P0, vx, vy } = buildA_3857_to_target_projection_at(x, y);
    const tileCenterWorld = new Vector3(P0[0], P0[1], 0);

    const rootCenter = new Vector3().setFromMatrixPosition(parentTransformMatrix);

    const deltaWorld = tileCenterWorld.sub(rootCenter);


    const rootRotScale3 = new Matrix3().setFromMatrix4(parentTransformMatrix);
    const invRootRotScale3 = rootRotScale3.clone().invert();
    const deltaLocal = deltaWorld.clone().applyMatrix3(invRootRotScale3);

    const childTransform = new Matrix4().makeTranslation(deltaLocal.x, deltaLocal.y, deltaLocal.z)

    const te = childTransform.elements;
    // Applying the linear approximation 
    // [ vx.x  vy.x  0  _ ]
    //[ vx.y  vy.y  0 _ ]
    //[  0    0    1  _]
    //[  _    _    _  _]
    te[0] = vx.x; te[1] = vx.y; te[2] = 0;
    te[4] = vy.x; te[5] = vy.y; te[6] = 0;
    te[8] = 0; te[9] = 0; te[10] = 1;

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
    const [minX, minY, maxX, maxY] = transformExtent(extent, "EPSG:3857", targetProjection);
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

function buildA_3857_to_target_projection_at(x0: number, y0: number) {
    // Linear approximation from 3857 to target projection 

    const P0 = transform([x0, y0], "EPSG:3857", targetProjection);
    const Px = transform([x0 + 1, y0], "EPSG:3857", targetProjection);
    const Py = transform([x0, y0 + 1], "EPSG:3857", targetProjection);

    // jacobien
    const vx = { x: Px[0] - P0[0], y: Px[1] - P0[1] };
    const vy = { x: Py[0] - P0[0], y: Py[1] - P0[1] };

    return { P0, vx, vy };
}
