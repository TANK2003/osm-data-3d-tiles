import { buildingTextures } from "./building_textures.js";

export function getImageFrame(textureId: number) {
    return global.diffuseMapImages["frames"][buildingTextures[(4 * textureId)].url]["frame"]
}