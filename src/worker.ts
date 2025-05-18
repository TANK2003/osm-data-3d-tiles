import { parentPort, workerData } from 'worker_threads';

import pkg from 'straight-skeleton';
import { build3dBuildings } from './build3dBuilding.js';
import { texturesLoader } from './texturesLoader.js';
const { SkeletonBuilder } = pkg;




let moduleReady: Promise<void>;

moduleReady = Promise.all([
  ...texturesLoader,
  SkeletonBuilder.init().then(() => {
    console.log('Module initialized');
  })
]).then(() => {
  console.log('Module ready');
})

parentPort.on('message', async (data) => {
  console.log('data received 1');
  await moduleReady;
  console.log('data received 2');
  const result = build3dBuildings(data.features, data.worldBuildingPosition, data.tile_key);
  parentPort.postMessage(result);
});





