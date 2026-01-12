import { TextureArrayLoader, SingleTextureLoader } from "./textureArrayLoader.js";
import { packAsync } from "free-tex-packer-core"
import fs from 'fs';


const textures = {
    "roofGeneric1Diffuse": { "url": "assets/textures/buildings/roofs/generic1_diffuse.png", "type": "image" },
    "roofGeneric1Normal": { "url": "assets/textures/buildings/roofs/generic1_normal.png", "type": "image" },
    "roofGeneric2Diffuse": { "url": "assets/textures/buildings/roofs/generic2_diffuse.png", "type": "image" },
    "roofGeneric2Normal": { "url": "assets/textures/buildings/roofs/generic2_normal.png", "type": "image" },

    "roofGeneric3Diffuse": { "url": "assets/textures/buildings/roofs/Plastic018A_1K-JPG_Color.jpg", "type": "image" },
    "roofGeneric3Normal": { "url": "assets/textures/buildings/roofs/Plastic018A_1K-JPG_NormalGL.png", "type": "image" },
    "roofGeneric3Mask": { "url": "assets/textures/buildings/roofs/Plastic018A_1K-JPG_Roughness.png", "type": "image" },
    // "roofGeneric3Diffuse": { "url": "assets/textures/buildings/roofs/Plastic001_1K-JPG_Color.jpg", "type": "image" },
    // "roofGeneric3Normal": { "url": "assets/textures/buildings/roofs/Plastic001_1K-JPG_NormalGL.jpg", "type": "image" },
    // "roofGeneric3Mask": { "url": "assets/textures/buildings/roofs/Plastic001_1K-JPG_Roughness.jpg", "type": "image" },
    // "roofGeneric3Diffuse": { "url": "assets/textures/buildings/roofs/grey_roof_01_diff_1k.jpg", "type": "image" },
    // "roofGeneric3Diffuse": { "url": "assets/textures/buildings/roofs/generic3_diffuse.png", "type": "image" },
    // "roofGeneric3Normal": { "url": "assets/textures/buildings/roofs/grey_roof_01_nor_dx_1k.jpg", "type": "image" },
    // "roofGeneric3Normal": { "url": "assets/textures/buildings/roofs/generic3_normal.png", "type": "image" },
    "roofGeneric4Diffuse": { "url": "assets/textures/buildings/roofs/generic4_diffuse.png", "type": "image" },
    "roofGeneric4Normal": { "url": "assets/textures/buildings/roofs/generic4_normal.png", "type": "image" },

    "roofTilesDiffuse": { "url": "assets/textures/buildings/roofs/tiles_diffuse.png", "type": "image" },
    "roofTilesNormal": { "url": "assets/textures/buildings/roofs/tiles_normal.png", "type": "image" },
    "roofTilesMask": { "url": "assets/textures/buildings/roofs/tiles_mask.png", "type": "image" },

    "roofMetalDiffuse": { "url": "assets/textures/buildings/roofs/metal_diffuse.png", "type": "image" },
    "roofMetalNormal": { "url": "assets/textures/buildings/roofs/metal_normal.png", "type": "image" },
    "roofMetalMask": { "url": "assets/textures/buildings/roofs/metal_mask.png", "type": "image" },
    "roofConcreteDiffuse": { "url": "assets/textures/buildings/roofs/concrete_diffuse.png", "type": "image" },
    "roofConcreteNormal": { "url": "assets/textures/buildings/roofs/concrete_normal.png", "type": "image" },

    "roofConcreteMask": { "url": "assets/textures/buildings/roofs/concrete_mask.png", "type": "image" },
    "roofThatchDiffuse": { "url": "assets/textures/buildings/roofs/thatch_diffuse.png", "type": "image" },
    "roofThatchNormal": { "url": "assets/textures/buildings/roofs/thatch_normal.png", "type": "image" },
    "roofThatchMask": { "url": "assets/textures/buildings/roofs/thatch_mask.png", "type": "image" },

    "roofEternitDiffuse": { "url": "assets/textures/buildings/roofs/eternit_diffuse.png", "type": "image" },
    "roofEternitNormal": { "url": "assets/textures/buildings/roofs/eternit_normal.png", "type": "image" },
    "roofEternitMask": { "url": "assets/textures/buildings/roofs/eternit_mask.png", "type": "image" },
    "roofGrassDiffuse": { "url": "assets/textures/buildings/roofs/grass_diffuse.png", "type": "image" },

    "roofGrassNormal": { "url": "assets/textures/buildings/roofs/grass_normal.png", "type": "image" },
    "roofGrassMask": { "url": "assets/textures/buildings/roofs/grass_mask.png", "type": "image" },
    "roofGlassDiffuse": { "url": "assets/textures/buildings/roofs/glass_diffuse.png", "type": "image" },
    "roofGlassNormal": { "url": "assets/textures/buildings/roofs/glass_normal.png", "type": "image" },

    "roofGlassMask": { "url": "assets/textures/buildings/roofs/glass_mask.png", "type": "image" },
    "roofTarDiffuse": { "url": "assets/textures/buildings/roofs/tar_diffuse.png", "type": "image" },
    "roofTarNormal": { "url": "assets/textures/buildings/roofs/tar_normal.png", "type": "image" },
    "roofTarMask": { "url": "assets/textures/buildings/roofs/tar_mask.png", "type": "image" },

    "roofCommonMask": { "url": "assets/textures/buildings/roofs/grey_roof_01_arm_1k.jpg", "type": "image" },
    // "roofCommonMask": { "url": "assets/textures/buildings/roofs/common_mask.png", "type": "image" },
    "facadeGlassDiffuse": { "url": "assets/textures/buildings/facades/glass_diffuse.png", "type": "image" },
    "facadeGlassNormal": { "url": "assets/textures/buildings/facades/glass_normal.png", "type": "image" },
    "facadeGlassMask": { "url": "assets/textures/buildings/facades/glass_mask.png", "type": "image" },

    "facadeBrickWallDiffuse": { "url": "assets/textures/buildings/facades/brick_wall_diffuse.png", "type": "image" },
    "facadeBrickWallNormal": { "url": "assets/textures/buildings/facades/brick_wall_normal.png", "type": "image" },
    "facadeBrickWallMask": { "url": "assets/textures/buildings/facades/brick_wall_mask.png", "type": "image" },
    "facadeBrickWindowDiffuse": { "url": "assets/textures/buildings/facades/brick_window_diffuse.png", "type": "image" },


    "facadePlasterWallDiffuse": { "url": "assets/textures/buildings/facades/plastered_wall_02_diff_1k.jpg", "type": "image" },
    "facadePlasterWallNormal": { "url": "assets/textures/buildings/facades/plastered_wall_02_nor_gl_1k.jpg", "type": "image" },
    "facadePlasterWallMask": { "url": "assets/textures/buildings/facades/plastered_wall_02_arm_1k.png", "type": "image" },

    "facadeBrickWindowNormal": { "url": "assets/textures/buildings/facades/brick_window_normal.png", "type": "image" },
    "facadeBrickWindowMask": { "url": "assets/textures/buildings/facades/brick_window_mask.png", "type": "image" },
    // "facadePlasterWallDiffuse": { "url": "assets/textures/buildings/facades/plaster_wall_diffuse.png", "type": "image" },
    // "facadePlasterWallNormal": { "url": "assets/textures/buildings/facades/plaster_wall_normal.png", "type": "image" },
    // "facadePlasterWallMask": { "url": "assets/textures/buildings/facades/plaster_wall_mask.png", "type": "image" },


    "facadePlasterWindowDiffuse": { "url": "assets/textures/buildings/facades/plaster_window_diffuse.png", "type": "image" },
    "facadePlasterWindowNormal": { "url": "assets/textures/buildings/facades/plaster_window_normal.png", "type": "image" },
    "facadePlasterWindowMask": { "url": "assets/textures/buildings/facades/plaster_window_mask.png", "type": "image" },

    "facadeWoodWallDiffuse": { "url": "assets/textures/buildings/facades/wood_wall_diffuse.png", "type": "image" },
    "facadeWoodWallNormal": { "url": "assets/textures/buildings/facades/wood_wall_normal.png", "type": "image" },
    "facadeWoodWallMask": { "url": "assets/textures/buildings/facades/wood_wall_mask.png", "type": "image" },
    "facadeWoodWindowDiffuse": { "url": "assets/textures/buildings/facades/wood_window_diffuse.png", "type": "image" },

    "facadeWoodWindowNormal": { "url": "assets/textures/buildings/facades/wood_window_normal.png", "type": "image" },
    "facadeWoodWindowMask": { "url": "assets/textures/buildings/facades/wood_window_mask.png", "type": "image" },
    "facadeBlockWallDiffuse": { "url": "assets/textures/buildings/facades/block_wall_diffuse.png", "type": "image" },
    "facadeBlockWallNormal": { "url": "assets/textures/buildings/facades/block_wall_normal.png", "type": "image" },

    "facadeBlockWallMask": { "url": "assets/textures/buildings/facades/block_wall_mask.png", "type": "image" },
    "facadeBlockWindowDiffuse": { "url": "assets/textures/buildings/facades/block_window_diffuse.png", "type": "image" },
    "facadeBlockWindowNormal": { "url": "assets/textures/buildings/facades/block_window_normal.png", "type": "image" },
    "facadeBlockWindowMask": { "url": "assets/textures/buildings/facades/block_window_mask.png", "type": "image" },

    "window0Glow": { "url": "assets/textures/buildings/facades/window0_glow.png", "type": "image" },
    "window1Glow": { "url": "assets/textures/buildings/facades/window1_glow.png", "type": "image" },
    "glassGlow": { "url": "assets/textures/buildings/facades/glass_glow.png", "type": "image" },
    "noGlow": { "url": "assets/textures/buildings/facades/no_glow.png", "type": "image" },
}

