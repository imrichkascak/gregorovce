// First-person controller. On foot by default: camera-relative walk with a
// short run-up and a stop, jump, and a fall from the sky at the spawn point.
// F switches to fly. Coordinates are local metric world meters.
import * as THREE from 'three';
import { pointInPolygon } from './geo.js';
import { MOTION, stepHorizontal } from './motion.js';

const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.5;
const LOOK_SENSITIVITY = 0.0022;
const COYOTE_TIME = 0.12;
const TERMINAL_VELOCITY = -42;

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
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.28;
    this.spawnYaw = 0;
    this.grounded = false;
    this.flying = false;
    this.started = false;
    this.sprinting = false;
    this.stamina = 1;
    this.coyote = 0;
    this.jumpHeld = false;
    this.currentSpeed = 0;
    this.keys = new Set();
    this.sensitivity = LOOK_SENSITIVITY;
    // Phones/tablets: no pointer lock — start directly and use touch controls.
    this.touchMode = window.matchMedia?.('(pointer: coarse)')?.matches ?? false;
    this.touchMove = { x: 0, y: 0 };
    this.touchUp = 0;

    document.addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'KeyF') this.setFlying(!this.flying);
      if (event.code === 'KeyR') this.respawn();
      if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    });
    document.addEventListener('keyup', (event) => this.keys.delete(event.code));
    document.addEventListener('mousemove', (event) => {
      if (!this.locked) return;
      this.yaw -= event.movementX * this.sensitivity;
      this.pitch -= event.movementY * this.sensitivity;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.2, 1.2);
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement !== null;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  setFlying(flying) {
    if (this.flying === flying) return;
    this.flying = flying;
    if (!flying) this.velocity.y = 0;
    if (this.onFlyingChange) this.onFlyingChange(flying);
  }

  lock() {
    if (this.touchMode || typeof document.body.requestPointerLock !== 'function') {
      if (this.onLockChange) this.onLockChange(true);
      return;
    }
    const result = document.body.requestPointerLock();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }

  /** Returns to the menu (used by the touch MENU button). */
  pause() {
    this.keys.clear();
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchUp = 0;
    if (this.onLockChange) this.onLockChange(false);
  }

  /** Remember where a fresh drop should land, and face `yaw` on the way down. */
  setSpawn(x, z, yaw) {
    this.spawnPoint = { x, z };
    this.spawnYaw = yaw;
    this.yaw = yaw;
    this.pitch = -0.55;
    this.started = false;
    this.parkAtDrop();
  }

  parkAtDrop() {
    if (!this.spawnPoint) return;
    const { x, z } = this.spawnPoint;
    this.position.set(x, this.geo.heightAt(x, z) + MOTION.dropHeight, z);
    this.velocity.set(0, 0, 0);
    this.grounded = false;
  }

  /**
   * Drop from above the spawn. Used for the first entrance and for R,
   * so both land in the same place the same way.
   */
  dropFromSky() {
    if (!this.spawnPoint) return;
    this.started = true;
    this.setFlying(false);
    this.parkAtDrop();
    this.yaw = this.spawnYaw;
    this.pitch = -0.55;
    this.stamina = 1;
    this.coyote = 0;
    this.jumpHeld = false;
    this.touchMove.x = 0;
    this.touchMove.y = 0;
    this.touchUp = 0;
    this.keys.clear();
  }

  /** @deprecated name kept for the touch reset button. */
  respawn() {
    this.dropFromSky();
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
      this.velocity.z = 0;
    } else if (!this.collides(x, z + dz)) {
      this.position.z += dz;
      this.velocity.x = 0;
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }

  writeCamera() {
    this.camera.position.set(this.position.x, this.position.y + EYE_HEIGHT, this.position.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  update(dt) {
    if (!this.started) {
      this.parkAtDrop();
      this.writeCamera();
      return;
    }

    const keyForward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0);
    const keyStrafe =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0);
    const forward = THREE.MathUtils.clamp(keyForward + this.touchMove.y, -1, 1);
    const strafe = THREE.MathUtils.clamp(keyStrafe + this.touchMove.x, -1, 1);
    const wantsSprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    this.sprinting = wantsSprint && (this.flying || this.stamina > 0.02);

    let wishSpeed = this.flying
      ? this.sprinting
        ? MOTION.flyRun
        : MOTION.fly
      : this.sprinting
        ? MOTION.run
        : MOTION.walk;
    if (!this.flying && this.sprinting) {
      this.stamina = Math.max(0, this.stamina - dt * 0.22);
      if (this.stamina <= 0) {
        this.sprinting = false;
        wishSpeed = MOTION.walk;
      }
    } else {
      this.stamina = Math.min(1, this.stamina + dt * 0.28);
    }

    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let wishX = -sin * forward + cos * strafe;
    let wishZ = -cos * forward - sin * strafe;
    const wishLen = Math.hypot(wishX, wishZ);
    if (wishLen > 0) {
      wishX /= wishLen;
      wishZ /= wishLen;
    } else {
      wishSpeed = 0;
    }

    const stepped = stepHorizontal(
      this.velocity.x,
      this.velocity.z,
      wishX,
      wishZ,
      wishSpeed,
      dt,
      this.grounded,
      this.flying,
    );
    this.velocity.x = stepped.x;
    this.velocity.z = stepped.z;
    this.currentSpeed = Math.hypot(this.velocity.x, this.velocity.z);

    const dx = this.velocity.x * dt;
    const dz = this.velocity.z * dt;
    if (this.flying) {
      this.position.x += dx;
      this.position.z += dz;
    } else if (dx || dz) {
      this.move(dx, dz);
    }

    const halfX = this.geo.size.x / 2 - 20;
    const halfZ = this.geo.size.z / 2 - 20;
    this.position.x = THREE.MathUtils.clamp(this.position.x, -halfX, halfX);
    this.position.z = THREE.MathUtils.clamp(this.position.z, -halfZ, halfZ);

    if (this.flying) {
      const up = THREE.MathUtils.clamp(
        (this.keys.has('Space') ? 1 : 0) -
          (this.keys.has('ControlLeft') ? 1 : 0) +
          this.touchUp,
        -1,
        1,
      );
      const wishY = up * MOTION.flyVertical;
      this.velocity.y = THREE.MathUtils.damp(this.velocity.y, wishY, 8, dt);
      this.position.y += this.velocity.y * dt;
      const ground = this.geo.heightAt(this.position.x, this.position.z);
      if (this.position.y < ground) {
        this.position.y = ground;
        this.velocity.y = 0;
      }
      this.grounded = false;
    } else {
      this.velocity.y -= MOTION.gravity * dt;
      this.velocity.y = Math.max(this.velocity.y, TERMINAL_VELOCITY);
      this.position.y += this.velocity.y * dt;
      const ground = this.geo.heightAt(this.position.x, this.position.z);
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velocity.y = 0;
        this.grounded = true;
        this.coyote = COYOTE_TIME;
      } else {
        this.grounded = false;
        this.coyote = Math.max(0, this.coyote - dt);
      }
      const jump = this.keys.has('Space') || this.touchUp > 0;
      if (jump && !this.jumpHeld && this.coyote > 0) {
        this.velocity.y = MOTION.jump;
        this.grounded = false;
        this.coyote = 0;
      }
      this.jumpHeld = jump;
    }

    this.writeCamera();
  }
}
