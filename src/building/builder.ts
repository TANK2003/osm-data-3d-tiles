import { Vector2, Vector3 } from "three";
import { BaseDescriptor, BuildingDescriptor, BuildingFacadeMaterial, BuildingProperties, BuildingRoofMaterial, BuildingRoofType, RoofType } from "./type.js";

import Tile3DMultipolygon from "./tile3d-multipolygon.js";
import Tile3DRing, { Tile3DRingType } from "./tile-3d-ring.js";
import { BuildingBuilder } from "./building-builder.js";
import { OMBBResult } from "./ombb-params.js";
import { ExtrudedTextures } from "./roof/textures.js";
import { Tile3DFeaturesToBuffersConverter } from "./tile3d-features-to-buffers-converter.js";
import { getRoofTypeFromString } from "./roof/utils.js";
import Vec2 from "../math/vector2.js";
import Vec3 from "../math/vector3.js";
import { ColorParser } from "./color-parser.js";
import { VectorArea, VectorAreaRing, VectorAreaRingType } from "../ring/ring-type.js";



const TERRAINMAXHEIGHT = 0;
const TERRAINMINHEIGHT = 0

export class Builder {


    multipolygon: Tile3DMultipolygon
    rings: Array<VectorAreaRing>
    private mercatorScale: number = 1.52122668;
    descriptor: BuildingDescriptor
    feature: VectorArea<BuildingDescriptor>
    tilePosition: Vec3
    skirtOffset: number
    outlineHeight: number
    constructor(
        feature: VectorArea<BuildingDescriptor>,
        tilePosition: [number, number, number],
        skirtOffset: number,
        outlineHeight: number
    ) {
        this.skirtOffset = skirtOffset ?? 0
        this.outlineHeight = outlineHeight ?? 1

        this.feature = feature
        this.descriptor = feature.descriptor;
        this.rings = feature.rings;
        this.tilePosition = new Vec3(tilePosition[0], tilePosition[1], tilePosition[2]);
    }



    public getMultipolygon(): Tile3DMultipolygon {
        if (this.multipolygon == undefined) {
            this.multipolygon = new Tile3DMultipolygon(this.feature.osmReference);

            for (const ring of this.rings) {
                const type = ring.type === VectorAreaRingType.Inner ? Tile3DRingType.Inner : Tile3DRingType.Outer;

                const nodes = ring.nodes.map(node => {

                    return new Vec2(node.x, node.y)
                });

                this.multipolygon.addRing(new Tile3DRing(type, nodes));
            }

            if (this.descriptor.ombb) {
                const newOmbb = this.descriptor.ombb.map((corner) => {
                    const newCorner = Vec2.clone(corner)
                    newCorner.x -= this.tilePosition.x
                    newCorner.y -= this.tilePosition.y
                    return newCorner
                })
                this.multipolygon.setOMBB(newOmbb as OMBBResult);
            }
            if (Boolean(this.descriptor.skeleton)) {
                const skeleton = this.descriptor.skeleton
                try {
                    for (let index = 0; index < skeleton.vertices.length; index++) {
                        const vertex = skeleton.vertices[index];
                        vertex[0] -= this.tilePosition.x
                        vertex[1] -= this.tilePosition.y
                    }
                    this.multipolygon.setStraightSkeleton(skeleton)
                } catch (error) {
                    console.error(error, this.feature.osmReference, this.descriptor)
                }

            }


        }

        return this.multipolygon;
    }


