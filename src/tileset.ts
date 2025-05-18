import { get as getProjection, transformExtent } from 'ol/proj.js';
import fs from 'fs/promises';
import { TileGrid } from 'ol/tilegrid.js';
import { Extent } from 'ol/extent.js';
import { Tile } from 'ol';
import { TileCoord } from 'ol/tilecoord.js';




function createTilesetContent(tileCoord: TileCoord, extent: Extent) {
    const z = tileCoord[0]
    const x = tileCoord[1]
    const y = tileCoord[2]
    return {
        geometricError: 512,
        refine: 'ADD',
        boundingVolume: getBoundingVolumeRegionFromCenter(extent, 20),
        content: {
            uri: z + "_" + x + "_" + y + ".b3dm"
        }
    }
}

function createTilesetRoot(extent) {
    return {
        geometricError: 512,
        refine: 'ADD',
        boundingVolume: getBoundingVolumeRegionFromCenter(extent, 20),
        children: []
    }
}

export function getBoundingVolumeRegionFromCenter(extent: Extent, z_max: number) {
    const [westDeg, southDeg, eastDeg, northDeg] = transformExtent(extent, 'EPSG:3857', 'EPSG:4326');
    const toRad = deg => deg * Math.PI / 180;
    return {
        "region": [
            toRad(westDeg),
            toRad(southDeg),
            toRad(eastDeg),
            toRad(northDeg),
            0,
            z_max
        ]
    };
}

export async function createNestedTileSetJson(tileGrid: TileGrid, extent: Extent, filePath: string) {
    const nestedTileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: createTilesetRoot(extent)
    };
    tileGrid.forEachTileCoord(extent, 16, (tileCoord) => {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        nestedTileSetJson.root.children.push(createTilesetContent(tileCoord, tileExtent))
    })

    await fs.writeFile(filePath, JSON.stringify(nestedTileSetJson)).then(() => {
        console.log("Successfully wrote file", filePath);
    }, (err) => {
        console.error("Error writing file", err);
    })

}