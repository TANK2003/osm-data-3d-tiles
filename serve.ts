import express from 'express';
import fs from 'fs';
import cors from 'cors';
import { texturesLoader } from "./src/texturesLoader.js";
import { B3dmException } from "./src/b3dmGenerator.js";
import { WorkerPool } from './src/building/worker/worker-pool.js';
import pkg from 'straight-skeleton';
import { tileUrl } from './config.js';
const { SkeletonBuilder } = pkg;

export function serve(appPort: number, appHost: string) {
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
