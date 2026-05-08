// ─────────────────────────────────────────────────────────────
// SOLDIERS — Player & Enemy Spawning
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export function spawnPlayer(player, scene) {
  ensurePlayerMaterials();

  // Spawn at extreme Z-axis edge (forward)
  player.mesh.position.set(0, 1.6, 38);
  scene.add(player.mesh);
  player.mesh.visible = true;
}

export function spawnEnemies(scene, collidables, count) {
  ensureSoldierMaterials();

  // Clamp count to valid range (10-30)
  const enemyCount = Math.max(10, Math.min(30, count));
  
  // Player spawns at Z = 38 (positive edge)
  // Enemies spawn at Z = -38 (opposite negative edge)
  const playerZ = 38;
  const enemyZ = -38;
  const startX = -20;
  const endX = 20;
  const y = 1.6;

  // Calculate X spacing to distribute enemies across the width
  // For 10 enemies: X = -20, -12, -4, 4, 12, 20 (plus center)
  // For 30 enemies: tighter spacing across the same X range
  const spacing = (endX - startX) / (enemyCount - 1);
  const positions = [];

  for (let i = 0; i < enemyCount; i++) {
    const x = startX + i * spacing;
    const enemyMesh = new THREE.Mesh(
      enemySoldierGeo,
      enemySoldierMat.clone()
    );
    enemyMesh.position.set(x, y, enemyZ);
    scene.add(enemyMesh);
    enemyMesh.userData = {
      isEnemy: true,
      health: 100,
      speed: 8,
      lastShot: 0,
      cooldown: 1.0,
      state: 'idle',
      stateTimer: 0,
      lastSeenTime: 0,
      lastAttackTime: 0,
      attackTimer: 0
    };
    collidables.push(enemyMesh);
    positions.push({ x: Math.round(x), y, z: enemyZ });

    enemyMesh.userData.health = 100;
  }

  return { count: positions.length };
}

export function updateSoldiers(dt) {
  if (!player) return;

  // Update player health bar
  const healthPct = Math.max(0, (player.health / 100) * 100);
  player.healthBar.progress.value = healthPct;
  player.healthBar.text.value = Math.ceil(player.health);
  player.healthBar.color.setHex(healthPct < 30 ? 0xff0000 : 0x00ff00);

  // Update player ammo display
  player.ammo.text.value = `${player.currentAmmo} / ${player.reserveAmmo}`;

  // Update player weapon model
  player.mesh.children.forEach((child, i) => {
    child.visible = i === player.weaponModelIndex;
  });
}

export function fireWeapon(player) {
  if (player.currentAmmo <= 0) return false;

  const recoil = 0.2;
  const recoilDecay = 0.1;
  player.recoilValue += recoil;
  player.recoilDecayValue += recoilDecay;

  player.currentAmmo--;
  player.ammo.text.value = `${player.currentAmmo} / ${player.reserveAmmo}`;

  // Auto-reload when empty
  if (player.currentAmmo === 0 && player.reserveAmmo > 0) {
    setTimeout(() => {
      if (!player.isReloading) {
        player.isReloading = true;
        player.reloadProgress.value = 0;
        player.reloadText.value = 'RELOADING...';
        player.reloadProgress.max.value = 100;

        const reloadTime = 1500;
        const interval = 30;
        const steps = reloadTime / interval;

        let elapsed = 0;
        const timer = setInterval(() => {
          elapsed += interval;
          player.reloadProgress.value = (elapsed / reloadTime) * 100;
          if (elapsed >= reloadTime) {
            clearInterval(timer);
            player.isReloading = false;
            player.currentAmmo = player.reserveAmmo;
            player.reloadProgress.value = 0;
            player.reloadText.value = '';
            player.ammo.text.value = `${player.currentAmmo} / ${player.reserveAmmo}`;
          }
        }, interval);
      }
    }, 500);
  }

  return true;
}

export function hitEnemy(enemy, damage) {
  enemy.health = Math.max(0, enemy.health - damage);
  enemy.healthBar.progress.value = (enemy.health / enemy.userData.maxHealth) * 100;

  if (enemy.health <= 0) {
    scene.remove(enemy.mesh);
    return true; // Enemy defeated
  }
  return false;
}

export function animateDeath(enemy) {
  if (enemy.mesh.userData.isDead) return;
  
  enemy.mesh.userData.isDead = true;
  const mesh = enemy.mesh;
  const originalScale = mesh.scale.clone();
  const originalPosition = mesh.position.clone();
  
  // Collapse effect
  mesh.scale.set(1.1, 0.9, 1.1);
  
  setTimeout(() => {
    mesh.scale.set(1.05, 0.95, 1.05);
  }, 100);
  
  setTimeout(() => {
    mesh.scale.set(originalScale.x * 0.5, originalScale.y * 0.5, originalScale.z * 0.5);
    mesh.position.y = originalPosition.y * 0.5;
  }, 200);
  
  setTimeout(() => {
    scene.remove(mesh);
    return true;
  }, 300);
}
