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
import { Extent, getBottomLeft, getCenter, getSize } from "ol/extent.js";
import { NodeIO } from '@gltf-transform/core';

import { getBuildingParams } from "./building/building-params.js";
import { BuildingProperties, OSMReferenceType } from "./building/type.js";
import UniqueTilePerBuilding from './unique-tile-per-building.js';
import { lonLatToECEF } from './math/utils.js';
import { Box3, BufferAttribute, BufferAttributeJSON, BufferGeometry, DoubleSide, Group, MathUtils, Mesh, MeshStandardMaterial, Vector2, Vector3 } from 'three';
import { build3dBuildings } from './build3dBuilding.js';
import RenderFeature, { toGeometry } from "ol/render/Feature.js";
import { coordinate_units_type } from './type.js';

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


function buildMeshGroup(building: Mesh) {

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


    group.rotation.x -= Math.PI / 2

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



export async function getB3dmFileFromTileCoord(tileCoord: number[]) {
    const uniqueTilePerBuilding = (global.uniqueTilePerBuilding as UniqueTilePerBuilding)

    const tileExtent = tileGrid.getTileCoordExtent(tileCoord)
    if (tileExtent.every(Number.isNaN) || tileCoord === undefined) {
        throw new B3dmException(`Incorrect tile coord ${tileCoord}`, 400)
    }


    const pbfUrl = `${global.TILE_URL}/16/${tileCoord[1]}/${tileCoord[2]}.pbf`;

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

            // Exclude features that does not belong to this tile, to avoid duplicate feature in many tiles
            const buildings = features.filter((feature) => feature.getProperties()["layer"] == "buildings")
            const tilesForeignOsmIds = await uniqueTilePerBuilding.claimBuildingsInTile(buildings.map((f) => f.getProperties()["osm_id"]), tileCoord)

            const featuresInTile = buildings.filter((feature) => !tilesForeignOsmIds.includes(feature.getProperties()["osm_id"]))
            // .filter((feature) => feature.getProperties()["osm_id"] == 69034126)

            if (featuresInTile.length == 0) {
                throw new B3dmException("No buildings in the tile", 404)
            }

            const tileCenter = getCenter(tileExtent)

            // the offset that will be applied to all the features : all features will have coordinates relative to the bottom left of the tile
            const tilePosition = new Vector2(tileCenter[0], tileCenter[1])

            const data = build3dBuildings(featuresInTile, tilePosition, tileCenter.join("_"))

            const geometry = new BufferGeometry()
            data.geometriesJson.map((geometryJson) => {
                if (geometryJson.key == "batchId") {
                    geometry.setAttribute(geometryJson.key, new BufferAttribute(new Uint16Array(geometryJson.data.array), geometryJson.data.itemSize, geometryJson.data.normalized))
                } else {

                    geometry.setAttribute(geometryJson.key, new BufferAttribute(new Float32Array(geometryJson.data.array), geometryJson.data.itemSize, geometryJson.data.normalized))
                }
            })
            const buildingMaterial = new MeshStandardMaterial({
                side: DoubleSide,
                color: "red"
                // map: global.diffuseTexture,
                // normalMap: global.normalTexture,
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
            // let lon, lat: number
            // // let buildingPositions: [number, number, number]
            // if ((global.COORDINATE_UNITS as coordinate_units_type) == "ecef") {
            //     // [lon, lat] = transform(tileCenter, 'EPSG:3857', 'EPSG:4326');
            //     // buildingPositions = lonLatToECEF(lon, lat, 0)
            // } else if ((global.COORDINATE_UNITS as coordinate_units_type) == "mercator") {
            //     // [lon, lat] = tileCenter
            //     // buildingPositions = [lon, lat, 0]
            // }
            const group = buildMeshGroup(building)

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
                    case "node":
                        osm_ref_type = OSMReferenceType[OSMReferenceType.Node];
                        break;
                    case "way":
                        osm_ref_type = OSMReferenceType[OSMReferenceType.Way];
                        break;
                    case "relation":
                        osm_ref_type = OSMReferenceType[OSMReferenceType.Relation];
                        break;
                }
                if (osm_ref_type !== undefined && osmId !== undefined) {
                    return `https://www.openstreetmap.org/${osm_ref_type.toLowerCase()}/${osmId}`
                }
                return undefined
            }
            // RTC_CENTER: [buildingPositions[0], buildingPositions[1], buildingPositions[2]] 
            const featureTableJson = { BATCH_LENGTH: featuresInTile.length };
            const batchTableJson = groupByKeys(featuresInTile.map((feature) => {
                const polygonCenter = transform(feature.getFlatMidpoint(), 'EPSG:3857', 'EPSG:4326')
                const properties = feature.getProperties() as BuildingProperties
                return { ...getBuildingParams(properties), "boxCenter": [polygonCenter[0], polygonCenter[1], 10], "osm_url": buildOpenStreetMapUrl(properties.osm_id, properties.osm_type) }
            }))

            const b3dmData = await glbToB3dm(compressedBuffer, featureTableJson, batchTableJson)
            // console.log(buildingPositions, "buildingPositions")
            // let [z, x, y] = tileCoord;
            // fs.writeFileSync('exported/b3dm/' + z + "_" + x + "_" + y + '.b3dm', b3dmData);
            // fs.writeFileSync('exported/uncompressed_' + z + "_" + x + "_" + y + '.glb', glbBuffer);
            // fs.writeFileSync('exported/compressed_' + z + "_" + x + "_" + y + '.glb', compressedBuffer);
            // await createNestedTileSetJson(tileGrid, tileExtent, "exported/" + z + "_" + x + "_" + y + ".json")
            return b3dmData

        })


}