// ─────────────────────────────────────────────────────────────
// INPUT — Keyboard/mouse listeners and state
// ─────────────────────────────────────────────────────────────

export const keys = { w: false, a: false, s: false, d: false, crouch: false };

export const player = {
  hp: 0, vel: null, // Vector3, set in engine init
  onGround: true, onLadder: false,
  weapon: 'ak47',
  ammo: { ak47: { cur: 30, reserve: 90 }, pistol: { cur: 12, reserve: 60 } },
  reloading: false, reloadTimer: 0,
  fireTimer: 0, mouseHeld: false, canFire: true,
  isCrouching: false, isSliding: false, slideTimer: 0,
  slideDir: null, // Vector3, set in engine init
  currentHeight: 1.75, stepTimer: 0
};

export const stats = { shots: 0, hits: 0, kills: 0 };
export const cfg = { sensitivity: 1.0 };

export const PLAYER_SPEED = 12;
export const PLAYER_HEIGHT = 1.75;
export const CROUCH_HEIGHT = 0.8;
export const SLIDE_SPEED = 24;
export const SLIDE_DUR = 0.65;
export const JUMP_VEL = 8.5;
export const GRAVITY = 22;
export const PLAYER_RADIUS = 0.4;
export const ENEMY_TOTAL = 20;
export const ENEMY_SPEED = 2.4;
export const ENEMY_SIGHT = 40;
export const ENEMY_ATK_RNG = 20;
export const ENEMY_ATK_RT = 2.8;
export const ENEMY_DMG = 9;
export const ENEMY_HIT_MOVING = 0.15;
export const ENEMY_HIT_STATIONARY = 0.85;
export const BODY_DMG = 34;
export const HEAD_DMG = 100;

export const WPN = {
  ak47:   { name: 'AK-47',  mag: 30, reserve: 90,  auto: true,  rpm: 600, reloadSec: 2.4 },
  pistol: { name: 'Deagle', mag: 12, reserve: 60,  auto: false, rpm: 280, reloadSec: 1.6 },
};

// Callbacks set by engine
let onShoot = null;
let onReload = null;
let onWeaponSwitch = null;
let onJump = null;
let isGameActive = () => false;

export function setInputCallbacks({ shoot, reload, weaponSwitch, jump, gameActive }) {
  onShoot = shoot;
  onReload = reload;
  onWeaponSwitch = weaponSwitch;
  onJump = jump;
  isGameActive = gameActive;
}

export function initInputListeners() {
  document.addEventListener('keydown', e => {
    if (!isGameActive()) return;
    switch (e.code) {
      case 'KeyW': keys.w = true; break;
      case 'KeyA': keys.a = true; break;
      case 'KeyS': keys.s = true; break;
      case 'KeyD': keys.d = true; break;
      case 'KeyC':
      case 'ControlLeft':
        if (!keys.crouch) {
          keys.crouch = true;
          player.isCrouching = true;
          if (player.onGround && (keys.w || keys.a || keys.s || keys.d)) {
            player.isSliding = true;
            player.slideTimer = SLIDE_DUR;
            if (player.slideDir) {
              player.slideDir.set(player.vel.x, 0, player.vel.z);
              if (player.slideDir.lengthSq() > 0) player.slideDir.normalize();
            }
          }
        }
        break;
      case 'Space':
        e.preventDefault();
        if (onJump) onJump();
        break;
      case 'KeyR':
        if (onReload) onReload();
        break;
      case 'Digit1':
        if (onWeaponSwitch) onWeaponSwitch('ak47');
        break;
      case 'Digit2':
        if (onWeaponSwitch) onWeaponSwitch('pistol');
        break;
    }
  });

  document.addEventListener('keyup', e => {
    switch (e.code) {
      case 'KeyW': keys.w = false; break;
      case 'KeyA': keys.a = false; break;
      case 'KeyS': keys.s = false; break;
      case 'KeyD': keys.d = false; break;
      case 'KeyC':
      case 'ControlLeft':
        keys.crouch = false;
        player.isCrouching = false;
        break;
    }
  });

  document.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    player.mouseHeld = true;
    if (!isGameActive()) return;
    if (!WPN[player.weapon].auto && player.canFire && player.fireTimer <= 0) {
      player.canFire = false;
      player.fireTimer = 60 / WPN[player.weapon].rpm;
      if (onShoot) onShoot();
    }
  });

  document.addEventListener('mouseup', e => {
    if (e.button !== 0) return;
    player.mouseHeld = false;
    player.canFire = true;
  });
}
