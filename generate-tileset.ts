
import { createXYZ } from "ol/tilegrid.js";
import fs from 'fs/promises';

import { TileCoord } from "ol/tilecoord.js";
import { coordinate_units_type } from "./src/type.js";
import { createBoxNestedTileSetJson, createCustomBoxNestedTileSetJson, createRegionNestedTileSetJson } from "./src/tileset/tileset.js";
import { createRegionTilesetRoot } from "./src/tileset/region.js";
import { createBoxTilesetRoot, getBoundingVolumeBoxFromExtent } from "./src/tileset/box.js";
import { Matrix4 } from "three";
import { TILESET_SUBTILES_PATH, TILESET_ROOT_PATH, TILESET_SUBTILES_PATH_RELATIVE } from './config.js';
import { TILE_HEIGHT } from "./src/tileset/utils.js";
import { createCustomBoxTilesetRoot, } from "./src/tileset/customBox.js";



const tileGrid = createXYZ({ tileSize: 512 })


export async function buildTileSetJson() {
    const extent = global.EXTENT as number[];
    const coordinateUnits = global.COORDINATE_UNITS as coordinate_units_type;
    let rootTileSet;

    if (coordinateUnits === "ecef") {
        rootTileSet = createRegionTilesetRoot(extent);
    } else if (coordinateUnits === "mercator") {
        rootTileSet = createBoxTilesetRoot(extent);
    } else if (coordinateUnits == "custom") {
        rootTileSet = createCustomBoxTilesetRoot(extent);
    }

    const rootTileMatrix: Matrix4 = rootTileSet.matrix
    const tileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: rootTileSet.content
    };
    const tileCoords = [];

    tileGrid.forEachTileCoord(extent, 12, (tileCoord: TileCoord) => {
        tileCoords.push(tileCoord)
    })


    for (const tileCoord of tileCoords) {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        const z = tileCoord[0]
        const x = tileCoord[1]
        const y = tileCoord[2]

        const tileName = `${z}_${x}_${y}.json`;
        const nestedTileSetJsonPath = TILESET_SUBTILES_PATH + tileName

        let rootBoundingVolume, rootBoundingTransform;
        if (coordinateUnits === "ecef") {
            [rootBoundingVolume, rootBoundingTransform] = await createRegionNestedTileSetJson(tileGrid, tileExtent, nestedTileSetJsonPath, rootTileMatrix)
        } else if (coordinateUnits === "mercator") {
            [rootBoundingVolume, rootBoundingTransform] = await createBoxNestedTileSetJson(tileGrid, tileExtent, nestedTileSetJsonPath, rootTileMatrix)
        } else if (coordinateUnits === "custom") {

            [rootBoundingVolume, rootBoundingTransform] = await createCustomBoxNestedTileSetJson(tileGrid, tileExtent, nestedTileSetJsonPath, rootTileMatrix)
        }

        tileSetJson.root.children.push({
            geometricError: 512,
            refine: 'ADD',
            boundingVolume: rootBoundingVolume,
            transform: rootBoundingTransform.elements,
            content: {
                uri: TILESET_SUBTILES_PATH_RELATIVE + tileName
            }
        })
    }
    const filePath = TILESET_ROOT_PATH + 'tileset.json'

    await fs.writeFile(filePath, JSON.stringify(tileSetJson)).then(() => {
        console.log("Successfully wrote file", filePath);
    }, (err) => {
        console.error("Error writing file", err);
    })

}


export async function buildTileSetJsonForTileCoord(tileCoordPath: string) {
    const tileCoord = tileCoordPath.split("_").map((t) => Number(t))
    const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
    const z = tileCoord[0]
    const x = tileCoord[1]
    const y = tileCoord[2]

    const nestedTileSetJsonPath = `${z}_${x}_${y}.json`;
    const coordinateUnits = global.COORDINATE_UNITS as coordinate_units_type;
    const filePath = TILESET_ROOT_PATH + nestedTileSetJsonPath;

    if (coordinateUnits === "ecef") {
        await createRegionNestedTileSetJson(tileGrid, tileExtent, filePath);
    } else if (coordinateUnits === "mercator") {
        await createBoxNestedTileSetJson(tileGrid, tileExtent, filePath);
    }


}