// ─────────────────────────────────────────────────────────────
// MAP BUILDER — Desert Compound Environment
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeSandTextures, makeBrickTextures, makeConcreteTextures, makeMetalTextures, makeWoodTextures, makePBR } from './textures.js';

let sandMat, brickMat, concreteMat, metalMat, woodMat;
let texturesReady = false;

function ensureMaterials() {
  if (texturesReady) return;
  const sand = makeSandTextures(512);
  sand.albedo.repeat.set(8, 8); sand.normal.repeat.set(8, 8); sand.roughness.repeat.set(8, 8);
  sandMat = makePBR(sand, { roughness: 0.95 });

  const brick = makeBrickTextures(512);
  brickMat = makePBR(brick, { roughness: 0.85 });

  const conc = makeConcreteTextures(512);
  concreteMat = makePBR(conc, { roughness: 0.8 });

  metalMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.5, metalness: 0.2 });

  const wood = makeWoodTextures(256);
  woodMat = makePBR(wood, { roughness: 0.75 });

  texturesReady = true;
}

function mkBox(scene, w, h, d, mat, x, y, z, shadow = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  if (shadow) { m.castShadow = true; m.receiveShadow = true; }
  scene.add(m);
  return m;
}

function mkWall(scene, collidables, w, h, d, mat, x, y, z) {
  const m = mkBox(scene, w, h, d, mat, x, y, z);
  m.geometry.computeBoundingBox();
  m.userData.aabb = new THREE.Box3().setFromObject(m);
  collidables.push(m);
  return m;
}

function mkLadder(scene, collidables, w, h, x, y, z, rotY) {
  const vol = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, 0.6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  vol.position.set(x, y, z);
  vol.rotation.y = rotY;
  vol.updateMatrixWorld();
  vol.geometry.computeBoundingBox();
  vol.userData.aabb = new THREE.Box3().setFromObject(vol);
  vol.userData.isLadder = true;
  collidables.push(vol);
  scene.add(vol);

  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  grp.rotation.y = rotY;
  scene.add(grp);

  function p(bw, bh, bd, bx, by, bz) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), metalMat);
    m.position.set(bx, by, bz);
    m.castShadow = true;
    grp.add(m);
  }
  const rw = 0.12;
  p(rw, h, 0.08, -w / 2 + rw / 2, 0, 0);
  p(rw, h, 0.08, w / 2 - rw / 2, 0, 0);
  const steps = Math.floor(h / 0.6);
  for (let i = 0; i < steps; i++) {
    p(w - rw * 2, 0.06, 0.06, 0, -h / 2 + i * 0.6 + 0.3, 0);
  }
}

// Sandbag barrier
function mkSandbags(scene, collidables, x, y, z, w, h, d) {
  const grp = new THREE.Group();
  grp.position.set(x, y, z);
  scene.add(grp);

  const bagMat = new THREE.MeshStandardMaterial({ color: 0x8B7D5B, roughness: 0.95 });
  const bagW = Math.min(1.2, w / 3), bagH = 0.35, bagD = Math.min(0.6, d);
  const rows = Math.ceil(h / bagH);
  const cols = Math.ceil(w / bagW);

  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * bagW * 0.3;
    for (let c = 0; c < cols; c++) {
      const bx = -w / 2 + c * bagW + bagW / 2 + offset;
      const by = -h / 2 + r * bagH + bagH / 2;
      const bag = new THREE.Mesh(
        new THREE.BoxGeometry(bagW * 0.92, bagH * 0.85, bagD * 0.9),
        bagMat
      );
      bag.position.set(bx, by, 0);
      bag.rotation.z = (Math.random() - 0.5) * 0.06;
      bag.castShadow = true;
      bag.receiveShadow = true;
      grp.add(bag);
    }
  }

  // Collision box
  const col = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  col.position.set(x, y, z);
  col.geometry.computeBoundingBox();
  col.userData.aabb = new THREE.Box3().setFromObject(col);
  collidables.push(col);
  scene.add(col);
}

