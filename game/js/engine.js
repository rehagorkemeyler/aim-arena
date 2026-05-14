// ─────────────────────────────────────────────────────────────
// ENGINE — Core loop, physics, enemy AI, shooting, HUD
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { buildMap, buildDustParticles, updateDust, updatePickups, checkPickup, hidePickup, resetPickups } from './map.js';
import { buildWeaponMesh, updateWeaponAnim, applyRecoilAnim, getMuzzleWorldPos } from './weapons.js';
import { spawnEnemies, animateDeath } from './soldiers.js';
import { VFXSystem, spawnTracer, updateTracers, clearTracers, spawnBloodPool, clearBloodPools,
         showHitmarker, addKillFeedEntry, showStreakBanner } from './vfx.js';
import { setupPostProcessing, setDamageFlash, setHealthEffect, onResize } from './postfx.js';
import { sfxAK, sfxPistol, sfxStep, sfxDeath, sfxHit, sfxPain, gameActiveRef,
         playCombatMusic, pauseCombatMusic, playMenuMusic, playDefeatMusic, playVictoryMusic,
         playReloadVoice, playStreakAnnouncer, isAnnouncerActive } from './audio.js';
import { keys, player, stats, cfg, WPN, setInputCallbacks, initInputListeners,
         PLAYER_SPEED, PLAYER_HEIGHT, CROUCH_HEIGHT, SLIDE_SPEED, SLIDE_DUR, JUMP_VEL,
         GRAVITY, PLAYER_RADIUS, ENEMY_TOTAL, ENEMY_SPEED, ENEMY_SIGHT, ENEMY_ATK_RNG,
         ENEMY_ATK_RT, ENEMY_DMG, ENEMY_HIT_MOVING, ENEMY_HIT_STATIONARY, BODY_DMG, HEAD_DMG } from './input.js';
import { initMobileInputs, mobileLookDelta, mobileCfg } from './mobileInput.js';

const $ = id => document.getElementById(id);

let renderer, scene, camera, controls, clock, raycaster;
let gameActive = false;
let isMobile = false;
let enemies = [], collidables = [], enemyMeshes = [];
let wpnMesh = null;
let dustPts = null;
let vfx = null;
let postfx = null;
let currentLevel = 0;

const LEVEL_CONFIG = [
  { level:1,  theme:'bind',    title:'Bind — Recon',         enemies:10 },
  { level:2,  theme:'bind',    title:'Bind — Breach',        enemies:12 },
  { level:3,  theme:'bind',    title:'Bind — Assault',       enemies:14 },
  { level:4,  theme:'bind',    title:'Bind — Siege',         enemies:16 },
  { level:5,  theme:'bind',    title:'Bind — Lockdown',      enemies:18 },
  { level:6,  theme:'inferno', title:'Inferno — Recon',      enemies:20 },
  { level:7,  theme:'inferno', title:'Inferno — Breach',     enemies:22 },
  { level:8,  theme:'inferno', title:'Inferno — Assault',    enemies:25 },
  { level:9,  theme:'inferno', title:'Inferno — Siege',      enemies:28 },
  { level:10, theme:'inferno', title:'Inferno — Last Stand', enemies:30 },
];

// Recoil
let recoilTarget = 0, recoilApplied = 0;
const _rcEuler = new THREE.Euler(0, 0, 0, 'YXZ');

// Damage flash
let dmgFlashIntensity = 0;

// Death animations queue
let dyingEnemies = [];

// Kill Streak
let streakCount = 0;
let lastKillTime = 0;
let pentakillCooldown = 0;

