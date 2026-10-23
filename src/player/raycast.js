import { getBlockDef } from '../world/blocks.js';

export function raycastVoxel(world, origin, direction, maxDistance = 6.5) {
  let x = Math.floor(origin.x);
  let y = Math.floor(origin.y);
  let z = Math.floor(origin.z);
  const dx = direction.x;
  const dy = direction.y;
  const dz = direction.z;
  if (!dx && !dy && !dz) return null;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  const sz = Math.sign(dz);
  const deltaX = sx ? Math.abs(1 / dx) : Infinity;
  const deltaY = sy ? Math.abs(1 / dy) : Infinity;
  const deltaZ = sz ? Math.abs(1 / dz) : Infinity;
  let maxX = sx > 0 ? (x + 1 - origin.x) * deltaX : sx < 0 ? (origin.x - x) * deltaX : Infinity;
  let maxY = sy > 0 ? (y + 1 - origin.y) * deltaY : sy < 0 ? (origin.y - y) * deltaY : Infinity;
  let maxZ = sz > 0 ? (z + 1 - origin.z) * deltaZ : sz < 0 ? (origin.z - z) * deltaZ : Infinity;
  let distance = 0;
  let normal = { x: 0, y: 0, z: 0 };
  for (let count = 0; count < 128 && distance <= maxDistance; count++) {
    const id = world.getBlock(x, y, z);
    const block = getBlockDef(id);
    if (block && block.solid) return { x, y, z, id, normal, distance };
    if (maxX <= maxY && maxX <= maxZ) {
      distance = maxX;
      x += sx;
      maxX += deltaX;
      normal = { x: -sx, y: 0, z: 0 };
    } else if (maxY <= maxZ) {
      distance = maxY;
      y += sy;
      maxY += deltaY;
      normal = { x: 0, y: -sy, z: 0 };
    } else {
      distance = maxZ;
      z += sz;
      maxZ += deltaZ;
      normal = { x: 0, y: 0, z: -sz };
    }
  }
  return null;
}
