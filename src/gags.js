// Village set-pieces that play on a loop:
// the house at Gregorovce 101 blows apart and rebuilds, Pali and Mata lie in
// the road in front of the church until a motorcycle runs them over, and the
// bytovka at Gregorovce 217 empties its septic tank across the road into the ditch.
import * as THREE from 'three';
import { roadWidth } from './osm.js';
import { labelTexture } from './textures.js';

const MAIN_ROADS = new Set([
  'primary',
  'secondary',
  'tertiary',
  'unclassified',
  'residential',
  'living_street',
]);

function hash(n) {
  const x = Math.sin(n * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function makePath(geo, latlon) {
  const pts = latlon.map((g) => geo.toWorld(g.lat, g.lon));
  const cumulative = [0];
  for (let i = 1; i < pts.length; i += 1) {
    cumulative.push(
      cumulative[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z),
    );
  }
  return { pts, cumulative, length: cumulative[cumulative.length - 1] };
}

function samplePath(geo, path, distance, lateral) {
  const { pts, cumulative } = path;
  const span = path.length || 1;
  let wrapped = distance % span;
  if (wrapped < 0) wrapped += span;
  let i = 1;
  while (i < cumulative.length - 1 && cumulative[i] < wrapped) i += 1;
  const segment = Math.max(0.001, cumulative[i] - cumulative[i - 1]);
  const t = (wrapped - cumulative[i - 1]) / segment;
  const a = pts[i - 1];
  const b = pts[i];
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const tx = dx / len;
  const tz = dz / len;
  return {
    x: a.x + dx * t - tz * lateral,
    z: a.z + dz * t + tx * lateral,
    y: 0,
    tx,
    tz,
    heading: Math.atan2(tx, tz),
  };
}

/** Closest point on a drivable road, with the road tangent and a path for traffic. */
function closestMainRoad(geo, roads, x, z) {
  let best = null;
  for (const road of roads) {
    if (!MAIN_ROADS.has(road.tags.highway) || !road.latlon || road.latlon.length < 2) continue;
    const path = makePath(geo, road.latlon);
    if (path.length < 12) continue;
    for (let i = 1; i < path.pts.length; i += 1) {
      const a = path.pts[i - 1];
      const b = path.pts[i];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const lenSq = dx * dx + dz * dz || 1;
      let t = ((x - a.x) * dx + (z - a.z) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const px = a.x + dx * t;
      const pz = a.z + dz * t;
      const d = (px - x) ** 2 + (pz - z) ** 2;
      if (!best || d < best.d) {
        const len = Math.hypot(dx, dz) || 1;
        best = {
          d,
          x: px,
          z: pz,
          tx: dx / len,
          tz: dz / len,
          distance: path.cumulative[i - 1] + Math.hypot(dx, dz) * t,
          width: roadWidth(road.tags),
          path,
        };
      }
    }
  }
  return best;
}

function nearestBoundaryPoint(points, x, z) {
  let best = null;
  let bestDistance = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lengthSq = dx * dx + dz * dz || 1;
    let t = ((x - a.x) * dx + (z - a.z) * dz) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx;
    const pz = a.z + t * dz;
    const d = (px - x) ** 2 + (pz - z) ** 2;
    if (d < bestDistance) {
      bestDistance = d;
      best = { x: px, z: pz };
    }
  }
  return best;
}

function softTexture(inner, outer) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  gradient.addColorStop(0, inner);
  gradient.addColorStop(1, outer);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function nameSprite(text, x, y, z) {
  const { texture, aspect } = labelTexture(text, 'rgba(20,16,12,0.82)', '#f4efe2');
  const height = 0.7;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true }),
  );
  sprite.scale.set(height * aspect, height, 1);
  sprite.position.set(x, y, z);
  return sprite;
}

function rememberPiece(mesh) {
  return {
    mesh,
    homePos: mesh.position.clone(),
    homeQuat: mesh.quaternion.clone(),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    radius: 0.35,
  };
}

/**
 * House 101 stands for a few seconds, blows apart, then pulls itself back together.
 */
