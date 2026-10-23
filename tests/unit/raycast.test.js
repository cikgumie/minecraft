import { describe, expect, it } from 'vitest';
import { raycastVoxel } from '../../src/player/raycast.js';

describe('voxel raycast', () => {
  it('handles axis-aligned rays starting at an integer boundary', () => {
    const world = { getBlock: (x, y, z) => x === -1 && y === 2 && z === 0 ? 3 : 0 };
    expect(raycastVoxel(world, { x: 0, y: 2.5, z: 0.5 }, { x: -1, y: 0, z: 0 })).toMatchObject({
      x: -1, y: 2, z: 0, normal: { x: 1, y: 0, z: 0 }, distance: 0
    });
  });

  it('ignores water and respects maximum distance', () => {
    const world = { getBlock: (x) => x === 1 ? 11 : x === 3 ? 3 : 0 };
    expect(raycastVoxel(world, { x: 0.5, y: 1.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 2)).toBeNull();
    expect(raycastVoxel(world, { x: 0.5, y: 1.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 3)?.x).toBe(3);
  });
});
