// CJ-style player avatar: a low-poly humanoid built from boxes, animated
// procedurally (idle / walk / run / jump) from the player's speed.
import * as THREE from 'three';

const COLORS = {
  skin: '#c98a5a',
  tank: '#f4f4f0',
  jeans: '#3a5a8c',
  shoe: '#181818',
  hair: '#241a12',
};

function makeMaterials() {
  const materials = {};
  for (const [key, color] of Object.entries(COLORS)) {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.95, metalness: 0 });
    material.userData.slot = key;
    materials[key] = material;
  }
  return materials;
}

function part(geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createAvatar() {
  const group = new THREE.Group();
  group.name = 'avatar';
  const materials = makeMaterials();

  const torso = part(new THREE.BoxGeometry(0.5, 0.62, 0.28), materials.tank);
  torso.position.y = 1.16;

  const hips = part(new THREE.BoxGeometry(0.46, 0.2, 0.26), materials.jeans);
  hips.position.y = 0.9;

  const head = part(new THREE.SphereGeometry(0.16, 12, 10), materials.skin);
  head.position.y = 1.63;

  const hair = part(new THREE.BoxGeometry(0.3, 0.14, 0.3), materials.hair);
  hair.position.y = 1.72;

  const makeArm = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 1.4, 0);
    const upper = part(new THREE.BoxGeometry(0.13, 0.32, 0.15), materials.tank);
    upper.position.y = -0.16;
    const lower = part(new THREE.BoxGeometry(0.11, 0.3, 0.13), materials.skin);
    lower.position.y = -0.47;
    const hand = part(new THREE.BoxGeometry(0.11, 0.12, 0.13), materials.skin);
    hand.position.y = -0.68;
    pivot.add(upper, lower, hand);
    return pivot;
  };

  const makeLeg = (side) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.13, 0.82, 0);
    const thigh = part(new THREE.BoxGeometry(0.18, 0.36, 0.2), materials.jeans);
    thigh.position.y = -0.18;
    const shin = part(new THREE.BoxGeometry(0.15, 0.32, 0.17), materials.jeans);
    shin.position.y = -0.52;
    const shoe = part(new THREE.BoxGeometry(0.17, 0.12, 0.3), materials.shoe);
    shoe.position.set(0, -0.74, 0.05);
    pivot.add(thigh, shin, shoe);
    return pivot;
  };

  const arms = [makeArm(-1), makeArm(1)];
  const legs = [makeLeg(-1), makeLeg(1)];
  group.add(torso, hips, head, hair, arms[0], arms[1], legs[0], legs[1]);

  const state = { pose: 'idle', phase: 0 };
  const limbs = { arms, legs, torso, head };

  /** Pose from the current speed; `phase` drives the walk/run cycle. */
  function update(speed, grounded, dt) {
    const pose = !grounded ? 'jump' : speed > 6 ? 'run' : speed > 0.4 ? 'walk' : 'idle';
    state.pose = pose;
    const cadence = pose === 'run' ? 12 : pose === 'walk' ? 7 : 1.6;
    state.phase += dt * cadence;

    if (pose === 'jump') {
      legs[0].rotation.x = -0.5;
      legs[1].rotation.x = 0.45;
      arms[0].rotation.x = -0.7;
      arms[1].rotation.x = -0.7;
      torso.rotation.x = 0.06;
      return;
    }

    const swing = pose === 'run' ? 0.95 : pose === 'walk' ? 0.6 : 0.06;
    const armSwing = pose === 'run' ? 0.85 : pose === 'walk' ? 0.5 : 0.08;
    const s = Math.sin(state.phase);
    legs[0].rotation.x = s * swing;
    legs[1].rotation.x = -s * swing;
    arms[0].rotation.x = -s * armSwing;
    arms[1].rotation.x = s * armSwing;
    torso.rotation.x = pose === 'run' ? 0.1 : pose === 'walk' ? 0.04 : 0;
    torso.position.y = 1.16 + (pose === 'idle' ? Math.sin(state.phase * 2) * 0.015 : 0);
  }

  function face(yaw) {
    group.rotation.y = yaw;
  }

  return { group, state, limbs, update, face, materials };
}

/** Recolours the tank top (used by the clothes shop in missions.js). */
export function setAvatarShirtColor(avatar, color) {
  avatar.materials.tank.color.set(color);
}