    private handleBuilding() {
        const multipolygon = this.getMultipolygon();

        let builder = new BuildingBuilder(multipolygon)
        const noDefaultRoof = builder.getAreaToOMBBRatio() < 0.75 || multipolygon.getArea() < 10;

        const roofParams = this.getRoofParams(noDefaultRoof, this.descriptor.buildingHeight == 4);
        // The offset between the roof and the facade
        const skirtOffset = this.skirtOffset
        const outlineHeight = this.outlineHeight


        const facadeMinHeight = this.descriptor.buildingFoundation ? TERRAINMAXHEIGHT : TERRAINMINHEIGHT;
        const foundationHeight = TERRAINMAXHEIGHT - TERRAINMINHEIGHT;


        const { skirt, facadeHeightOverride } = builder.addRoof({
            terrainHeight: facadeMinHeight,
            type: roofParams.type,
            buildingHeight: this.descriptor.buildingHeight,
            minHeight: this.descriptor.buildingHeight - this.descriptor.buildingRoofHeight + skirtOffset,
            height: this.descriptor.buildingRoofHeight,
            direction: this.descriptor.buildingRoofDirection,
            orientation: this.descriptor.buildingRoofOrientation,
            angle: this.descriptor.buildingRoofAngle,
            textureId: roofParams.textureId,
            color: roofParams.color,
            scaleX: roofParams.scaleX,
            scaleY: roofParams.scaleY,
            isStretched: roofParams.isStretched,
            flip: false
        });

        const facadeParams = this.getFacadeParams();

        builder.addWalls({
            terrainHeight: facadeMinHeight,
            levels: this.descriptor.buildingLevels,
            windowWidth: facadeParams.windowWidth,
            minHeight: this.descriptor.buildingMinHeight,
            height: facadeHeightOverride ?? (this.descriptor.buildingHeight - this.descriptor.buildingRoofHeight),
            skirt: skirt,
            skirtOffset: skirtOffset,
            color: facadeParams.color,
            textureIdWall: facadeParams.textureIdWall,
            textureIdWindow: facadeParams.textureIdWindow,
            windowSeed: null
        });

        if (this.descriptor.buildingFoundation && foundationHeight > 0.5) {
            builder.addWalls({
                terrainHeight: TERRAINMINHEIGHT,
                levels: foundationHeight / 4,
                windowWidth: facadeParams.windowWidth,
                minHeight: 0,
                height: TERRAINMAXHEIGHT - TERRAINMINHEIGHT,
                skirt: null,
                color: facadeParams.color,
                textureIdWall: facadeParams.textureIdWall,
                textureIdWindow: facadeParams.textureIdWall,
                windowSeed: null
            });
        }


        // builder.addOutLine({
        //     terrainHeight: facadeMinHeight,
        //     minHeight: this.descriptor.buildingHeight - this.descriptor.buildingRoofHeight,
        //     textureId: this.feature.descriptor.station_id ? this.feature.descriptor.station_id + 100 : 100,
        //     color: roofParams.color,
        //     outlineHeight: outlineHeight
        // })


        let features = [
            builder.getGeometry(),
            builder.getTerrainMaskGeometry()
        ];

        if (this.descriptor.label) {
            const pole = this.getMultipolygon().getPoleOfInaccessibility();
            const height = facadeMinHeight + this.descriptor.buildingHeight + 5;
            const labelFeature = {
                type: 'label',
                position: [pole.x, height, pole.y],
                priority: pole.z,
                text: this.descriptor.label
            };

            features.push(labelFeature as any);
        }

        return features;

    }

    getFeatures() {
        const collection = {
            extruded: [],
            projected: [],
            hugging: [],
            terrainMask: [],
            labels: [],
            instances: []
        };

        const output = this.handleBuilding()

        if (output) {
            for (const feature of output) {
                if (feature === null) {
                    continue;
                }
                switch (feature.type) {
                    case 'instance':
                        collection.instances.push(feature);
                        break;
                    case 'projected':
                        collection.projected.push(feature);
                        break;
                    case 'extruded':
                        collection.extruded.push(feature);
                        break;
                    case 'hugging':
                        collection.hugging.push(feature);
                        break;
                    case 'mask':
                        collection.terrainMask.push(feature);
                        break;
                    case 'label':
                        collection.labels.push(feature);
                        break;
                }
            }
        }
        const buffers = Tile3DFeaturesToBuffersConverter.convert(collection)
        return buffers
    }



