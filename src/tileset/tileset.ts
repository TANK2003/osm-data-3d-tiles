import fs from 'fs/promises';
import { TileGrid } from 'ol/tilegrid.js';
import { Extent } from 'ol/extent.js';
import { createRegionTilesetContent, createRegionTilesetRoot, getTranslationMatrixFromMatrixToExtentEcef } from './region.js';
import { createBoxTilesetContent, createBoxTilesetRoot, getTranslationMatrixFromMatrixToExtent } from './box.js';
import { Matrix4 } from 'three';
import { createCustomBoxTilesetContent, createCustomBoxTilesetRoot, getTranslationMatrixFromMatrixToExtentCustom } from './customBox.js';



export async function createRegionNestedTileSetJson(tileGrid: TileGrid, extent: Extent, filePath: string, tileRootMatrix?: Matrix4) {
    const rootTileSet = createRegionTilesetRoot(extent)
    const rootMatrix = rootTileSet.matrix
    const rootBoundingVolume = rootTileSet.content.boundingVolume

    const shouldApplyTransform = tileRootMatrix !== undefined
    let childTransform: Matrix4 | undefined;
    if (shouldApplyTransform) {
        delete rootTileSet.content.transform
        childTransform = getTranslationMatrixFromMatrixToExtentEcef(extent, tileRootMatrix)
    }
    const nestedTileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: rootTileSet.content
    };
    tileGrid.forEachTileCoord(extent, 16, (tileCoord) => {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        nestedTileSetJson.root.children.push(createRegionTilesetContent(tileCoord, tileExtent, rootMatrix))
    })

    return await fs.writeFile(filePath, JSON.stringify(nestedTileSetJson)).then(() => {
        console.log("Successfully wrote file", filePath);
        return [rootBoundingVolume, childTransform]
    }, (err) => {
        console.error("Error writing file", err);
        throw err
    })

}

export async function createBoxNestedTileSetJson(tileGrid: TileGrid, extent: Extent, filePath: string, tileRootMatrix?: Matrix4) {
    const rootTileSet = createBoxTilesetRoot(extent)

    const rootMatrix = rootTileSet.matrix
    const rootBoundingVolume = rootTileSet.content.boundingVolume

    const shouldApplyTransform = tileRootMatrix !== undefined
    let childTransform: Matrix4 | undefined;
    if (shouldApplyTransform) {
        delete rootTileSet.content.transform
        childTransform = getTranslationMatrixFromMatrixToExtent(extent, tileRootMatrix)
    }

    const nestedTileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: rootTileSet.content
    };

    tileGrid.forEachTileCoord(extent, 16, (tileCoord) => {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        nestedTileSetJson.root.children.push(createBoxTilesetContent(tileCoord, tileExtent, rootMatrix))
    })

    return await fs.writeFile(filePath, JSON.stringify(nestedTileSetJson)).then(() => {
        console.log("Successfully wrote file", filePath);
        return [rootBoundingVolume, childTransform]
    }, (err) => {
        console.error("Error writing file", err);
        throw err
    })

}


export async function createCustomBoxNestedTileSetJson(tileGrid: TileGrid, extent: Extent, filePath: string, tileRootMatrix?: Matrix4) {
    const rootTileSet = createCustomBoxTilesetRoot(extent)

    const rootMatrix = rootTileSet.matrix
    const rootBoundingVolume = rootTileSet.content.boundingVolume

    const shouldApplyTransform = tileRootMatrix !== undefined
    let childTransform: Matrix4 | undefined;
    if (shouldApplyTransform) {
        delete rootTileSet.content.transform
        childTransform = getTranslationMatrixFromMatrixToExtentCustom(extent, tileRootMatrix)
    }

    const nestedTileSetJson = {
        asset: { version: '1.0' },
        geometricError: 512,
        root: rootTileSet.content
    };

    tileGrid.forEachTileCoord(extent, 16, (tileCoord) => {
        const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
        nestedTileSetJson.root.children.push(createCustomBoxTilesetContent(tileCoord, tileExtent, rootMatrix))
    })

    return await fs.writeFile(filePath, JSON.stringify(nestedTileSetJson)).then(() => {
        console.log("Successfully wrote file", filePath);
        return [rootBoundingVolume, childTransform]
    }, (err) => {
        console.error("Error writing file", err);
        throw err
    })

}