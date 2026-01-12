import express from 'express';
import pkg from 'straight-skeleton';
import fs from 'fs';
import cors from 'cors';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { texturesLoader } from "./src/texturesLoader.js";
import { B3dmException } from "./src/b3dmGenerator.js";
import { buildTileSetJson, buildTileSetJsonForTileCoord } from "./generate-tileset.js";
import { seed_b3dm } from "./seed-b3dm.js";
import { packImages } from "./src/textures/building_textures.js";
import { coordinate_units_type } from './src/type.js';
import { WorkerPool } from './src/building/worker/worker-pool.js';
import dotenv from 'dotenv';

dotenv.config();

const port = parseInt(process.env.PORT || '3300');
const host = process.env.HOST || 'localhost';
const tileUrl = process.env.TILE_URL

if (!tileUrl) {
    console.error('TILE_URL is not set');
    process.exit(1);
}




const { SkeletonBuilder } = pkg;

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
            serve(port, host, tileUrl);
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
        'generate-tileset [tileCoord] [projection]',
        'Generate all tileset or only one',
        (yargs) => {
            return yargs
                .option('tileCoord', {
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
            console.info(`🗺️  PROJECTION: ${argv.projection}`);
            if (argv.tileCoord) {
                console.info(`🗺️  GENERATE TILESET FOR TILE ${argv.tileCoord}`);
                buildTileSetJsonForTileCoord(argv.tileCoord).then(() => {
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


function serve(appPort: number, appHost: string, tileUrl: string) {
    Promise.all([
        SkeletonBuilder.init(),
        ...texturesLoader
    ])
        .then(() => {
            global.TILE_URL = tileUrl
            const workerPool = new WorkerPool({ workerPath: "./src/building/worker/tile-worker.ts", size: 10 })

            const app = express();
            app.use((req, res, next) => {
                req.url = req.url.replace(/\/{2,}/g, '/');
                next();
            });

            app.use(cors({
                origin: "*",
                credentials: true
            }));

            app.get(['/:b3dm_path', '/subtiles/:b3dm_path'], (req, res) => {
                let b3dm_path = req.path;
                if (b3dm_path.startsWith('\/')) {
                    b3dm_path = b3dm_path.slice(1);
                }
                console.log('Received file:', b3dm_path);
                if (!b3dm_path.endsWith(".b3dm") && !b3dm_path.endsWith(".json")) {
                    res.status(400).send('Invalid  path');
                    return
                }

                if (b3dm_path.endsWith(".json")) {
                    const filePath = "./exported/" + b3dm_path
                    if (!fs.existsSync(filePath)) {
                        return res.status(404).json({ error: 'File not found' });
                    }
                    fs.readFile(filePath, 'utf8', (err, data) => {
                        if (err) {
                            res.status(500).send('Could not read file');
                            return
                        }
                        const jsonData = JSON.parse(data);
                        res.json(jsonData);
                        return
                    })

                } else {

                    if (b3dm_path.startsWith('subtiles/')) {
                        b3dm_path = b3dm_path.replace("subtiles/", "");
                    }
                    const b3dm_coordinates = b3dm_path.replace(".b3dm", "").split("_")
                    if (b3dm_coordinates.length !== 3) {
                        res.status(400).send('Invalid  path');
                        return
                    }

                    const filePath = "./exported/b3dm/" + b3dm_path
                    if (fs.existsSync(filePath)) {
                        fs.readFile(filePath, (err, data) => {
                            res.send(data);
                            return
                        })
                    } else {
                        const tileCoord = b3dm_coordinates.map((i) => parseInt(i))
                        return workerPool.exec(tileCoord).then((glbBuffer) => {
                            res.send(glbBuffer)
                            return
                        }).catch((error) => {
                            console.error(error)
                            if (error instanceof B3dmException) {
                                res.status(error.statusCode).send(error.message);
                                return
                            }
                            res.status(500).send(error.message);
                            return
                        })

                    }



                }

            })




            app.listen(appPort, appHost, () => {


                console.log(`Example app listening on port ${appPort}`)
            })
        })

}
