import { BLOCK_BY_ID } from '../world/blocks.js';
import { GENERATOR_VERSION } from '../world/world.js';

const DB_NAME = 'voxelcraft-3d-worlds-v1';
const DB_VERSION = 1;
const CHUNK_BYTES = 16 * 16 * 16 * 2;
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onabort = () => reject(tx.error || new Error('Transaksi storan dibatalkan.'));
    tx.onerror = () => reject(tx.error || new Error('Gagal menulis storan.'));
  });
}

function encodeBlockData(data) {
  let binary = '';
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i] & 255, data[i] >>> 8);
  }
  return btoa(binary);
}

function decodeBlockData(encoded) {
  if (typeof encoded !== 'string' || encoded.length > 11000) throw new Error('Data chunk tidak sah.');
  let binary;
  try { binary = atob(encoded); } catch { throw new Error('Data chunk bukan base64 sah.'); }
  if (binary.length !== CHUNK_BYTES) throw new Error('Panjang data chunk tidak sah.');
  const result = new Uint16Array(CHUNK_BYTES / 2);
  for (let i = 0; i < result.length; i++) {
    result[i] = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
    if (result[i] && !BLOCK_BY_ID.has(result[i])) throw new Error('ID blok tidak dikenali.');
  }
  return result;
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot.key !== 'string' || !/^-?\d+,[0-3],-?\d+$/.test(snapshot.key)) throw new Error('Koordinat chunk tidak sah.');
  const [cx, cy, cz] = snapshot.key.split(',').map(Number);
  if (`${cx},${cy},${cz}` !== snapshot.key) throw new Error('Format koordinat chunk tidak sah.');
  if (cx < -8 || cx > 7 || cz < -8 || cz > 7 || cy < 0 || cy > 3) throw new Error('Chunk di luar dunia.');
  if (snapshot.encoding !== 'raw-u16' || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0) throw new Error('Versi chunk tidak sah.');
  return { key: snapshot.key, revision: snapshot.revision, data: decodeBlockData(snapshot.data) };
}

function isFinitePlayer(player) {
  return player && ['x', 'y', 'z', 'yaw', 'pitch'].every((key) => Number.isFinite(player[key]));
}

export function parseWorldExport(text) {
  if (typeof text !== 'string' || new Blob([text]).size > MAX_IMPORT_BYTES) throw new Error('Fail dunia melebihi 20 MiB.');
  let source;
  try { source = JSON.parse(text); } catch { throw new Error('Fail JSON tidak sah.'); }
  if (source?.format !== 'voxelcraft-world' || source.schemaVersion !== 1) throw new Error('Format dunia tidak disokong.');
  if (source.world?.generatorVersion !== GENERATOR_VERSION) throw new Error('Generator dunia tidak disokong.');
  if (typeof source.world.seed !== 'string' || source.world.seed.length > 100 || !['hills', 'flat'].includes(source.world.preset)) throw new Error('Metadata dunia tidak sah.');
  if (!isFinitePlayer(source.world.player) || !Array.isArray(source.world.hotbar) || source.world.hotbar.length !== 9) throw new Error('Data pemain tidak sah.');
  if (source.world.hotbar.some((id) => !BLOCK_BY_ID.get(id)?.selectable)) throw new Error('Hotbar mengandungi blok tidak sah.');
  if (!Array.isArray(source.chunks) || source.chunks.length > 1024) throw new Error('Terlalu banyak chunk.');
  const keys = new Set();
  const chunks = source.chunks.map((item) => {
    const snapshot = validateSnapshot(item);
    if (keys.has(snapshot.key)) throw new Error('Chunk pendua dalam import.');
    keys.add(snapshot.key);
    return snapshot;
  });
  return { metadata: source.world, chunks };
}

export function serializeWorld(world, player, sky, hotbar) {
  const metadata = {
    ...world.metadata,
    player: player.snapshot(),
    sky,
    hotbar: [...hotbar],
    updatedAt: new Date().toISOString()
  };
  const chunks = world.snapshots().map(({ key, revision, data }) => ({ key, revision, encoding: 'raw-u16', data: encodeBlockData(data) }));
  return JSON.stringify({ format: 'voxelcraft-world', schemaVersion: 1, world: metadata, chunks });
}

export class GameStorage {
  constructor() {
    this.db = null;
    this.memoryWorlds = new Map();
    this.memoryChunks = new Map();
    this.persistent = false;
  }

