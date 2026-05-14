// ─────────────────────────────────────────────────────────────
// MAP BUILDER — Theme-aware arena with pickups
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { getThemeMaterials } from './textures.js';

let currentThemeMats = null;

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

  const metalMat = currentThemeMats.metal;
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

// Sky dome with theme colors
function buildSky(scene, theme) {
  const t = currentThemeMats;
  const skyGeo = new THREE.SphereGeometry(95, 32, 16);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uSkyTop:  { value: new THREE.Vector3(...t.skyTop) },
      uSkyMid:  { value: new THREE.Vector3(...t.skyMid) },
      uHorizon: { value: new THREE.Vector3(...t.horizon) },
      uSunTint: { value: new THREE.Vector3(...t.sunTint) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uSkyTop, uSkyMid, uHorizon, uSunTint;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        vec3 col;
        if (h > 0.0) {
          col = mix(uHorizon, uSkyMid, smoothstep(0.0, 0.15, h));
          col = mix(col, uSkyTop, smoothstep(0.15, 0.6, h));
        } else {
          col = uHorizon * 0.7;
        }
        float sun = max(0.0, dot(normalize(vPos), normalize(vec3(20.0, 35.0, 20.0))));
        col += uSunTint * pow(sun, 32.0) * 0.6;
        gl_FragColor = vec4(col, 1.0);
      }
    `
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));
}

// ── Health Pack (spinning heart at X=-39) ──
let healthPack = null;
// ── Ammo Pack (glowing battery at X=39) ──
let ammoPack = null;

function buildPickups(scene) {
  // Health — spinning heart shape (two spheres + cone)
  const hpGroup = new THREE.Group();
  const heartMat = new THREE.MeshStandardMaterial({
    color: 0xff4466, emissive: 0xff2244, emissiveIntensity: 0.4, roughness: 0.3
  });
  const s1 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), heartMat);
  s1.position.set(-0.22, 0.15, 0);
  hpGroup.add(s1);
  const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 12), heartMat);
  s2.position.set(0.22, 0.15, 0);
  hpGroup.add(s2);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.7, 12), heartMat);
  cone.position.set(0, -0.25, 0);
  cone.rotation.z = Math.PI;
  hpGroup.add(cone);
  // Cross overlay
  const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 });
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.12), crossMat);
  crossH.position.set(0, 0.05, 0.35);
  hpGroup.add(crossH);
  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.12), crossMat);
  crossV.position.set(0, 0.05, 0.35);
  hpGroup.add(crossV);

  hpGroup.position.set(-37, 1.5, 0);
  hpGroup.userData.isPickup = 'health';
  scene.add(hpGroup);
  healthPack = hpGroup;

  // Ammo — glowing battery
  const ammoGroup = new THREE.Group();
  const batteryMat = new THREE.MeshStandardMaterial({
    color: 0x44ccff, emissive: 0x2288ff, emissiveIntensity: 0.5, roughness: 0.2, metalness: 0.5
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), batteryMat);
  ammoGroup.add(body);
  const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15, 8), batteryMat);
  tip.position.y = 0.475;
  ammoGroup.add(tip);
  // Lightning bolt
  const boltMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.8 });
  const bolt = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), boltMat);
  bolt.position.set(0, 0, 0.18);
  ammoGroup.add(bolt);

  ammoGroup.position.set(37, 1.5, 0);
  ammoGroup.userData.isPickup = 'ammo';
  scene.add(ammoGroup);
  ammoPack = ammoGroup;
}

export function updatePickups(dt) {
  const t = Date.now() * 0.002;
  if (healthPack) {
    healthPack.rotation.y += dt * 2;
    healthPack.position.y = 1.5 + Math.sin(t) * 0.3;
  }
  if (ammoPack) {
    ammoPack.rotation.y -= dt * 2;
    ammoPack.position.y = 1.5 + Math.sin(t + 1) * 0.3;
  }
}

export function checkPickup(playerPos, playerHP, playerAmmo) {
  let picked = null;
  if (healthPack && healthPack.visible !== false) {
    const d = playerPos.distanceTo(healthPack.position);
    if (d < 2.5 && playerHP < 100) { picked = 'health'; }
  }
  if (ammoPack && ammoPack.visible !== false) {
    const d = playerPos.distanceTo(ammoPack.position);
    if (d < 2.5) { picked = picked || 'ammo'; }
  }
  return picked;
}

export function hidePickup(type) {
  if (type === 'health' && healthPack) healthPack.visible = false;
  if (type === 'ammo' && ammoPack) ammoPack.visible = false;
}

export function resetPickups() {
  if (healthPack) healthPack.visible = true;
  if (ammoPack) ammoPack.visible = true;
}

// Ambient floating dust
export function buildDustParticles(scene, theme) {
  const count = 300;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 80;
    pos[i * 3 + 1] = Math.random() * 12;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const t = getThemeMaterials(theme);
  const dustColor = (theme === 'inferno') ? 0xb8a878 : 0xd4c49a;
  const mat = new THREE.PointsMaterial({
    color: dustColor, size: 0.08, transparent: true, opacity: 0.4,
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
  currentThemeMats = getThemeMaterials(theme);
  const t = currentThemeMats;

  // Sky
  buildSky(scene, theme);

  // Fog
  scene.fog = new THREE.FogExp2(t.fog, 0.012);

  // Ground
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 1, 1), t.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Outer walls
  mkWall(scene, collidables, 77, 8, 1.5, t.wall, 0, 4, -40);
  mkWall(scene, collidables, 77, 8, 1.5, t.wall, 0, 4, 40);
  mkWall(scene, collidables, 1.5, 8, 80, t.wall, -40, 4, 0);
  mkWall(scene, collidables, 1.5, 8, 80, t.wall, 40, 4, 0);

  // Wall top ledge
  mkBox(scene, 78, 0.4, 2.2, t.cover, 0, 8.2, -40, true);
  mkBox(scene, 78, 0.4, 2.2, t.cover, 0, 8.2, 40, true);
  mkBox(scene, 2.2, 0.4, 80, t.cover, -40, 8.2, 0, true);
  mkBox(scene, 2.2, 0.4, 80, t.cover, 40, 8.2, 0, true);

  // Central Tower
  mkWall(scene, collidables, 10, 7, 10, t.cover, 0, 3.5, 0);

  // Tower parapets
  mkWall(scene, collidables, 2, 1.2, 0.5, t.cover, -3.0, 7.6, -4.75);
  mkWall(scene, collidables, 2, 1.2, 0.5, t.cover, 3.0, 7.6, -4.75);
  mkWall(scene, collidables, 2, 1.2, 0.5, t.cover, -3.0, 7.6, 4.75);
  mkWall(scene, collidables, 2, 1.2, 0.5, t.cover, 3.0, 7.6, 4.75);
  mkWall(scene, collidables, 0.5, 1.2, 2, t.cover, -4.75, 7.6, -3.0);
  mkWall(scene, collidables, 0.5, 1.2, 2, t.cover, -4.75, 7.6, 3.0);
  mkWall(scene, collidables, 0.5, 1.2, 2, t.cover, 4.75, 7.6, -3.0);
  mkWall(scene, collidables, 0.5, 1.2, 2, t.cover, 4.75, 7.6, 3.0);

  // Corner pillars
  mkWall(scene, collidables, 0.8, 4, 0.8, t.metal, -4.5, 9.0, -4.5);
  mkWall(scene, collidables, 0.8, 4, 0.8, t.metal, 4.5, 9.0, -4.5);
  mkWall(scene, collidables, 0.8, 4, 0.8, t.metal, -4.5, 9.0, 4.5);
  mkWall(scene, collidables, 0.8, 4, 0.8, t.metal, 4.5, 9.0, 4.5);

  // Roof
  mkWall(scene, collidables, 11, 0.4, 11, t.metal, 0, 11.2, 0);

  // Metal ladders
  mkLadder(scene, collidables, 1.5, 7.5, 0, 3.75, -5.05, 0);
  mkLadder(scene, collidables, 1.5, 7.5, 0, 3.75, 5.05, Math.PI);
  mkLadder(scene, collidables, 1.5, 7.5, -5.05, 3.75, 0, -Math.PI / 2);
  mkLadder(scene, collidables, 1.5, 7.5, 5.05, 3.75, 0, Math.PI / 2);

  // Corridor cover
  mkWall(scene, collidables, 2, 2.5, 16, t.cover, -18, 1.25, -9.5);
  mkWall(scene, collidables, 2, 2.5, 16, t.cover, -18, 1.25, 9.5);
  mkWall(scene, collidables, 2, 2.5, 16, t.cover, 18, 1.25, -9.5);
  mkWall(scene, collidables, 2, 2.5, 16, t.cover, 18, 1.25, 9.5);

  // Corner bunkers
  const corners = [[-30, -30], [30, -30], [-30, 30], [30, 30]];
  corners.forEach(([cx, cz]) => {
    mkWall(scene, collidables, 6, 3, 1.5, t.wall, cx, 1.5, cz);
    mkWall(scene, collidables, 1.5, 3, 6, t.wall, cx, 1.5, cz);
    mkBox(scene, 4.5, 0.5, 1.2, t.cover, cx, 3.25, cz, true);
  });

  // Mid-lane cover
  const coverPositions = [
    [-12, -12], [12, -12], [-12, 12], [12, 12],
    [-25, 0], [25, 0], [0, -25], [0, 25],
    [-25, -20], [25, -20], [-25, 20], [25, 20],
  ];
  coverPositions.forEach(([cx, cz]) => {
    mkWall(scene, collidables, 3, 1.8, 3, t.cover, cx, 0.9, cz);
  });

  // Site platforms
  mkWall(scene, collidables, 12, 1, 12, t.cover, -28, 0.5, -28);
  mkWall(scene, collidables, 12, 1, 12, t.cover, 28, 0.5, 28);

  // Platform pillars
  [-28, 28].forEach(px => [-28, 28].forEach(pz =>
    mkWall(scene, collidables, 1.5, 4, 1.5, t.cover, px, 2, pz)
  ));

  // ── Theme-specific props ──
  if (theme === 'bind') {
    // ─── BIND: Radiant Crates (orange body, glowing teal edges) ───
    const cratePositions = [[-8,-32],[15,-35],[-22,8],[32,-8],[-35,-15],[10,30],[-10,28]];
    cratePositions.forEach(([cx, cz]) => {
      const grp = new THREE.Group();
      // Orange body
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), t.crate);
      body.castShadow = true; body.receiveShadow = true;
      grp.add(body);
      // Teal edge strips (4 vertical edges)
      const edgeGeo = new THREE.BoxGeometry(0.06, 1.24, 0.06);
      [[-0.6,-0.6],[0.6,-0.6],[-0.6,0.6],[0.6,0.6]].forEach(([ex,ez]) => {
        const edge = new THREE.Mesh(edgeGeo, t.crateEdge);
        edge.position.set(ex, 0, ez);
        grp.add(edge);
      });
      grp.position.set(cx, 0.6, cz);
      grp.rotation.y = Math.random() * 0.5;
      scene.add(grp);
    });

    // Sandy barriers (low sand-colored walls)
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0xc8b070, roughness: 0.95 });
    [[-15, -20, 4], [15, 20, 4], [-20, 15, 3], [20, -15, 3]].forEach(([bx, bz, bw]) => {
      const barrier = mkWall(scene, collidables, bw, 1.2, 1.0, barrierMat, bx, 0.6, bz);
      // Sandbag texture bumps
      for (let i = 0; i < 3; i++) {
        const bump = new THREE.Mesh(
          new THREE.SphereGeometry(0.25, 6, 4),
          barrierMat
        );
        bump.position.set(bx + (i - 1) * 0.6, 1.3, bz);
        bump.scale.set(1, 0.6, 0.8);
        bump.castShadow = true;
        scene.add(bump);
      }
    });

  } else {
    // ─── INFERNO: Stone Pillars + Wooden Archways ───
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.85 });
    const pillarPositions = [[-8,-32],[15,-35],[-22,8],[32,-8],[-35,-15]];
    pillarPositions.forEach(([px, pz]) => {
      // Stone pillar (cylinder)
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 3.5, 10), pillarMat);
      pillar.position.set(px, 1.75, pz);
      pillar.castShadow = true; pillar.receiveShadow = true;
      scene.add(pillar);
      // Pillar base (wider disc)
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.75, 0.3, 10), pillarMat);
      base.position.set(px, 0.15, pz);
      base.castShadow = true;
      scene.add(base);
      // Pillar capital
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.5, 0.25, 10), pillarMat);
      cap.position.set(px, 3.6, pz);
      cap.castShadow = true;
      scene.add(cap);
    });

    // Wooden archways between paired pillars
    const archWoodMat = t.wood;
    // Arch between pillar 0 and 1
    [[ [-8,-32], [15,-35] ], [ [-22,8], [-35,-15] ]].forEach(([[ax,az],[bx2,bz2]]) => {
      const mx = (ax + bx2) / 2, mz = (az + bz2) / 2;
      const dx = bx2 - ax, dz = bz2 - az;
      const len = Math.sqrt(dx*dx + dz*dz);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 0.4), archWoodMat);
      beam.position.set(mx, 3.75, mz);
      beam.rotation.y = Math.atan2(dz, dx);
      beam.castShadow = true;
      scene.add(beam);
    });

    // Wooden crates (Inferno style — plain wood)
    [[10,30],[-10,28],[25,15]].forEach(([cx, cz]) => {
      const crate = mkBox(scene, 1.2, 1.2, 1.2, t.wood, cx, 0.6, cz);
      crate.rotation.y = Math.random() * 0.5;
    });
  }

  // ── Ground markings — paint lines ──
  const lineMat = new THREE.MeshStandardMaterial({
    color: theme === 'inferno' ? 0xa09878 : 0xccbb88,
    roughness: 1, transparent: true, opacity: 0.25
  });
  [[-10,0,0.5,0.02,20],[10,0,0.5,0.02,20],[0,-10,20,0.02,0.5],[0,10,20,0.02,0.5]].forEach(([x,z,w,h,d]) => {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lineMat);
    line.position.set(x, 0.015, z);
    line.receiveShadow = true;
    scene.add(line);
  });

  // ── Tactical Buddy — a cute rounded robot sitting on cover ──
  buildTacticalBuddy(scene, theme);

  // Pickups
  buildPickups(scene);
}

// ── TACTICAL BUDDY — cute low-poly robot companion ──
function buildTacticalBuddy(scene, theme) {
  const buddy = new THREE.Group();

  const bodyColor = theme === 'inferno' ? 0x887766 : 0x88bbcc;
  const eyeColor = theme === 'inferno' ? 0xff8844 : 0x44ffcc;
  const bodyMat = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.4, metalness: 0.3 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: eyeColor, emissive: eyeColor, emissiveIntensity: 0.6, roughness: 0.2 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.5, metalness: 0.2 });

  // Round body (sphere)
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 12, 12), bodyMat);
  body.position.y = 0.45;
  body.castShadow = true;
  buddy.add(body);

  // Flat bottom (so it sits nicely)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.38, 0.15, 10), bodyMat);
  base.position.y = 0.07;
  buddy.add(base);

  // Eyes (two small glowing spheres)
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
  eyeL.position.set(-0.15, 0.55, 0.38);
  buddy.add(eyeL);
  const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), eyeMat);
  eyeR.position.set(0.15, 0.55, 0.38);
  buddy.add(eyeR);

  // Antenna
  const antennaPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.25, 6), accentMat);
  antennaPole.position.set(0, 0.95, 0);
  buddy.add(antennaPole);
  const antennaBall = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeMat);
  antennaBall.position.set(0, 1.1, 0);
  buddy.add(antennaBall);

  // Little arm stubs
  const armMat = bodyMat;
  const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 6), armMat);
  armL.position.set(-0.48, 0.4, 0);
  armL.rotation.z = 0.4;
  buddy.add(armL);
  const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.18, 4, 6), armMat);
  armR.position.set(0.48, 0.4, 0);
  armR.rotation.z = -0.4;
  buddy.add(armR);

  // Place on a mid-lane cover block
  buddy.position.set(12, 1.8, 12);
  buddy.userData.isBuddy = true;
  scene.add(buddy);
}