function createExplosion(site) {
  const group = new THREE.Group();
  group.name = 'explosion-101';
  group.position.set(site.rect.center.x, site.groundY, site.rect.center.z);
  group.rotation.y = site.rect.angle;

  const wallMat = new THREE.MeshStandardMaterial({ color: site.wall, roughness: 0.92 });
  const roofMat = new THREE.MeshStandardMaterial({ color: site.roof, roughness: 0.82 });
  const glassMat = new THREE.MeshStandardMaterial({
    color: '#6a7c8a',
    roughness: 0.2,
    metalness: 0.15,
  });
  const brickMat = new THREE.MeshStandardMaterial({ color: '#7a5344', roughness: 1 });

  const { length, width } = site.rect;
  const height = site.height;
  const pieces = [];

  const addWall = (w, h, d, x, y, z) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const thinX = w < d;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(thinX ? 0.06 : Math.min(1.15, w * 0.34), 0.95, thinX ? Math.min(1.15, d * 0.34) : 0.06),
      glassMat,
    );
    glass.position.set(
      thinX ? Math.sign(x || 1) * (w / 2 + 0.02) : 0,
      0.2,
      thinX ? 0 : Math.sign(z || 1) * (d / 2 + 0.02),
    );
    mesh.add(glass);
    group.add(mesh);
    pieces.push(rememberPiece(mesh));
  };

  addWall(length, height, 0.24, 0, height / 2, -width / 2);
  addWall(length, height, 0.24, 0, height / 2, width / 2);
  addWall(0.24, height, width, -length / 2, height / 2, 0);
  addWall(0.24, height, width, length / 2, height / 2, 0);

  const rise = Math.min(2.6, Math.max(1.15, width * 0.38));
  const halfW = width / 2;
  const slopeLen = Math.hypot(halfW, rise);
  const pitch = Math.atan2(rise, halfW);
  for (const side of [-1, 1]) {
    const roof = new THREE.Mesh(
      new THREE.BoxGeometry(length + 0.55, 0.16, slopeLen),
      roofMat,
    );
    roof.position.set(0, height + rise / 2, side * (halfW / 2));
    roof.rotation.x = side * pitch;
    roof.castShadow = true;
    group.add(roof);
    pieces.push(rememberPiece(roof));
  }

  const bricks = [];
  for (let i = 0; i < 14; i += 1) {
    const brick = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.18, 0.22), brickMat);
    brick.position.set((hash(i + 1) - 0.5) * length * 0.7, height * (0.3 + hash(i + 2) * 0.6), (hash(i + 3) - 0.5) * width * 0.7);
    brick.castShadow = true;
    brick.visible = false;
    group.add(brick);
    const piece = rememberPiece(brick);
    piece.radius = 0.12;
    bricks.push(piece);
  }

  const scorch = new THREE.Mesh(
    new THREE.CircleGeometry(Math.max(length, width) * 0.62, 22),
    new THREE.MeshBasicMaterial({
      color: '#24160f',
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
    }),
  );
  scorch.rotation.x = -Math.PI / 2;
  scorch.position.y = 0.14;
  group.add(scorch);

  const flashTex = softTexture('rgba(255,220,140,0.95)', 'rgba(255,80,20,0)');
  const flash = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, opacity: 0 }),
  );
  flash.position.y = height * 0.55;
  flash.scale.set(2, 2, 1);
  group.add(flash);

  const smokeTex = softTexture('rgba(70,64,58,0.55)', 'rgba(70,64,58,0)');
  const smokes = [];
  for (let i = 0; i < 7; i += 1) {
    const puff = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }),
    );
    puff.position.y = height * 0.4;
    group.add(puff);
    smokes.push(puff);
  }

  const fireTex = softTexture('rgba(255,170,40,0.9)', 'rgba(180,40,10,0)');
  const fires = [];
  for (let i = 0; i < 4; i += 1) {
    const fire = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: fireTex,
        transparent: true,
        depthWrite: false,
        opacity: 0,
        blending: THREE.AdditiveBlending,
      }),
    );
    fire.position.set((hash(i + 8) - 0.5) * length * 0.4, 0.4, (hash(i + 9) - 0.5) * width * 0.4);
    group.add(fire);
    fires.push(fire);
  }

  const light = new THREE.PointLight('#ff8a3a', 0, 28, 1.4);
  light.position.y = 2;
  group.add(light);

  let state = 'whole';
  let stateTime = 0;
  group.userData.phase = state;

  const launch = (piece, seed, upward) => {
    const dir = piece.homePos.clone();
    dir.y = 0;
    if (dir.lengthSq() < 0.04) dir.set(hash(seed) - 0.5, 0, hash(seed + 1) - 0.5);
    dir.normalize();
    const speed = 4 + hash(seed + 2) * 5;
    piece.vel.set(dir.x * speed, upward + hash(seed + 3) * 5, dir.z * speed);
    piece.spin.set(hash(seed + 4) * 8 - 4, hash(seed + 5) * 6 - 3, hash(seed + 6) * 8 - 4);
    piece.mesh.visible = true;
  };

  return {
    group,
    anchor: { x: site.rect.center.x, z: site.rect.center.z },
    update(dt) {
      stateTime += dt;
      if (state === 'whole' && stateTime > 4.2) {
        state = 'blast';
        stateTime = 0;
        pieces.forEach((piece, i) => launch(piece, i * 3.1, 8));
        bricks.forEach((piece, i) => launch(piece, i * 5.7 + 20, 6));
      } else if (state === 'blast' && stateTime > 3.4) {
        state = 'reform';
        stateTime = 0;
        for (const piece of pieces.concat(bricks)) {
          piece.fromPos = piece.mesh.position.clone();
          piece.fromQuat = piece.mesh.quaternion.clone();
        }
      } else if (state === 'reform' && stateTime > 1.05) {
        state = 'whole';
        stateTime = 0;
        for (const piece of pieces.concat(bricks)) {
          piece.mesh.position.copy(piece.homePos);
          piece.mesh.quaternion.copy(piece.homeQuat);
          piece.vel.set(0, 0, 0);
        }
        for (const brick of bricks) brick.mesh.visible = false;
      }
      group.userData.phase = state;

      if (state === 'blast') {
        for (const piece of pieces.concat(bricks)) {
          piece.vel.y -= 16 * dt;
          piece.mesh.position.addScaledVector(piece.vel, dt);
          if (piece.mesh.position.y < piece.radius) {
            piece.mesh.position.y = piece.radius;
            piece.vel.y *= -0.28;
            piece.vel.x *= 0.62;
            piece.vel.z *= 0.62;
          }
          piece.mesh.rotateX(piece.spin.x * dt);
          piece.mesh.rotateY(piece.spin.y * dt);
          piece.mesh.rotateZ(piece.spin.z * dt);
        }
      } else if (state === 'reform') {
        const k = Math.min(1, stateTime / 0.95);
        const blend = k * k * (3 - 2 * k);
        for (const piece of pieces.concat(bricks)) {
          piece.mesh.position.lerpVectors(piece.fromPos, piece.homePos, blend);
          piece.mesh.quaternion.copy(piece.fromQuat).slerp(piece.homeQuat, blend);
        }
      }

      const blast = state === 'blast' ? Math.max(0, 1 - stateTime / 0.35) : 0;
      flash.material.opacity = blast;
      flash.scale.setScalar(3 + (1 - blast) * 14);
      light.intensity = blast * 18 + (state === 'blast' ? 1.2 : 0);
      scorch.material.opacity = state === 'whole' ? 0.12 : 0.55;
      smokes.forEach((puff, i) => {
        const life = state === 'blast' ? (stateTime * 0.35 + i * 0.14) % 1 : 0;
        puff.material.opacity = life > 0 ? (1 - life) * 0.55 : 0;
        puff.position.y = height * 0.35 + life * 7;
        puff.position.x = (hash(i + 4) - 0.5) * 2 + Math.sin(stateTime + i) * 0.4;
        puff.scale.setScalar(1.2 + life * 4);
      });
      fires.forEach((fire, i) => {
        const on = state === 'blast' ? Math.max(0, 1 - stateTime / 2.6) : 0;
        fire.material.opacity = on * (0.65 + Math.sin(stateTime * 18 + i) * 0.25);
        fire.scale.set(1.1, 1.6 + Math.sin(stateTime * 14 + i) * 0.35, 1);
      });
    },
  };
}