  async open() {
    if (!globalThis.indexedDB) return this;
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('chunks')) {
          const store = db.createObjectStore('chunks', { keyPath: 'id' });
          store.createIndex('worldId', 'worldId');
        }
      };
      this.db = await requestResult(request);
      this.persistent = true;
    } catch {
      this.db = null;
      this.persistent = false;
    }
    return this;
  }

  async requestPersistence() {
    if (!this.persistent || !navigator.storage?.persist) return false;
    try { return await navigator.storage.persist(); } catch { return false; }
  }

  async listWorlds() {
    const worlds = this.db
      ? await requestResult(this.db.transaction('worlds', 'readonly').objectStore('worlds').getAll())
      : [...this.memoryWorlds.values()];
    return worlds.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }

  async createWorld(name, seed, preset) {
    const now = new Date().toISOString();
    const metadata = {
      id: crypto.randomUUID(),
      name: String(name || 'Dunia Baru').trim().slice(0, 48) || 'Dunia Baru',
      seed: String(seed || Math.floor(Math.random() * 1e9)).slice(0, 100),
      preset: preset === 'flat' ? 'flat' : 'hills',
      generatorVersion: GENERATOR_VERSION,
      schemaVersion: 1,
      revision: 0,
      createdAt: now,
      updatedAt: now,
      player: null,
      sky: 0,
      hotbar: [1, 2, 3, 4, 5, 6, 7, 8, 9]
    };
    if (this.db) {
      const tx = this.db.transaction('worlds', 'readwrite');
      const done = transactionDone(tx);
      tx.objectStore('worlds').add(metadata);
      await done;
    } else this.memoryWorlds.set(metadata.id, structuredClone(metadata));
    return metadata;
  }

  async loadWorld(id) {
    if (!this.db) {
      const metadata = this.memoryWorlds.get(id);
      if (!metadata) throw new Error('Dunia tidak ditemui.');
      return { metadata: structuredClone(metadata), snapshots: [...(this.memoryChunks.get(id)?.values() || [])].map((item) => ({ ...item, data: new Uint16Array(item.data) })) };
    }
    const tx = this.db.transaction(['worlds', 'chunks'], 'readonly');
    const metadata = await requestResult(tx.objectStore('worlds').get(id));
    if (!metadata) throw new Error('Dunia tidak ditemui.');
    const records = await requestResult(tx.objectStore('chunks').index('worldId').getAll(id));
    return { metadata, snapshots: records.map(({ key, revision, data }) => ({ key, revision, data: new Uint16Array(data) })) };
  }

  async saveWorld(world, player, sky, hotbar) {
    const snapshots = world.snapshots(true);
    const metadata = {
      ...world.metadata,
      revision: world.metadata.revision + 1,
      updatedAt: new Date().toISOString(),
      player: player.snapshot(),
      sky,
      hotbar: [...hotbar]
    };
    if (!this.db) {
      const disk = this.memoryWorlds.get(metadata.id);
      if (!disk || disk.revision !== world.metadata.revision) throw new Error('Dunia diubah dalam tab lain. Muat semula sebelum menyimpan.');
      this.memoryWorlds.set(metadata.id, structuredClone(metadata));
      const record = this.memoryChunks.get(metadata.id) || new Map();
      snapshots.forEach((snapshot) => record.set(snapshot.key, { key: snapshot.key, revision: snapshot.revision, data: new Uint16Array(snapshot.data) }));
      this.memoryChunks.set(metadata.id, record);
    } else {
      const tx = this.db.transaction(['worlds', 'chunks'], 'readwrite');
      const done = transactionDone(tx);
      const worlds = tx.objectStore('worlds');
      const stored = await requestResult(worlds.get(metadata.id));
      if (!stored || stored.revision !== world.metadata.revision) {
        tx.abort();
        await done.catch(() => {});
        throw new Error('Dunia diubah dalam tab lain. Eksport backup sebelum memuat semula.');
      }
      worlds.put(metadata);
      const chunks = tx.objectStore('chunks');
      snapshots.forEach((snapshot) => chunks.put({
        id: `${metadata.id}:${snapshot.key}`, worldId: metadata.id,
        key: snapshot.key, revision: snapshot.revision, data: snapshot.data.buffer
      }));
      await done;
    }
    world.metadata = metadata;
    world.markSaved(snapshots);
    return metadata;
  }

  async deleteWorld(id) {
    if (!this.db) {
      this.memoryWorlds.delete(id);
      this.memoryChunks.delete(id);
      return;
    }
    const tx = this.db.transaction(['worlds', 'chunks'], 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore('worlds').delete(id);
    const index = tx.objectStore('chunks').index('worldId');
    const cursor = index.openCursor(IDBKeyRange.only(id));
    cursor.onsuccess = () => {
      if (cursor.result) { cursor.result.delete(); cursor.result.continue(); }
    };
    await done;
  }

  async renameWorld(id, name) {
    const cleanName = String(name || '').trim().slice(0, 48);
    if (!cleanName) throw new Error('Nama dunia tidak boleh kosong.');
    if (!this.db) {
      const metadata = this.memoryWorlds.get(id);
      if (!metadata) throw new Error('Dunia tidak ditemui.');
      metadata.name = cleanName;
      metadata.updatedAt = new Date().toISOString();
      return;
    }
    const tx = this.db.transaction('worlds', 'readwrite');
    const done = transactionDone(tx);
    const store = tx.objectStore('worlds');
    const metadata = await requestResult(store.get(id));
    if (!metadata) { tx.abort(); await done.catch(() => {}); throw new Error('Dunia tidak ditemui.'); }
    metadata.name = cleanName;
    metadata.updatedAt = new Date().toISOString();
    store.put(metadata);
    await done;
  }

  async importWorld(text) {
    const { metadata: source, chunks } = parseWorldExport(text);
    const metadata = {
      id: crypto.randomUUID(),
      name: String(source.name || 'Dunia Import').slice(0, 48),
      seed: source.seed,
      preset: source.preset,
      generatorVersion: GENERATOR_VERSION,
      schemaVersion: 1,
      revision: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      player: source.player,
      sky: Number.isInteger(source.sky) && source.sky >= 0 && source.sky < 3 ? source.sky : 0,
      hotbar: source.hotbar
    };
    if (!this.db) {
      this.memoryWorlds.set(metadata.id, structuredClone(metadata));
      this.memoryChunks.set(metadata.id, new Map(chunks.map((chunk) => [chunk.key, chunk])));
      return metadata;
    }
    const tx = this.db.transaction(['worlds', 'chunks'], 'readwrite');
    const done = transactionDone(tx);
    tx.objectStore('worlds').add(metadata);
    const store = tx.objectStore('chunks');
    chunks.forEach((chunk) => store.add({
      id: `${metadata.id}:${chunk.key}`, worldId: metadata.id,
      key: chunk.key, revision: chunk.revision, data: chunk.data.buffer
    }));
    await done;
    return metadata;
  }
}
