// ─────────────────────────────────────────────────────────────
// SOLDIERS — Enemy Spawning & Death Animation
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// ── Enemy Colors per Theme ──
const THEME_PALETTES = {
  bind:    { body: 0x5a6332, head: 0xd4a574, accent: 0x8B7D5B },
  inferno: { body: 0x4a3a2e, head: 0xc8a888, accent: 0x6b4c3a },
};

function getEnemyPalette(theme) {
  return THEME_PALETTES[theme] || THEME_PALETTES.bind;
}

export function spawnEnemies(scene, count, theme = 'desert') {
  const palette = getEnemyPalette(theme);
  const enemies = [];
  const enemyMeshes = [];

  const bodyMat = new THREE.MeshStandardMaterial({ color: palette.body, roughness: 0.7 });
  const headMat = new THREE.MeshStandardMaterial({ color: palette.head, roughness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: palette.accent, roughness: 0.5 });

  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();

    // Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.2, 0.5), bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = { type: 'enemy', hitType: 'body', ref: null };
    group.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), headMat);
    head.position.y = 1.42;
    head.castShadow = true;
    head.userData = { type: 'enemy', hitType: 'head', ref: null };
    group.add(head);

    // Accent belt
    const belt = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.55), accentMat);
    belt.position.y = 0.35;
    group.add(belt);

    // Legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.25), legMat);
    legL.position.set(-0.18, -0.3, 0);
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 0.25), legMat);
    legR.position.set(0.18, -0.3, 0);
    group.add(legR);

    // Spawn position — spread across the arena, Z from -38 to 38
    const angle = Math.random() * Math.PI * 2;
    const radius = 8 + Math.random() * 28;
    const sx = Math.cos(angle) * radius;
    const sz = Math.sin(angle) * radius;
    group.position.set(
      THREE.MathUtils.clamp(sx, -36, 36),
      0,
      THREE.MathUtils.clamp(sz, -36, 36)
    );

    scene.add(group);

    const enemy = {
      group, body, head,
      alive: true,
      hp: 100,
      atkTimer: 1 + Math.random() * 2,
      _deathPhase: 0,
      _deathTime: 0
    };

    body.userData.ref = enemy;
    head.userData.ref = enemy;

    enemies.push(enemy);
    enemyMeshes.push(body, head);
  }

  return { enemies, enemyMeshes };
}

export function animateDeath(enemy, dt, scene) {
  if (!enemy || !enemy.group) return true;
  enemy._deathTime += dt;

  if (enemy._deathPhase === 0) {
    // Fall over
    enemy.group.rotation.x += dt * 4;
    enemy.group.position.y -= dt * 2;
    if (enemy._deathTime > 0.5) {
      enemy._deathPhase = 1;
    }
    return false;
  }

  if (enemy._deathPhase === 1) {
    // Shrink and remove
    const s = Math.max(0, 1 - (enemy._deathTime - 0.5) * 2);
    enemy.group.scale.set(s, s, s);
    if (s <= 0) {
      scene.remove(enemy.group);
      return true;
    }
    return false;
  }

  scene.remove(enemy.group);
  return true;
}