function ribbonGeometry(geo, points, width, yOffset) {
  const positions = [];
  const indices = [];
  const half = width / 2;
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    let dx = next.x - prev.x;
    let dz = next.z - prev.z;
    const len = Math.hypot(dx, dz) || 1;
    dx /= len;
    dz /= len;
    const px = -dz;
    const pz = dx;
    const lx = points[i].x + px * half;
    const lz = points[i].z + pz * half;
    const rx = points[i].x - px * half;
    const rz = points[i].z - pz * half;
    positions.push(lx, geo.heightAt(lx, lz) + yOffset, lz);
    positions.push(rx, geo.heightAt(rx, rz) + yOffset, rz);
    if (i > 0) {
      const a = (i - 1) * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function hoseBetween(geo, from, to, material) {
  const group = new THREE.Group();
  const steps = 10;
  let prev = null;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const x = from.x + (to.x - from.x) * t;
    const z = from.z + (to.z - from.z) * t;
    const point = new THREE.Vector3(x, geo.heightAt(x, z) + 0.16, z);
    if (prev) {
      const delta = point.clone().sub(prev);
      const length = delta.length();
      const segment = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, Math.max(0.05, length), 7), material);
      segment.position.copy(prev).add(point).multiplyScalar(0.5);
      segment.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      segment.castShadow = true;
      group.add(segment);
    }
    prev = point;
  }
  return group;
}

