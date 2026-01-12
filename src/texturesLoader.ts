import fsPromise from 'fs/promises';
import { TextureLoader } from 'node-three-gltf';
import { ClampToEdgeWrapping, LinearFilter, RGBAFormat, SRGBColorSpace, UnsignedByteType } from 'three';
import { buildingTextures } from './textures/building_textures.js';


export const texturesLoader = [
    fsPromise.readFile("./assets/textures/packed/diffuse.json", "utf-8").then((data) => {
        global.diffuseMapImages = JSON.parse(data)
        // global.diffuseMapImages.getImageFrame = (textureId) => {
        //     return global.diffuseMapImages["frames"][buildingTextures[(4 * textureId)].url]["frame"]
        // }
    }),
    new TextureLoader().loadAsync("./assets/textures/packed/diffuse.png").then((texture) => {
        global.diffuseTexture = texture
        global.diffuseTexture.format = RGBAFormat;
        global.diffuseTexture.internalFormat = "RGBA8"
        // global.diffuseTexture.type = UnsignedByteType;
        global.diffuseTexture.colorSpace = SRGBColorSpace;
        // global.diffuseTexture.generateMipmaps = true;
        // global.diffuseTexture.magFilter = LinearFilter
        // global.diffuseTexture.minFilter = LinearFilter;
        global.diffuseTexture.wrapS = ClampToEdgeWrapping
        global.diffuseTexture.wrapT = ClampToEdgeWrapping
    }),
    new TextureLoader().loadAsync("./assets/textures/packed/normal.png").then((texture) => {
        global.normalTexture = texture
        global.normalTexture.format = RGBAFormat;
    }),
    new TextureLoader().loadAsync("./assets/textures/packed/mask.png").then((texture) => {
        global.maskTexture = texture
        global.maskTexture.format = RGBAFormat;
        global.maskTexture.internalFormat = "RGBA8"
        global.maskTexture.type = UnsignedByteType;
        global.maskTexture.colorSpace = SRGBColorSpace;
        // global.maskTexture.generateMipmaps = true;
        // global.maskTexture.magFilter = LinearFilter
        // global.maskTexture.wrapS = ClampToEdgeWrapping
        // global.maskTexture.wrapT = ClampToEdgeWrapping
        // global.maskTexture.minFilter = LinearFilter;
    }),
    new TextureLoader().loadAsync("./assets/textures/packed/glow.png").then((texture) => {
        global.glowTexture = texture
        global.glowTexture.format = RGBAFormat;
        global.glowTexture.internalFormat = "RGBA8"
        global.glowTexture.type = UnsignedByteType;
        global.glowTexture.colorSpace = SRGBColorSpace;
        // global.glowTexture.generateMipmaps = true;
        // global.glowTexture.magFilter = LinearFilter
        // global.glowTexture.wrapS = ClampToEdgeWrapping
        // global.glowTexture.wrapT = ClampToEdgeWrapping
        // global.glowTexture.minFilter = LinearFilter;
    })
]