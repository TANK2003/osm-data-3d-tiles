import { Extent } from "ol/extent.js";
import { Box3, Group } from "three";

export class BuildingsTile extends Group {
    readonly isFeatureTile = true;
    readonly type = 'BuildingTile';
    key: string



}

export function boxToExtent(box: Box3): Extent {

    return [box.min.x, box.min.y, box.max.x, box.max.y]

}