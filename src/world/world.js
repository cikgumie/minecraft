import { getBlockDef } from './blocks.js';

export const CHUNK_SIZE = 16;
export const WORLD_MIN = -128;
export const WORLD_MAX = 127;
export const WORLD_HEIGHT = 64;
export const GENERATOR_VERSION = 1;
export const WATER_LEVEL = 5;

const chunkKey = (cx, cy, cz) => `${cx},${cy},${cz}`;
const indexOf = (x, y, z) => x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
const local = (value) => ((value % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;

export function hashSeed(input) {
  let hash = 2166136261;
  for (const char of String(input)) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function coordinateHash(seed, x, z, salt = 0) {
  let hash = seed ^ Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(salt, 1274126177);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function noise(seed, x, z, scale, salt) {
  const gx = Math.floor(x / scale);
  const gz = Math.floor(z / scale);
  const fx = (x - gx * scale) / scale;
  const fz = (z - gz * scale) / scale;
  const sx = fx * fx * (3 - 2 * fx);
  const sz = fz * fz * (3 - 2 * fz);
  const value = (dx, dz) => (coordinateHash(seed, gx + dx, gz + dz, salt) & 65535) / 65535;
  const a = value(0, 0) * (1 - sx) + value(1, 0) * sx;
  const b = value(0, 1) * (1 - sx) + value(1, 1) * sx;
  return a * (1 - sz) + b * sz;
}

export class World {
  constructor(metadata) {
    this.metadata = { ...metadata, generatorVersion: metadata.generatorVersion ?? GENERATOR_VERSION, revision: metadata.revision || 0 };
    if (this.metadata.generatorVersion !== GENERATOR_VERSION) throw new Error('Versi generator dunia belum disokong.');
    this.seed = hashSeed(metadata.seed);
    this.chunks = new Map();
    this.changedChunks = new Set();
    this.dirtySave = new Set();
    this.dirtyMesh = new Set();
  }

  static coords(x, y, z) {
    return { cx: Math.floor(x / CHUNK_SIZE), cy: Math.floor(y / CHUNK_SIZE), cz: Math.floor(z / CHUNK_SIZE) };
  }

  static inBounds(x, y, z) {
    return Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z)
      && x >= WORLD_MIN && x <= WORLD_MAX && z >= WORLD_MIN && z <= WORLD_MAX
      && y >= 0 && y < WORLD_HEIGHT;
  }

  terrainHeight(x, z) {
    if (this.metadata.preset === 'flat') return 7;
    return Math.max(2, Math.min(27, Math.floor(
      2 + noise(this.seed, x, z, 64, 1) * 7
        + noise(this.seed, x, z, 18, 2) * 7
        + noise(this.seed, x, z, 7, 3) * 2
    )));
  }

  biomeAt(x, z) {
    const height = this.terrainHeight(x, z);
    return height <= WATER_LEVEL + 1 ? 'Coast' : height >= 17 ? 'Highlands' : 'Forest';
  }

  getChunk(cx, cy, cz) {
    const key = chunkKey(cx, cy, cz);
    let chunk = this.chunks.get(key);
    if (chunk) return chunk;
    const data = new Uint16Array(CHUNK_SIZE ** 3);
    const bx = cx * CHUNK_SIZE;
    const by = cy * CHUNK_SIZE;
    const bz = cz * CHUNK_SIZE;

    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        const x = bx + lx;
        const z = bz + lz;
        if (x < WORLD_MIN || x > WORLD_MAX || z < WORLD_MIN || z > WORLD_MAX) continue;
        const surface = this.terrainHeight(x, z);
        for (let ly = 0; ly < CHUNK_SIZE; ly++) {
          const y = by + ly;
          if (y < 0 || y >= WORLD_HEIGHT) continue;
          let id = 0;
          if (y === 0) id = 13;
          else if (y <= surface) id = y === surface
            ? (surface <= WATER_LEVEL + 1 ? 9 : 1)
            : (y >= surface - 2 ? 2 : 3);
          else if (y <= WATER_LEVEL) id = 11;
          data[indexOf(lx, ly, lz)] = id;
        }
      }
    }

    // Tree anchors are global. Every chunk replays nearby anchors in a stable order.
    const firstGX = Math.floor((bx - 2) / 5);
    const lastGX = Math.floor((bx + CHUNK_SIZE + 1) / 5);
    const firstGZ = Math.floor((bz - 2) / 5);
    const lastGZ = Math.floor((bz + CHUNK_SIZE + 1) / 5);
    const putTreeBlock = (x, y, z, id) => {
      if (x < bx || x >= bx + 16 || y < by || y >= by + 16 || z < bz || z >= bz + 16) return;
      if (!World.inBounds(x, y, z)) return;
      const idx = indexOf(x - bx, y - by, z - bz);
      if (id === 5 || data[idx] === 0 || data[idx] === 11) data[idx] = id;
    };
    for (let gx = firstGX; this.metadata.preset !== 'flat' && gx <= lastGX; gx++) {
      for (let gz = firstGZ; gz <= lastGZ; gz++) {
        if (coordinateHash(this.seed, gx, gz, 4) % 7 !== 0) continue;
        const tx = gx * 5 + (coordinateHash(this.seed, gx, gz, 5) % 3);
        const tz = gz * 5 + (coordinateHash(this.seed, gx, gz, 6) % 3);
        if (Math.abs(tx) <= 4 && Math.abs(tz) <= 4) continue;
        if (tx < WORLD_MIN + 2 || tx > WORLD_MAX - 2 || tz < WORLD_MIN + 2 || tz > WORLD_MAX - 2) continue;
        const surface = this.terrainHeight(tx, tz);
        if (surface <= WATER_LEVEL + 1) continue;
        const root = surface + 1;
        const trunk = 4 + (coordinateHash(this.seed, gx, gz, 7) % 2);
        for (let y = root; y < root + trunk; y++) putTreeBlock(tx, y, tz, 5);
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            for (let dy = trunk - 2; dy <= trunk + 1; dy++) {
              const distance = Math.abs(dx) + Math.abs(dz);
              if (dy === trunk + 1 && distance > 1) continue;
              if (distance === 4 && coordinateHash(this.seed, tx + dx, tz + dz, dy) % 3 === 0) continue;
              if (dx === 0 && dz === 0 && dy < trunk) continue;
              putTreeBlock(tx + dx, root + dy, tz + dz, 6);
            }
          }
        }
      }
    }
    chunk = { key, cx, cy, cz, data, revision: 0, savedRevision: 0 };
    this.chunks.set(key, chunk);
    return chunk;
  }

  getBlock(x, y, z) {
    if (!World.inBounds(x, y, z)) return 0;
    const { cx, cy, cz } = World.coords(x, y, z);
    return this.getChunk(cx, cy, cz).data[indexOf(local(x), local(y), local(z))];
  }

  setBlock(x, y, z, id) {
    if (!World.inBounds(x, y, z) || !Number.isInteger(id) || (id !== 0 && !getBlockDef(id))) return false;
    const { cx, cy, cz } = World.coords(x, y, z);
    const chunk = this.getChunk(cx, cy, cz);
    const idx = indexOf(local(x), local(y), local(z));
    if (chunk.data[idx] === id) return false;
    chunk.data[idx] = id;
    chunk.revision++;
    this.changedChunks.add(chunk.key);
    this.dirtySave.add(chunk.key);
    this.dirtyMesh.add(chunk.key);
    if (local(x) === 0) this.dirtyMesh.add(chunkKey(cx - 1, cy, cz));
    if (local(x) === 15) this.dirtyMesh.add(chunkKey(cx + 1, cy, cz));
    if (local(y) === 0) this.dirtyMesh.add(chunkKey(cx, cy - 1, cz));
    if (local(y) === 15) this.dirtyMesh.add(chunkKey(cx, cy + 1, cz));
    if (local(z) === 0) this.dirtyMesh.add(chunkKey(cx, cy, cz - 1));
    if (local(z) === 15) this.dirtyMesh.add(chunkKey(cx, cy, cz + 1));
    return true;
  }

  applySnapshot(snapshot) {
    const [cx, cy, cz] = snapshot.key.split(',').map(Number);
    const chunk = this.getChunk(cx, cy, cz);
    chunk.data = new Uint16Array(snapshot.data);
    chunk.revision = snapshot.revision;
    chunk.savedRevision = snapshot.revision;
    this.changedChunks.add(snapshot.key);
    this.dirtyMesh.add(snapshot.key);
  }

  snapshots(onlyDirty = false) {
    const keys = onlyDirty ? this.dirtySave : this.changedChunks;
    return [...keys].map((key) => {
      const chunk = this.chunks.get(key);
      return { key, revision: chunk.revision, data: new Uint16Array(chunk.data) };
    });
  }

  markSaved(snapshots) {
    for (const snapshot of snapshots) {
      const chunk = this.chunks.get(snapshot.key);
      if (!chunk) continue;
      chunk.savedRevision = Math.max(chunk.savedRevision, snapshot.revision);
      if (chunk.revision === snapshot.revision) this.dirtySave.delete(snapshot.key);
    }
  }
}
