import Database from "better-sqlite3";
import { TileCoord } from "ol/tilecoord.js";




export default class UniqueTilePerBuilding {
    private db: Database.Database;

    private stmtInsertOrIgnore: Database.Statement;
    private stmtSelectTile: Database.Statement;

    constructor(dbPath = "./building-tile-db/db.sqlite") {
        this.db = new Database(dbPath);


        this.db.pragma("journal_mode = WAL");
        this.db.pragma("synchronous = NORMAL");
        this.db.pragma("temp_store = MEMORY");

        this.db.exec(`
      CREATE TABLE IF NOT EXISTS building_tile (
        osm_id INTEGER PRIMARY KEY,
        tile_x INTEGER NOT NULL,
        tile_y INTEGER NOT NULL
      );
    `);

        this.stmtInsertOrIgnore = this.db.prepare(`
      INSERT OR IGNORE INTO building_tile (osm_id, tile_x, tile_y)
      VALUES (?, ?, ?)
    `);

        this.stmtSelectTile = this.db.prepare(`
      SELECT osm_id
      FROM building_tile
      WHERE tile_x != ? AND tile_y != ? AND osm_id not in (?)
      LIMIT 1
    `);
    }



    /**
     *  traite une liste d'osmIds pour une tuile donnée.
     * Retourne ids non "possédés" par cette tuile
     */
    async claimBuildingsInTile(osmIds: number[], tileCoord: TileCoord): Promise<number[]> {
        const tileX = tileCoord[1];
        const tileY = tileCoord[2];

        const foreign: number[] = [];

        const tx = this.db.transaction((ids: number[]) => {
            for (const osmId of ids) {
                this.stmtInsertOrIgnore.run(osmId, tileX, tileY);
            }
        });

        tx(osmIds);
        this.stmtSelectTile.all(tileX, tileY, osmIds.join(',')).forEach((row) => foreign.push(row["osm_id"]));
        return foreign
    }

    close() {
        this.db.close();
    }
}