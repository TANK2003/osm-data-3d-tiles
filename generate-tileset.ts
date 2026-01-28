
import { createXYZ } from "ol/tilegrid.js";
import fs from 'fs/promises';

import { TileCoord } from "ol/tilecoord.js";
import { coordinate_units_type } from "./src/type.js";
import { createBoxNestedTileSetJson, createRegionNestedTileSetJson } from "./src/tileset/tileset.js";
import { createRegionTilesetRoot } from "./src/tileset/region.js";
import { createBoxTilesetRoot } from "./src/tileset/box.js";
import { Matrix4 } from "three";
import { TILESET_SUBTILES_PATH, TILESET_ROOT_PATH } from './config.js';



const tileGrid = createXYZ({ tileSize: 512 })


export async function buildTileSetJson() {
    const extent = global.EXTENT as number[];
    const coordinateUnits = global.COORDINATE_UNITS as coordinate_units_type;
    let rootTileSet;
    let rootMatrix;

    if (coordinateUnits === "ecef") {
        rootTileSet = createRegionTilesetRoot(extent);
        rootMatrix = rootTileSet.matrix;
    } else if (coordinateUnits === "mercator") {
        rootTileSet = createBoxTilesetRoot(extent);
        rootMatrix = rootTileSet.matrix;
    }
    rootTileSet.content.transform = new Matrix4().identity().elements
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

        const nestedTileSetJsonPath = TILESET_SUBTILES_PATH + z + "_" + x + "_" + y + ".json"
        if (coordinateUnits === "ecef") {
            await createRegionNestedTileSetJson(tileGrid, tileExtent, nestedTileSetJsonPath)
        } else if (coordinateUnits === "mercator") {
            await createBoxNestedTileSetJson(tileGrid, tileExtent, nestedTileSetJsonPath)
        }

        tileSetJson.root.children.push({
            geometricError: 512,
            refine: 'ADD',
            // boundingVolume: getBoundingVolume(tileExtent, 300),
            content: {
                uri: nestedTileSetJsonPath
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