// ── INIT ──
export function init() {
  player.vel = new THREE.Vector3();
  player.slideDir = new THREE.Vector3();

  renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.6;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
  clock = new THREE.Clock();
  raycaster = new THREE.Raycaster();

  controls = new PointerLockControls(camera, document.body);
  scene.add(controls.object);

  // Lighting
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1.4);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(20, 40, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -70;
  sun.shadow.camera.right = 70;
  sun.shadow.camera.top = 70;
  sun.shadow.camera.bottom = -70;
  sun.shadow.bias = -0.001;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xffffff, 0.8);
  fill.position.set(-15, 20, -15);
  scene.add(fill);

  // Post-processing
  postfx = setupPostProcessing(renderer, scene, camera);

  // Pointer lock callbacks
  controls.addEventListener('lock', () => {
    gameActive = true;
    gameActiveRef.value = true;
  });
  controls.addEventListener('unlock', () => {
    gameActive = false;
    gameActiveRef.value = false;
    const endVisible = !$('go-screen').classList.contains('hidden') ||
                       !$('win-screen').classList.contains('hidden');
    if (!endVisible) {
      pauseCombatMusic();
      showScreen($('pause-screen'));
    }
  });

  // Input
  isMobile = window.location.pathname.includes('mobile.html');
  
  if (isMobile) {
    initMobileInputs({
      shoot: tryShoot,
      reload: startReload,
      jump: doJump,
      crouch: toggleCrouchMobile,
      weaponSwitch: toggleWeaponMobile,
      pause: pauseGameMobile
    });
  } else {
    setInputCallbacks({
      shoot: tryShoot,
      reload: startReload,
      weaponSwitch: switchWeapon,
      jump: doJump,
      gameActive: () => gameActive && controls.isLocked
    });
    initInputListeners();
  }

  // Settings
  if ($('sld-sens')) {
    $('sld-sens').addEventListener('input', function() {
      cfg.sensitivity = parseFloat(this.value);
      $('sens-val').textContent = cfg.sensitivity.toFixed(2);
      if (isMobile) {
        mobileCfg.lookSpeed = 0.005 * cfg.sensitivity;
      } else {
        controls.pointerSpeed = cfg.sensitivity;
      }
    });
  }
  if ($('chk-fs')) {
    $('chk-fs').addEventListener('change', function() {
      if (this.checked) document.documentElement.requestFullscreen?.().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    });
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && $('chk-fs')) $('chk-fs').checked = false;
    });
  }

  // Buttons — use both touchstart and click so mobile Chrome works
  function bindBtn(id, handler) {
    const el = $(id);
    if (!el) return;
    el.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); handler(); }, { passive: false });
    el.addEventListener('click', e => { e.stopPropagation(); handler(); });
  }

  bindBtn('btn-start', () => startGame());
  bindBtn('btn-cfg',   () => showScreen($('cfg')));
  bindBtn('btn-back',  () => showScreen($('menu')));
  bindBtn('btn-go-retry',  () => startGame());
  bindBtn('btn-win-retry', () => nextLevel());

  // Level select dropdown
  const levelSel = $('level-select');
  if (levelSel) {
    levelSel.addEventListener('change', function() {
      currentLevel = parseInt(this.value, 10);
    });
  }
  bindBtn('btn-resume', () => {
    showScreen($('hud'));
    $('vignette').classList.remove('hidden');
    if (isMobile && $('mobile-overlay')) $('mobile-overlay').style.display = '';
    playCombatMusic();
    if (!isMobile) controls.lock();
    else { gameActive = true; gameActiveRef.value = true; }
  });
  bindBtn('btn-exit', () => {
    resetGame();
    showScreen($('menu'));
    $('vignette').classList.add('hidden');
    playMenuMusic();
  });

  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    onResize(postfx.composer, renderer);
  });

  // Menu music on interaction
  document.addEventListener('click', e => {
    if (e.target.closest('button')) return;
    if (!gameActive) playMenuMusic();
  });

  showScreen($('menu'));
  loop();
}

// ── SCREENS ──
function showScreen(el) {
  [$('menu'),$('cfg'),$('go-screen'),$('win-screen'),$('pause-screen'),$('hud')]
    .forEach(s => { if (s) s.classList.add('hidden'); });
  if (el) el.classList.remove('hidden');

  // On mobile, hide the touch overlay when any menu/overlay screen is active
  // so it can't steal touch events from buttons
  if (isMobile && $('mobile-overlay')) {
    const isGameHUD = (el === $('hud'));
    $('mobile-overlay').style.display = isGameHUD ? '' : 'none';
  }
}

