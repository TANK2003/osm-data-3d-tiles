import {
    DataTexture, DataArrayTexture, RGBAFormat,
    UnsignedByteType,
    LinearFilter,
} from 'three';
import { EventEmitter } from 'events';

import sharp from 'sharp';
import path from 'path';

export class TextureArrayLoader extends EventEmitter {
    texture: DataArrayTexture | null = null;

    async loadImages(paths: string[]) {
        const rawImages = await Promise.all(paths.map(path => this.readImageAsRGBA(path)));

        const width = rawImages[0].info.width;
        const height = rawImages[0].info.height;
        const depth = rawImages.length;

        // Ensure all images are same size
        for (const img of rawImages) {
            if (img.info.width !== width || img.info.height !== height) {
                throw new Error('All images must have the same dimensions');
            }
        }

        // Merge all pixel data into a single buffer
        const data = new Uint8Array(width * height * 4 * depth);
        rawImages.forEach((img, i) => {
            data.set(img.data, i * width * height * 4);
        });

        this.texture = new DataArrayTexture(data, width, height, depth);
        this.texture.format = RGBAFormat;
        this.texture.type = UnsignedByteType;
        this.texture.minFilter = LinearFilter;
        this.texture.magFilter = LinearFilter;
        this.texture.generateMipmaps = false;
        this.texture.needsUpdate = true;

        this.emit('loaded', this.texture);
    }

    private async readImageAsRGBA(path: string): Promise<{ data: Uint8Array, info: sharp.OutputInfo }> {
        const image = sharp(path).ensureAlpha(); // ensures 4 channels
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
        return { data: new Uint8Array(data), info };
    }
}

export class SingleTextureLoader {
    async load(filePath: string): Promise<DataTexture> {
        const absPath = path.resolve(filePath);

        // Decode image and get raw pixel data (RGBA)
        const image = sharp(absPath).ensureAlpha();
        const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

        // Create a DataTexture
        const texture = new DataTexture(
            new Uint8Array(data),
            info.width,
            info.height,
            RGBAFormat
        );

        // texture.type = UnsignedByteType;
        // texture.minFilter = LinearFilter;
        // texture.magFilter = LinearFilter;
        // texture.generateMipmaps = false;
        // texture.needsUpdate = true;

        return texture;
    }
}