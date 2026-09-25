// Floating name labels for notable places (church, shop, pub, town hall...).
import * as THREE from 'three';
import { labelTexture } from './textures.js';

const KIND_STYLES = {
  church: { background: 'rgba(58,68,80,0.95)', foreground: '#ffffff' },
  shop: { background: 'rgba(46,125,79,0.95)', foreground: '#ffffff' },
  pub: { background: 'rgba(138,90,31,0.95)', foreground: '#fff4d6' },
  townhall: { background: 'rgba(47,95,158,0.95)', foreground: '#ffffff' },
  school: { background: 'rgba(201,138,26,0.95)', foreground: '#ffffff' },
  fire_station: { background: 'rgba(181,50,44,0.95)', foreground: '#ffffff' },
  house: { background: 'rgba(52,62,74,0.88)', foreground: '#ffffff' },
  poi: { background: 'rgba(52,62,74,0.9)', foreground: '#ffffff' },
};

export function buildLabels(labels) {
  const group = new THREE.Group();
  group.name = 'labels';
  for (const label of labels) {
    if (!label.text) continue;
    const style = KIND_STYLES[label.kind] ?? KIND_STYLES.poi;
    const { texture, aspect } = labelTexture(label.text, style.background, style.foreground);
    const height = 2.4;
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }),
    );
    sprite.scale.set(height * aspect, height, 1);
    sprite.position.set(label.x, label.y, label.z);
    group.add(sprite);
  }
  return group;
}
