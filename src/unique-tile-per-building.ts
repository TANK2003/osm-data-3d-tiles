import { Level } from 'level';
import { EntryStream } from "level-read-stream";

import { TileCoord } from 'ol/tilecoord.js';
import { parse } from 'path';

const FLUSH_BATCH_SIZE = 10; // or when 500 entries added

export default class UniqueTilePerBuilding {

    private db: Level

    private inMemoryMap = new Map();
    // entry not already store in db
    private dirtyEntries = new Map();

    private isPendingFlush = false;

    constructor() {
        this.db = new Level('./building-tile-db');
    }

    async preloadFromLevelDB() {
        const stream = new EntryStream(this.db);
        for await (const { key, value } of stream) {
            const tileXY = (value as string).split('_').map(Number);
            this.inMemoryMap.set(parseInt(key as string), tileXY);
        }
    }

    canAddBuildingToTile(osmId: number, tileCoord: TileCoord) {
        const tileXY = [tileCoord[1], tileCoord[2]];
        return !this.inMemoryMap.has(osmId) || this.inMemoryMap.get(osmId).join('_') === tileXY.join('_');
    }

    async registerBuildingsInTile(osmIds: number[], tileCoord: TileCoord) {

        for (const osmId of osmIds.filter(osmId => !this.inMemoryMap.has(osmId))) {
            this.inMemoryMap.set(osmId, [tileCoord[1], tileCoord[2]]);
            this.dirtyEntries.set(osmId, [tileCoord[1], tileCoord[2]]);
        }

        if (this.dirtyEntries.size >= FLUSH_BATCH_SIZE && !this.isPendingFlush) {
            await this.flushDirtyEntries();
        }
    }

    async flushDirtyEntries() {
        if (this.dirtyEntries.size === 0) return;

        this.isPendingFlush = true;

        const batchOps = [];
        for (const [osmId, tileXY] of this.dirtyEntries.entries()) {

            batchOps.push({
                type: 'put',
                key: osmId.toString(),
                value: (tileXY as [number, number]).join('_')
            });
        }

        await this.db.batch(batchOps);

        this.dirtyEntries.clear();
        this.isPendingFlush = false;
    }
}