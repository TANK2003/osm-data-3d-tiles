import fs from 'fs/promises';
import UniqueTilePerBuilding from "./src/unique-tile-per-building.js";
import { getB3dmFileFromTileCoord, B3dmException } from "./src/b3dmGenerator.js";
import pkg from 'straight-skeleton';
import { texturesLoader } from "./src/texturesLoader.js";
const { SkeletonBuilder } = pkg;





export const seed_b3dm = function (tile_json, tile_url) {
    global.uniqueTilePerBuilding = new UniqueTilePerBuilding()
    global.TILE_URL = tile_url
    // const tilesetPath = "./exported/subtiles/12_2073_1408.json"
    const tilesetPath = "./exported/subtiles/" + tile_json
    return Promise.all([
        global.uniqueTilePerBuilding.preloadFromLevelDB(),
        SkeletonBuilder.init(),
        ...texturesLoader
    ]).then(() => {

        fs.readFile(tilesetPath, "utf-8").then(async (tileString) => {
            const data = JSON.parse(tileString)
            for (let index = 0; index < data.root.children.length; index++) {
                const tile = data.root.children[index]
                const b3dm_coordinates = tile.content.uri.replace(".b3dm", "").split("_")
                const b3dmBuffer = await getB3dmFileFromTileCoord(b3dm_coordinates)

                const filePath = "./exported/b3dm/" + tile.content.uri
                await fs.writeFile(filePath, b3dmBuffer).then(() => {
                    console.log("Successfully wrote file", filePath);
                }, (err) => {
                    console.error("Error writing file", err);
                })

            }
        })
    })

}