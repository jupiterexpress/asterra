import * as THREE from 'three';

// Surface extraction retains every occupied cell, including setbacks, holes and overhangs.
// These surfaces define blueprint guides. Finished architecture uses the village model family.
const faces = [
  { n: [1,0,0], q: [[.5,0,-.5],[.5,1,-.5],[.5,1,.5],[.5,0,.5]], material: 0 },
  { n: [-1,0,0], q: [[-.5,0,.5],[-.5,1,.5],[-.5,1,-.5],[-.5,0,-.5]], material: 0 },
  { n: [0,1,0], q: [[-.5,1,.5],[.5,1,.5],[.5,1,-.5],[-.5,1,-.5]], material: 1 },
  { n: [0,-1,0], q: [[-.5,0,-.5],[.5,0,-.5],[.5,0,.5],[-.5,0,.5]], material: 0 },
  { n: [0,0,1], q: [[.5,0,.5],[.5,1,.5],[-.5,1,.5],[-.5,0,.5]], material: 0 },
  { n: [0,0,-1], q: [[-.5,0,-.5],[-.5,1,-.5],[.5,1,-.5],[.5,0,-.5]], material: 0 },
];
export function exterior(cells) {
  const keys = new Set(cells.map(c => c.join(','))), buckets = [{ positions: [], normals: [] },{ positions: [], normals: [] }], surfaces = [];
  const geometry = new THREE.BufferGeometry();
  for (const [x,y,z] of cells) for (const face of faces) {
    const [nx,ny,nz] = face.n;
    if (keys.has([x+nx,y+ny,z+nz].join(','))) continue;
    const { positions, normals } = buckets[face.material];
    for (const i of [0,1,2,0,2,3]) {
      const q = face.q[i]; positions.push(x+q[0],y+q[1],z+q[2]); normals.push(nx,ny,nz);
    }
    surfaces.push({ x,y,z,nx,ny,nz });
  }
  const positions = [], normals = [];
  buckets.forEach((bucket,index) => { geometry.addGroup(positions.length/3,bucket.positions.length/3,index); positions.push(...bucket.positions); normals.push(...bucket.normals); });
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeBoundingBox();
  return { geometry, surfaces, keys };
}

export {makeBuilding} from './village-buildings.js';
