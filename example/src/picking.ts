import Tiles3D from "@giro3d/giro3d/entities/Tiles3D";
import {  Mesh } from "three";

const fieldsToDisplay = [
    'osm_url',
    'label',
    'buildingLevels',
    'buildingHeight',
    'buildingMinHeight',
    'buildingRoofHeight',
    'buildingRoofType',
    'buildingFacadeMaterial',
    'buildingRoofMaterial',
    'rnb',
    'is_part',
];

let canPick = true;

const resultsTable = document.getElementById('results-body');
const viewDom = document.getElementById('view');


viewDom?.addEventListener('pointerdown', () => (canPick = true));
viewDom?.addEventListener('pointermove', () => (canPick = false));



export function highlight(evt: MouseEvent, instance: any, tileset: Tiles3D) {

    if (!canPick) {
        return;
    }
    const picked = instance.pickObjectsAt(evt, {
        radius: 0,
        limit: 10,
        where: [tileset],
    });

    if (picked.length === 0) {
        const row = document.createElement('tr');
        const nameCell = document.createElement('td');
        nameCell.innerText = '-';

        const valueCell = document.createElement('td');
        valueCell.innerText = '-';
        row.append(nameCell, valueCell);

        resultsTable?.replaceChildren(row);
    } else {
        const obj = picked[0].object;
        const face = picked[0].face
        if (obj instanceof Mesh) {
            const batchidAttr = obj.geometry.getAttribute('_batchid');
            let batchTableObject = obj;
            // @ts-ignore
            while (!batchTableObject["batchTable"]) {

                // @ts-ignore
                batchTableObject = batchTableObject.parent;

            }
            // @ts-ignore
            const batchTable = batchTableObject.batchTable;
            const hoveredBatchid = batchidAttr.getX(face.a);
            const batchData = batchTable.getDataFromId(hoveredBatchid);
            const rows = [];

            for (const [name, value] of Object.entries(batchData)) {
                if (!fieldsToDisplay.includes(name)) {
                    continue;
                }
                const row = document.createElement('tr');
                if (name == 'osm_url') {

                    const valueCell = document.createElement('td');
                    valueCell.colSpan = 2;
                    valueCell.style.textAlign = 'center';
                    const osm_link = document.createElement('a');
                    osm_link.style.textAlign = 'center';
                    osm_link.style.fontWeight = 'bold';
                    osm_link.target = '_blank';
                    osm_link.href = value as string;
                    osm_link.innerText = "Open building in OSM";
                    valueCell.appendChild(osm_link);

                    row.append(valueCell);
                    rows.unshift(row);
                } else {
                    const nameCell = document.createElement('td');
                    nameCell.innerHTML = `<code>${name}</code>`;

                    const valueCell = document.createElement('td');
                    valueCell.innerText = value as string;
                    row.append(nameCell, valueCell);
                    rows.push(row);

                }
            }

            resultsTable?.replaceChildren(...rows);

            if (Boolean(batchData.boxCenter)) {

                // buildHighlightGeometry(obj.geometry, '_batchid', hoveredBatchid, obj.getWorldPosition(tmpVec3).clone());
            }

            // instance.notifyChange(obj);

        }


    }

}

// function buildHighlightGeometry(sourceGeom: BufferGeometry, attrName: string, id: number, position: Vector3) {
//     const pos = sourceGeom.getAttribute('position');
//     const batch = sourceGeom.getAttribute(attrName);
//     if (!pos || !batch) return null;
  
//     const normal = sourceGeom.getAttribute('normal') || null;
//     const uv = sourceGeom.getAttribute('uv') || null;
  
//     const indexAttr = sourceGeom.index;
  
//     const outPos: number[] = [];
//     const outNor = normal ? [] : null;
//     const outUv = uv ? [] : null;
  
//     const isHit = (bid: number) => bid == id;
  
//     const pushVertex = (vi: number) => {
//       outPos.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
//       if (outNor) outNor.push(normal.getX(vi), normal.getY(vi), normal.getZ(vi));
//       if (outUv) outUv.push(uv.getX(vi), uv.getY(vi));
//     };
  
//     if (indexAttr) {
//       // Géométrie indexée : triangles via index buffer
//       const triCount = indexAttr.count / 3;
//       for (let t = 0; t < triCount; t++) {
//         const ia = indexAttr.getX(t * 3 + 0);
//         const ib = indexAttr.getX(t * 3 + 1);
//         const ic = indexAttr.getX(t * 3 + 2);
  
//         // En général les 3 sommets partagent le même batchId
//         const bid = batch.getX(ia);
//         if (!isHit(bid)) continue;
  
//         pushVertex(ia);
//         pushVertex(ib);
//         pushVertex(ic);
//       }
//     } else {
//       // Non indexée : triangles consécutifs
//       const triCount = pos.count / 3;
//       for (let t = 0; t < triCount; t++) {
//         const ia = t * 3 + 0;
//         const ib = t * 3 + 1;
//         const ic = t * 3 + 2;
  
//         const bid = batch.getX(ia);
//         if (!isHit(bid)) continue;
  
//         pushVertex(ia);
//         pushVertex(ib);
//         pushVertex(ic);
//       }
//     }
  
//     if (outPos.length === 0) return null;
  
//     const g = new BufferGeometry();
//     g.setAttribute('position', new Float32BufferAttribute(outPos, 3));
//   //   if (outNor) g.setAttribute('normal', new Float32BufferAttribute(outNor, 3));
//   //   if (outUv) g.setAttribute('uv', new Float32BufferAttribute(outUv, 2));
  
  
    
//      g.computeVertexNormals();
  
//      const mesh = new Mesh(g)
//       mesh.position.copy(position);
//       mesh.updateMatrixWorld();
//       instance.add(mesh);
  
//     return g;
//   }