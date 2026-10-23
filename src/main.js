import * as THREE from 'three';
import './styles.css';
import { BLOCK_BY_ID, CATEGORIES, SELECTABLE_BLOCKS } from './world/blocks.js';
import { World, GENERATOR_VERSION } from './world/world.js';
import { VoxelScene, SKY } from './render/scene.js';
import { Player } from './player/player.js';
import { raycastVoxel } from './player/raycast.js';
import { GameStorage, serializeWorld } from './storage/storage.js';
import { Sound } from './audio/sound.js';

const SETTINGS_KEY = 'voxelcraft-3d-settings';
const isTouch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
const DEFAULT_SETTINGS = { quality: isTouch ? 'low' : 'medium', language: 'ms', volume: 0.45, sensitivity: 1, invertY: false, autoJump: isTouch, touchMode: 'buttons' };
const copy = (value) => structuredClone(value);

const TEXT = {
  ms: {
    subtitle: 'Bina dunia sendiri, satu blok demi satu blok.', worlds: 'Dunia saya', create: 'Cipta Dunia',
    settings: 'Tetapan', help: 'Cara Main', play: 'Main', back: 'Kembali', pause: 'Jeda', resume: 'Sambung',
    inventory: 'Inventori Blok', save: 'Simpan', quit: 'Simpan & Keluar', export: 'Eksport', import: 'Import Dunia',
    rename: 'Nama', delete: 'Padam', seed: 'Seed (kosong untuk rawak)', preset: 'Jenis dunia',
    name: 'Nama dunia', hills: 'Bukit', flat: 'Rata', quality: 'Kualiti grafik', language: 'Bahasa',
    touchMode: 'Kawalan sentuh', touchButtons: 'Butang aksi', touchInteract: 'Tap & tahan',
    autoJump: 'Auto-jump', invertY: 'Songsangkan pandangan Y', sensitivity: 'Sensitiviti', volume: 'Volume',
    empty: 'Belum ada dunia. Cipta dunia pertama anda.', search: 'Cari blok…',
    selected: 'Blok dipilih', noStorage: 'Storan browser tidak tersedia. Dunia hanya kekal sepanjang sesi ini.',
    saved: 'Disimpan', saving: 'Menyimpan…', failed: 'Gagal menyimpan', offline: 'Dunia ini disimpan pada peranti ini. Eksport fail untuk backup atau pindah peranti.',
    newWorld: 'Dunia baharu', copied: 'Pautan seed disalin.', downloaded: 'Dunia dieksport.',
    controls: 'WASD bergerak · Mouse melihat · Klik kiri pecah · Klik kanan letak · E inventori · Esc menu',
    tutorial: 'Pilih blok pada hotbar, kemudian bina dunia sendiri. Tekan F untuk terbang dan T untuk tukar waktu.'
  },
  en: {
    subtitle: 'Build your own world, one block at a time.', worlds: 'My Worlds', create: 'Create World',
    settings: 'Settings', help: 'How to Play', play: 'Play', back: 'Back', pause: 'Pause', resume: 'Resume',
    inventory: 'Block Inventory', save: 'Save', quit: 'Save & Quit', export: 'Export', import: 'Import World',
    rename: 'Rename', delete: 'Delete', seed: 'Seed (blank for random)', preset: 'World preset',
    name: 'World name', hills: 'Hills', flat: 'Flat', quality: 'Graphics quality', language: 'Language',
    touchMode: 'Touch controls', touchButtons: 'Action buttons', touchInteract: 'Tap & hold',
    autoJump: 'Auto-jump', invertY: 'Invert Y look', sensitivity: 'Sensitivity', volume: 'Volume',
    empty: 'No worlds yet. Create your first world.', search: 'Search blocks…',
    selected: 'Selected block', noStorage: 'Browser storage is unavailable. Worlds last only for this session.',
    saved: 'Saved', saving: 'Saving…', failed: 'Save failed', offline: 'This world is saved on this device. Export a file for backup or transfer.',
    newWorld: 'New world', copied: 'Seed link copied.', downloaded: 'World exported.',
    controls: 'WASD move · Mouse look · Left click mine · Right click place · E inventory · Esc menu',
    tutorial: 'Select a block in the hotbar and build. Press F to fly and T to change the time.'
  }
};

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return copy(DEFAULT_SETTINGS); }
}

