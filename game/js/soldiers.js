// ─────────────────────────────────────────────────────────────
// ENEMY SOLDIERS — Humanoid procedural soldiers with camo
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeCamoTextures, makePBR } from './textures.js';

let camoMat, skinMat, bootMat, helmetMat, vestMat, eGunMat;

function ensureMats() {
  if (camoMat) return;
  camoMat = new THREE.MeshStandardMaterial({ color: 0x3cb043, roughness: 0.85 });
  skinMat = new THREE.MeshStandardMaterial({ color: 0x3cb043, roughness: 0.8 });
  bootMat = new THREE.MeshStandardMaterial({ color: 0x1a6620, roughness: 0.9 });
  helmetMat = new THREE.MeshStandardMaterial({ color: 0x2e8b34, roughness: 0.7, metalness: 0.15 });
  vestMat = new THREE.MeshStandardMaterial({ color: 0x237028, roughness: 0.85 });
  eGunMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.4, metalness: 0.8 });
}

function cyl(grp, rT, rB, h, mat, x, y, z, rX = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, 8), mat);
  m.position.set(x, y, z);
  m.rotation.x = rX;
  m.castShadow = true;
  grp.add(m);
  return m;
}

function box(grp, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  grp.add(m);
  return m;
}

function sph(grp, r, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  grp.add(m);
  return m;
}

export function createSoldier() {
  ensureMats();
  const group = new THREE.Group();

  // ── Legs ──
  // Left leg: thigh + shin
  cyl(group, 0.09, 0.08, 0.45, camoMat, -0.12, 0.55, 0);  // thigh
  cyl(group, 0.08, 0.07, 0.40, camoMat, -0.12, 0.18, 0);   // shin
  // Right leg
  cyl(group, 0.09, 0.08, 0.45, camoMat, 0.12, 0.55, 0);
  cyl(group, 0.08, 0.07, 0.40, camoMat, 0.12, 0.18, 0);
  // Boots
  box(group, 0.12, 0.08, 0.18, bootMat, -0.12, 0.02, 0.02);
  box(group, 0.12, 0.08, 0.18, bootMat, 0.12, 0.02, 0.02);

  // ── Torso ── (tactical vest over body)
  const torso = box(group, 0.38, 0.40, 0.22, camoMat, 0, 0.98, 0);
  // Tactical vest overlay
  box(group, 0.40, 0.35, 0.24, vestMat, 0, 1.0, 0);
  // Vest pouches
  box(group, 0.08, 0.06, 0.04, vestMat, -0.12, 0.88, 0.14);
  box(group, 0.08, 0.06, 0.04, vestMat, 0, 0.88, 0.14);
  box(group, 0.08, 0.06, 0.04, vestMat, 0.12, 0.88, 0.14);
  // Belt
  box(group, 0.39, 0.04, 0.23, bootMat, 0, 0.78, 0);

  // ── Arms ──
  // Left arm (barrel hand) - upper arm straight down, forearm pointing forward/inward
  cyl(group, 0.06, 0.05, 0.30, camoMat, -0.24, 1.02, 0);
  cyl(group, 0.05, 0.04, 0.30, camoMat, -0.16, 0.85, 0.15, -Math.PI / 2).rotation.z = -0.2;
  sph(group, 0.04, skinMat, -0.10, 0.85, 0.30);
  
  // Right arm (trigger hand) - upper arm straight down, forearm pointing forward
  cyl(group, 0.06, 0.05, 0.30, camoMat, 0.24, 1.02, 0);
  cyl(group, 0.05, 0.04, 0.30, camoMat, 0.24, 0.85, 0.15, -Math.PI / 2);
  sph(group, 0.04, skinMat, 0.24, 0.85, 0.30);

  // ── Head ──
  const head = sph(group, 0.14, skinMat, 0, 1.35, 0);
  // Neck
  cyl(group, 0.05, 0.06, 0.08, skinMat, 0, 1.20, 0);
  // Helmet
  const helmet = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6),
    helmetMat
  );
  helmet.position.set(0, 1.40, -0.01);
  helmet.castShadow = true;
  group.add(helmet);
  // Helmet rim
  cyl(group, 0.17, 0.17, 0.02, helmetMat, 0, 1.32, 0);

  // ── Eyes (painted on face) ──
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
  sph(group, 0.02, eyeMat, -0.05, 1.37, 0.12);
  sph(group, 0.02, eyeMat, 0.05, 1.37, 0.12);

  // ── Enemy weapon ──
  const gunGrp = new THREE.Group();
  box(gunGrp, 0.04, 0.06, 0.35, eGunMat, 0, 0, 0); // Receiver
  cyl(gunGrp, 0.01, 0.01, 0.40, eGunMat, 0, 0.01, -0.37, Math.PI / 2); // Long barrel
  box(gunGrp, 0.04, 0.05, 0.20, eGunMat, 0, -0.02, 0.27); // Stock
  box(gunGrp, 0.03, 0.12, 0.06, eGunMat, 0, -0.08, -0.05); // Magazine

  // Position at right hand and angle across body towards left hand
  gunGrp.position.set(0.18, 0.83, 0.15);
  gunGrp.rotation.y = 0.25;
  group.add(gunGrp);

  // ── Hitbox meshes (invisible but raycastable) ──
  // Body hitbox — covers torso + upper legs
  const bodyHit = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.75, 0.28),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  bodyHit.position.set(0, 0.85, 0);
  group.add(bodyHit);

  // Head hitbox — sphere around head
  const headHit = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 8, 6),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  headHit.position.set(0, 1.38, 0);
  group.add(headHit);

  // Scale up the soldier to be taller
  group.scale.set(1.3, 1.3, 1.3);

  return { group, bodyHit, headHit, gunGrp, helmet };
}

