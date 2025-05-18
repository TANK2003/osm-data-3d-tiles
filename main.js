import express from 'express';
import pkg from 'straight-skeleton';
import fs from 'fs';
import cors from 'cors';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import UniqueTilePerBuilding from "./src/unique-tile-per-building.js";
import { texturesLoader } from "./src/texturesLoader.js";
import { getB3dmFileFromTileCoord, B3dmException } from "./src/b3dmGenerator.js";
import { buildTileSetJson, } from "./generate-tileset.js";
import { seed_b3dm } from "./seed-b3dm.js";
// import cluster from "cluster";
// import os from "os"
// if (cluster.isPrimary) {
//     const numCPUs = os.cpus().length;
//     for (let i = 0; i < numCPUs; i++) {
//       cluster.fork();
//     }
//   } 
const { SkeletonBuilder } = pkg;

const argv = yargs(hideBin(process.argv))
    .command(
        'serve [port] [host] [tile_url]',
        'start the server',
        (yargs) => {
            return yargs
                .option('port', {
                    describe: 'Port to bind on',
                    default: 3300
                })
                .option('host', {
                    type: 'string',
                    default: 'localhost',
                    describe: 'Host to bind on'
                })
                .option('tile_url', {
                    type: 'string',
                    describe: 'Tile URL',
                    demandOption: true
                })
        },
        (argv) => {
            console.info(`🗺️ START SERVER`);
            serve(argv.port, argv.host, argv.tile_url);
        }
    )
    .command(
        'seed-b3dm [tile_json] [tile_url]',
        'start the server',
        (yargs) => {
            return yargs
                .option('tile_json', {
                    type: 'string',
                    describe: 'Name of the tile eg: 12_2073_1408.json',
                    demandOption: true
                })
                .option('tile_url', {
                    type: 'string',
                    describe: 'Tile URL',
                    demandOption: true
                })
        },
        (argv) => {
            console.info(`🗺️  SEED B3DM of tile json ${argv.tile_json}`);
            seed_b3dm(argv.tile_json, argv.tile_url).then(() => {
                console.log("✅  Done")
            })
        }
    )
    .command(
        'generate-tileset',
        'Generate all tileset',
        (yargs) => {

        },
        () => {
            console.info(`🗺️  GENERATE TILESET`);
            buildTileSetJson().then(() => {
                console.log("✅  Done")
            })
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


function serve(appPort, appHost, tileUrl) {


    global.TILE_URL = tileUrl

    const app = express();
    app.use((req, res, next) => {
        req.url = req.url.replace(/\/{2,}/g, '/');
        next();
    });

    app.use(cors({
        origin: "*",
        credentials: true
    }));


    global.uniqueTilePerBuilding = new UniqueTilePerBuilding()


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

                return getB3dmFileFromTileCoord(b3dm_coordinates).then((glbBuffer) => {
                    res.send(glbBuffer)
                    return
                }).catch((error) => {
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


    Promise.all([
        global.uniqueTilePerBuilding.preloadFromLevelDB(),
        SkeletonBuilder.init(),
        ...texturesLoader
    ])
        .then(() => {

            app.listen(appPort, appHost, () => {

                // getB3dmFileFromTileCoord([16, 33185, 22546])
                // getB3dmFileFromTileCoord([16, 33174, 22536])

                console.log(`Example app listening on port ${appPort}`)
            })
        })

}