// First-person controller: pointer-lock mouse look, WASD movement, gravity and
// simple building collision. Coordinates are local metric world meters.
import * as THREE from 'three';
import { pointInPolygon } from './geo.js';

const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.5;
const WALK_SPEED = 16;
const RUN_SPEED = 45;
const FLY_SPEED = 80;
const FLY_RUN_SPEED = 240;
const FLY_VERTICAL_SPEED = 55;
const JUMP_SPEED = 9;
const GRAVITY = 28;
const LOOK_SENSITIVITY = 0.0022;

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

export class Player {
  constructor(camera, geo, colliders) {
    this.camera = camera;
    this.geo = geo;
    this.colliders = colliders;
    this.position = new THREE.Vector3();
    this.velocityY = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.grounded = true;
    this.flying = false;
    this.currentSpeed = 0;
    this.keys = new Set();
    this.sensitivity = LOOK_SENSITIVITY;

    document.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'KeyF') this.flying = !this.flying;
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    });
    document.addEventListener('keyup', (event) => this.keys.delete(event.code));
    document.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.yaw -= event.movementX * this.sensitivity;
      this.pitch -= event.movementY * this.sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement !== null;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    const result = document.body.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }

  spawn(x, z) {
    this.position.set(x, this.geo.heightAt(x, z), z);
  }

  collides(x, z) {
    for (const poly of this.colliders) {
      if (pointInPolygon(x, z, poly)) return true;
      for (let i = 0; i < poly.length; i += 1) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (distanceToSegment(x, z, a.x, a.z, b.x, b.z) < PLAYER_RADIUS) return true;
      }
    }
    return false;
  }

  move(dx, dz) {
    const { x, z } = this.position;
    if (!this.collides(x + dx, z + dz)) {
      this.position.x += dx;
      this.position.z += dz;
    } else if (!this.collides(x + dx, z)) {
      this.position.x += dx;
    } else if (!this.collides(x, z + dz)) {
      this.position.z += dz;
    }
  }

  update(dt) {
    const forward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const strafe =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const running = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const speed = this.flying
      ? running
        ? FLY_RUN_SPEED
        : FLY_SPEED
      : running
        ? RUN_SPEED
        : WALK_SPEED;
    this.currentSpeed = 0;

    if (forward || strafe) {
      this.currentSpeed = speed;
      const sin = Math.sin(this.yaw);
      const cos = Math.cos(this.yaw);
      let dx = -sin * forward + cos * strafe;
      let dz = -cos * forward - sin * strafe;
      const len = Math.hypot(dx, dz) || 1;
      dx = (dx / len) * speed * dt;
      dz = (dz / len) * speed * dt;

      if (this.flying) {
        this.position.x += dx;
        this.position.z += dz;
      } else {
        this.move(dx, dz);
      }
    }

    const halfX = this.geo.size.x / 2 - 20;
    const halfZ = this.geo.size.z / 2 - 20;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -halfX, halfX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -halfZ, halfZ);

    if (this.flying) {
      const up = (this.keys.has('Space') ? 1 : 0) - (this.keys.has('ControlLeft') ? 1 : 0);
      this.position.y += up * FLY_VERTICAL_SPEED * dt;
    } else {
      this.velocityY -= GRAVITY * dt;
      this.position.y += this.velocityY * dt;
      const ground = this.geo.heightAt(this.position.x, this.position.z);
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velocityY = 0;
        this.grounded = true;
      } else {
        this.grounded = false;
      }
      if (this.grounded && this.keys.has('Space')) {
        this.velocityY = JUMP_SPEED;
        this.grounded = false;
      }
    }

    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }
}
