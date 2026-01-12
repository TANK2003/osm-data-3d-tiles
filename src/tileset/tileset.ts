import fs from 'fs/promises';
import { TileGrid } from 'ol/tilegrid.js';
import { Extent } from 'ol/extent.js';
import { createRegionTilesetContent, createRegionTilesetRoot } from './region.js';
import { createBoxTilesetContent, createBoxTilesetRoot } from './box.js';



export async function createRegionNestedTileSetJson(tileGrid: TileGrid, extent: Extent, filePath: string) {
    const rootTileSet = createRegionTilesetRoot(extent)
    const rootMatrix = rootTileSet.matrix
    const nestedTileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: rootTileSet.content
    };
    tileGrid.forEachTileCoord(extent, 16, (tileCoord) => {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        nestedTileSetJson.root.children.push(createRegionTilesetContent(tileCoord, tileExtent, rootMatrix))
    })

    await fs.writeFile(filePath, JSON.stringify(nestedTileSetJson)).then(() => {
        console.log("Successfully wrote file", filePath);
    }, (err) => {
        console.error("Error writing file", err);
    })

}

export async function createBoxNestedTileSetJson(tileGrid: TileGrid, extent: Extent, filePath: string) {
    const rootTileSet = createBoxTilesetRoot(extent)

    const rootMatrix = rootTileSet.matrix
    const nestedTileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: rootTileSet.content
    };
    tileGrid.forEachTileCoord(extent, 16, (tileCoord) => {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        nestedTileSetJson.root.children.push(createBoxTilesetContent(tileCoord, tileExtent, rootMatrix))
    })

    await fs.writeFile(filePath, JSON.stringify(nestedTileSetJson)).then(() => {
        console.log("Successfully wrote file", filePath);
    }, (err) => {
        console.error("Error writing file", err);
    })

}