import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { seed_b3dm } from "./seed-b3dm.js";
import { packImages } from "./src/textures/building_textures.js";
import { coordinate_units_type } from './src/type.js';

import { port, host, tileUrl, extentArray } from './config.js';
import { serve } from './serve.js';
import { buildTileSetJson, buildTileSetJsonForTileCoord } from './generate-tileset.js';


global.EXTENT = extentArray;


console.log('Project EXTENT:', extentArray);



const argv = yargs(hideBin(process.argv))
    .command(
        'pack-textures',
        'Generate atlas of textures',
        (yargs) => {
            return yargs
        },
        () => {
            console.info(`🗺️ START PACK TEXTURES`);
            packImages().then(() => {
                console.log("✅ Images packed")
            }).catch((error) => {
                console.error("❌ Error packing images:", error);
                process.exit(1);
            })
        }
    )
    .command(
        'serve',
        'start the server',
        (yargs) => {
            return yargs
        },
        () => {
            console.info(`🗺️ START SERVER`);
            serve(port, host);
        }
    )
    .command(
        'seed-b3dm [tile_json]',
        'start the server',
        (yargs) => {
            return yargs
                .option('tile_json', {
                    type: 'string',
                    describe: 'Name of the tile eg: 12_2073_1408.json',
                    demandOption: true
                })
        },
        (argv) => {
            console.info(`🗺️  SEED B3DM of tile json ${argv.tile_json}`);
            seed_b3dm(argv.tile_json, tileUrl).then(() => {
                console.log("✅  Done")
            }).catch((error) => {
                console.error("❌ Error seeding b3dm:", error);
                process.exit(1);
            })
        }
    )
    .command(
        'generate-tileset',
        'Generate all tileset or only one',
        (yargs) => {
            return yargs
                .option('tile_coord', {
                    type: 'string',
                    describe: 'Name of the tile eg: 16_33174_22536',
                    demandOption: false
                })
                .option('projection', {
                    type: 'string',
                    default: 'mercator',
                    choices: ['mercator', 'ecef'],
                    describe: 'Projection of the tile eg: mercator, ecef',
                    demandOption: false
                })
        },
        (argv) => {
            global.COORDINATE_UNITS = argv.projection as coordinate_units_type;
            console.info(`🗺️  PROJECTION: ${argv.projection} and TILE COORD: ${argv.tile_coord}`);
            if (argv.tile_coord) {
                console.info(`🗺️  GENERATE TILESET FOR TILE ${argv.tile_coord}`);
                buildTileSetJsonForTileCoord(argv.tile_coord).then(() => {
                    console.log("✅  Done")
                }).catch((error) => {
                    console.error("❌ Error generating tileset:", error);
                    process.exit(1);
                })
            } else {
                console.info(`🗺️  GENERATE TILESET`);
                buildTileSetJson().then(() => {
                    console.log("✅  Done")
                }).catch((error) => {
                    console.error("❌ Error generating tileset:", error);
                    process.exit(1);
                })
            }

        }
    )
    .option('verbose', {
        alias: 'v',
        type: 'boolean',
        description: 'Run with verbose logging'
    })
    .strict()
    .help()
    .parse();

