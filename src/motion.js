// Horizontal movement shared by the player. Quake-style: friction first, then
// accelerate toward a wish velocity, so you ease in and ease out instead of
// snapping between 0 and full speed.

export const MOTION = {
  walk: 4.6,
  run: 9,
  fly: 22,
  flyRun: 42,
  groundAccel: 8,
  airAccel: 3,
  flyAccel: 6,
  friction: 5,
  flyFriction: 2.4,
  gravity: 24,
  jump: 6.4,
  flyVertical: 14,
  dropHeight: 46,
};

/** Add speed along a unit wish direction, never past wishSpeed. */
export function accelerate(vx, vz, wishX, wishZ, wishSpeed, accel, dt) {
  const current = vx * wishX + vz * wishZ;
  const addSpeed = wishSpeed - current;
  if (addSpeed <= 0) return { x: vx, z: vz };
  let accelSpeed = accel * dt * wishSpeed;
  if (accelSpeed > addSpeed) accelSpeed = addSpeed;
  return { x: vx + accelSpeed * wishX, z: vz + accelSpeed * wishZ };
}

/**
 * Slow horizontal velocity. Below a walk, friction uses a higher control speed
 * so you actually stop instead of creeping forever.
 */
export function applyFriction(vx, vz, friction, dt) {
  const speed = Math.hypot(vx, vz);
  if (speed < 0.08) return { x: 0, z: 0 };
  const control = Math.max(speed, 4);
  const drop = control * friction * dt;
  const next = Math.max(0, speed - drop);
  return { x: vx * (next / speed), z: vz * (next / speed) };
}

/** One horizontal step: friction on the ground, then accelerate. */
export function stepHorizontal(vx, vz, wishX, wishZ, wishSpeed, dt, grounded, flying) {
  const friction = flying ? MOTION.flyFriction : MOTION.friction;
  const accel = flying ? MOTION.flyAccel : grounded ? MOTION.groundAccel : MOTION.airAccel;
  const slowed = grounded || flying ? applyFriction(vx, vz, friction, dt) : { x: vx, z: vz };
  if (wishSpeed <= 0) return slowed;
  return accelerate(slowed.x, slowed.z, wishX, wishZ, wishSpeed, accel, dt);
}