// Desert skybox (procedural gradient)
function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(95, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {},
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 skyTop = vec3(0.35, 0.55, 0.85);
        vec3 skyMid = vec3(0.65, 0.75, 0.88);
        vec3 horizon = vec3(0.85, 0.78, 0.60);
        vec3 col;
        if (h > 0.0) {
          col = mix(horizon, skyMid, smoothstep(0.0, 0.15, h));
          col = mix(col, skyTop, smoothstep(0.15, 0.6, h));
        } else {
          col = horizon * 0.7;
        }
        // Sun glow
        float sun = max(0.0, dot(normalize(vPos), normalize(vec3(20.0, 35.0, 20.0))));
        col += vec3(1.0, 0.9, 0.6) * pow(sun, 32.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// Ambient floating dust
export function buildDustParticles(scene) {
  const count = 300;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = Math.random() * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xd4c49a, size: 0.08, transparent: true, opacity: 0.4,
    depthWrite: false, sizeAttenuation: true
  });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return pts;
}

export function updateDust(dustPts, dt) {
  if (!dustPts) return;
  const pos = dustPts.geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.array[i * 3] += Math.sin(Date.now() * 0.0003 + i) * 0.003;
    pos.array[i * 3 + 1] += 0.003;
    if (pos.array[i * 3 + 1] > 12) pos.array[i * 3 + 1] = 0;
  }
  pos.needsUpdate = true;
}