/**
 * A hose runs out of bytovka 217, arcs across the road and dumps into the ditch.
 */
function createSeptic(geo, site, roads) {
  const group = new THREE.Group();
  group.name = 'septic-217';
  const road = closestMainRoad(geo, roads, site.rect.center.x, site.rect.center.z);
  if (!road) return { group, anchor: { x: site.rect.center.x, z: site.rect.center.z }, update() {} };

  const toRoadX = road.x - site.rect.center.x;
  const toRoadZ = road.z - site.rect.center.z;
  const toRoadLen = Math.hypot(toRoadX, toRoadZ) || 1;
  const nx = toRoadX / toRoadLen;
  const nz = toRoadZ / toRoadLen;
  const wall = nearestBoundaryPoint(site.points, road.x, road.z) ?? site.rect.center;
  const half = road.width / 2;
  // samplePath's positive lateral is (-tz, tx). Pick the sign that points
  // away from the bytovka, so the ditch sits on the far side of the road.
  const side = Math.sign(nx * -road.tz + nz * road.tx) || 1;
  const nearLateral = -side * (half + 0.25);
  const farLateral = side * (half + 3.6);
  const nearSample = samplePath(geo, road.path, road.distance, nearLateral);
  const farSample = samplePath(geo, road.path, road.distance, farLateral);
  const near = { x: nearSample.x, z: nearSample.z };
  const far = { x: farSample.x, z: farSample.z };

  const pipeMat = new THREE.MeshStandardMaterial({ color: '#5c5348', roughness: 0.75, metalness: 0.2 });
  const sludgeMat = new THREE.MeshStandardMaterial({
    color: '#5a3a14',
    roughness: 0.35,
    metalness: 0.02,
  });
  const ditchMat = new THREE.MeshStandardMaterial({
    color: '#3a2a16',
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const bankMat = new THREE.MeshStandardMaterial({
    color: '#6d5a38',
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const mouth = new THREE.Vector3(
    wall.x + nx * 0.7,
    geo.heightAt(wall.x, wall.z) + 0.42,
    wall.z + nz * 0.7,
  );
  const outlet = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 1.3, 8), pipeMat);
  outlet.position.copy(mouth);
  outlet.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0.05, nz).normalize());
  outlet.castShadow = true;
  group.add(outlet);

  group.add(hoseBetween(geo, { x: mouth.x, z: mouth.z }, near, pipeMat));

  const startY = geo.heightAt(near.x, near.z) + 0.28;
  const midX = (near.x + far.x) / 2;
  const midZ = (near.z + far.z) / 2;
  const midY = geo.heightAt(midX, midZ) + 2.7;
  const endY = geo.heightAt(far.x, far.z) + 0.22;
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(near.x, startY, near.z),
    new THREE.Vector3(midX, midY, midZ),
    new THREE.Vector3(far.x, endY, far.z),
  );
  const stream = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 40, 0.18, 10, false),
    new THREE.MeshStandardMaterial({
      color: '#6b4518',
      roughness: 0.25,
      transparent: true,
      opacity: 0.94,
    }),
  );
  stream.castShadow = true;
  group.add(stream);

  const dropMat = new THREE.MeshStandardMaterial({ color: '#8a5a1c', roughness: 0.3 });
  const drops = [];
  for (let i = 0; i < 14; i += 1) {
    const drop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), dropMat);
    group.add(drop);
    drops.push({ mesh: drop, t: i / 14 });
  }

  // Shallow jarok following the road, not a row of boxes.
  const ditchLine = (lateral) => {
    const points = [];
    for (let s = -12; s <= 12; s += 1.4) {
      points.push(samplePath(geo, road.path, road.distance + s, lateral));
    }
    return points;
  };
  const wet = new THREE.Mesh(ribbonGeometry(geo, ditchLine(farLateral), 1.55, 0.08), ditchMat);
  wet.receiveShadow = true;
  group.add(wet);
  for (const bankLateral of [farLateral - side * 0.95, farLateral + side * 0.95]) {
    const bank = new THREE.Mesh(ribbonGeometry(geo, ditchLine(bankLateral), 0.5, 0.18), bankMat);
    bank.receiveShadow = true;
    group.add(bank);
  }

  const splashTex = softTexture('rgba(120,80,30,0.8)', 'rgba(90,60,20,0)');
  const splash = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: splashTex, transparent: true, depthWrite: false }),
  );
  splash.position.set(far.x, endY + 0.3, far.z);
  group.add(splash);

  const flow = [];
  for (let i = 0; i < 6; i += 1) {
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 7, 6), sludgeMat);
    group.add(blob);
    flow.push({ mesh: blob, t: i / 6 });
  }
  let time = 0;

  return {
    group,
    anchor: { x: road.x, z: road.z },
    update(dt) {
      time += dt;
      for (const drop of drops) {
        drop.t = (drop.t + dt * 0.55) % 1;
        const point = curve.getPoint(drop.t);
        drop.mesh.position.copy(point);
        drop.mesh.scale.setScalar(0.85 + Math.sin(drop.t * Math.PI) * 0.35);
      }
      splash.scale.setScalar(1.1 + Math.sin(time * 9) * 0.35);
      splash.material.opacity = 0.45 + Math.sin(time * 14) * 0.2;
      for (const blob of flow) {
        blob.t = (blob.t + dt * 0.28) % 1;
        const along = (blob.t - 0.5) * 20;
        const point = samplePath(geo, road.path, road.distance + along, farLateral);
        blob.mesh.position.set(point.x, geo.heightAt(point.x, point.z) + 0.16, point.z);
      }
    },
  };
}

