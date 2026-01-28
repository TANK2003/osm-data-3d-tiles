import fs from 'fs/promises';
import UniqueTilePerBuilding from "./src/unique-tile-per-building.js";
import { getB3dmFileFromTileCoord, B3dmException } from "./src/b3dmGenerator.js";
import pkg from 'straight-skeleton';
import { texturesLoader } from "./src/texturesLoader.js";
import { TileCoord } from 'ol/tilecoord.js';
import { exit } from 'process';
import { B3DM_ROOT_PATH, TILESET_ROOT_PATH } from './config.js';
const { SkeletonBuilder } = pkg;




export const seed_b3dm = function (tile_json, tile_url) {
    global.uniqueTilePerBuilding = new UniqueTilePerBuilding()
    global.TILE_URL = tile_url
    const tilesetPath = TILESET_ROOT_PATH + tile_json
    return Promise.all([
        SkeletonBuilder.init(),
        ...texturesLoader
    ]).then(async () => {
        const bd3dm_paths = []
        await listBd3dmPaths(tilesetPath, bd3dm_paths)
        console.log(`Found ${bd3dm_paths.length} b3dm files to generate`);
        for (let index = 0; index < bd3dm_paths.length; index++) {
            const bd3dm_path = bd3dm_paths[index]
            const b3dm_coordinates = bd3dm_path.replace(".b3dm", "").split("_")
            const tileCoord = b3dm_coordinates.map((x) => parseInt(x))
            const filePath = B3DM_ROOT_PATH + bd3dm_path
            await generateAndStoreBd3dm(tileCoord, filePath).then(() => {
                console.log(`${index + 1}/${bd3dm_paths.length} --- `, "Successfully wrote file", filePath);
            }, (err) => {
                console.error(`${index + 1}/${bd3dm_paths.length} --- `, "Error writing file", err);
            })
        }

    })

}

const listBd3dmPaths = async (tileJsonPath: string, bd3dm_paths: string[]) => {
    await fs.readFile(tileJsonPath, "utf-8").then(async (tileString) => {
        const data = JSON.parse(tileString)
        for (let index = 0; index < data.root.children.length; index++) {
            const tile = data.root.children[index]
            if (tile.content.uri.includes(".b3dm")) {
                bd3dm_paths.push(tile.content.uri)
            } else if (tile.content.uri.includes(".json")) {
                await listBd3dmPaths(tile.content.uri, bd3dm_paths)
            } else {
                console.error(`${index + 1}/${data.root.children.length} --- `, "Invalid tile path", tile.content.uri);
            }

        }
    }).catch((err) => {
        console.error("Error reading tile json", err);
        exit(1);
    })
}

const generateAndStoreBd3dm = async (tileCoord: TileCoord, targetPath: string) => {
    const b3dmBuffer = await getB3dmFileFromTileCoord(tileCoord)

    return fs.writeFile(targetPath, b3dmBuffer)
}