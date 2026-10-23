import { expect, it } from 'vitest';
import { World } from '../../src/world/world.js';
import { meshChunk } from '../../src/render/mesher.js';

it('emits only exposed faces for a flat interior chunk', () => {
  const world = new World({ id: 'test', seed: 'flat', preset: 'flat', generatorVersion: 1 });
  const chunk = world.getChunk(0, 0, 0);
  const atlas = { uv: () => [0, 0, 1, 1] };
  const geometry = meshChunk(world, chunk, atlas);
  expect(geometry.opaque.index.count).toBe(512 * 6);
  expect(geometry.opaque.getAttribute('position').count).toBe(512 * 4);
  geometry.opaque.dispose();
});