// ── GAME START/RESET ──
function clearScene() {
  enemies.forEach(e => scene.remove(e.group));
  clearBloodPools(scene);
  clearTracers(scene);
  dyingEnemies = [];
  // Remove all non-essential objects (keep camera, lights)
  const keep = new Set();
  scene.traverse(o => { if (o.isLight || o === controls.object) keep.add(o); });
  const toRemove = [];
  scene.children.forEach(c => { if (!keep.has(c) && !c.isLight) toRemove.push(c); });
  toRemove.forEach(c => scene.remove(c));
  collidables.length = 0;
}

function resetGame() {
  clearScene();

  const lvl = LEVEL_CONFIG[currentLevel] || LEVEL_CONFIG[0];

  // Rebuild map for current level theme
  buildMap(scene, collidables, lvl.theme);
  if (dustPts) scene.remove(dustPts);
  dustPts = buildDustParticles(scene, lvl.theme);
  resetPickups();

  player.hp = 100;
  player.vel.set(0, 0, 0);
  player.onGround = true;
  player.reloading = false;
  player.reloadTimer = 0;
  player.fireTimer = 0;
  player.weapon = 'ak47';
  player.mouseHeld = false;
  player.canFire = true;
  player.isCrouching = false;
  player.isSliding = false;
  player.currentHeight = PLAYER_HEIGHT;
  keys.crouch = false;
  player.ammo = {
    ak47:  { cur: WPN.ak47.mag,   reserve: WPN.ak47.reserve },
    pistol:{ cur: WPN.pistol.mag, reserve: WPN.pistol.reserve },
  };
  stats.shots = stats.hits = stats.kills = 0;
  recoilTarget = 0;
  recoilApplied = 0;
  dmgFlashIntensity = 0;
  streakCount = 0;
  lastKillTime = 0;
  pentakillCooldown = 0;

  controls.object.position.set(0, PLAYER_HEIGHT, 18);
  if (wpnMesh) { camera.remove(wpnMesh); wpnMesh = null; }
  wpnMesh = buildWeaponMesh(camera, player.weapon);

  const enemyCount = lvl.enemies || ENEMY_TOTAL;
  const spawned = spawnEnemies(scene, enemyCount, lvl.theme);
  enemies = spawned.enemies;
  enemyMeshes = spawned.enemyMeshes;

  // VFX system re-init
  if (vfx) vfx.dispose();
  vfx = new VFXSystem(scene);

  updateHealthHUD();
  updateWeaponHUD();
  updateAccHUD();
  updateKillHUD();
  $('wpn-reload').textContent = '';
  const kf = $('kill-feed');
  if (kf) kf.innerHTML = '';

  // Level title HUD
  const lt = $('level-title');
  if (lt) {
    lt.textContent = `Level ${lvl.level}: ${lvl.title}`;
    lt.style.opacity = '1';
    setTimeout(() => { lt.style.opacity = '0'; }, 3000);
  }
  // Sync level-select dropdown
  const sel = $('level-select');
  if (sel) sel.value = currentLevel;
  // Update hostiles counter
  const hb = $('kills-box');
  if (hb) hb.innerHTML = `HOSTILES <span id="h-enemies">${enemyCount}</span>/${enemyCount}`;
}

function startGame(level) {
  if (level !== undefined) currentLevel = level;
  resetGame();
  showScreen($('hud'));
  $('vignette').classList.remove('hidden');
  playCombatMusic();
  if (!isMobile) controls.lock();
  else {
    gameActive = true;
    gameActiveRef.value = true;
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().then(() => {
        if (screen.orientation && screen.orientation.lock) {
          screen.orientation.lock('landscape').catch((e) => console.log('Orientation lock failed:', e));
        }
      }).catch(e => console.log('Fullscreen failed:', e));
    }
  }
}