function lyingPerson(shirtColor, hairColor) {
  const group = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: '#e0ac82', roughness: 1 });
  const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 1 });
  const pants = new THREE.MeshStandardMaterial({ color: '#3e4650', roughness: 1 });
  const hair = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 1 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#1b1b1b', roughness: 0.8 });

  const add = (geom, material, x, y, z) => {
    const mesh = new THREE.Mesh(geom, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
  };

  // Local +Z runs head to feet. The group is turned so that axis crosses the lane.
  add(new THREE.BoxGeometry(0.48, 0.26, 0.52), shirt, 0, 0.2, 0.05);
  add(new THREE.SphereGeometry(0.16, 10, 8), skin, 0, 0.26, -0.38);
  add(new THREE.SphereGeometry(0.17, 10, 8), hair, 0, 0.32, -0.42);
  add(new THREE.BoxGeometry(0.46, 0.1, 0.14), shirt, -0.46, 0.18, 0.02);
  add(new THREE.BoxGeometry(0.46, 0.1, 0.14), shirt, 0.46, 0.18, 0.08);
  add(new THREE.BoxGeometry(0.16, 0.14, 0.5), pants, -0.12, 0.14, 0.52);
  add(new THREE.BoxGeometry(0.16, 0.14, 0.5), pants, 0.12, 0.14, 0.52);
  add(new THREE.BoxGeometry(0.14, 0.08, 0.22), shoe, -0.12, 0.1, 0.84);
  add(new THREE.BoxGeometry(0.14, 0.08, 0.22), shoe, 0.12, 0.1, 0.84);
  return group;
}

