// Pure gameplay helpers, kept free of three.js/DOM so they can be unit tested.

/** Game time in minutes → "HH:MM". */
export function formatClock(minutes) {
  const wrapped = ((Math.floor(minutes) % 1440) + 1440) % 1440;
  const hh = String(Math.floor(wrapped / 60)).padStart(2, '0');
  const mm = String(wrapped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Wanted level → six stars, filled for the first `level`. */
export function stars(level) {
  let out = '';
  for (let i = 0; i < 6; i += 1) out += i < level ? '★' : '☆';
  return out;
}

/** Clamp a wanted level to the 0–6 star range. */
export function clampWanted(level) {
  return Math.max(0, Math.min(6, Math.floor(level)));
}

/** Money as an eight-digit euro counter, San Andreas style. */
export function formatMoney(value) {
  return `€${String(Math.max(0, Math.floor(value))).padStart(8, '0')}`;
}