// Death animation state machine
export function animateDeath(enemy, dt) {
  if (!enemy._deathTime) {
    enemy._deathTime = 0;
    enemy._deathPhase = 0;
  }
  enemy._deathTime += dt;
  const g = enemy.group;

  switch (enemy._deathPhase) {
    case 0: // Stagger back
      if (enemy._deathTime < 0.15) {
        g.position.y += 0.01;
        g.rotation.x -= dt * 2;
      } else {
        enemy._deathPhase = 1;
      }
      break;
    case 1: // Fall
      if (enemy._deathTime < 0.6) {
        g.rotation.x -= dt * 4;
        g.position.y = Math.max(0.05, g.position.y - dt * 4);
      } else {
        g.rotation.x = -Math.PI / 2;
        g.position.y = 0.06;
        enemy._deathPhase = 2;
      }
      break;
    case 2: // Done
      return true;
  }
  return false;
}

// Idle animation — slight sway
export function animateIdle(enemy, time) {
  if (!enemy.alive) return;
  const sway = Math.sin(time * 1.5 + enemy._seed) * 0.015;
  // Subtle body sway - we offset the base group slightly
  enemy.group.children.forEach(c => {
    if (c.position.y > 0.8 && c.position.y < 1.3) {
      // Upper body parts sway gently
    }
  });
}

// Spawn enemies in the scene
const SPAWNS = [
  [-28,-20],[-14,-20],[0,-20],[14,-20],[28,-20],
  [-28,-28],[-14,-28],[0,-28],[14,-28],[28,-28],
  [-28,-36],[-14,-36],[0,-36],[14,-36],[28,-36],
  [-20,-32],[20,-32],[-8,-24],[8,-24],[0,-32],
];

export function spawnEnemies(scene, ENEMY_TOTAL) {
  const enemies = [];
  const enemyMeshes = [];

  SPAWNS.slice(0, ENEMY_TOTAL).forEach(([sx, sz]) => {
    const jx = sx + (Math.random() - 0.5) * 4;
    const jz = sz + (Math.random() - 0.5) * 4;

    const { group, bodyHit, headHit, gunGrp, helmet } = createSoldier();
    group.position.set(jx, 0, jz);
    scene.add(group);

    const obj = {
      group, body: bodyHit, head: headHit, gunGrp, helmet,
      hp: 100, alive: true,
      atkTimer: Math.random() * 2.8,
      _seed: Math.random() * 100,
      _deathTime: 0, _deathPhase: -1
    };

    bodyHit.userData = { type: 'enemy', hitType: 'body', ref: obj };
    headHit.userData = { type: 'enemy', hitType: 'head', ref: obj };

    enemies.push(obj);
    enemyMeshes.push(bodyHit, headHit);
  });

  return { enemies, enemyMeshes };
}
