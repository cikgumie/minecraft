import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, WORLD_MAX, WORLD_MIN } from '../world/world.js';
import { createAtlas } from './atlas.js';
import { meshChunk } from './mesher.js';

export const SKY = [
  { name: 'Tengah hari', background: '#81bfff', fog: '#a5cfff', ambient: 1.7, sun: 2.4, at: [50, 90, 30] },
  { name: 'Senja', background: '#e89971', fog: '#e8ad91', ambient: 1.0, sun: 1.8, at: [-60, 28, -30] },
  { name: 'Malam', background: '#101b38', fog: '#172341', ambient: 0.55, sun: 0.5, at: [30, 80, -50] }
];

export class VoxelScene {
  constructor(host, world, quality = 'medium') {
    this.host = host;
    this.world = world;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 110);
    this.camera.rotation.order = 'YXZ';
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setSize(host.clientWidth, host.clientHeight);
    host.appendChild(this.renderer.domElement);
    this.atlas = createAtlas();
    this.materials = {
      opaque: new THREE.MeshLambertMaterial({ map: this.atlas.texture }),
      cutout: new THREE.MeshLambertMaterial({ map: this.atlas.texture, alphaTest: 0.1, side: THREE.DoubleSide }),
      transparent: new THREE.MeshLambertMaterial({ map: this.atlas.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide })
    };
    this.ambient = new THREE.AmbientLight(0xffffff, 1.7);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.4);
    this.scene.add(this.ambient, this.sun);
    this.chunkMeshes = new Map();
    this.timeIndex = 0;
    this.quality = quality;
    this.applyQuality(quality);
    this.setTime(0);
    this.highlight = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(1.007, 1.007, 1.007)),
      new THREE.LineBasicMaterial({ color: '#ffec87' })
    );
    this.highlight.visible = false;
    this.scene.add(this.highlight);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
  }

  applyQuality(quality) {
    this.quality = quality;
    this.radius = quality === 'low' ? 2 : quality === 'high' ? 4 : 3;
    const pixelRatio = quality === 'low' ? 1 : quality === 'high' ? 2 : 1.5;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, pixelRatio));
    this.resize();
    this.scene.fog = new THREE.FogExp2(SKY[this.timeIndex].fog, quality === 'low' ? 0.028 : 0.019);
  }

  setTime(index) {
    this.timeIndex = ((index % SKY.length) + SKY.length) % SKY.length;
    const preset = SKY[this.timeIndex];
    this.scene.background = new THREE.Color(preset.background);
    if (this.scene.fog) this.scene.fog.color.set(preset.fog);
    this.ambient.intensity = preset.ambient;
    this.sun.intensity = preset.sun;
    this.sun.position.set(...preset.at);
    return preset.name;
  }

  resize() {
    const width = Math.max(1, this.host.clientWidth);
    const height = Math.max(1, this.host.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setPlayerView(player) {
    this.camera.position.set(player.x, player.y + player.eyeHeight, player.z);
    this.camera.rotation.set(player.pitch, player.yaw, 0);
  }

  setTarget(hit) {
    this.highlight.visible = Boolean(hit);
    if (hit) this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  }

  syncChunks(x, z, budget = 3) {
    const centerX = Math.floor(x / CHUNK_SIZE);
    const centerZ = Math.floor(z / CHUNK_SIZE);
    const desired = [];
    const keep = new Set();
    for (let dx = -this.radius; dx <= this.radius; dx++) {
      for (let dz = -this.radius; dz <= this.radius; dz++) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        if (cx * 16 > WORLD_MAX || cx * 16 + 15 < WORLD_MIN || cz * 16 > WORLD_MAX || cz * 16 + 15 < WORLD_MIN) continue;
        for (let cy = 0; cy < WORLD_HEIGHT / CHUNK_SIZE; cy++) {
          const key = `${cx},${cy},${cz}`;
          keep.add(key);
          if (!this.chunkMeshes.has(key) || this.world.dirtyMesh.has(key)) {
            desired.push({ key, cx, cy, cz, distance: dx * dx + dz * dz + cy * 0.25 });
          }
        }
      }
    }
    desired.sort((a, b) => a.distance - b.distance);
    for (const { key, cx, cy, cz } of desired.slice(0, budget)) {
      const old = this.chunkMeshes.get(key);
      if (old) this.removeChunk(old);
      const chunk = this.world.getChunk(cx, cy, cz);
      const geometryByLayer = meshChunk(this.world, chunk, this.atlas);
      const meshes = [];
      for (const [layer, geometry] of Object.entries(geometryByLayer)) {
        const mesh = new THREE.Mesh(geometry, this.materials[layer]);
        mesh.position.set(cx * 16, cy * 16, cz * 16);
        mesh.renderOrder = layer === 'transparent' ? 2 : layer === 'cutout' ? 1 : 0;
        this.scene.add(mesh);
        meshes.push(mesh);
      }
      this.chunkMeshes.set(key, meshes);
      this.world.dirtyMesh.delete(key);
    }
    for (const [key, meshes] of this.chunkMeshes) {
      if (!keep.has(key)) {
        this.removeChunk(meshes);
        this.chunkMeshes.delete(key);
      }
    }
  }

  removeChunk(meshes) {
    for (const mesh of meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }

  dispose() {
    this.resizeObserver.disconnect();
    for (const meshes of this.chunkMeshes.values()) this.removeChunk(meshes);
    this.chunkMeshes.clear();
    this.highlight.geometry.dispose();
    this.highlight.material.dispose();
    Object.values(this.materials).forEach((material) => material.dispose());
    this.atlas.texture.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
