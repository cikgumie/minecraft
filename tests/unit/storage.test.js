import { describe, expect, it } from 'vitest';
import { Player } from '../../src/player/player.js';
import { World } from '../../src/world/world.js';
import { GameStorage, parseWorldExport, serializeWorld } from '../../src/storage/storage.js';

describe('world persistence', () => {
  it('round-trips a modified chunk including removed blocks', async () => {
    const storage = new GameStorage();
    const metadata = await storage.createWorld('Save Test', 'flat-seed', 'flat');
    const world = new World(metadata);
    const player = new Player(world);
    world.setBlock(2, 7, 2, 0);
    world.setBlock(2, 8, 2, 4);
    await storage.saveWorld(world, player, 1, metadata.hotbar);
    const loaded = await storage.loadWorld(metadata.id);
    const restored = new World(loaded.metadata);
    loaded.snapshots.forEach((snapshot) => restored.applySnapshot(snapshot));
    expect(restored.getBlock(2, 7, 2)).toBe(0);
    expect(restored.getBlock(2, 8, 2)).toBe(4);
    const text = serializeWorld(restored, player, 1, metadata.hotbar);
    const imported = parseWorldExport(text);
    expect(imported.chunks).toHaveLength(1);
    expect(imported.chunks[0].data).toEqual(loaded.snapshots[0].data);
  });

  it('rejects corrupt and duplicate chunks before import', async () => {
    const storage = new GameStorage();
    const metadata = await storage.createWorld('Save Test', 's', 'flat');
    const world = new World(metadata);
    const player = new Player(world);
    world.setBlock(2, 8, 2, 4);
    const exported = JSON.parse(serializeWorld(world, player, 0, metadata.hotbar));
    exported.chunks.push({ ...exported.chunks[0] });
    expect(() => parseWorldExport(JSON.stringify(exported))).toThrow(/pendua/);
    exported.chunks.pop();
    exported.chunks[0].data = 'AAAA';
    expect(() => parseWorldExport(JSON.stringify(exported))).toThrow(/Panjang/);
  });
});
