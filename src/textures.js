// Procedurally generated canvas textures: building facades with windows and
// floating name labels for points of interest.
import * as THREE from 'three';

/** Facade tile representing 8 x 3 m: one small window per floor. */
export function facadeTexture() {
  const width = 256;
  const height = 96;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#efe6cc';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgba(90,70,40,0.1)';
  ctx.fillRect(0, height - 10, width, 10);

  const winW = 46;
  const winH = 40;
  const x = (width - winW) / 2;
  const y = (height - winH) / 2 - 4;
  ctx.fillStyle = '#f2ead0';
  ctx.fillRect(x - 3, y - 3, winW + 6, winH + 6);
  ctx.fillStyle = '#4e5a66';
  ctx.fillRect(x, y, winW, winH);
  ctx.fillStyle = 'rgba(255,240,200,0.22)';
  ctx.fillRect(x, y, winW, winH * 0.4);
  ctx.strokeStyle = '#f2ead0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + winW / 2, y);
  ctx.lineTo(x + winW / 2, y + winH);
  ctx.moveTo(x, y + winH / 2);
  ctx.lineTo(x + winW, y + winH / 2);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / 8, 1 / 3);
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
