// ─────────────────────────────────────────────────────────────
// AUDIO ENGINE
// ─────────────────────────────────────────────────────────────
const actx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};
const SOUND_URLS = {
  ak47:   "https://raw.githubusercontent.com/sourcesounds/csgo/master/sound/weapons/ak47/ak47-1.wav",
  pistol: "https://raw.githubusercontent.com/sourcesounds/csgo/master/sound/weapons/deagle/deagle-1.wav",
  step:   "https://raw.githubusercontent.com/sourcesounds/csgo/master/sound/player/footsteps/concrete1.wav",
  death:  "https://raw.githubusercontent.com/sourcesounds/csgo/master/sound/player/headshot1.wav",
  hit:    "https://raw.githubusercontent.com/sourcesounds/csgo/master/sound/player/bhit_helmet-1.wav",
  pain:   "https://raw.githubusercontent.com/sourcesounds/csgo/master/sound/player/damage1.wav"
};

Object.keys(SOUND_URLS).forEach(async k => {
  try {
    const res = await fetch(SOUND_URLS[k]);
    const buf = await res.arrayBuffer();
    audioBuffers[k] = await actx.decodeAudioData(buf);
  } catch (e) { console.error("Failed to load sound:", k); }
});

export let gameActiveRef = { value: false };

function playSound(name, vol = 1.0) {
  if (!audioBuffers[name] || !gameActiveRef.value) return;
  const src = actx.createBufferSource();
  src.buffer = audioBuffers[name];
  const gain = actx.createGain();
  gain.gain.value = vol;
  src.connect(gain);
  gain.connect(actx.destination);
  src.start(0);
}

export const sfxAK     = () => playSound('ak47', 0.02);
export const sfxPistol = () => playSound('pistol', 0.024);
export const sfxStep   = () => playSound('step', 0.02);
export const sfxDeath  = () => playSound('death', 0.04);
export const sfxHit    = () => playSound('hit', 0.04);
export const sfxPain   = () => playSound('pain', 0.12);

export const bgmMenu = new Audio('sounds/menu.mp4');
bgmMenu.loop = true; bgmMenu.volume = 0.5;
export const bgmCombat = new Audio('sounds/combat.mp4');
bgmCombat.loop = true; bgmCombat.volume = 0.2;
export const bgmVictory = new Audio('sounds/victory.mp4');
bgmVictory.volume = 0.6;
export const bgmDefeat = new Audio('sounds/defeat.mp4');
bgmDefeat.volume = 0.6;

export function playMenuMusic() {
  bgmCombat.pause(); bgmVictory.pause(); bgmDefeat.pause();
  bgmVictory.currentTime = 0; bgmDefeat.currentTime = 0;
  bgmMenu.play().catch(() => {});
}
export function playCombatMusic() {
  bgmMenu.pause(); bgmVictory.pause(); bgmDefeat.pause();
  bgmCombat.play().catch(() => {});
}
export function playVictoryMusic() {
  bgmCombat.pause(); bgmMenu.pause();
  bgmVictory.play().catch(() => {});
}
export function playDefeatMusic() {
  bgmCombat.pause(); bgmMenu.pause();
  bgmDefeat.play().catch(() => {});
}
export function pauseCombatMusic() { bgmCombat.pause(); }

const reloadSfx = new Audio('sounds/misc/reloading.mp3');
export function playReloadVoice() {
  reloadSfx.currentTime = 0;
  reloadSfx.volume = 0.8;
  reloadSfx.play().catch(()=>{});
}

// ── Kill Streak Audio ──
// We pitch-shift the Ace sound (5.mp3) to perfectly recreate the ascending scale.
const chimeRatios = [0.56, 0.66, 0.74, 0.84, 1.0];

const announcers = [
  null,
  new Audio('sounds/announcer/1.mp3'),
  new Audio('sounds/announcer/2.mp3'),
  new Audio('sounds/announcer/3.mp3'),
  new Audio('sounds/announcer/4.mp3'),
  new Audio('sounds/announcer/5.mp3')
];

const voiceQueue = [];
let voiceActive = false;

export function playStreakAnnouncer(level) {
  const capLevel = Math.min(level, 5);
  
  // Play Reaver chime (overlapping, pitch-shifted)
  const a = new Audio('sounds/chimes/5.mp3');
  a.preservesPitch = false;
  a.playbackRate = chimeRatios[capLevel - 1] || 1.0;
  a.volume = 0.4;
  a.play().catch(()=>{});

  if (capLevel <= 1) return; // Only announce Double Kill and above

  voiceQueue.push(capLevel);
  processVoiceQueue();
}

function processVoiceQueue() {
  if (voiceActive || voiceQueue.length === 0) return;
  voiceActive = true;
  const level = voiceQueue.shift();
  
  const ann = announcers[level];
  if (ann) {
    ann.currentTime = 0;
    ann.volume = 0.54; // Reduced by 40% from 0.9
    ann.play().catch(()=>{});
    ann.onended = () => {
      voiceActive = false;
      processVoiceQueue();
    };
  } else {
    voiceActive = false;
    processVoiceQueue();
  }
}

export function isAnnouncerActive() {
  return voiceActive || voiceQueue.length > 0;
}
