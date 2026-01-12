
import { createXYZ } from "ol/tilegrid.js";
import fs from 'fs/promises';

import { Tile } from "ol";
import { TileCoord } from "ol/tilecoord.js";
import { coordinate_units_type } from "./src/type.js";
import { createBoxNestedTileSetJson, createRegionNestedTileSetJson } from "./src/tileset/tileset.js";

const FranceExtent = [
    -606913.8638049276,
    5050915.662319799,
    1094047.9555162925,
    6675601.120660107
]

const Extent = FranceExtent

const tileGrid = createXYZ({ tileSize: 512 })


export async function buildTileSetJson() {

    const tileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: {
            geometricError: 512,
            refine: 'ADD',
            // boundingVolume: getBoundingVolume(Extent, 300),
            children: []
        }
    };
    const tileCoords = [];

    tileGrid.forEachTileCoord(Extent, 12, (tileCoord: TileCoord) => {
        tileCoords.push(tileCoord)
    })


    for (const tileCoord of tileCoords) {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        const z = tileCoord[0]
        const x = tileCoord[1]
        const y = tileCoord[2]

        const nestedTileSetJsonPath = "subtiles/" + z + "_" + x + "_" + y + ".json"
        // await createNestedTileSetJson(tileGrid, tileExtent, "exported/" + nestedTileSetJsonPath)

        tileSetJson.root.children.push({
            geometricError: 512,
            refine: 'ADD',
            // boundingVolume: getBoundingVolume(tileExtent, 300),
            content: {
                uri: nestedTileSetJsonPath
            }
        })
    }
    const filePath = 'exported/tileset.json'

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

    const nestedTileSetJsonPath = z + "_" + x + "_" + y + ".json"
    if ((global.COORDINATE_UNITS as coordinate_units_type) == "ecef") {
        await createRegionNestedTileSetJson(tileGrid, tileExtent, "exported/" + nestedTileSetJsonPath)
    } else if ((global.COORDINATE_UNITS as coordinate_units_type) == "mercator") {
        await createBoxNestedTileSetJson(tileGrid, tileExtent, "exported/" + nestedTileSetJsonPath)
    }


}