function nextLevel() {
  if (currentLevel < LEVEL_CONFIG.length - 1) {
    currentLevel++;
    startGame(currentLevel);
  } else {
    // All 10 levels complete!
    currentLevel = 0;
    resetGame();
    showScreen($('menu'));
    $('vignette').classList.add('hidden');
    playMenuMusic();
  }
}


// ── SHOOTING ──
function tryShoot() {
  const w = player.weapon;
  const ammo = player.ammo[w];
  if (player.reloading || ammo.cur <= 0) { if (ammo.cur <= 0) startReload(); return; }

  stats.shots++;
  if (w === 'ak47') sfxAK(); else sfxPistol();

  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  const targets = [...enemyMeshes, ...collidables];
  const hits = raycaster.intersectObjects(targets, false);

  const muzzlePt = new THREE.Vector3();
  camera.getWorldPosition(muzzlePt);
  muzzlePt.addScaledVector(raycaster.ray.direction, 0.5);
  const targetPt = new THREE.Vector3();
  if (hits.length) raycaster.ray.at(hits[0].distance, targetPt);
  else raycaster.ray.at(150, targetPt);
  spawnTracer(scene, muzzlePt, targetPt);

  // Muzzle flash + shell eject VFX
  const muzzleWorld = getMuzzleWorldPos(wpnMesh, camera);
  vfx.muzzleFlash(muzzleWorld, raycaster.ray.direction);
  vfx.shellEject(muzzleWorld, raycaster.ray.direction);

  if (hits.length) {
    const tag = hits[0].object.userData;
    if (tag?.type === 'enemy' && tag.ref?.alive) {
      sfxHit();
      const isHead = tag.hitType === 'head';
      const dmg = isHead ? HEAD_DMG : BODY_DMG;
      hurtEnemy(tag.ref, dmg, isHead);
      stats.hits++;
      showHitmarker(isHead);
      vfx.bloodHit(hits[0].point, isHead);
    } else if (!tag?.isLadder) {
      // Hit map geometry (skip invisible ladders)
      vfx.dustImpact(hits[0].point);
    }
  }

  ammo.cur--;
  updateWeaponHUD();
  updateAccHUD();
  recoilTarget += (w === 'pistol' ? 0.08 : 0.055);
  applyRecoilAnim(wpnMesh, w);

  if (ammo.cur === 0 && ammo.reserve > 0) setTimeout(startReload, 180);
}

function hurtEnemy(obj, dmg, isHeadshot) {
  if (!obj.alive) return;
  obj.hp -= dmg;
  if (obj.hp <= 0) dieEnemy(obj, isHeadshot);
}

function dieEnemy(obj, isHeadshot) {
  if (!obj.alive) return;
  obj.alive = false;
  sfxDeath();
  enemyMeshes = enemyMeshes.filter(m => m !== obj.body && m !== obj.head);
  spawnBloodPool(scene, obj.group.position.x, obj.group.position.z);
  addKillFeedEntry(WPN[player.weapon].name, isHeadshot);
  obj._deathPhase = 0;
  obj._deathTime = 0;
  dyingEnemies.push(obj);
  stats.kills++;
  updateKillHUD();

  // Streak Logic
  if (pentakillCooldown <= 0) {
    const now = clock.elapsedTime;
    if (now - lastKillTime <= 2.0) {
      streakCount++;
    } else {
      streakCount = 1;
    }
    lastKillTime = now;
    
    showStreakBanner(streakCount);
    playStreakAnnouncer(streakCount);
    
    if (streakCount >= 5) {
      pentakillCooldown = 4.0;
      streakCount = 0;
    }
  }

  if (enemies.filter(e => e.alive).length === 0) setTimeout(showVictory, 400);
}

