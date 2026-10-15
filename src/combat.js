// Pure combat helpers: armor-soaked damage, melee swing arcs and the hit-combo
// window. Free of three.js/DOM so they can be unit tested.

/** Armor soaks up to two thirds of a hit; the rest hits health. */
export function applyDamage(health, armor, amount) {
  const soaked = Math.min(armor, amount * (2 / 3));
  return {
    health: Math.max(0, health - (amount - soaked)),
    armor: Math.max(0, armor - soaked),
    absorbed: soaked,
  };
}

/**
 * True when (tx, tz) sits within `range` and inside the `halfAngle` cone the
 * attacker at (ax, az) faces. Yaw 0 looks toward -z, matching the player rig.
 */
export function inMeleeArc(ax, az, yaw, tx, tz, range, halfAngle) {
  const dx = tx - ax;
  const dz = tz - az;
  const distance = Math.hypot(dx, dz);
  if (distance > range) return false;
  if (distance < 0.0001) return true;
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  return (dx * fx + dz * fz) / distance >= Math.cos(halfAngle);
}

/** How many of `times` fall inside the combo window ending at `now`. */
export function comboHits(times, now, window = 2) {
  return times.filter((t) => now - t <= window).length;
}
