import { gsap } from "gsap";
import Instance from "@giro3d/giro3d/core/Instance.js";
import PointOfView from "@giro3d/giro3d/core/PointOfView.js";
import { Vector3 } from "three";

const tmpVec3 = new Vector3();
const tmpVec3_2 = new Vector3();



export const panTo = (instance: Instance, pov_origin: PointOfView, pov_target: PointOfView) => {
    const origin_copy = pov_origin.origin;
    const target_copy = pov_origin.target;
    const pov_copy = {
        origin_x: origin_copy.x,
        origin_y: origin_copy.y,
        origin_z: origin_copy.z,
        target_x: target_copy.x,
        target_y: target_copy.y,
        target_z: target_copy.z,
    };
    gsap.to(pov_copy, {
        origin_x: pov_target.origin.x,
        origin_y: pov_target.origin.y,
        origin_z: pov_target.origin.z,
        target_x: pov_target.target.x,
        target_y: pov_target.target.y,
        target_z: pov_target.target.z,
        duration: 4,
        ease: "power2.inOut",
        onUpdate: () => {

            const pov = {
                origin: tmpVec3.set(pov_copy.origin_x, pov_copy.origin_y, pov_copy.origin_z),
                target: tmpVec3_2.set(pov_copy.target_x, pov_copy.target_y, pov_copy.target_z),
                orthographicZoom: pov_target.orthographicZoom,
            }
            // if MapControls is used, update the target of the controls
            if (instance.view.controls) {
                // @ts-ignore
                instance.view.controls.target.copy(pov.target);
            }
            instance.view.goTo(pov);
        }

    });

}

