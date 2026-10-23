import * as THREE from 'three';
import { getBlockDef } from '../world/blocks.js';
import { CHUNK_SIZE } from '../world/world.js';

const FACES = [
  { step: [1, 0, 0], normal: [1, 0, 0], face: 'side', corners: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { step: [-1, 0, 0], normal: [-1, 0, 0], face: 'side', corners: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { step: [0, 1, 0], normal: [0, 1, 0], face: 'top', corners: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { step: [0, -1, 0], normal: [0, -1, 0], face: 'bottom', corners: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { step: [0, 0, 1], normal: [0, 0, 1], face: 'side', corners: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { step: [0, 0, -1], normal: [0, 0, -1], face: 'side', corners: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] }
];

function shouldDraw(id, neighborId) {
  if (neighborId === 0) return true;
  const block = getBlockDef(id);
  const neighbor = getBlockDef(neighborId);
  if (id === neighborId && block.layer !== 'opaque') return false;
  if (block.layer === 'opaque') return !neighbor.opaque;
  return !neighbor.opaque && id !== neighborId;
}

function emptyLayer() { return { positions: [], normals: [], uvs: [], indices: [], faceCount: 0 }; }

export function meshChunk(world, chunk, atlas) {
  const layers = { opaque: emptyLayer(), cutout: emptyLayer(), transparent: emptyLayer() };
  for (let ly = 0; ly < CHUNK_SIZE; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = chunk.data[lx + CHUNK_SIZE * (lz + CHUNK_SIZE * ly)];
        if (!id) continue;
        const block = getBlockDef(id);
        const x = chunk.cx * CHUNK_SIZE + lx;
        const y = chunk.cy * CHUNK_SIZE + ly;
        const z = chunk.cz * CHUNK_SIZE + lz;
        for (const face of FACES) {
          const neighbor = world.getBlock(x + face.step[0], y + face.step[1], z + face.step[2]);
          if (!shouldDraw(id, neighbor)) continue;
          const layer = layers[block.layer];
          const vertex = layer.positions.length / 3;
          const [u0, v0, u1, v1] = atlas.uv(id, face.face);
          const texCoords = [[u0, v0], [u0, v1], [u1, v1], [u1, v0]];
          face.corners.forEach((corner, index) => {
            layer.positions.push(lx + corner[0], ly + corner[1], lz + corner[2]);
            layer.normals.push(...face.normal);
            layer.uvs.push(...texCoords[index]);
          });
          layer.indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
          layer.faceCount++;
        }
      }
    }
  }
  const geometries = {};
  for (const [name, layer] of Object.entries(layers)) {
    if (!layer.faceCount) continue;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(layer.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(layer.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(layer.uvs, 2));
    geometry.setIndex(layer.indices);
    geometry.computeBoundingSphere();
    geometries[name] = geometry;
  }
  return geometries;
}