    private getRoofParams(noDefaultRoof: boolean, buildingWithOneLevel: boolean = false): {
        type: RoofType;
        textureId: number;
        color: number;
        scaleX: number;
        scaleY: number;
        isStretched: boolean;
    } {
        const roofType = getRoofTypeFromString(this.descriptor.buildingRoofType);
        const roofMaterial = this.descriptor.buildingRoofMaterial;
        let roofColor = this.descriptor.buildingRoofColor;

        const materialToTextureId: Record<BuildingRoofMaterial, number> = {
            default: ExtrudedTextures.RoofConcrete,
            tiles: ExtrudedTextures.RoofTiles,
            metal: ExtrudedTextures.RoofMetal,
            concrete: ExtrudedTextures.RoofConcrete,
            thatch: ExtrudedTextures.RoofThatch,
            eternit: ExtrudedTextures.RoofEternit,
            grass: ExtrudedTextures.RoofGrass,
            glass: ExtrudedTextures.RoofGlass,
            tar: ExtrudedTextures.RoofTar
        };
        const textureIdToScale: Record<number, Vector2> = {
            [ExtrudedTextures.RoofTiles]: new Vector2(3, 3),
            [ExtrudedTextures.RoofMetal]: new Vector2(4, 4),
            [ExtrudedTextures.RoofConcrete]: new Vector2(10, 10),
            [ExtrudedTextures.RoofThatch]: new Vector2(8, 8),
            [ExtrudedTextures.RoofEternit]: new Vector2(5, 5),
            [ExtrudedTextures.RoofGrass]: new Vector2(12, 12),
            [ExtrudedTextures.RoofGlass]: new Vector2(4, 4),
            [ExtrudedTextures.RoofTar]: new Vector2(4, 4),
        };
        const scaleFactor = 1

        if (roofMaterial === 'default') {
            return {
                type: roofType,
                textureId: ExtrudedTextures.RoofGeneric3,
                color: 0xFF333333,
                scaleX: 32 * scaleFactor,
                scaleY: 32 * scaleFactor,
                isStretched: false
            }
        } else {

            let id = materialToTextureId[roofMaterial];
            let scale = textureIdToScale[id] ?? new Vector2(1, 1);
            return {
                type: roofType,
                textureId: id,
                color: roofColor,
                scaleX: scale.x * scaleFactor,
                scaleY: scale.y * scaleFactor,
                isStretched: false
            };
        }

    }



    private getFacadeParams(): {
        windowWidth: number;
        color: number;
        textureIdWindow: number;
        textureIdWall: number;
    } {
        const material = this.descriptor.buildingFacadeMaterial;
        let color = <number>new ColorParser().parseColor(this.descriptor.buildingFacadeColor.toString());
        if (!Boolean(color)) {
            color = 0xffffff;
        }
        // const hasWindows = this.descriptor.buildingWindows;
        const hasWindows = false;
        const materialToTextureId: Record<BuildingFacadeMaterial, {
            wall: number;
            // window: number;
            width: number;
        }> = {
            plaster: {
                wall: ExtrudedTextures.FacadePlasterWall,
                // window: ExtrudedTextures.FacadePlasterWindow,
                width: 4
            },
            glass: {
                wall: ExtrudedTextures.FacadeGlass,
                // window: ExtrudedTextures.FacadeGlass,
                width: 4
            },
            brick: {
                wall: ExtrudedTextures.FacadeBrickWall,
                // window: ExtrudedTextures.FacadeBrickWindow,
                width: 4
            },
            wood: {
                wall: ExtrudedTextures.FacadeWoodWall,
                // window: ExtrudedTextures.FacadeWoodWindow,
                width: 4
            },
            cementBlock: {
                wall: ExtrudedTextures.FacadeBlockWall,
                // window: ExtrudedTextures.FacadeBlockWindow,
                width: 4
            }
        };

        const params = materialToTextureId[material] ?? materialToTextureId.cementBlock;
        return {
            windowWidth: params.width * this.mercatorScale,
            color,
            textureIdWall: params.wall,
            textureIdWindow: params.wall
        };
    }



}
