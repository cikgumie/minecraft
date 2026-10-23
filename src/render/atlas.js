import * as THREE from 'three';
import { BLOCKS } from '../world/blocks.js';

const SIZE = 16;
const PAD = 1;
const STRIDE = SIZE + PAD * 2;
const COLUMNS = 8;

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const part = (shift) => Math.max(0, Math.min(255, (value >> shift & 255) + amount));
  return `rgb(${part(16)},${part(8)},${part(0)})`;
}

function pixelVariation(id, face, x, y) {
  let value = (Math.imul(id + 17, 0x9e3779b1) ^ Math.imul(x + 1, 0x85ebca6b) ^ Math.imul(y + 3, 0xc2b2ae35) ^ face.length) >>> 0;
  value = Math.imul(value ^ value >>> 15, 0x85ebca6b);
  return ((value >>> 16) % 21) - 10;
}

function drawTile(ctx, block, face, px, py) {
  const base = block[face] || block.color;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let color = base;
      let delta = pixelVariation(block.id, face, x, y);
      if (block.pattern === 'grass' && face === 'side' && y < 3 + (x % 3 === 0 ? 1 : 0)) color = block.top;
      if (block.pattern === 'planks' && y % 5 === 0) delta -= 24;
      if (block.pattern === 'log' && face === 'side' && x % 4 === 0) delta -= 22;
      if (block.pattern === 'log' && face !== 'side') {
        const ring = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
        delta += Math.floor(ring) % 2 === 0 ? 16 : -13;
      }
      if (block.pattern === 'bricks' && (y % 5 === 0 || x === ((Math.floor(y / 5) % 2) * 7 + 3))) delta -= 25;
      if (block.pattern === 'stone' && ((x * 3 + y * 7) % 11 === 0)) delta -= 20;
      if (block.pattern === 'ore' && (x * 5 + y * 3) % 13 < 3) delta += 27;
      if (block.pattern === 'leaves' && (x * 7 + y * 11 + block.id) % 17 === 0) continue;
      if (block.pattern === 'glass' && x !== 0 && y !== 0 && x !== 15 && y !== 15 && (x + y) % 9 !== 0) {
        ctx.fillStyle = 'rgba(201,242,255,0.22)';
      } else if (block.pattern === 'water') {
        ctx.fillStyle = `rgba(50,125,218,${0.52 + (delta + 10) / 140})`;
      } else {
        ctx.fillStyle = shade(color, delta);
      }
      ctx.fillRect(px + x, py + y, 1, 1);
    }
  }
}

export function createAtlas() {
  const faces = [];
  const tileFor = new Map();
  for (const block of BLOCKS) {
    for (const face of ['side', 'top', 'bottom']) {
      const distinct = block[face] !== block.side || (block.pattern === 'grass' && face === 'top')
        || (block.pattern === 'log' && face !== 'side');
      if (!distinct && face !== 'side') {
        tileFor.set(`${block.id}:${face}`, tileFor.get(`${block.id}:side`));
      } else {
        const index = faces.length;
        faces.push({ block, face });
        tileFor.set(`${block.id}:${face}`, index);
      }
    }
  }
  const rows = Math.ceil(faces.length / COLUMNS);
  const canvas = document.createElement('canvas');
  canvas.width = COLUMNS * STRIDE;
  canvas.height = rows * STRIDE;
  const ctx = canvas.getContext('2d');
  const icons = new Map();
  faces.forEach(({ block, face }, index) => {
    const col = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);
    const px = col * STRIDE + PAD;
    const py = row * STRIDE + PAD;
    drawTile(ctx, block, face, px, py);
    // Duplicate edge pixels into one-pixel gutters to prevent atlas bleeding.
    ctx.drawImage(canvas, px, py, SIZE, 1, px, py - 1, SIZE, 1);
    ctx.drawImage(canvas, px, py + SIZE - 1, SIZE, 1, px, py + SIZE, SIZE, 1);
    ctx.drawImage(canvas, px, py, 1, SIZE, px - 1, py, 1, SIZE);
    ctx.drawImage(canvas, px + SIZE - 1, py, 1, SIZE, px + SIZE, py, 1, SIZE);
    if (face === 'side') {
      const thumb = document.createElement('canvas');
      thumb.width = thumb.height = SIZE;
      thumb.getContext('2d').drawImage(canvas, px, py, SIZE, SIZE, 0, 0, SIZE, SIZE);
      icons.set(block.id, thumb.toDataURL());
    }
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return {
    texture, icons,
    uv(id, face) {
      const index = tileFor.get(`${id}:${face}`);
      const col = index % COLUMNS;
      const row = Math.floor(index / COLUMNS);
      const u0 = (col * STRIDE + PAD + 0.015) / canvas.width;
      const u1 = (col * STRIDE + PAD + SIZE - 0.015) / canvas.width;
      const v0 = 1 - (row * STRIDE + PAD + SIZE - 0.015) / canvas.height;
      const v1 = 1 - (row * STRIDE + PAD + 0.015) / canvas.height;
      return [u0, v0, u1, v1];
    }
  };
}