export function buildMap(scene, collidables, theme = 'desert') {
  // Theme parameter can be used to switch textures/materials per level
  // Currently placeholder – future implementation can load different texture sets based on `theme`
  ensureMaterials();

  // Sky
  buildSky(scene);

  // Ground — sand textured
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80, 1, 1),
    sandMat
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Outer walls — brick
  const brickWall = (w, h, d, x, y, z) => {
    const m = mkWall(scene, collidables, w, h, d, brickMat, x, y, z);
    // Tile the brick texture relative to wall size
    return m;
  };
  brickWall(77, 8, 1.5, 0, 4, -40);
  brickWall(77, 8, 1.5, 0, 4, 40);
  brickWall(1.5, 8, 80, -40, 4, 0);
  brickWall(1.5, 8, 80, 40, 4, 0);

  // Wall top ledge (concrete lip)
  mkBox(scene, 78, 0.4, 2.2, concreteMat, 0, 8.2, -40, true);
  mkBox(scene, 78, 0.4, 2.2, concreteMat, 0, 8.2, 40, true);
  mkBox(scene, 2.2, 0.4, 80, concreteMat, -40, 8.2, 0, true);
  mkBox(scene, 2.2, 0.4, 80, concreteMat, 40, 8.2, 0, true);

  // ── Central Tower — concrete + metal ──
  mkWall(scene, collidables, 10, 7, 10, concreteMat, 0, 3.5, 0);

  // Tower parapets — concrete
  const pm = concreteMat;
  mkWall(scene, collidables, 2, 1.2, 0.5, pm, -3.0, 7.6, -4.75);
  mkWall(scene, collidables, 2, 1.2, 0.5, pm, 3.0, 7.6, -4.75);
  mkWall(scene, collidables, 2, 1.2, 0.5, pm, -3.0, 7.6, 4.75);
  mkWall(scene, collidables, 2, 1.2, 0.5, pm, 3.0, 7.6, 4.75);
  mkWall(scene, collidables, 0.5, 1.2, 2, pm, -4.75, 7.6, -3.0);
  mkWall(scene, collidables, 0.5, 1.2, 2, pm, -4.75, 7.6, 3.0);
  mkWall(scene, collidables, 0.5, 1.2, 2, pm, 4.75, 7.6, -3.0);
  mkWall(scene, collidables, 0.5, 1.2, 2, pm, 4.75, 7.6, 3.0);

  // Corner pillars — metal
  mkWall(scene, collidables, 0.8, 4, 0.8, metalMat, -4.5, 9.0, -4.5);
  mkWall(scene, collidables, 0.8, 4, 0.8, metalMat, 4.5, 9.0, -4.5);
  mkWall(scene, collidables, 0.8, 4, 0.8, metalMat, -4.5, 9.0, 4.5);
  mkWall(scene, collidables, 0.8, 4, 0.8, metalMat, 4.5, 9.0, 4.5);

  // Roof — metal
  mkWall(scene, collidables, 11, 0.4, 11, metalMat, 0, 11.2, 0);

  // Metal ladders
  mkLadder(scene, collidables, 1.5, 7.5, 0, 3.75, -5.05, 0);
  mkLadder(scene, collidables, 1.5, 7.5, 0, 3.75, 5.05, Math.PI);
  mkLadder(scene, collidables, 1.5, 7.5, -5.05, 3.75, 0, -Math.PI / 2);
  mkLadder(scene, collidables, 1.5, 7.5, 5.05, 3.75, 0, Math.PI / 2);

  // ── Corridor cover — concrete barriers ──
  mkWall(scene, collidables, 2, 2.5, 16, concreteMat, -18, 1.25, -9.5);
  mkWall(scene, collidables, 2, 2.5, 16, concreteMat, -18, 1.25, 9.5);
  mkWall(scene, collidables, 2, 2.5, 16, concreteMat, 18, 1.25, -9.5);
  mkWall(scene, collidables, 2, 2.5, 16, concreteMat, 18, 1.25, 9.5);

  // ── Corner bunkers — brick walls ──
  const corners = [[-30, -30], [30, -30], [-30, 30], [30, 30]];
  corners.forEach(([cx, cz]) => {
    mkWall(scene, collidables, 6, 3, 1.5, brickMat, cx, 1.5, cz);
    mkWall(scene, collidables, 1.5, 3, 6, brickMat, cx, 1.5, cz);
    // Window slot on top
    mkBox(scene, 4.5, 0.5, 1.2, concreteMat, cx, 3.25, cz, true);
  });

  // ── Mid-lane cover — sandbag barriers ──
  const coverPositions = [
    [-12, -12], [12, -12], [-12, 12], [12, 12],
    [-25, 0], [25, 0], [0, -25], [0, 25],
    [-25, -20], [25, -20], [-25, 20], [25, 20],
  ];
  coverPositions.forEach(([cx, cz]) => {
    mkWall(scene, collidables, 3, 1.8, 3, concreteMat, cx, 0.9, cz);
  });

  // ── Site platforms — concrete ──
  mkWall(scene, collidables, 12, 1, 12, concreteMat, -28, 0.5, -28);
  mkWall(scene, collidables, 12, 1, 12, concreteMat, 28, 0.5, 28);

  // Platform pillars — concrete
  [-28, 28].forEach(px => [-28, 28].forEach(pz =>
    mkWall(scene, collidables, 1.5, 4, 1.5, concreteMat, px, 2, pz)
  ));

  // ── Ground detail — scattered crates ──
  const crateMat = woodMat;
  [[-8, -32], [15, -35], [-22, 8], [32, -8], [-35, -15]].forEach(([cx, cz]) => {
    const crate = mkBox(scene, 1.2, 1.2, 1.2, crateMat, cx, 0.6, cz);
    crate.rotation.y = Math.random() * 0.5;
  });

  // ── Ground markings / faded paint lines ──
  const lineMat = new THREE.MeshStandardMaterial({
    color: 0xccbb88, roughness: 1, transparent: true, opacity: 0.25
  });
  [[-10, 0, 0.5, 0.02, 20], [10, 0, 0.5, 0.02, 20], [0, -10, 20, 0.02, 0.5], [0, 10, 20, 0.02, 0.5]].forEach(([x, z, w, h, d]) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lineMat);
    line.position.set(x, 0.015, z);
    line.receiveShadow = true;
    scene.add(line);
  });

  return { sandMat, brickMat, concreteMat, metalMat, woodMat };
}
