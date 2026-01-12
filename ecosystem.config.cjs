module.exports = {
    apps: [
        {
            name: "osm-data-3d-tiles",
            script: "main.js",
            interpreter: "node",
            node_args: "--loader ts-node/esm",
            args: "serve  --port 3300 --host localhost --tile_url https://buildings.dataosm.info/data/data"
        }
    ]
};