import { keys, player } from './input.js';

let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let lookActive = false;
let lastLookPos = { x: 0, y: 0 };

export const mobileLookDelta = { x: 0, y: 0 };
export const mobileFlags = { isMobile: true };
export const mobileCfg = { lookSpeed: 0.005 };

let onShoot = null;
let onReload = null;
let onJump = null;
let onCrouch = null;
let onWeaponSwitch = null;
let onPause = null;

export function initMobileInputs(callbacks) {
  onShoot = callbacks.shoot;
  onReload = callbacks.reload;
  onJump = callbacks.jump;
  onCrouch = callbacks.crouch || null;
  onWeaponSwitch = callbacks.weaponSwitch || null;
  onPause = callbacks.pause || null;

  const joyZone = document.getElementById('joystick-zone');
  const stick = document.getElementById('joystick-stick');
  const lookZone = document.getElementById('touch-look-zone');

  // Joystick
  joyZone.addEventListener('touchstart', e => {
    joystickActive = true;
    const touch = e.touches[0];
    joystickStart = { x: touch.clientX, y: touch.clientY };
  }, { passive: false });

  joyZone.addEventListener('touchmove', e => {
    if (!joystickActive) return;
    const touch = e.touches[0];
    const dx = touch.clientX - joystickStart.x;
    const dy = touch.clientY - joystickStart.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = 50;
    
    const limitedDist = Math.min(dist, maxDist);
    const angle = Math.atan2(dy, dx);
    const moveX = Math.cos(angle) * limitedDist;
    const moveY = Math.sin(angle) * limitedDist;

    stick.style.transform = `translate(${moveX}px, ${moveY}px)`;

    // Map to keys
    keys.w = dy < -20;
    keys.s = dy > 20;
    keys.a = dx < -20;
    keys.d = dx > 20;
  }, { passive: false });

  joyZone.addEventListener('touchend', () => {
    joystickActive = false;
    stick.style.transform = `translate(0,0)`;
    keys.w = keys.s = keys.a = keys.d = false;
  });

  let lookTouchId = null;

  lookZone.addEventListener('touchstart', e => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (!lookActive) {
        const t = e.changedTouches[i];
        lookActive = true;
        lookTouchId = t.identifier;
        lastLookPos = { x: t.clientX, y: t.clientY };
        break;
      }
    }
  }, { passive: false });

  lookZone.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!lookActive) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchId) {
        const dx = t.clientX - lastLookPos.x;
        const dy = t.clientY - lastLookPos.y;
        
        mobileLookDelta.x += dx * mobileCfg.lookSpeed;
        mobileLookDelta.y += dy * mobileCfg.lookSpeed;
        
        lastLookPos = { x: t.clientX, y: t.clientY };
        break;
      }
    }
  }, { passive: false });

  lookZone.addEventListener('touchend', e => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchId) {
        lookActive = false;
        lookTouchId = null;
        break;
      }
    }
  });

  // ── Action Buttons ──

  // Fire (hold for auto-fire)
  document.getElementById('btn-fire').addEventListener('touchstart', (e) => {
    e.preventDefault();
    player.mouseHeld = true;
    if (onShoot) onShoot();
  });
  document.getElementById('btn-fire').addEventListener('touchend', () => {
    player.mouseHeld = false;
  });

  // Jump
  document.getElementById('btn-jump').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (onJump) onJump();
  });

  // Reload
  document.getElementById('btn-reload-m').addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (onReload) onReload();
  });

  // Crouch (toggle)
  const crouchBtn = document.getElementById('btn-crouch');
  if (crouchBtn) {
    crouchBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onCrouch) onCrouch();
    });
  }

  // Weapon Switch
  const wpnBtn = document.getElementById('btn-wpn-switch');
  if (wpnBtn) {
    wpnBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onWeaponSwitch) onWeaponSwitch();
    });
  }

  // Pause
  const pauseBtn = document.getElementById('btn-pause-m');
  if (pauseBtn) {
    pauseBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (onPause) onPause();
    });
  }
}