export const buildingTextures = [
    // textures['roofGeneric1Diffuse'],
    // textures['roofGeneric1Normal'],
    // textures['roofCommonMask'],
    // textures['noGlow'],

    // textures['roofGeneric2Diffuse'],
    // textures['roofGeneric2Normal'],
    // textures['roofCommonMask'],
    // textures['noGlow'],

    textures['roofGeneric3Diffuse'],
    textures['roofGeneric3Normal'],
    textures['roofGeneric3Mask'],
    textures['noGlow'],

    // textures['roofGeneric4Diffuse'],
    // textures['roofGeneric4Normal'],
    // textures['roofCommonMask'],
    // textures['noGlow'],

    textures['roofTilesDiffuse'],
    textures['roofTilesNormal'],
    textures['roofTilesMask'],
    textures['noGlow'],

    textures['roofMetalDiffuse'],
    textures['roofMetalNormal'],
    textures['roofMetalMask'],
    textures['noGlow'],

    textures['roofConcreteDiffuse'],
    textures['roofConcreteNormal'],
    textures['roofConcreteMask'],
    textures['noGlow'],

    textures['roofThatchDiffuse'],
    textures['roofThatchNormal'],
    textures['roofThatchMask'],
    textures['noGlow'],

    textures['roofEternitDiffuse'],
    textures['roofEternitNormal'],
    textures['roofEternitMask'],
    textures['noGlow'],

    textures['roofGrassDiffuse'],
    textures['roofGrassNormal'],
    textures['roofGrassMask'],
    textures['noGlow'],

    textures['roofGlassDiffuse'],
    textures['roofGlassNormal'],
    textures['roofGlassMask'],
    textures['noGlow'],

    textures['roofTarDiffuse'],
    textures['roofTarNormal'],
    textures['roofTarMask'],
    textures['noGlow'],

    textures['facadeGlassDiffuse'],
    textures['facadeGlassNormal'],
    textures['facadeGlassMask'],
    textures['glassGlow'],

    textures['facadeBrickWallDiffuse'],
    textures['facadeBrickWallNormal'],
    textures['facadeBrickWallMask'],
    textures['noGlow'],

    // textures['facadeBrickWindowDiffuse'],
    // textures['facadeBrickWindowNormal'],
    // textures['facadeBrickWindowMask'],
    // textures['window0Glow'],
    // 15
    textures['facadePlasterWallDiffuse'],
    textures['facadePlasterWallNormal'],
    textures['facadePlasterWallMask'],
    textures['noGlow'],

    // textures['facadePlasterWindowDiffuse'],
    // textures['facadePlasterWindowNormal'],
    // textures['facadePlasterWindowMask'],
    // textures['window1Glow'],

    textures['facadeWoodWallDiffuse'],
    textures['facadeWoodWallNormal'],
    textures['facadeWoodWallMask'],
    textures['noGlow'],

    // textures['facadeWoodWindowDiffuse'],
    // textures['facadeWoodWindowNormal'],
    // textures['facadeWoodWindowMask'],
    // textures['window0Glow'],

    textures['facadeBlockWallDiffuse'],
    textures['facadeBlockWallNormal'],
    textures['facadeBlockWallMask'],
    textures['window0Glow'],

    // textures['facadeBlockWindowDiffuse'],
    // textures['facadeBlockWindowNormal'],
    // textures['facadeBlockWindowMask'],
    // textures['window1Glow'],

]
const noiseTextureUrl = "assets/textures/noise/noise.png"


