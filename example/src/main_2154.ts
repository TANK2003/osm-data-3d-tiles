import OSM from "ol/source/OSM";
import Instance from "@giro3d/giro3d/core/Instance.js";
import Inspector from "@giro3d/giro3d/gui/Inspector.js";
import ColorLayer from "@giro3d/giro3d/core/layer/ColorLayer";
import TiledImageSource from "@giro3d/giro3d/sources/TiledImageSource";
import Map from "@giro3d/giro3d/entities/Map";
import Extent from "@giro3d/giro3d/core/geographic/Extent";
import CoordinateSystem from "@giro3d/giro3d/core/geographic/CoordinateSystem";
import Tiles3D from '@giro3d/giro3d/entities/Tiles3D';
import { MeshBasicMaterial, TextureLoader, Mesh, RGBAFormat, SRGBColorSpace, ClampToEdgeWrapping, LinearMipMapLinearFilter, LinearFilter } from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { highlight } from "./picking";
import { panTo } from "./pan";


const coordinateSystem = CoordinateSystem.register(
    'EPSG:2154',
    '+proj=lcc +lat_0=46.5 +lon_0=3 +lat_1=49 +lat_2=44 +x_0=700000 +y_0=6600000 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs',
);

const imageLoader = new TextureLoader();

// @ts-ignore
const DEFAULT_URL = `${import.meta.env.BASE_URL}tileset_2154.json`;

const instance = new Instance({
    target: "view",
    crs: coordinateSystem,
    backgroundColor: null,
});


const extent = new Extent(
    coordinateSystem,
    -722642,
    2597478,
    5348393,
    8010406,
)



const map = new Map({ extent });

await instance.add(map);

const controls = new MapControls(instance.view.camera, instance.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.25;
instance.view.setControls(controls);



const osm = new ColorLayer({
    name: "osm",
    source: new TiledImageSource({ source: new OSM() }),
});

map.addLayer(osm);
const pov_map = map.getDefaultPointOfView({ camera: instance.view.camera });
// @ts-ignore
controls.target.copy(pov_map?.target);
// @ts-ignore
instance.view.goTo(pov_map);

const tileset = new Tiles3D({ url: DEFAULT_URL });
tileset.tiles.optimizeRaycast = false

// @ts-ignore
imageLoader.loadAsync(`${import.meta.env.BASE_URL}assets/diffuse.png`).then((texture) => {
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
        // @ts-ignore
        panTo(instance, pov_map, pov);

    });

    instance.domElement.addEventListener('click', (evt: MouseEvent) => highlight(evt, instance, tileset));
});



if (!(import.meta as any).env.PROD) {
    Inspector.attach("inspector", instance);
}


