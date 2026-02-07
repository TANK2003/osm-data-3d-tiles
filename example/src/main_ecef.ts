import OSM from "ol/source/OSM";
import Instance from "@giro3d/giro3d/core/Instance.js";
import Inspector from "@giro3d/giro3d/gui/Inspector.js";
import ColorLayer from "@giro3d/giro3d/core/layer/ColorLayer";
import TiledImageSource from "@giro3d/giro3d/sources/TiledImageSource";
import Globe from '@giro3d/giro3d/entities/Globe.js';
import CoordinateSystem from "@giro3d/giro3d/core/geographic/CoordinateSystem";
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D';
import GlobeControls from '@giro3d/giro3d/controls/GlobeControls.js';
import { highlight } from "./picking";
import { ClampToEdgeWrapping, LinearFilter, TextureLoader, LinearMipMapLinearFilter, Mesh, MeshBasicMaterial, RGBAFormat, SRGBColorSpace, Texture } from "three";
import { panTo } from "./pan";


const coordinateSystem = CoordinateSystem.epsg4978;

const imageLoader = new TextureLoader();

// @ts-ignore
const DEFAULT_URL = `${import.meta.env.BASE_URL}tileset_ecef.json`;

async function run() {
    const instance = new Instance({
        target: "view",
        crs: coordinateSystem,
        backgroundColor: null,
    });

    const globe = new Globe({
        name: 'Earth',
        backgroundColor: '#001B35',
    });

    await instance.add(globe);
    const layer = new ColorLayer({
        source: new TiledImageSource({ source: new OSM() }),
    });

    globe.addLayer(layer);
    instance.view.goTo(globe)



    const tileset = new Tiles3D({ url: DEFAULT_URL });
    tileset.tiles.optimizeRaycast = false

    const controls = new GlobeControls({
        scene: globe.object3d,
        ellipsoid: globe.ellipsoid,
        camera: instance.view.camera,
        domElement: instance.domElement,
    });

    // @ts-ignore
    imageLoader.loadAsync(`${import.meta.env.BASE_URL}assets/diffuse.png`).then((texture: Texture) => {
        texture.format = RGBAFormat;
        texture.colorSpace = SRGBColorSpace;
        texture.wrapS = ClampToEdgeWrapping;
        texture.wrapT = ClampToEdgeWrapping;
        texture.minFilter = LinearMipMapLinearFilter;
        texture.magFilter = LinearFilter;
        texture.anisotropy = instance.renderer.capabilities.getMaxAnisotropy();
        texture.needsUpdate = true;
        const material = new MeshBasicMaterial({ map: texture });
        tileset.addEventListener('object-created', evt => {
            const scene = evt.obj;
            scene.traverse(obj => {
                if (obj instanceof Mesh) {
                    obj.material = material;
                }
            });
        });

        instance.add(tileset).then(() => {
            const pov = tileset.getDefaultPointOfView({ camera: instance.view.camera });
            const pov_globe = globe.getDefaultPointOfView({ camera: instance.view.camera });
            // @ts-ignore
            panTo(instance, pov_globe, pov);

        });

        instance.domElement.addEventListener('click', (evt: MouseEvent) => highlight(evt, instance, tileset));

    })




    const updateControls = () => {
        controls.update();
        instance.notifyChange([globe, instance.view.camera]);

        requestAnimationFrame(updateControls);
    };

    updateControls();

    if (!(import.meta as any).env.PROD) {
        Inspector.attach("inspector", instance);
    }
}



run().catch(console.error);
