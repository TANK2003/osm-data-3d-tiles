import dotenv from 'dotenv';
dotenv.config();

const port = parseInt(process.env.PORT || '3300');
const host = process.env.HOST || 'localhost';
const tileUrl = process.env.TILE_URL;
const extent = process.env.EXTENT;

if (!tileUrl) {
    console.error('TILE_URL is not set in .env file');
    process.exit(1);
}

if (!extent) {
    console.error('EXTENT is not set in .env file');
    process.exit(1);
}

// Validate and parse extent
const extentArray = extent.split(',').map(coord => parseFloat(coord.trim()));

if (extentArray.length !== 4) {
    console.error('EXTENT must contain exactly 4 values (minX, minY, maxX, maxY)');
    process.exit(1);
}

if (extentArray.some(val => isNaN(val))) {
    console.error('EXTENT contains invalid numbers');
    process.exit(1);
}
const [minX, minY, maxX, maxY] = extentArray;

if (minX >= maxX || minY >= maxY) {
    console.error('EXTENT values are invalid: minX must be < maxX and minY must be < maxY');
    process.exit(1);
}

const TILESET_ROOT_PATH = "./exported/"
const B3DM_ROOT_PATH = "./exported/b3dm/"

const TILESET_SUBTILES_PATH = TILESET_ROOT_PATH + "subtiles/"

export { port, host, tileUrl, extentArray, TILESET_ROOT_PATH, B3DM_ROOT_PATH, TILESET_SUBTILES_PATH };