export function loadBuildingTextures() {
    const loader = new TextureArrayLoader();

    loader.loadImages(buildingTextures.map((image) => {
        return image.url
    }))

    return loader
}

export function loadNoiseTexture() {
    const loader = new SingleTextureLoader();
    return loader.load(noiseTextureUrl)
}
export function loadTexture(texture_path: string) {
    const loader = new SingleTextureLoader();
    return loader.load(texture_path)
}

const diffusesImages = []
const normalImages = []
const maskImages = []
const glowImages = []
buildingTextures.map((texture, index) => {
    if (index % 4 === 0) {
        diffusesImages.push({
            "path": texture.url, "contents": fs.readFileSync(texture.url)
        })
    } else if ((index - 1) % 4 === 0) {
        normalImages.push({
            "path": buildingTextures[index - 1].url, "contents": fs.readFileSync(texture.url)
        })
    } else if ((index - 2) % 4 === 0) {
        maskImages.push({
            "path": buildingTextures[index - 2].url, "contents": fs.readFileSync(texture.url)
        })
    } else if ((index - 3) % 4 === 0) {
        glowImages.push({
            "path": buildingTextures[index - 3].url, "contents": fs.readFileSync(texture.url)
        })
    }
})


export async function packImages() {
    const diffuseFiles = await packAsync(diffusesImages, {
        width: 3048,
        height: 3048,
        extrude: 2,
        textureName: "diffuse",
        detectIdentical: false
    });
    for (let item of diffuseFiles) {
        fs.createWriteStream("./assets/textures/packed/" + item.name).write(item.buffer);
    }

    const normalFiles = await packAsync(normalImages, {
        width: 3048,
        height: 3048,
        extrude: 2,
        textureName: "normal",
        detectIdentical: false,
    });
    for (let item of normalFiles) {
        fs.createWriteStream("./assets/textures/packed/" + item.name).write(item.buffer);
    }

    const maskFiles = await packAsync(maskImages, {
        width: 3048,
        height: 3048,
        extrude: 2,
        textureName: "mask",
        detectIdentical: false
    });
    for (let item of maskFiles) {
        fs.createWriteStream("./assets/textures/packed/" + item.name).write(item.buffer);
    }

    const glowFiles = await packAsync(glowImages, {
        width: 3048,
        height: 3048,
        extrude: 2,
        textureName: "glow",
        detectIdentical: false,
    });
    for (let item of glowFiles) {
        fs.createWriteStream("./assets/textures/packed/" + item.name).write(item.buffer);
    }

}


export function getTileUVTransform(
    x: number,
    y: number,
    atlasSize: number = 2580,
    tileSize: number = 512,
    padding: number = 2,
    cols: number = 5
) {
    // 1) taille d’une « cellule » incluant padding
    const cell = tileSize + padding * 2;    // 512 + 4 = 516

    // 2) calcul de la colonne et de la ligne
    const col = (Math.floor(x / tileSize));
    const row = (cols - 1) - (Math.floor(y / tileSize));
    // const row = idx % cols;
    // const col = Math.floor(idx / cols);

    // 3) offset en pixels jusqu’au coin haut-gauche de la tuile
    const px = padding + col * cell;
    const py = padding + row * cell;

    // 4) conversion en UV (0→1)
    const uOffset = px / atlasSize;
    const vOffset = py / atlasSize;
    const uScale = tileSize / atlasSize;
    const vScale = tileSize / atlasSize;

    // 5) pour éviter le bleeding dû au filtering, on peut « shrinker » un peu :
    const epsU = 2 / atlasSize;
    const epsV = 2 / atlasSize;

    return {
        offset: { x: uOffset + epsU, y: vOffset + epsV },
        scale: { x: uScale - 2 * epsU, y: vScale - 2 * epsV }
    };
}