// ── RELOAD ──
function startReload() {
  const w = player.weapon;
  const ammo = player.ammo[w];
  if (player.reloading || ammo.cur === WPN[w].mag || ammo.reserve === 0) return;
  player.reloading = true;
  player.reloadTimer = WPN[w].reloadSec;
  $('wpn-reload').textContent = 'RELOADING…';
  playReloadVoice();
}

function finishReload() {
  const w = player.weapon;
  const ammo = player.ammo[w];
  const need = WPN[w].mag - ammo.cur;
  const take = Math.min(need, ammo.reserve);
  ammo.cur += take;
  ammo.reserve -= take;
  player.reloading = false;
  $('wpn-reload').textContent = '';
  updateWeaponHUD();
}

// ── WEAPON SWITCH ──
function switchWeapon(type) {
  if (player.weapon === type) return;
  player.weapon = type;
  player.reloading = false;
  $('wpn-reload').textContent = '';
  if (wpnMesh) { camera.remove(wpnMesh); wpnMesh = null; }
  wpnMesh = buildWeaponMesh(camera, type);
  updateWeaponHUD();
}

// ── JUMP ──
function doJump() {
  if (player.onGround) {
    player.vel.y = JUMP_VEL;
    player.onGround = false;
    player.isSliding = false;
  }
}

// ── MOBILE: CROUCH TOGGLE ──
function toggleCrouchMobile() {
  keys.crouch = !keys.crouch;
  player.isCrouching = keys.crouch;
  if (keys.crouch && player.onGround && (keys.w || keys.a || keys.s || keys.d)) {
    player.isSliding = true;
    player.slideTimer = SLIDE_DUR;
    if (player.slideDir) {
      player.slideDir.set(player.vel.x, 0, player.vel.z);
      if (player.slideDir.lengthSq() > 0) player.slideDir.normalize();
    }
  }
  const crouchBtn = $('btn-crouch');
  if (crouchBtn) crouchBtn.classList.toggle('m-btn-active', keys.crouch);
}

// ── MOBILE: WEAPON SWITCH ──
function toggleWeaponMobile() {
  const next = player.weapon === 'ak47' ? 'pistol' : 'ak47';
  switchWeapon(next);
  const wpnBtn = $('btn-wpn-switch');
  if (wpnBtn) wpnBtn.textContent = '🔄 ' + WPN[next].name;
}

// ── MOBILE: PAUSE ──
function pauseGameMobile() {
  if (!gameActive) return;
  gameActive = false;
  gameActiveRef.value = false;
  pauseCombatMusic();
  showScreen($('pause-screen'));
}

// ── PLAYER DAMAGE ──
function damagePlayer(n) {
  if (!gameActive) return;
  player.hp = Math.max(0, player.hp - n);
  sfxPain();
  updateHealthHUD();
  dmgFlashIntensity = 0.4;
  if (player.hp <= 0) setTimeout(showGameOver, 300);
}

// ── END SCREENS ──
function showGameOver() {
  if (!isMobile) controls.unlock();
  else { gameActive = false; gameActiveRef.value = false; }
  playDefeatMusic();
  if ($('go-acc'))   $('go-acc').textContent = stats.shots > 0 ? Math.round(stats.hits / stats.shots * 100) + '%' : '0%';
  if ($('go-kills')) $('go-kills').textContent = stats.kills;
  $('vignette').classList.add('hidden');
  showScreen($('go-screen'));
}

function showVictory() {
  if (!isMobile) controls.unlock();
  else { gameActive = false; gameActiveRef.value = false; }
  playVictoryMusic();
  if ($('win-acc'))   $('win-acc').textContent = stats.shots > 0 ? Math.round(stats.hits / stats.shots * 100) + '%' : '0%';
  if ($('win-kills')) $('win-kills').textContent = stats.kills;
  $('vignette').classList.add('hidden');
  showScreen($('win-screen'));
}

