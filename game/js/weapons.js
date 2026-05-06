// ─────────────────────────────────────────────────────────────
// WEAPON MODELS — Detailed first-person weapons with PBR
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { makeMetalTextures, makeWoodTextures, makePBR } from './textures.js';

let metalMat, darkMetalMat, woodGripMat, polymerMat;

function ensureMats() {
  if (metalMat) return;
  metalMat = new THREE.MeshStandardMaterial({ color: 0x99aabb, roughness: 0.5, metalness: 0.2 });
  darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.7, metalness: 0.2 });
  const wd = makeWoodTextures(256);
  woodGripMat = makePBR(wd, { roughness: 0.7, metalness: 0.0 });
  polymerMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.6, metalness: 0.1 });
}

function box(grp, w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  grp.add(m);
  return m;
}

function cyl(grp, rTop, rBot, h, mat, x, y, z, rotX = 0, segs = 12) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, segs), mat);
  m.position.set(x, y, z);
  m.rotation.x = rotX;
  grp.add(m);
  return m;
}

function buildAK47() {
  ensureMats();
  const grp = new THREE.Group();

  // Receiver body
  box(grp, 0.075, 0.06, 0.38, metalMat, 0, 0, 0);
  // Dust cover (top)
  box(grp, 0.065, 0.015, 0.28, darkMetalMat, 0, 0.038, -0.04);
  // Barrel — cylinder
  cyl(grp, 0.012, 0.014, 0.30, darkMetalMat, 0, 0.008, -0.34, Math.PI / 2);
  // Muzzle brake
  cyl(grp, 0.016, 0.013, 0.05, metalMat, 0, 0.008, -0.515, Math.PI / 2);
  // Gas tube above barrel
  cyl(grp, 0.008, 0.008, 0.18, metalMat, 0, 0.035, -0.28, Math.PI / 2);
  // Handguard (wood foregrip)
  box(grp, 0.06, 0.045, 0.16, woodGripMat, 0, -0.01, -0.22);
  // Lower handguard
  box(grp, 0.055, 0.025, 0.14, woodGripMat, 0, -0.04, -0.22);
  // Magazine — curved banana shape (3 boxes angled)
  const magGrp = new THREE.Group();
  box(magGrp, 0.04, 0.08, 0.055, darkMetalMat, 0, 0, 0);
  box(magGrp, 0.04, 0.07, 0.055, darkMetalMat, 0, -0.07, 0.008);
  magGrp.position.set(0, -0.09, -0.04);
  magGrp.rotation.x = 0.12;
  grp.add(magGrp);
  grp.userData.magGroup = magGrp;
  // Trigger guard
  box(grp, 0.005, 0.035, 0.06, darkMetalMat, 0.018, -0.055, 0.04);
  box(grp, 0.005, 0.035, 0.06, darkMetalMat, -0.018, -0.055, 0.04);
  box(grp, 0.04, 0.005, 0.005, darkMetalMat, 0, -0.075, 0.065);
  // Trigger
  box(grp, 0.008, 0.025, 0.01, metalMat, 0, -0.055, 0.04);
  // Pistol grip
  box(grp, 0.042, 0.10, 0.05, woodGripMat, 0, -0.09, 0.10);
  // Stock
  box(grp, 0.055, 0.055, 0.16, woodGripMat, 0, -0.005, 0.28);
  // Stock butt plate
  box(grp, 0.058, 0.06, 0.012, darkMetalMat, 0, -0.005, 0.365);
  // Front sight post
  cyl(grp, 0.003, 0.003, 0.035, darkMetalMat, 0, 0.035, -0.46);
  // Front sight hood
  box(grp, 0.02, 0.035, 0.015, darkMetalMat, 0, 0.05, -0.46);
  // Rear sight
  box(grp, 0.03, 0.012, 0.02, darkMetalMat, 0, 0.048, 0.12);
  // Rear sight notch
  box(grp, 0.008, 0.006, 0.015, metalMat, -0.012, 0.054, 0.12);
  box(grp, 0.008, 0.006, 0.015, metalMat, 0.012, 0.054, 0.12);
  // Selector switch
  box(grp, 0.025, 0.006, 0.008, metalMat, 0.04, 0.01, 0.08);
  // Charging handle
  box(grp, 0.015, 0.01, 0.018, metalMat, 0.04, 0.03, 0.02);

  grp.position.set(0.18, -0.14, -0.35);
  return grp;
}

function buildPistol() {
  ensureMats();
  const grp = new THREE.Group();

  // Slide
  box(grp, 0.052, 0.055, 0.18, darkMetalMat, 0, 0.01, 0);
  // Slide serrations (grooves on back)
  for (let i = 0; i < 5; i++) {
    box(grp, 0.054, 0.003, 0.004, metalMat, 0, 0.015, 0.06 + i * 0.012);
  }
  // Barrel
  cyl(grp, 0.01, 0.012, 0.08, metalMat, 0, 0.008, -0.13, Math.PI / 2);
  // Frame / lower
  box(grp, 0.048, 0.035, 0.14, polymerMat, 0, -0.03, 0.02);
  // Trigger guard
  box(grp, 0.004, 0.025, 0.045, polymerMat, 0.016, -0.05, -0.025);
  box(grp, 0.004, 0.025, 0.045, polymerMat, -0.016, -0.05, -0.025);
  box(grp, 0.035, 0.004, 0.004, polymerMat, 0, -0.065, -0.043);
  // Trigger
  box(grp, 0.006, 0.02, 0.008, metalMat, 0, -0.045, -0.025);
  // Grip
  box(grp, 0.042, 0.09, 0.048, polymerMat, 0, -0.09, 0.05);
  // Grip texture lines
  for (let i = 0; i < 4; i++) {
    box(grp, 0.044, 0.003, 0.05, darkMetalMat, 0, -0.06 - i * 0.016, 0.05);
  }
  // Magazine base plate
  box(grp, 0.038, 0.008, 0.04, metalMat, 0, -0.14, 0.05);
  // Front sight
  cyl(grp, 0.003, 0.003, 0.02, darkMetalMat, 0, 0.045, -0.07);
  // Rear sight
  box(grp, 0.025, 0.01, 0.012, darkMetalMat, 0, 0.042, 0.06);
  // Sight dots
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.3 });
  cyl(grp, 0.002, 0.002, 0.003, dotMat, 0, 0.048, -0.07); // front dot
  cyl(grp, 0.002, 0.002, 0.003, dotMat, -0.008, 0.048, 0.06); // rear left
  cyl(grp, 0.002, 0.002, 0.003, dotMat, 0.008, 0.048, 0.06); // rear right
  // Hammer
  box(grp, 0.01, 0.02, 0.012, metalMat, 0, 0.025, 0.09);
  // Beaver tail
  box(grp, 0.04, 0.015, 0.02, polymerMat, 0, -0.01, 0.095);

  grp.position.set(0.16, -0.13, -0.30);
  return grp;
}

