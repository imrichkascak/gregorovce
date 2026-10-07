// Procedurally generated canvas textures: building facades with windows and
// floating name labels for points of interest.
import * as THREE from 'three';

function drawBarredWindow(ctx, x, y, winW, winH) {
  ctx.fillStyle = '#f7f1e6';
  ctx.fillRect(x - 5, y - 5, winW + 10, winH + 10);
  ctx.fillStyle = '#1a222a';
  ctx.fillRect(x, y, winW, winH);
  ctx.strokeStyle = '#12161a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 1; i <= 3; i += 1) {
    const barX = x + (winW * i) / 4;
    ctx.moveTo(barX, y);
    ctx.lineTo(barX, y + winH);
  }
  ctx.moveTo(x, y + winH * 0.42);
  ctx.lineTo(x + winW, y + winH * 0.42);
  ctx.stroke();
}

/**
 * Stucco tile, 8 x 3 m. Mostly white so the per-house vertex color tints it
 * into the San Andreas pastels; windows stay dark with security bars.
 */
export function facadeTexture() {
  const width = 256;
  const height = 96;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 500; i += 1) {
    const shade = 0.03 + ((i * 17) % 7) * 0.008;
    ctx.fillStyle = `rgba(80,60,40,${shade})`;
    ctx.fillRect((i * 53) % width, (i * 29) % height, 2, 2);
  }

  ctx.fillStyle = 'rgba(60,40,20,0.16)';
  ctx.fillRect(0, height - 12, width, 12);

  drawBarredWindow(ctx, 38, 22, 52, 48);
  drawBarredWindow(ctx, 160, 22, 52, 48);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 8, 1 / 3);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Cracked Los Santos asphalt. UVs on the road ribbon are in ~6 m tiles. */
export function asphaltTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#8c8982';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 900; i += 1) {
    const x = (i * 47) % size;
    const y = (i * 91) % size;
    const dark = (i % 5) === 0;
    ctx.fillStyle = dark ? 'rgba(40,38,34,0.35)' : 'rgba(255,250,240,0.06)';
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.strokeStyle = 'rgba(50,48,44,0.55)';
  ctx.lineWidth = 2;
  const cracks = [
    [12, 40, 80, 70, 140, 60, 200, 110],
    [30, 180, 90, 200, 160, 170, 230, 210],
    [180, 20, 200, 80, 170, 140],
  ];
  for (const crack of cracks) {
    ctx.beginPath();
    ctx.moveTo(crack[0], crack[1]);
    for (let i = 2; i < crack.length; i += 2) ctx.lineTo(crack[i], crack[i + 1]);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** A rounded sign board with the given text, used as a sprite above a POI. */
export function labelTexture(text, background, foreground) {
  const pad = 18;
  const fontSize = 44;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `600 ${fontSize}px system-ui, sans-serif`;
  const width = Math.ceil(measure.measureText(text).width) + pad * 2;
  const height = fontSize + pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const radius = 22;
  ctx.fillStyle = background;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = foreground;
  ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, width / 2, height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: width / height };
}

/** A small shop/pub sign: coloured board on a post. */
export function signTexture(text, background, foreground) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
  ctx.fillStyle = foreground;
  ctx.font = '700 46px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Comic-style speech bubble with a tail pointing down-left (towards speaker). */
export function speechBubbleTexture(text) {
  const pad = 24;
  const fontSize = 36;
  const lineHeight = fontSize * 1.2;
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `700 ${fontSize}px "Barlow Condensed", system-ui, sans-serif`;

  // Naive word wrap at ~420 px so long shouts stay readable.
  const maxWidth = 420;
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    const candidate = line ? `${line} ${word}` : word;
    if (measure.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const textWidth = Math.max(...lines.map((l) => measure.measureText(l).width));
  const width = Math.ceil(textWidth) + pad * 2;
  const bubbleHeight = Math.ceil(lines.length * lineHeight + pad);
  const height = bubbleHeight + 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Bubble body
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 5;
  const radius = 18;
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, bubbleHeight - radius);
  ctx.quadraticCurveTo(width, bubbleHeight, width - radius, bubbleHeight);
  ctx.lineTo(radius, bubbleHeight);
  ctx.quadraticCurveTo(0, bubbleHeight, 0, bubbleHeight - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Tail pointing down towards the speaker
  const tailX = width * 0.22;
  ctx.beginPath();
  ctx.moveTo(tailX, bubbleHeight - 4);
  ctx.lineTo(tailX + 14, height - 4);
  ctx.lineTo(tailX + 42, bubbleHeight - 4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Hide the seam where tail meets bubble
  ctx.fillRect(tailX + 3, bubbleHeight - 5, 37, 8);

  // Text
  ctx.fillStyle = '#000000';
  ctx.font = `700 ${fontSize}px "Barlow Condensed", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => {
    ctx.fillText(l, width / 2, pad / 2 + lineHeight * (i + 0.5));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, aspect: width / height };
}
