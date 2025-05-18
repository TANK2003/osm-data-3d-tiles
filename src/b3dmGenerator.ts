import {
    GLTFExporter,
} from 'node-three-gltf';
import { KHRDracoMeshCompression } from '@gltf-transform/extensions';
// @ts-ignore
import { TileFormats } from "3d-tiles-tools";
import draco3d from 'draco3dgltf';
import { weld } from '@gltf-transform/functions';
import Polygon from 'ol/geom/Polygon.js';
import { MVT } from 'ol/format.js';
import { transform } from 'ol/proj.js';
import { createXYZ } from "ol/tilegrid.js";
import { getBottomLeft } from "ol/extent.js";
import { NodeIO } from '@gltf-transform/core';

import { getBuildingParams } from "./building/building-params.js";
import { OSMReferenceType } from "./building/type.js";
import UniqueTilePerBuilding from './unique-tile-per-building.js';
import { lonLatToECEF } from './math/utils.js';
import { Box3, BufferAttribute, BufferAttributeJSON, BufferGeometry, DoubleSide, Group, MathUtils, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import { build3dBuildings } from './build3dBuilding.js';
import { createNestedTileSetJson } from './tileset.js';

async function fetchWithRetry(url, options = {}, retries = 3, delay = 2000) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) throw new Error(`HTTP error ${response.status}`);
            return response;
        } catch (err) {
            if (attempt === retries) throw err;
            console.warn(`Retry ${attempt + 1} after error: ${err.message}`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
}


const tileGrid = createXYZ({ tileSize: 512 })


function buildMeshGroup(building: Mesh, lat: number) {
    const scale = Math.cos(lat * Math.PI / 180);
    building.geometry.computeBoundingBox();
    const geom = building.geometry
    const box = new Box3().setFromObject(building);
    let center = new Vector3();
    box.getCenter(center);
    geom.center();
    building.position.copy(center);


    building.geometry.computeBoundingBox();

    const group = new Group();
    group.add(building);

    // Get from Cesuim with this code : 
    // tileset.tileLoad.addEventListener((tile) => {
    //     const referenceMatrix = tile.content._model.referenceMatrix;

    //     const rot3 = new Cesium.Matrix3();
    //     Cesium.Matrix4.getMatrix3(referenceMatrix, rot3);
    //     const quat = Cesium.Quaternion.fromRotationMatrix(rot3);
    //     const hpr = Cesium.HeadingPitchRoll.fromQuaternion(quat);

    //     console.log(`  Heading : ${Cesium.Math.toDegrees(hpr.heading).toFixed(1)}°`);
    //     console.log(`  Pitch   : ${Cesium.Math.toDegrees(hpr.pitch).toFixed(1)}°`);
    //     console.log(`  Roll    : ${Cesium.Math.toDegrees(hpr.roll).toFixed(1)}°`);

    // });
    const heading = MathUtils.degToRad(92.3);
    const roll = MathUtils.degToRad(41.1);
    group.rotation.set(roll, heading, 0, "YXZ")
    group.rotation.x -= Math.PI / 2

    group.scale.set(scale, scale, scale);
    group.updateMatrixWorld(true);
    return group
}

export class B3dmException extends Error {
    statusCode: number
    constructor(message: string, statusCode: number, error = "") {
        super(message);
        console.error(error || message)
        this.name = this.constructor.name;
        this.statusCode = statusCode;
    }
}



export async function getB3dmFileFromTileCoord(tileCoord) {
    const uniqueTilePerBuilding = (global.uniqueTilePerBuilding as UniqueTilePerBuilding)
    tileCoord = tileCoord.map((i) => parseInt(i))
    const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
    if (tileExtent.every(Number.isNaN) || tileCoord === undefined) {
        throw new B3dmException("Incorrect tile coord", 400)
    }

    const tileCenter = getBottomLeft(tileExtent)
    let pbfUrl = `${global.TILE_URL}/16/${tileCoord[1]}/${tileCoord[2]}.pbf`;

    return await fetchWithRetry(pbfUrl)
        .catch(error => {
            throw new B3dmException("Could not find the tile", 404, error)
        })
        .then(response => response.arrayBuffer())
        .then(async (arrayBuffer) => {
            const format = new MVT();
            const features = format.readFeatures(arrayBuffer, {
                extent: tileExtent,
                featureProjection: 'EPSG:3857'
            });

            const serializableFeatures = features.filter((feature) => feature.getProperties()["layer"] == "buildings" && ["bench", "construction", "streetLamp", "busStop"].indexOf(feature.getProperties()["type"]) == -1)
                .filter((feature) => uniqueTilePerBuilding.canAddBuildingToTile(feature.getProperties()["osmId"], tileCoord))
                // .filter((feature) => feature.getProperties()["osmId"] == 69034126)
                .map((feature) => {
                    return {
                        "flatCoordinates": feature.getFlatCoordinates(),
                        // @ts-expect-error
                        "ends_": feature.ends_,
                        "properties": feature.getProperties()
                    }
                })
            if (serializableFeatures.length == 0) {
                throw new B3dmException("No buildings in the tile", 404)
            }

            await uniqueTilePerBuilding.registerBuildingsInTile(serializableFeatures.map((feature) => feature.properties["osmId"]), tileCoord)


            const [lon, lat] = transform(tileCenter, 'EPSG:3857', 'EPSG:4326');
            const buildingPositions = lonLatToECEF(lon, lat, 0)

            const worldBuildingPosition = new Vector2(tileCenter[0], tileCenter[1])
            const data = build3dBuildings(serializableFeatures, worldBuildingPosition, tileCenter.join("_"))

            const geometry = new BufferGeometry()
            data.geometriesJson.map((geometryJson) => {
                geometry.setAttribute(geometryJson.key, new BufferAttribute(new Float32Array(geometryJson.data.array), geometryJson.data.itemSize, geometryJson.data.normalized))
            })

            const buildingMaterial = new MeshStandardMaterial({
                side: DoubleSide,
                map: global.diffuseTexture,
                normalMap: global.normalTexture,
                // aoMap: global.maskTexture,
                // roughnessMap: global.maskTexture,
                // metalnessMap: global.maskTexture,
                // emissiveMap: global.glowTexture,
                // emmissive: new Color(1, 1, 1),
                // emissiveIntensity: 0.1,
                // roughness: 0.0,
                // metalness: 0.0,
            })
            const building = new Mesh(geometry, buildingMaterial)

            const group = buildMeshGroup(building, lat)

            const exporter = new GLTFExporter();


            const glbBuffer = await exporter.parseAsync(group, {
                binary: true, trs: false, forceIndices: true, truncateDrawRange: false
            })

            const io = new NodeIO()
                .registerExtensions([KHRDracoMeshCompression])
                .registerDependencies({
                    'draco3d.encoder': await draco3d.createEncoderModule(),
                });

            const document = await io.readBinary(Buffer.from(glbBuffer));

            // Je ne sais pas pourquoi lorsque j'indexe la géomérie, elle ne s'affiche pas sous CESUIM
            // Pourtant j'en ai besoin avant de compresser (en quantizationVolume: "scene" ), car la compression ne marche pas sans index
            // @ts-expect-error
            await document.transform(weld({ tolerance: 1e-10 }))

            document.createExtension(KHRDracoMeshCompression)
                .setRequired(true)
                .setEncoderOptions({
                    method: KHRDracoMeshCompression.EncoderMethod.EDGEBREAKER,
                    quantizationVolume: "scene",
                    // quantizationBits: {
                    //     position: 14,
                    //     uv: 14,
                    //     normal: 14,
                    //     texcoord: 12
                    // }
                })

            const compressedBuffer = await io.writeBinary(document);

            async function glbToB3dm(glbData, featureTableJson, batchTableJson) {
                const featureTableBinary = undefined;
                const batchTableBinary = undefined;
                const b3dmTileData = TileFormats.createB3dmTileDataFromGlb(
                    glbData,
                    featureTableJson,
                    featureTableBinary,
                    batchTableJson,
                    batchTableBinary
                );
                const b3dmData = TileFormats.createTileDataBuffer(b3dmTileData);
                return b3dmData
            }

            function groupByKeys(array) {
                if (array.length === 0) return {};

                const keys = Object.keys(array[0]);
                const result = {};

                for (const key of keys) {
                    result[key] = array.map(item => item[key]);
                }

                return result;
            }
            function buildOpenStreetMapUrl(osmId, osmType) {
                let osm_ref_type = undefined
                switch (osmType) {
                    case 0:
                        osm_ref_type = OSMReferenceType[OSMReferenceType.Node];
                        break;
                    case 1:
                        osm_ref_type = OSMReferenceType[OSMReferenceType.Way];
                        break;
                    case 2:
                        osm_ref_type = OSMReferenceType[OSMReferenceType.Relation];
                        break;
                }
                if (osm_ref_type !== undefined && osmId !== undefined) {
                    return `https://www.openstreetmap.org/${osm_ref_type.toLowerCase()}/${osmId}`
                }
                return undefined
            }
            const featureTableJson = { BATCH_LENGTH: serializableFeatures.length, RTC_CENTER: [buildingPositions[0], buildingPositions[1], buildingPositions[2]] };
            const batchTableJson = groupByKeys(serializableFeatures.map((feature) => {
                const polygon = new Polygon(feature.flatCoordinates, 'XY', feature.ends_)
                const polygonCenter = transform(polygon.getInteriorPoint().getCoordinates(), 'EPSG:3857', 'EPSG:4326')
                // @ts-expect-error
                return { ...getBuildingParams(feature.properties), "boxCenter": [polygonCenter[0], polygonCenter[1], 10], "Url OSM": buildOpenStreetMapUrl(feature.properties["osmId"], feature.properties["osmType"]) }
            }))

            const b3dmData = await glbToB3dm(compressedBuffer, featureTableJson, batchTableJson)

            // let [z, x, y] = tileCoord;
            // fs.writeFileSync('exported/b3dm/' + z + "_" + x + "_" + y + '.b3dm', b3dmData);
            // fs.writeFileSync('exported/uncompressed_' + z + "_" + x + "_" + y + '.glb', glbBuffer);
            // fs.writeFileSync('exported/compressed_' + z + "_" + x + "_" + y + '.glb', compressedBuffer);
            // await createNestedTileSetJson(tileGrid, tileExtent, "exported/" + z + "_" + x + "_" + y + ".json")
            return b3dmData

        })


}