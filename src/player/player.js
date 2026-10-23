import { getBlockDef } from '../world/blocks.js';

const WIDTH = 0.29;
const HEIGHT = 1.75;

export class Player {
  constructor(world, state = null) {
    this.world = world;
    this.x = state?.x ?? 0.5;
    this.y = state?.y ?? world.terrainHeight(0, 0) + 1.02;
    this.z = state?.z ?? 0.5;
    this.yaw = state?.yaw ?? 0;
    this.pitch = state?.pitch ?? -0.1;
    this.fly = state?.fly ?? false;
    this.vy = 0;
    this.onGround = false;
    this.eyeHeight = 1.55;
    if (Math.abs(this.x) > 128 || Math.abs(this.z) > 128 || this.y < -4 || this.y > 63
      || this.collides(this.x, this.y, this.z)) this.respawn();
  }

  snapshot() {
    return { x: this.x, y: this.y, z: this.z, yaw: this.yaw, pitch: this.pitch, fly: this.fly };
  }

  respawn() {
    this.x = 0.5;
    this.z = 0.5;
    this.y = this.world.terrainHeight(0, 0) + 1.02;
    this.vy = 0;
    this.onGround = false;
  }

  look(dx, dy, sensitivity = 0.0023, invertY = false) {
    this.yaw -= dx * sensitivity;
    this.pitch += dy * sensitivity * (invertY ? 1 : -1);
    this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
  }

  collides(px, py, pz) {
    const minX = Math.floor(px - WIDTH);
    const maxX = Math.floor(px + WIDTH);
    const minY = Math.floor(py + 0.001);
    const maxY = Math.floor(py + HEIGHT - 0.001);
    const minZ = Math.floor(pz - WIDTH);
    const maxZ = Math.floor(pz + WIDTH);
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        for (let z = minZ; z <= maxZ; z++) {
          if (getBlockDef(this.world.getBlock(x, y, z))?.solid) return true;
        }
      }
    }
    return false;
  }

  overlapsBlock(x, y, z) {
    return x + 1 > this.x - WIDTH && x < this.x + WIDTH
      && y + 1 > this.y && y < this.y + HEIGHT
      && z + 1 > this.z - WIDTH && z < this.z + WIDTH;
  }

  update(dt, input, settings) {
    const forward = Number(input.forward) - Number(input.backward) - input.joystickY;
    const side = Number(input.right) - Number(input.left) + input.joystickX;
    const magnitude = Math.hypot(forward, side);
    const f = magnitude > 1 ? forward / magnitude : forward;
    const s = magnitude > 1 ? side / magnitude : side;
    const inWater = this.world.getBlock(Math.floor(this.x), Math.floor(this.y + 0.5), Math.floor(this.z)) === 11;
    const speed = (this.fly ? 9 : inWater ? 3.2 : input.crouch ? 3 : 5.5);
    const vx = (-Math.sin(this.yaw) * f + Math.cos(this.yaw) * s) * speed;
    const vz = (-Math.cos(this.yaw) * f - Math.sin(this.yaw) * s) * speed;

    if (this.fly) {
      this.vy = (Number(input.jump) - Number(input.crouch)) * speed;
    } else if (inWater) {
      this.vy = Math.max(-3, this.vy - 7 * dt);
      if (input.jump) this.vy = 3.5;
    } else {
      this.vy = Math.max(-24, this.vy - 24 * dt);
      if (input.jump && this.onGround) {
        this.vy = 8;
        this.onGround = false;
      }
    }

    const nextX = this.x + vx * dt;
    const nextZ = this.z + vz * dt;
    const blockedX = this.collides(nextX, this.y, this.z);
    const blockedZ = this.collides(this.x, this.y, nextZ);
    if ((blockedX || blockedZ) && settings.autoJump && !this.fly && this.onGround && magnitude > 0.1) {
      // A normal jump follows the collision solver, preserving the head check.
      if (!this.collides(this.x, this.y + 0.12, this.z)) {
        this.vy = 8;
        this.onGround = false;
      }
    }
    if (!blockedX) this.x = nextX;
    if (!blockedZ && !this.collides(this.x, this.y, nextZ)) this.z = nextZ;

    const nextY = this.y + this.vy * dt;
    if (!this.collides(this.x, nextY, this.z)) {
      this.y = nextY;
      this.onGround = false;
    } else {
      if (this.vy < 0) {
        this.y = Math.floor(nextY + 0.001) + 1;
        this.onGround = true;
      }
      this.vy = 0;
    }
    if (this.y < -8) this.respawn();
    this.eyeHeight = input.crouch && !this.fly ? 1.29 : 1.55;
  }
}
