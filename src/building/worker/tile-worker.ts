// tile-worker.js (ESM)
import { parentPort, workerData } from "node:worker_threads";
import { getB3dmFileFromTileCoord } from "../../b3dmGenerator.js";
import UniqueTilePerBuilding from "../../unique-tile-per-building.js";
import pkg from 'straight-skeleton';
const { SkeletonBuilder } = pkg;

global.TILE_URL = workerData.TILE_URL
global.COORDINATE_UNITS = workerData.COORDINATE_UNITS
global.diffuseMapImages = workerData.diffuseMapImages
global.uniqueTilePerBuilding = new UniqueTilePerBuilding()


let moduleReady: Promise<void>;

parentPort.on("message", async ({ jobId, payload }: { jobId: string; payload: number[] }) => {
  await moduleReady
  try {
    const buf = await getB3dmFileFromTileCoord(payload);
    const u8 = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    parentPort.postMessage(
      { ok: true, jobId, result: u8 },
      [u8.buffer] // transfert ownership
    );
  } catch (e) {
    parentPort.postMessage({ ok: false, jobId, error: e?.stack || String(e) });
  }
});

moduleReady = SkeletonBuilder.init()