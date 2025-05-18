## Build the tileset.json
```sh
npm run start generate-tileset
```

## Start the server
```sh
npm run start  serve --port 3300 --host 192.168.1.188 --tile_url http://localhost:8082/data/data
```

## To seed all b3dm files of a tile
```sh
npm run start  seed-b3dm  --tile_json 12_2074_1408.json  --tile_url http://localhost:8082/data/data
```
