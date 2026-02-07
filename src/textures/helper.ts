import { buildingTextures } from "./building_textures.js";

export function getImageFrame(textureId: number) {
    // console.log(
    //     // plastered_wall_02_diff_1k (2,1550)
    //     // lastic018A_1K-JPG_Color.jpg (518,2)
    //     buildingTextures[(4 * textureId)].url
    // )
    return global.diffuseMapImages["frames"][buildingTextures[(4 * textureId)].url]["frame"]
}