function buildMotorcycle() {
  const group = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#1c1e22', roughness: 0.45, metalness: 0.35 });
  const tankMat = new THREE.MeshStandardMaterial({ color: '#a8342c', roughness: 0.4, metalness: 0.2 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: '#e0ac82', roughness: 1 });
  const jacket = new THREE.MeshStandardMaterial({ color: '#2c3340', roughness: 1 });

  const wheelGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.14, 12);
  wheelGeom.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const z of [0.78, -0.78]) {
    const wheel = new THREE.Mesh(wheelGeom, wheelMat);
    wheel.position.set(0, 0.34, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 1.7), frameMat);
  frame.position.set(0, 0.48, 0);
  frame.castShadow = true;
  group.add(frame);

  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.28, 0.55), tankMat);
  tank.position.set(0, 0.68, 0.15);
  tank.castShadow = true;
  group.add(tank);

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.48), frameMat);
  seat.position.set(0, 0.62, -0.28);
  group.add(seat);

  const bars = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), frameMat);
  bars.position.set(0, 0.92, 0.62);
  group.add(bars);

  const rider = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.42, 0.24), jacket);
  rider.position.set(0, 0.92, -0.22);
  rider.castShadow = true;
  group.add(rider);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), skin);
  head.position.set(0, 1.22, -0.18);
  group.add(head);

  const lampMat = new THREE.MeshStandardMaterial({
    color: '#fff4c4',
    emissive: '#ffe7a0',
    emissiveIntensity: 0.7,
  });
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.08), lampMat);
  lamp.position.set(0, 0.62, 0.95);
  group.add(lamp);

  group.userData.wheels = wheels;
  return group;
}

/**
 * Pali and Mata lie across the lane in front of the church and wait
 * until the motorcycle drives over them.
 */
function createRunover(geo, spawn, roads) {
  const group = new THREE.Group();
  group.name = 'church-runover';
  const road = closestMainRoad(geo, roads, spawn.x, spawn.z);
  if (!road) return { group, anchor: { x: spawn.x, z: spawn.z }, update() {} };

  const lateral = Math.min(1.4, road.width * 0.22);
  const spot = samplePath(geo, road.path, road.distance, lateral);
  // A few metres along the lane so they are not standing inside the other church NPC.
  const ahead = samplePath(geo, road.path, road.distance + 7, lateral);
  const places = [
    { name: 'PALI', shirt: '#3f6e9e', hair: '#3a2a22', along: -0.9 },
    { name: 'MATA', shirt: '#c45a6a', hair: '#2a1814', along: 0.9 },
  ];

  const bodies = places.map((person) => {
    const x = ahead.x + ahead.tx * person.along;
    const z = ahead.z + ahead.tz * person.along;
    const body = lyingPerson(person.shirt, person.hair);
    const ground = geo.heightAt(x, z);
    body.position.set(x, ground + 0.16, z);
    // Length of the body crosses the lane, so the bike rolls over the torso.
    body.rotation.y = ahead.heading + Math.PI / 2;
    group.add(body);
    group.add(nameSprite(person.name, x, ground + 1.15, z));
    return { mesh: body, x, z, flat: 0 };
  });

  const bike = buildMotorcycle();
  group.add(bike);

  const halfSpan = Math.min(18, road.path.length * 0.35);
  let along = -halfSpan;
  let direction = 1;

  return {
    group,
    anchor: { x: ahead.x, z: ahead.z },
    update(dt) {
      along += direction * 9 * dt;
      if (along > halfSpan) {
        along = halfSpan;
        direction = -1;
      } else if (along < -halfSpan) {
        along = -halfSpan;
        direction = 1;
      }
      const sample = samplePath(geo, road.path, road.distance + 7 + along, lateral);
      const ground = geo.heightAt(sample.x, sample.z);
      bike.position.set(sample.x, ground, sample.z);
      const heading = sample.heading + (direction < 0 ? Math.PI : 0);
      bike.rotation.y = heading;
      for (const wheel of bike.userData.wheels) wheel.rotation.x += direction * dt * 18;

      for (const body of bodies) {
        const distance = Math.hypot(sample.x - body.x, sample.z - body.z);
        if (distance < 2.1) body.flat = 1;
        else body.flat = Math.max(0, body.flat - dt * 0.4);
        body.mesh.scale.y = 1 - body.flat * 0.86;
      }
    },
  };
}

export function createVillageGags(geo, sites, roads) {
  const group = new THREE.Group();
  group.name = 'gags';
  const parts = [];
  const anchors = {};

  if (sites.explosion) {
    const explosion = createExplosion(sites.explosion);
    group.add(explosion.group);
    parts.push(explosion);
    anchors.explosion = explosion.anchor;
  }
  if (sites.septic) {
    const septic = createSeptic(geo, sites.septic, roads);
    group.add(septic.group);
    parts.push(septic);
    anchors.septic = septic.anchor;
  }
  if (sites.church) {
    const runover = createRunover(geo, sites.church, roads);
    group.add(runover.group);
    parts.push(runover);
    anchors.church = runover.anchor;
  }

  return {
    group,
    anchors,
    update(dt) {
      for (const part of parts) part.update(dt);
    },
  };
}