// ── HUD ──
function updateHealthHUD() {
  const p = player.hp;
  $('hp-bar').style.width = p + '%';
  $('hp-bar').style.background = p > 50 ? 'linear-gradient(90deg,#e74c3c,#e67e22)'
    : p > 25 ? 'linear-gradient(90deg,#cc6600,#ff9900)' : 'linear-gradient(90deg,#880000,#cc0000)';
  $('hp-val').textContent = p + ' HP';
}
function updateWeaponHUD() {
  const a = player.ammo[player.weapon];
  if ($('wpn-name')) $('wpn-name').textContent = WPN[player.weapon].name;
  if ($('h-cur'))    $('h-cur').textContent = a.cur;
  if ($('h-res'))    $('h-res').textContent = a.reserve;
}
function updateAccHUD() {
  const p = stats.shots > 0 ? Math.round(stats.hits / stats.shots * 100) : 0;
  if ($('h-acc'))   $('h-acc').textContent = p + '%';
  if ($('h-shots')) $('h-shots').textContent = stats.shots;
  if ($('h-hits'))  $('h-hits').textContent = stats.hits;
}
function updateKillHUD() {
  $('h-enemies').textContent = enemies.filter(e => e.alive).length;
}

// ── COLLISION ──
function resolveCollisions() {
  const pos = controls.object.position;
  player.onLadder = false;
  pos.x = THREE.MathUtils.clamp(pos.x, -39, 39);
  pos.z = THREE.MathUtils.clamp(pos.z, -39, 39);

  const pMin = new THREE.Vector3(pos.x - PLAYER_RADIUS, pos.y - PLAYER_HEIGHT, pos.z - PLAYER_RADIUS);
  const pMax = new THREE.Vector3(pos.x + PLAYER_RADIUS, pos.y + 0.1, pos.z + PLAYER_RADIUS);

  for (const mesh of collidables) {
    const box = mesh.userData.aabb;
    if (!box) continue;
    if (pMax.x < box.min.x || pMin.x > box.max.x) continue;
    if (pMax.y < box.min.y || pMin.y > box.max.y) continue;
    if (pMax.z < box.min.z || pMin.z > box.max.z) continue;

    if (mesh.userData.isLadder) { player.onLadder = true; continue; }

    const ox = Math.min(pMax.x, box.max.x) - Math.max(pMin.x, box.min.x);
    const oy = Math.min(pMax.y, box.max.y) - Math.max(pMin.y, box.min.y);
    const oz = Math.min(pMax.z, box.max.z) - Math.max(pMin.z, box.min.z);

    if (ox <= oz && ox <= oy) {
      pos.x += pos.x < (box.min.x + box.max.x) / 2 ? -ox : ox;
    } else if (oz <= ox && oz <= oy) {
      pos.z += pos.z < (box.min.z + box.max.z) / 2 ? -oz : oz;
    } else {
      if (pos.y > (box.min.y + box.max.y) / 2) {
        pos.y += oy; player.vel.y = 0; player.onGround = true;
      } else {
        pos.y -= oy; player.vel.y = 0;
      }
    }
  }
}

// ── ENEMY AI ──
const _dir = new THREE.Vector3();

