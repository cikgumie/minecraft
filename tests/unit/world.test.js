import { describe, expect, it } from 'vitest';
import { World } from '../../src/world/world.js';

const metadata = (seed = 'stable-seed', preset = 'hills') => ({ id: 'world-1', name: 'Test', seed, preset, generatorVersion: 1 });

describe('world chunks', () => {
  it('generates the same blocks regardless of chunk load order', () => {
    const first = new World(metadata());
    const second = new World(metadata());
    const locations = [[-17, 12, -17], [0, 7, 0], [15, 8, 15], [16, 8, 16], [42, 9, -31]];
    const forward = locations.map(([x, y, z]) => first.getBlock(x, y, z));
    const backward = locations.toReversed().map(([x, y, z]) => second.getBlock(x, y, z)).toReversed();
    expect(backward).toEqual(forward);
    const treeChunk = first.getChunk(0, 1, 0).data;
    expect([...treeChunk]).toEqual([...second.getChunk(0, 1, 0).data]);
  });

  it('stores air edits and marks both sides of a chunk boundary dirty', () => {
    const world = new World(metadata('flat', 'flat'));
    expect(world.getBlock(15, 7, 1)).toBe(1);
    expect(world.setBlock(15, 7, 1, 0)).toBe(true);
    expect(world.dirtyMesh.has('0,0,0')).toBe(true);
    expect(world.dirtyMesh.has('1,0,0')).toBe(true);
    const snapshot = world.snapshots(true)[0];
    const restored = new World(metadata('flat', 'flat'));
    restored.applySnapshot(snapshot);
    expect(restored.getBlock(15, 7, 1)).toBe(0);
    world.setBlock(15, 7, 2, 4);
    world.markSaved([snapshot]);
    expect(world.dirtySave.has('0,0,0')).toBe(true);
  });

  it('keeps the flat preset free of trees', () => {
    const world = new World(metadata('flat', 'flat'));
    expect(world.getBlock(30, 8, 30)).toBe(0);
    expect(world.getBlock(30, 7, 30)).toBe(1);
  });
});