export function buildWeaponMesh(camera, type) {
  const grp = type === 'ak47' ? buildAK47() : buildPistol();
  camera.add(grp);
  return grp;
}

// ── WEAPON ANIMATIONS ──
const _restPos = { ak47: [0.18, -0.14, -0.35], pistol: [0.16, -0.13, -0.30] };

export function updateWeaponAnim(wpnMesh, player, keys, dt, weaponType) {
  if (!wpnMesh) return;
  const rest = _restPos[weaponType] || _restPos.ak47;

  if (player.reloading) {
    const total = weaponType === 'ak47' ? 2.4 : 1.6;
    const elapsed = total - player.reloadTimer;
    const p = Math.min(1, elapsed / total);

    if (weaponType === 'ak47') {
      // AK reload: tilt right, mag drop, mag insert, bolt pull
      if (p < 0.25) {
        // Tilt weapon
        const t = p / 0.25;
        wpnMesh.rotation.z = -t * 0.3;
        wpnMesh.position.y = rest[1] - t * 0.03;
      } else if (p < 0.5) {
        // Magazine out
        wpnMesh.rotation.z = -0.3;
        if (wpnMesh.userData.magGroup) {
          const t = (p - 0.25) / 0.25;
          wpnMesh.userData.magGroup.position.y = -0.09 - t * 0.12;
        }
      } else if (p < 0.75) {
        // Magazine in
        wpnMesh.rotation.z = -0.3;
        if (wpnMesh.userData.magGroup) {
          const t = (p - 0.5) / 0.25;
          wpnMesh.userData.magGroup.position.y = -0.09 - 0.12 + t * 0.12;
        }
      } else {
        // Return to rest
        const t = (p - 0.75) / 0.25;
        wpnMesh.rotation.z = -0.3 * (1 - t);
        if (wpnMesh.userData.magGroup) {
          wpnMesh.userData.magGroup.position.y = -0.09;
        }
      }
    } else {
      // Pistol reload: tilt, mag drop, mag insert, slide rack
      const lift = Math.sin(p * Math.PI) * 0.12;
      wpnMesh.position.y = rest[1] + lift;
      wpnMesh.position.z = rest[2] - lift * 0.2;
      wpnMesh.rotation.z = -Math.sin(p * Math.PI) * 0.2;
    }
    return;
  }

  // Reset reload transforms
  wpnMesh.rotation.z = 0;
  if (wpnMesh.userData.magGroup) {
    wpnMesh.userData.magGroup.position.y = -0.09;
  }

  const moving = keys.w || keys.a || keys.s || keys.d;
  if (moving) {
    const t = Date.now() * 0.007;
    const bobY = Math.sin(t * 2) * 0.028;
    const bobX = Math.sin(t) * 0.016;
    wpnMesh.position.y = rest[1] + bobY;
    wpnMesh.position.x = rest[0] + bobX;
    wpnMesh.rotation.z = -bobX * 1.6;
    wpnMesh.rotation.x = Math.sin(t * 2) * 0.008;
  } else {
    // Idle breathing sway
    const t = Date.now() * 0.002;
    const breathY = Math.sin(t) * 0.004;
    const breathX = Math.sin(t * 0.7) * 0.002;
    wpnMesh.position.y += (rest[1] + breathY - wpnMesh.position.y) * 0.12;
    wpnMesh.position.x += (rest[0] + breathX - wpnMesh.position.x) * 0.12;
    wpnMesh.rotation.z += (0 - wpnMesh.rotation.z) * 0.12;
    wpnMesh.rotation.x += (0 - wpnMesh.rotation.x) * 0.12;
  }
  wpnMesh.position.z = rest[2];
}

// Recoil kick animation
export function applyRecoilAnim(wpnMesh, weaponType) {
  if (!wpnMesh) return;
  const rest = _restPos[weaponType] || _restPos.ak47;
  // Kick back
  wpnMesh.position.z = rest[2] + (weaponType === 'pistol' ? 0.08 : 0.04);
  wpnMesh.rotation.x = (weaponType === 'pistol' ? -0.15 : -0.06);
  // Recovery handled in updateWeaponAnim via lerping
}

// Muzzle flash position (world space)
export function getMuzzleWorldPos(wpnMesh, camera) {
  if (!wpnMesh) return new THREE.Vector3();
  const tip = new THREE.Vector3(0, 0.008, -0.54);
  tip.applyMatrix4(wpnMesh.matrixWorld);
  return tip;
}