function updateEnemies(dt) {
  const pPos = controls.object.position;
  for (const e of enemies) {
    if (!e.alive) continue;
    _dir.subVectors(pPos, e.group.position);
    _dir.y = 0;
    const dist = _dir.length();
    if (dist < ENEMY_SIGHT) {
      _dir.normalize();
      e.group.position.addScaledVector(_dir, ENEMY_SPEED * dt);
      e.group.lookAt(pPos.x, e.group.position.y, pPos.z);
      if (dist < ENEMY_ATK_RNG) {
        const eEye = new THREE.Vector3(e.group.position.x, 1.5, e.group.position.z);
        const pTarget = new THREE.Vector3(pPos.x, pPos.y, pPos.z);
        const rayDir = new THREE.Vector3().subVectors(pTarget, eEye);
        const trueDist = rayDir.length();
        rayDir.normalize();
        raycaster.set(eEye, rayDir);
        const solidWalls = collidables.filter(m => !m.userData.isLadder);
        const intersects = raycaster.intersectObjects(solidWalls);
        let hasLOS = true;
        if (intersects.length > 0 && intersects[0].distance < trueDist) hasLOS = false;

        if (hasLOS) {
          e.atkTimer -= dt;
          if (e.atkTimer <= 0) {
            e.atkTimer = ENEMY_ATK_RT;
            const isMoving = keys.w || keys.a || keys.s || keys.d;
            const hitChance = isMoving ? ENEMY_HIT_MOVING : ENEMY_HIT_STATIONARY;
            if (Math.random() < hitChance) damagePlayer(ENEMY_DMG);
          }
        } else {
          e.atkTimer = Math.max(e.atkTimer, 0.5);
        }
      }
    }
    // Wall collision
    const er = 0.42, ep = e.group.position;
    ep.x = THREE.MathUtils.clamp(ep.x, -38, 38);
    ep.z = THREE.MathUtils.clamp(ep.z, -38, 38);
    for (const mesh of collidables) {
      const b = mesh.userData.aabb;
      if (!b) continue;
      if (ep.x + er < b.min.x || ep.x - er > b.max.x) continue;
      if (ep.z + er < b.min.z || ep.z - er > b.max.z) continue;
      if (1.6 < b.min.y || 0 > b.max.y) continue;
      const ox2 = Math.min(ep.x + er, b.max.x) - Math.max(ep.x - er, b.min.x);
      const oz2 = Math.min(ep.z + er, b.max.z) - Math.max(ep.z - er, b.min.z);
      if (ox2 < oz2) ep.x += ep.x < (b.min.x + b.max.x) / 2 ? -ox2 : ox2;
      else ep.z += ep.z < (b.min.z + b.max.z) / 2 ? -oz2 : oz2;
    }
  }
}

// ── PLAYER UPDATE ──
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _mv = new THREE.Vector3();
const _UP = new THREE.Vector3(0, 1, 0);

