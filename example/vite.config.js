// vite.config.ts
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
    base: "/osm-data-3d-tiles/",
    build: {
        rollupOptions: {
            input: {
                home: resolve(__dirname, "index.html"),
                tiles2154: resolve(__dirname, "index_2154.html"),
                globe: resolve(__dirname, "index_ecef.html"),
            },
        },
    },
});