function downloadFile(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

class VoxelCraftApp {
  constructor() {
    this.settings = loadSettings();
    this.storage = new GameStorage();
    this.sound = new Sound();
    this.sound.setVolume(this.settings.volume);
    this.overlay = document.getElementById('overlay');
    this.panel = document.getElementById('panel-content');
    this.host = document.getElementById('canvas-host');
    this.hud = document.getElementById('hud');
    this.toastElement = document.getElementById('toast');
    this.touchUI = document.getElementById('touch-ui');
    this.state = 'BOOT';
    this.screen = 'menu';
    this.keys = new Set();
    this.joystick = { x: 0, y: 0 };
    this.touchPointers = new Map();
    this.mouseHeld = null;
    this.touchHeld = null;
    this.nextActionAt = 0;
    this.hotbar = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    this.selectedSlot = 0;
    this.undoStack = [];
    this.redoStack = [];
    this.sky = 0;
    this.saveQueue = Promise.resolve(true);
    this.lastSaveAt = performance.now();
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.frameCount = 0;
    this.fpsElapsed = 0;
    this.lastHudAt = 0;
    this.lookDirection = new THREE.Vector3();
    this.lockWasHeld = false;
    this.bindUI();
    requestAnimationFrame((now) => this.frame(now));
  }

  t(key) { return TEXT[this.settings.language]?.[key] || TEXT.ms[key] || key; }

  async boot() {
    await this.storage.open();
    this.updateStaticLanguage();
    await this.showMenu();
    if (!this.storage.persistent) this.toast(this.t('noStorage'));
  }

  toast(message) {
    this.toastElement.textContent = message;
    this.toastElement.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastElement.classList.remove('visible'), 3200);
  }

  setSaveStatus(message, failed = false) {
    const element = document.getElementById('save-status');
    element.textContent = message;
    element.classList.toggle('failed', failed);
  }

  setPanel(html, screen) {
    this.screen = screen;
    this.panel.innerHTML = html;
    this.overlay.hidden = false;
    this.overlay.scrollTop = 0;
  }

  updateStaticLanguage() {
    document.documentElement.lang = this.settings.language;
    document.querySelector('.panel-heading p').textContent = this.t('subtitle');
    document.getElementById('time-button').textContent = this.settings.language === 'en' ? '☀ Time' : '☀ Waktu';
    document.getElementById('fly-button').textContent = this.settings.language === 'en' ? '✦ Fly' : '✦ Terbang';
    document.getElementById('inventory-button').textContent = this.settings.language === 'en' ? '▦ Blocks' : '▦ Blok';
    document.getElementById('pause-button').textContent = this.settings.language === 'en' ? '⚙ Menu' : '⚙ Menu';
    document.getElementById('touch-mine').textContent = this.settings.language === 'en' ? 'MINE' : 'PECAH';
    document.getElementById('touch-place').textContent = this.settings.language === 'en' ? 'PLACE' : 'LETAK';
    document.getElementById('touch-jump').textContent = this.settings.language === 'en' ? 'JUMP' : 'LOMPAT';
    document.getElementById('touch-fly').textContent = this.settings.language === 'en' ? 'FLY' : 'TERBANG';
  }

  async showMenu() {
    this.pause(false);
    this.state = 'MENU';
    const worlds = await this.storage.listWorlds();
    this.setPanel(`
      <h2>${this.t('worlds')}</h2>
      <div class="world-list">${worlds.length ? worlds.map((world) => `
        <div class="world-card">
          <strong>${escapeHTML(world.name)}</strong>
          <small>${escapeHTML(world.preset)} · ${escapeHTML(world.seed)} · ${new Date(world.updatedAt).toLocaleDateString()}</small>
          <div class="row-actions">
            <button class="button" data-action="load" data-id="${world.id}">${this.t('play')}</button>
            <button class="secondary" data-action="rename" data-id="${world.id}">${this.t('rename')}</button>
            <button class="secondary" data-action="export-listed" data-id="${world.id}">${this.t('export')}</button>
            <button class="danger" data-action="delete" data-id="${world.id}">${this.t('delete')}</button>
          </div>
        </div>`).join('') : `<p class="muted">${this.t('empty')}</p>`}</div>
      <div class="panel-actions">
        <button class="button" data-action="new">${this.t('create')}</button>
        <button class="secondary" data-action="import">${this.t('import')}</button>
        <button class="secondary" data-action="settings">${this.t('settings')}</button>
        <button class="secondary" data-action="help">${this.t('help')}</button>
      </div>
      <p class="muted">${this.t('offline')}</p>
      <input id="import-file" type="file" accept=".json,application/json" hidden />
    `, 'menu');
  }

  showNewWorld() {
    const params = new URLSearchParams(location.search);
    const seed = params.get('gv') === String(GENERATOR_VERSION) ? params.get('seed') || '' : '';
    const preset = params.get('preset') === 'flat' ? 'flat' : 'hills';
    this.setPanel(`
      <h2>${this.t('create')}</h2>
      <form id="create-form" class="form-grid">
        <label>${this.t('name')}<input name="name" maxlength="48" value="${escapeHTML(this.t('newWorld'))}" required /></label>
        <label>${this.t('seed')}<input name="seed" maxlength="100" value="${escapeHTML(seed)}" /></label>
        <label>${this.t('preset')}<select name="preset"><option value="hills" ${preset === 'hills' ? 'selected' : ''}>${this.t('hills')}</option><option value="flat" ${preset === 'flat' ? 'selected' : ''}>${this.t('flat')}</option></select></label>
        <div class="panel-actions"><button class="button" type="submit">${this.t('create')}</button><button class="secondary" type="button" data-action="menu">${this.t('back')}</button></div>
      </form>`, 'new');
  }

  showReady() {
    this.state = 'PAUSED';
    this.setPanel(`
      <h2>${escapeHTML(this.world.metadata.name)}</h2>
      <p>${this.t('tutorial')}</p>
      <p class="muted">${this.t('controls')}</p>
      <div class="panel-actions"><button class="button wide" data-action="resume">▶ ${this.t('play')}</button>
      <button class="secondary" data-action="inventory">${this.t('inventory')}</button>
      <button class="secondary" data-action="worlds">${this.t('worlds')}</button></div>
    `, 'ready');
  }

  showPause() {
    if (!this.world) return this.showMenu();
    this.pause();
    this.setPanel(`
      <h2>${this.t('pause')} · ${escapeHTML(this.world.metadata.name)}</h2>
      <p class="muted">${this.t('offline')}</p>
      <div class="panel-actions">
        <button class="button" data-action="resume">▶ ${this.t('resume')}</button>
        <button class="secondary" data-action="save">${this.t('save')}</button>
        <button class="secondary" data-action="inventory">${this.t('inventory')}</button>
        <button class="secondary" data-action="settings">${this.t('settings')}</button>
        <button class="secondary" data-action="export-current">${this.t('export')}</button>
        <button class="secondary" data-action="screenshot">Screenshot</button>
        <button class="secondary" data-action="share-seed">Seed Link</button>
        <button class="secondary" data-action="help">${this.t('help')}</button>
        <button class="danger" data-action="worlds">${this.t('quit')}</button>
      </div>`, 'pause');
  }

  showSettings() {
    this.setPanel(`<h2>${this.t('settings')}</h2>
      <form id="settings-form" class="form-grid">
        <label class="setting-row"><span>${this.t('quality')}</span><select name="quality"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
        <label class="setting-row"><span>${this.t('language')}</span><select name="language"><option value="ms">Bahasa Melayu</option><option value="en">English</option></select></label>
        <label class="setting-row"><span>${this.t('touchMode')}</span><select name="touchMode"><option value="buttons">${this.t('touchButtons')}</option><option value="interact">${this.t('touchInteract')}</option></select></label>
        <label class="setting-row"><span>${this.t('autoJump')}</span><input type="checkbox" name="autoJump" /></label>
        <label class="setting-row"><span>${this.t('invertY')}</span><input type="checkbox" name="invertY" /></label>
        <label class="setting-row"><span>${this.t('sensitivity')}</span><input type="range" name="sensitivity" min="0.4" max="2.2" step="0.1" /></label>
        <label class="setting-row"><span>${this.t('volume')}</span><input type="range" name="volume" min="0" max="1" step="0.05" /></label>
        <div class="panel-actions"><button class="button" type="submit">${this.t('save')}</button><button class="secondary" type="button" data-action="back">${this.t('back')}</button></div>
      </form>`, 'settings');
    const form = document.getElementById('settings-form');
    for (const [key, value] of Object.entries(this.settings)) {
      if (!form.elements[key]) continue;
      if (typeof value === 'boolean') form.elements[key].checked = value;
      else form.elements[key].value = value;
    }
  }

  showHelp() {
    this.setPanel(`<h2>${this.t('help')}</h2>
      <p>${this.t('tutorial')}</p>
      <div class="help-grid">
        <span>W A S D</span><span>${this.settings.language === 'en' ? 'Move' : 'Bergerak'}</span>
        <span>Mouse / Touch</span><span>${this.settings.language === 'en' ? 'Look around' : 'Lihat sekeliling'}</span>
        <span>Left / Right click</span><span>${this.settings.language === 'en' ? 'Mine / Place' : 'Pecah / Letak'}</span>
        <span>Space / Shift</span><span>${this.settings.language === 'en' ? 'Jump / Crouch' : 'Lompat / Tunduk'}</span>
        <span>E / 1–9</span><span>${this.settings.language === 'en' ? 'Inventory / Hotbar' : 'Inventori / Hotbar'}</span>
        <span>F / T / Esc</span><span>${this.settings.language === 'en' ? 'Fly / Time / Pause' : 'Terbang / Waktu / Jeda'}</span>
        <span>Ctrl+Z / Ctrl+Y</span><span>Undo / Redo</span>
      </div>
      <p class="muted">${this.settings.language === 'en' ? 'Touch: move with the joystick, swipe to look. Optional tap to place and hold to mine in Settings.' : 'Sentuh: bergerak dengan joystick, leret untuk melihat. Mod tap untuk letak dan tahan untuk pecah boleh dipilih dalam Tetapan.'}</p>
      <div class="panel-actions"><button class="button" data-action="back">${this.t('back')}</button></div>`, 'help');
  }

  showInventory(category = CATEGORIES[0], query = '') {
    if (!this.world) return;
    this.pause();
    this.inventoryCategory = category;
    this.inventoryQuery = query;
    const matches = SELECTABLE_BLOCKS.filter((item) => item.category === category && item.name.toLowerCase().includes(query.toLowerCase()));
    this.setPanel(`<h2>${this.t('inventory')}</h2>
      <p class="muted">${this.t('selected')}: ${this.selectedSlot + 1} · ${escapeHTML(BLOCK_BY_ID.get(this.hotbar[this.selectedSlot])?.name || '')}</p>
      <div class="inventory-tools">${CATEGORIES.map((item) => `<button class="chip ${item === category ? 'active' : ''}" data-action="category" data-category="${item}">${item}</button>`).join('')}</div>
      <input id="block-search" class="search-input wide" type="search" placeholder="${this.t('search')}" value="${escapeHTML(query)}" />
      <div class="block-grid">${matches.map((item) => `<button class="block-choice" data-action="block" data-id="${item.id}"><img src="${this.scene.atlas.icons.get(item.id)}" alt="" /><span>${escapeHTML(item.name)}</span></button>`).join('')}</div>
      <div class="panel-actions"><button class="button" data-action="resume">${this.t('resume')}</button><button class="secondary" data-action="pause">${this.t('back')}</button></div>`, 'inventory');
    document.getElementById('block-search').addEventListener('input', (event) => {
      const caret = event.target.selectionStart;
      this.showInventory(category, event.target.value);
      const input = document.getElementById('block-search');
      input.focus();
      input.setSelectionRange(caret, caret);
    });
  }

  async startWorld(id) {
    this.state = 'LOADING';
    this.setPanel(`<h2>${this.settings.language === 'en' ? 'Loading world…' : 'Memuat dunia…'}</h2><p class="muted">${this.settings.language === 'en' ? 'Generating terrain and preparing the scene.' : 'Menjana terrain dan menyediakan paparan.'}</p>`, 'loading');
    await new Promise((resolve) => requestAnimationFrame(resolve));
    try {
      const { metadata, snapshots } = await this.storage.loadWorld(id);
      if (this.scene) this.scene.dispose();
      this.world = new World(metadata);
      snapshots.forEach((snapshot) => this.world.applySnapshot(snapshot));
      this.player = new Player(this.world, metadata.player);
      this.hotbar = Array.isArray(metadata.hotbar) && metadata.hotbar.length === 9 ? [...metadata.hotbar] : [1, 2, 3, 4, 5, 6, 7, 8, 9];
      this.selectedSlot = 0;
      this.undoStack = [];
      this.redoStack = [];
      this.scene = new VoxelScene(this.host, this.world, this.settings.quality);
      this.sky = metadata.sky || 0;
      this.scene.setTime(this.sky);
      this.scene.setPlayerView(this.player);
      this.scene.syncChunks(this.player.x, this.player.z, 6);
      this.scene.render();
      this.bindCanvas(this.scene.renderer.domElement);
      this.hud.hidden = false;
      this.touchUI.hidden = !isTouch;
      this.renderHotbar();
      this.updateHud(performance.now());
      this.setSaveStatus(this.storage.persistent ? this.t('saved') : this.t('noStorage'));
      this.lastSaveAt = performance.now();
      this.showReady();
    } catch (error) {
      this.state = 'ERROR';
      this.setPanel(`<h2>${this.settings.language === 'en' ? 'Could not open world' : 'Dunia gagal dibuka'}</h2><p class="warning">${escapeHTML(error.message)}</p><button class="button" data-action="menu">${this.t('back')}</button>`, 'error');
    }
  }

  resume() {
    if (!this.world) return;
    this.state = 'PLAYING';
    this.overlay.hidden = true;
    this.resetInput();
    this.lastFrame = performance.now();
    if (!isTouch && this.scene.renderer.domElement.requestPointerLock) {
      try {
        const result = this.scene.renderer.domElement.requestPointerLock();
        result?.catch(() => this.toast(this.settings.language === 'en' ? 'Drag to look; pointer lock unavailable.' : 'Seret mouse untuk melihat; pointer lock tidak tersedia.'));
      } catch { this.toast(this.settings.language === 'en' ? 'Drag to look.' : 'Seret mouse untuk melihat.'); }
    }
  }

  pause(exitLock = true) {
    if (this.state === 'PLAYING') this.state = 'PAUSED';
    this.resetInput();
    if (exitLock && document.pointerLockElement) document.exitPointerLock();
  }

  resetInput() {
    this.keys.clear();
    this.mouseHeld = null;
    this.touchHeld = null;
    this.joystick = { x: 0, y: 0 };
    document.getElementById('joystick-knob').style.transform = '';
    for (const pointer of this.touchPointers.values()) clearTimeout(pointer.timer);
    this.touchPointers.clear();
  }

  renderHotbar() {
    document.getElementById('hotbar').innerHTML = this.hotbar.map((id, index) => {
      const block = BLOCK_BY_ID.get(id);
      return `<button class="hotbar-slot ${index === this.selectedSlot ? 'active' : ''}" data-slot="${index}" aria-label="${index + 1}: ${escapeHTML(block.name)}" aria-pressed="${index === this.selectedSlot}"><small>${index + 1}</small><img src="${this.scene.atlas.icons.get(id)}" alt="" /></button>`;
    }).join('');
  }

  selectSlot(index) {
    this.selectedSlot = (index + 9) % 9;
    this.sound.play('select');
    this.renderHotbar();
    this.updateHud(performance.now());
  }

  targetAt(clientX = null, clientY = null) {
    if (!this.scene || !this.player) return null;
    this.scene.setPlayerView(this.player);
    const camera = this.scene.camera;
    let direction;
    if (clientX == null) {
      direction = camera.getWorldDirection(this.lookDirection).clone();
    } else {
      const rect = this.scene.renderer.domElement.getBoundingClientRect();
      const ndcX = (clientX - rect.left) / rect.width * 2 - 1;
      const ndcY = 1 - (clientY - rect.top) / rect.height * 2;
      direction = new THREE.Vector3(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    }
    return raycastVoxel(this.world, camera.position, direction);
  }

  action(type, clientX = null, clientY = null) {
    if (this.state !== 'PLAYING') return;
    const hit = this.targetAt(clientX, clientY);
    if (!hit) return;
    let x = hit.x; let y = hit.y; let z = hit.z;
    let nextId = 0;
    if (type === 'mine') {
      if (!BLOCK_BY_ID.get(hit.id)?.breakable) return this.toast(this.settings.language === 'en' ? 'This block cannot be mined.' : 'Blok ini tidak boleh dipecahkan.');
    } else {
      x += hit.normal.x; y += hit.normal.y; z += hit.normal.z;
      if (!World.inBounds(x, y, z) || this.player.overlapsBlock(x, y, z)) return;
      const old = this.world.getBlock(x, y, z);
      if (old && !BLOCK_BY_ID.get(old)?.replaceable) return;
      nextId = this.hotbar[this.selectedSlot];
    }
    const oldId = this.world.getBlock(x, y, z);
    if (!this.world.setBlock(x, y, z, nextId)) return;
    this.setSaveStatus(this.settings.language === 'en' ? 'Unsaved changes' : 'Perubahan belum disimpan');
    this.undoStack.push({ x, y, z, oldId, newId: nextId });
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack.length = 0;
    this.sound.play(type);
    if (isTouch && this.settings.volume > 0 && typeof navigator.vibrate === 'function') navigator.vibrate(20);
  }

  undo(redo = false) {
    if (!this.world) return;
    const from = redo ? this.redoStack : this.undoStack;
    const to = redo ? this.undoStack : this.redoStack;
    const command = from.pop();
    if (!command) return;
    this.world.setBlock(command.x, command.y, command.z, redo ? command.newId : command.oldId);
    this.setSaveStatus(this.settings.language === 'en' ? 'Unsaved changes' : 'Perubahan belum disimpan');
    to.push(command);
    this.sound.play('select');
  }

  async commitSave() {
    if (!this.world) return false;
    const world = this.world;
    this.setSaveStatus(this.t('saving'));
    try {
      await this.storage.saveWorld(world, this.player, this.sky, this.hotbar);
      this.setSaveStatus(world.dirtySave.size
        ? (this.settings.language === 'en' ? 'Unsaved changes' : 'Perubahan belum disimpan')
        : this.storage.persistent ? this.t('saved') : this.t('noStorage'));
      this.lastSaveAt = performance.now();
      return true;
    } catch (error) {
      this.setSaveStatus(this.t('failed'), true);
      this.toast(error.message);
      return false;
    }
  }

  save() {
    this.saveQueue = this.saveQueue.catch(() => false).then(() => this.commitSave());
    return this.saveQueue;
  }

  async exportCurrent() {
    if (!this.world) return;
    const content = serializeWorld(this.world, this.player, this.sky, this.hotbar);
    downloadFile(content, `voxelcraft-${this.world.metadata.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.json`, 'application/json');
    this.toast(this.t('downloaded'));
  }

  async exportListed(id) {
    const { metadata, snapshots } = await this.storage.loadWorld(id);
    const world = new World(metadata);
    snapshots.forEach((snapshot) => world.applySnapshot(snapshot));
    const player = new Player(world, metadata.player);
    downloadFile(serializeWorld(world, player, metadata.sky || 0, metadata.hotbar || [1, 2, 3, 4, 5, 6, 7, 8, 9]), `voxelcraft-${metadata.name.replace(/[^a-z0-9-]+/gi, '-')}.json`, 'application/json');
    this.toast(this.t('downloaded'));
  }

  async shareSeed() {
    if (!this.world) return;
    const url = new URL(location.href);
    url.search = new URLSearchParams({ seed: this.world.metadata.seed, preset: this.world.metadata.preset, gv: String(GENERATOR_VERSION) }).toString();
    try { await navigator.clipboard.writeText(url.href); this.toast(this.t('copied')); }
    catch { this.toast(url.href); }
  }

  screenshot() {
    if (!this.scene) return;
    this.scene.render();
    const link = document.createElement('a');
    link.href = this.scene.renderer.domElement.toDataURL('image/png');
    link.download = 'voxelcraft-screenshot.png';
    link.click();
    this.toast(this.settings.language === 'en' ? 'Screenshot saved.' : 'Gambar disimpan.');
  }

  updateHud(now) {
    if (!this.world || now - this.lastHudAt < 120) return;
    this.lastHudAt = now;
    const { x, y, z } = this.player;
    document.getElementById('world-info').textContent = `${Math.floor(x)}, ${Math.floor(y)}, ${Math.floor(z)} · ${this.world.biomeAt(Math.floor(x), Math.floor(z))} · ${SKY[this.sky].name} · ${this.player.fly ? 'Fly' : 'Walk'}`;
    const hit = this.targetAt();
    this.scene.setTarget(hit);
    document.getElementById('target-name').textContent = hit ? BLOCK_BY_ID.get(hit.id)?.name || '' : BLOCK_BY_ID.get(this.hotbar[this.selectedSlot])?.name || '';
  }

  frame(now) {
    requestAnimationFrame((time) => this.frame(time));
    const dt = Math.min((now - this.lastFrame) / 1000, 0.1);
    this.lastFrame = now;
    if (!this.scene || !this.world) return;
    if (document.hidden) return;
    if (this.state === 'PLAYING') {
      const input = {
        forward: this.keys.has('KeyW') || this.keys.has('ArrowUp'),
        backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
        left: this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
        right: this.keys.has('KeyD') || this.keys.has('ArrowRight'),
        jump: this.keys.has('Space'),
        crouch: this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
        joystickX: this.joystick.x,
        joystickY: this.joystick.y
      };
      this.accumulator = Math.min(this.accumulator + dt, 0.12);
      let steps = 0;
      while (this.accumulator >= 1 / 60 && steps < 6) {
        this.player.update(1 / 60, input, this.settings);
        this.accumulator -= 1 / 60;
        steps++;
      }
      if (this.mouseHeld && now >= this.nextActionAt) {
        this.action(this.mouseHeld);
        this.nextActionAt = now + 180;
      }
      if (this.touchHeld && now >= this.nextActionAt) {
        this.action(this.touchHeld);
        this.nextActionAt = now + 180;
      }
      if (now - this.lastSaveAt > 15000) void this.save();
    } else this.accumulator = 0;
    this.scene.setPlayerView(this.player);
    this.scene.syncChunks(this.player.x, this.player.z, this.state === 'LOADING' ? 6 : 3);
    this.scene.render();
    this.updateHud(now);
    this.frameCount++;
    this.fpsElapsed += dt;
    if (this.fpsElapsed >= 0.5) {
      document.getElementById('fps').textContent = `${Math.round(this.frameCount / this.fpsElapsed)} FPS`;
      this.frameCount = 0;
      this.fpsElapsed = 0;
    }
  }

  bindCanvas(canvas) {
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.showPause();
      this.toast(this.settings.language === 'en' ? 'Graphics context lost. Save or export your world.' : 'Paparan grafik terputus. Simpan atau eksport dunia.');
    });
    canvas.addEventListener('pointerdown', (event) => {
      if (this.state !== 'PLAYING') return;
      if (event.pointerType === 'touch') {
        canvas.setPointerCapture(event.pointerId);
        const info = { startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, dragging: false, mined: false, timer: null };
        if (this.settings.touchMode === 'interact') {
          info.timer = setTimeout(() => {
            if (!info.dragging && this.state === 'PLAYING') { this.action('mine', info.startX, info.startY); info.mined = true; }
          }, 350);
        }
        this.touchPointers.set(event.pointerId, info);
        event.preventDefault();
      } else {
        this.mouseHeld = event.button === 0 ? 'mine' : event.button === 2 ? 'place' : null;
        if (this.mouseHeld) {
          this.action(this.mouseHeld);
          this.nextActionAt = performance.now() + 180;
        }
        if (document.pointerLockElement !== canvas) this.dragMouse = { x: event.clientX, y: event.clientY };
      }
    });
    canvas.addEventListener('pointermove', (event) => {
      if (this.state !== 'PLAYING') return;
      if (event.pointerType === 'touch') {
        const info = this.touchPointers.get(event.pointerId);
        if (!info) return;
        const distance = Math.hypot(event.clientX - info.startX, event.clientY - info.startY);
        if (distance > 10) { info.dragging = true; clearTimeout(info.timer); }
        if (info.dragging) this.player.look(event.clientX - info.x, event.clientY - info.y, 0.004 * this.settings.sensitivity, this.settings.invertY);
        info.x = event.clientX; info.y = event.clientY;
      } else if (document.pointerLockElement === canvas) {
        this.player.look(event.movementX, event.movementY, 0.0023 * this.settings.sensitivity, this.settings.invertY);
      } else if (this.dragMouse) {
        this.player.look(event.clientX - this.dragMouse.x, event.clientY - this.dragMouse.y, 0.004 * this.settings.sensitivity, this.settings.invertY);
        this.dragMouse = { x: event.clientX, y: event.clientY };
      }
    });
    const end = (event) => {
      if (event.pointerType === 'touch') {
        const info = this.touchPointers.get(event.pointerId);
        if (!info) return;
        clearTimeout(info.timer);
        if (event.type === 'pointerup' && this.settings.touchMode === 'interact' && !info.dragging && !info.mined) this.action('place', info.startX, info.startY);
        this.touchPointers.delete(event.pointerId);
      } else { this.mouseHeld = null; this.dragMouse = null; }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('lostpointercapture', end);
  }

  bindUI() {
    this.panel.addEventListener('click', (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;
      void this.handleAction(button.dataset.action, button.dataset);
    });
    this.panel.addEventListener('submit', (event) => {
      event.preventDefault();
      if (event.target.id === 'create-form') {
        const data = new FormData(event.target);
        void this.storage.createWorld(data.get('name'), data.get('seed'), data.get('preset'))
          .then((metadata) => this.storage.requestPersistence().then(() => this.startWorld(metadata.id)))
          .catch((error) => this.toast(error.message));
      } else if (event.target.id === 'settings-form') {
        const form = event.target;
        this.settings = {
          quality: form.elements.quality.value,
          language: form.elements.language.value,
          touchMode: form.elements.touchMode.value,
          autoJump: form.elements.autoJump.checked,
          invertY: form.elements.invertY.checked,
          sensitivity: Number(form.elements.sensitivity.value),
          volume: Number(form.elements.volume.value)
        };
        try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings)); } catch { /* Gameplay can continue. */ }
        this.sound.setVolume(this.settings.volume);
        this.scene?.applyQuality(this.settings.quality);
        this.updateStaticLanguage();
        this.back();
      }
    });
    document.getElementById('hotbar').addEventListener('click', (event) => {
      const slot = event.target.closest('[data-slot]');
      if (slot) this.selectSlot(Number(slot.dataset.slot));
    });
    document.getElementById('time-button').addEventListener('click', () => this.changeTime());
    document.getElementById('fly-button').addEventListener('click', () => this.toggleFly());
    document.getElementById('inventory-button').addEventListener('click', () => this.showInventory());
    document.getElementById('pause-button').addEventListener('click', () => this.showPause());
    window.addEventListener('keydown', (event) => {
      if (event.target.closest('input,select,textarea,[contenteditable]')) return;
      if (event.code === 'Escape') { event.preventDefault(); if (this.state === 'PLAYING') this.showPause(); else if (this.world && this.state === 'PAUSED') this.resume(); return; }
      if (this.state !== 'PLAYING') return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
      this.keys.add(event.code);
      if (event.repeat) return;
      if (event.ctrlKey && event.code === 'KeyZ') { event.preventDefault(); this.undo(event.shiftKey); return; }
      if (event.ctrlKey && event.code === 'KeyY') { event.preventDefault(); this.undo(true); return; }
      if (event.code === 'KeyE') this.showInventory();
      if (event.code === 'KeyF') this.toggleFly();
      if (event.code === 'KeyT') this.changeTime();
      if (/^Digit[1-9]$/.test(event.code)) this.selectSlot(Number(event.code.slice(-1)) - 1);
    });
    window.addEventListener('keyup', (event) => this.keys.delete(event.code));
    window.addEventListener('blur', () => { if (this.state === 'PLAYING') this.showPause(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.state === 'PLAYING') { this.showPause(); void this.save(); } });
    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.scene?.renderer.domElement;
      if (!locked && this.lockWasHeld && this.state === 'PLAYING') this.showPause();
      this.lockWasHeld = locked;
    });
    document.addEventListener('pointerlockerror', () => this.toast(this.settings.language === 'en' ? 'Drag to look.' : 'Seret mouse untuk melihat.'));
    window.addEventListener('wheel', (event) => {
      if (this.state !== 'PLAYING') return;
      event.preventDefault();
      this.selectSlot(this.selectedSlot + (event.deltaY > 0 ? 1 : -1));
    }, { passive: false });
    this.bindTouchControls();
  }

  bindTouchControls() {
    const joystick = document.getElementById('joystick');
    const knob = document.getElementById('joystick-knob');
    const moveJoystick = (event) => {
      const rect = joystick.getBoundingClientRect();
      const x = Math.max(-1, Math.min(1, (event.clientX - rect.left - rect.width / 2) / (rect.width * 0.35)));
      const y = Math.max(-1, Math.min(1, (event.clientY - rect.top - rect.height / 2) / (rect.height * 0.35)));
      this.joystick = { x, y };
      knob.style.transform = `translate(${x * rect.width * 0.25}px,${y * rect.height * 0.25}px)`;
    };
    joystick.addEventListener('pointerdown', (event) => { joystick.setPointerCapture(event.pointerId); moveJoystick(event); event.preventDefault(); });
    joystick.addEventListener('pointermove', (event) => { if (joystick.hasPointerCapture(event.pointerId)) moveJoystick(event); });
    const clear = () => { this.joystick = { x: 0, y: 0 }; knob.style.transform = ''; };
    joystick.addEventListener('pointerup', clear);
    joystick.addEventListener('pointercancel', clear);
    joystick.addEventListener('lostpointercapture', clear);
    for (const [id, type] of [['touch-mine', 'mine'], ['touch-place', 'place']]) {
      const button = document.getElementById(id);
      button.addEventListener('pointerdown', (event) => {
        if (this.state !== 'PLAYING') return;
        button.setPointerCapture(event.pointerId);
        this.touchHeld = type;
        this.action(type);
        this.nextActionAt = performance.now() + 180;
        event.preventDefault();
      });
      for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => { this.touchHeld = null; });
    }
    const jump = document.getElementById('touch-jump');
    jump.addEventListener('pointerdown', (event) => { jump.setPointerCapture(event.pointerId); this.keys.add('Space'); event.preventDefault(); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) jump.addEventListener(name, () => this.keys.delete('Space'));
    document.getElementById('touch-fly').addEventListener('click', () => this.toggleFly());
  }

  toggleFly() {
    if (!this.player || this.state !== 'PLAYING') return;
    this.player.fly = !this.player.fly;
    this.player.vy = 0;
    this.toast(this.player.fly ? (this.settings.language === 'en' ? 'Fly mode' : 'Mod terbang') : (this.settings.language === 'en' ? 'Walk mode' : 'Mod berjalan'));
  }

  changeTime() {
    if (!this.scene || this.state !== 'PLAYING') return;
    this.sky = (this.sky + 1) % SKY.length;
    this.setSaveStatus(this.settings.language === 'en' ? 'Unsaved changes' : 'Perubahan belum disimpan');
    this.toast(this.scene.setTime(this.sky));
  }

  back() {
    if (this.world && this.state !== 'MENU') this.showPause();
    else void this.showMenu();
  }

  async handleAction(action, data) {
    try {
      switch (action) {
        case 'new': this.showNewWorld(); break;
        case 'menu': await this.showMenu(); break;
        case 'load': await this.startWorld(data.id); break;
        case 'resume': this.resume(); break;
        case 'pause': this.showPause(); break;
        case 'inventory': this.showInventory(); break;
        case 'settings': this.showSettings(); break;
        case 'help': this.showHelp(); break;
        case 'back': this.back(); break;
        case 'save': await this.save(); break;
        case 'worlds': if (await this.save()) await this.showMenu(); break;
        case 'export-current': await this.exportCurrent(); break;
        case 'export-listed': await this.exportListed(data.id); break;
        case 'share-seed': await this.shareSeed(); break;
        case 'screenshot': this.screenshot(); break;
        case 'category': this.showInventory(data.category, this.inventoryQuery); break;
        case 'block':
          this.hotbar[this.selectedSlot] = Number(data.id);
          this.setSaveStatus(this.settings.language === 'en' ? 'Unsaved changes' : 'Perubahan belum disimpan');
          this.renderHotbar();
          this.showInventory(this.inventoryCategory, this.inventoryQuery);
          break;
        case 'rename': {
          const name = prompt(this.settings.language === 'en' ? 'New world name:' : 'Nama dunia baharu:');
          if (name != null) { await this.storage.renameWorld(data.id, name); await this.showMenu(); }
          break;
        }
        case 'delete':
          if (confirm(this.settings.language === 'en' ? 'Delete this world permanently?' : 'Padam dunia ini secara kekal?')) {
            await this.storage.deleteWorld(data.id);
            await this.showMenu();
          }
          break;
        case 'import': {
          const fileInput = document.getElementById('import-file');
          fileInput.onchange = async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            if (file.size > 20 * 1024 * 1024) return this.toast('Fail melebihi 20 MiB.');
            try { const world = await this.storage.importWorld(await file.text()); await this.startWorld(world.id); }
            catch (error) { this.toast(error.message); }
          };
          fileInput.click();
          break;
        }
      }
    } catch (error) { this.toast(error.message); }
  }
}

const app = new VoxelCraftApp();
void app.boot();

if (import.meta.env.DEV) window.__voxelcraft = app;