function updatePlayer(dt) {
  if (!isMobile && !controls.isLocked) return;
  const obj = controls.object;

  // Mobile Look
  if (isMobile) {
    _rcEuler.setFromQuaternion(camera.quaternion, 'YXZ');
    _rcEuler.y -= mobileLookDelta.x;
    _rcEuler.x -= mobileLookDelta.y;
    _rcEuler.x = THREE.MathUtils.clamp(_rcEuler.x, -Math.PI / 2, Math.PI / 2);
    camera.quaternion.setFromEuler(_rcEuler);
    mobileLookDelta.x = 0;
    mobileLookDelta.y = 0;
  }

  camera.getWorldDirection(_fwd);
  _fwd.y = 0; _fwd.normalize();
  _rgt.crossVectors(_fwd, _UP).normalize();

  _mv.set(0, 0, 0);
  if (keys.w) _mv.addScaledVector(_fwd, 1);
  if (keys.s) _mv.addScaledVector(_fwd, -1);
  if (keys.a) _mv.addScaledVector(_rgt, -1);
  if (keys.d) _mv.addScaledVector(_rgt, 1);
  if (_mv.lengthSq() > 0) _mv.normalize();

  if (player.isSliding) {
    player.slideTimer -= dt;
    if (player.slideTimer <= 0 || !keys.crouch || !player.onGround) {
      player.isSliding = false;
    } else {
      _mv.copy(player.slideDir);
      const slideFactor = player.slideTimer / SLIDE_DUR;
      _mv.multiplyScalar(PLAYER_SPEED + (SLIDE_SPEED - PLAYER_SPEED) * slideFactor);
    }
  }
  if (!player.isSliding) {
    _mv.multiplyScalar(keys.crouch ? PLAYER_SPEED * 0.45 : PLAYER_SPEED);
  }

  // Footsteps
  if (player.onGround && !player.isSliding && _mv.lengthSq() > 0) {
    player.stepTimer -= dt;
    if (player.stepTimer <= 0) {
      sfxStep();
      player.stepTimer = keys.crouch ? 0.45 : 0.28;
    }
  } else {
    player.stepTimer = 0;
  }

  player.vel.x = _mv.x;
  player.vel.z = _mv.z;

  const targetHeight = keys.crouch ? CROUCH_HEIGHT : PLAYER_HEIGHT;
  const oldHeight = player.currentHeight;
  player.currentHeight += (targetHeight - player.currentHeight) * 12 * dt;
  obj.position.y += (player.currentHeight - oldHeight);

  if (player.onLadder) {
    player.vel.y = 0;
    if (keys.w) player.vel.y = 7;
    if (keys.s) player.vel.y = -7;
    player.onGround = true;
  } else {
    player.vel.y -= GRAVITY * dt;
    player.onGround = false;
  }

  obj.position.x += player.vel.x * dt;
  obj.position.y += player.vel.y * dt;
  obj.position.z += player.vel.z * dt;

  if (obj.position.y < player.currentHeight && !player.onLadder) {
    obj.position.y = player.currentHeight;
    player.vel.y = 0;
    player.onGround = true;
  }

  resolveCollisions();

  // Recoil
  {
    const isAutoFiring = player.mouseHeld && WPN[player.weapon].auto && !player.reloading;
    const decayRate = isAutoFiring ? 0.25 : 3.5;
    recoilTarget = Math.max(0, recoilTarget - decayRate * dt);
    const delta = recoilTarget - recoilApplied;
    if (Math.abs(delta) > 0.0002) {
      _rcEuler.setFromQuaternion(camera.quaternion, 'YXZ');
      _rcEuler.x += delta;
      _rcEuler.x = THREE.MathUtils.clamp(_rcEuler.x, -Math.PI / 2, Math.PI / 2);
      camera.quaternion.setFromEuler(_rcEuler);
      recoilApplied = recoilTarget;
    } else {
      recoilApplied = recoilTarget;
    }
  }

  // Weapon animation
  updateWeaponAnim(wpnMesh, player, keys, dt, player.weapon);

  // Timers
  if (player.fireTimer > 0) player.fireTimer -= dt;
  if (player.reloading) {
    player.reloadTimer -= dt;
    if (player.reloadTimer <= 0) finishReload();
  }

  // Auto-fire
  if (player.mouseHeld && WPN[player.weapon].auto && player.fireTimer <= 0 && !player.reloading) {
    player.fireTimer = 60 / WPN[player.weapon].rpm;
    tryShoot();
  }
}

// ── MAIN LOOP ──
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive) {
    updatePlayer(dt);
    updateEnemies(dt);

    // Pickup animations & collection
    updatePickups(dt);
    const pPos = controls.object.position;
    const pickup = checkPickup(pPos, player.hp, player.ammo);
    if (pickup === 'health' && player.hp < 100) {
      player.hp = Math.min(100, player.hp + 30);
      updateHealthHUD();
      hidePickup('health');
    } else if (pickup === 'ammo') {
      player.ammo.ak47.reserve += 30;
      player.ammo.pistol.reserve += 12;
      updateWeaponHUD();
      hidePickup('ammo');
    }
  }

  // Death animations
  for (let i = dyingEnemies.length - 1; i >= 0; i--) {
    if (animateDeath(dyingEnemies[i], dt, scene)) {
      dyingEnemies.splice(i, 1);
    }
  }

  // VFX
  if (vfx) vfx.update(dt);
  updateTracers(scene, dt);
  updateDust(dustPts, dt);

  // Damage flash decay
  if (dmgFlashIntensity > 0) {
    dmgFlashIntensity = Math.max(0, dmgFlashIntensity - dt * 3);
  }
  setDamageFlash(postfx.colorGrade, dmgFlashIntensity);
  setHealthEffect(postfx.colorGrade, player.hp);

  if (pentakillCooldown > 0) {
    if (!isAnnouncerActive()) {
      pentakillCooldown -= dt;
    }
  }

  // Render through post-processing
  postfx.composer.render();
}
