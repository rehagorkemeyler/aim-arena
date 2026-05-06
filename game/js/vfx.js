// ─────────────────────────────────────────────────────────────
// VFX ENGINE — Muzzle flash, shell casings, blood, impacts
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// ── Sprite texture generators ──
function makeMuzzleFlashTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.2, 'rgba(255,200,80,0.9)');
  g.addColorStop(0.5, 'rgba(255,120,20,0.5)');
  g.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function makeSmokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(180,170,150,0.4)');
  g.addColorStop(1, 'rgba(150,140,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function makeBloodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 14);
  g.addColorStop(0, 'rgba(180,20,20,0.9)');
  g.addColorStop(0.6, 'rgba(120,10,10,0.5)');
  g.addColorStop(1, 'rgba(80,5,5,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

function makeDustTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 14);
  g.addColorStop(0, 'rgba(200,180,140,0.5)');
  g.addColorStop(1, 'rgba(180,160,120,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}

// Shared textures (lazy init)
let _flashTex, _smokeTex, _bloodTex, _dustTex;
function getTextures() {
  if (!_flashTex) {
    _flashTex = makeMuzzleFlashTexture();
    _smokeTex = makeSmokeTexture();
    _bloodTex = makeBloodTexture();
    _dustTex = makeDustTexture();
  }
  return { flash: _flashTex, smoke: _smokeTex, blood: _bloodTex, dust: _dustTex };
}

// ── Particle Pool ──
class ParticlePool {
  constructor(scene, texture, maxCount, blending = THREE.AdditiveBlending) {
    this.scene = scene;
    this.particles = [];
    this.mat = new THREE.SpriteMaterial({
      map: texture, transparent: true, blending, depthWrite: false
    });
    this.maxCount = maxCount;
  }

  spawn(pos, vel, scale, life, color = null) {
    let p;
    // Reuse dead particle
    p = this.particles.find(p => p.life <= 0);
    if (!p && this.particles.length < this.maxCount) {
      const sprite = new THREE.Sprite(this.mat.clone());
      this.scene.add(sprite);
      p = { sprite, vel: new THREE.Vector3(), life: 0, maxLife: 1, scale: 1 };
      this.particles.push(p);
    }
    if (!p) return;

    p.sprite.position.copy(pos);
    p.vel.copy(vel);
    p.scale = scale;
    p.life = life;
    p.maxLife = life;
    p.sprite.scale.set(scale, scale, 1);
    p.sprite.visible = true;
    if (color) p.sprite.material.color.set(color);
  }

  update(dt) {
    for (const p of this.particles) {
      if (p.life <= 0) { p.sprite.visible = false; continue; }
      p.life -= dt;
      const t = Math.max(0, p.life / p.maxLife);
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.y -= 3 * dt; // gravity on particles
      p.sprite.material.opacity = t;
      const s = p.scale * (0.5 + t * 0.5);
      p.sprite.scale.set(s, s, 1);
    }
  }

  dispose() {
    this.particles.forEach(p => {
      this.scene.remove(p.sprite);
      p.sprite.material.dispose();
    });
    this.particles = [];
  }
}

// ── Shell Casing Pool (InstancedMesh) ──
class ShellPool {
  constructor(scene, maxCount = 20) {
    this.scene = scene;
    const geo = new THREE.CylinderGeometry(0.006, 0.006, 0.025, 6);
    const mat = new THREE.MeshStandardMaterial({ color: 0xD4A840, metalness: 0.9, roughness: 0.3 });
    this.mesh = new THREE.InstancedMesh(geo, mat, maxCount);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.shells = [];
    this.maxCount = maxCount;
    this._dummy = new THREE.Object3D();
    this._clearAll();
  }

  _clearAll() {
    this.shells = [];
    this._dummy.scale.set(0, 0, 0);
    this._dummy.updateMatrix();
    for (let i = 0; i < this.maxCount; i++) {
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  eject(pos, dir) {
    // Find available slot
    let idx = this.shells.findIndex(s => s.life <= 0);
    if (idx === -1 && this.shells.length < this.maxCount) {
      idx = this.shells.length;
      this.shells.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: 0, life: 0 });
    }
    if (idx === -1) idx = 0; // recycle oldest

    const s = this.shells[idx];
    s.pos.copy(pos);
    // Eject to the right and slightly up
    const right = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
    s.vel.set(
      right.x * 3 + (Math.random() - 0.5) * 1,
      2 + Math.random() * 2,
      right.z * 3 + (Math.random() - 0.5) * 1
    );
    s.rot = Math.random() * Math.PI * 2;
    s.life = 3.0;
  }

  update(dt) {
    for (let i = 0; i < this.shells.length; i++) {
      const s = this.shells[i];
      if (s.life <= 0) {
        this._dummy.scale.set(0, 0, 0);
        this._dummy.updateMatrix();
        this.mesh.setMatrixAt(i, this._dummy.matrix);
        continue;
      }
      s.life -= dt;
      s.vel.y -= 15 * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.rot += dt * 15;

      // Floor bounce
      if (s.pos.y < 0.01) {
        s.pos.y = 0.01;
        s.vel.y *= -0.3;
        s.vel.x *= 0.5;
        s.vel.z *= 0.5;
      }

      this._dummy.position.copy(s.pos);
      this._dummy.rotation.set(s.rot, s.rot * 0.7, 0);
      this._dummy.scale.set(1, 1, 1);
      this._dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this._dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}

// ── Muzzle Flash Light ──
class FlashLight {
  constructor(scene) {
    this.light = new THREE.PointLight(0xFFAA44, 0, 8);
    scene.add(this.light);
    this.timer = 0;
  }
  flash(pos) {
    this.light.position.copy(pos);
    this.light.intensity = 4;
    this.timer = 0.05;
  }
  update(dt) {
    if (this.timer > 0) {
      this.timer -= dt;
      this.light.intensity = Math.max(0, this.timer / 0.05 * 4);
    }
  }
}

// ── Blood Pool Decals ──
const bloodPools = [];

export function spawnBloodPool(scene, x, z) {
  const geo = new THREE.CircleGeometry(0.5 + Math.random() * 0.5, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x6B0000, roughness: 0.95, transparent: true, opacity: 0.85
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, 0.015, z);
  scene.add(mesh);
  bloodPools.push(mesh);
}

export function clearBloodPools(scene) {
  bloodPools.forEach(b => { scene.remove(b); b.geometry.dispose(); b.material.dispose(); });
  bloodPools.length = 0;
}

// ── Tracer Rounds ──
const tracers = [];

export function spawnTracer(scene, from, to) {
  const dir = new THREE.Vector3().subVectors(to, from);
  const len = Math.max(0.1, dir.length());
  dir.normalize();
  const geo = new THREE.BoxGeometry(0.012, 0.012, len);
  const mat = new THREE.MeshBasicMaterial({ color: 0xFFEE44, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(from).addScaledVector(dir, len / 2);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
  scene.add(mesh);
  tracers.push({ mesh, life: 0.1, maxLife: 0.1 });
}

export function updateTracers(scene, dt) {
  for (let i = tracers.length - 1; i >= 0; i--) {
    const t = tracers[i];
    t.life -= dt;
    const s = Math.max(0, t.life / t.maxLife);
    t.mesh.scale.set(s, s, 1);
    t.mesh.material.opacity = s;
    if (t.life <= 0) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      tracers.splice(i, 1);
    }
  }
}

export function clearTracers(scene) {
  tracers.forEach(t => { scene.remove(t.mesh); t.mesh.geometry.dispose(); t.mesh.material.dispose(); });
  tracers.length = 0;
}

// ── Hitmarker UI ──
let _hmTimer = 0;
export function showHitmarker(isHeadshot) {
  const el = document.getElementById('hitmarker');
  if (!el) return;
  el.classList.add('show');
  if (isHeadshot) el.classList.add('headshot');
  else el.classList.remove('headshot');
  _hmTimer = 0.3;
}

export function updateHitmarker(dt) {
  if (_hmTimer > 0) {
    _hmTimer -= dt;
    if (_hmTimer <= 0) {
      const el = document.getElementById('hitmarker');
      if (el) el.classList.remove('show', 'headshot');
    }
  }
}

// ── Kill Feed ──
export function addKillFeedEntry(weaponName, isHeadshot) {
  const feed = document.getElementById('kill-feed');
  if (!feed) return;
  const entry = document.createElement('div');
  entry.className = 'kf-entry';
  const hs = isHeadshot ? ' <span class="kf-hs">★ HEADSHOT</span>' : '';
  entry.innerHTML = `YOU <span class="kf-wpn">[${weaponName}]</span> → HOSTILE${hs}`;
  feed.appendChild(entry);
  // Remove after 4s
  setTimeout(() => { entry.style.opacity = '0'; setTimeout(() => entry.remove(), 300); }, 4000);
  // Cap entries
  while (feed.children.length > 5) feed.removeChild(feed.firstChild);
}

// ── Main VFX System ──
export class VFXSystem {
  constructor(scene) {
    this.scene = scene;
    const tex = getTextures();
    this.flashPool = new ParticlePool(scene, tex.flash, 10, THREE.AdditiveBlending);
    this.smokePool = new ParticlePool(scene, tex.smoke, 30, THREE.NormalBlending);
    this.bloodPool = new ParticlePool(scene, tex.blood, 40, THREE.NormalBlending);
    this.dustPool = new ParticlePool(scene, tex.dust, 30, THREE.NormalBlending);
    this.shellPool = new ShellPool(scene, 20);
    this.flashLight = new FlashLight(scene);
  }

  muzzleFlash(pos, dir) {
    // Flash sprite
    this.flashPool.spawn(
      pos, new THREE.Vector3(0, 0, 0), 0.25 + Math.random() * 0.1, 0.06
    );
    // Flash light
    this.flashLight.flash(pos);
    // Smoke wisps
    for (let i = 0; i < 2; i++) {
      this.smokePool.spawn(
        pos.clone().add(new THREE.Vector3((Math.random()-.5)*.05, .02, (Math.random()-.5)*.05)),
        new THREE.Vector3((Math.random()-.5)*.3, 0.5 + Math.random()*.3, (Math.random()-.5)*.3),
        0.08 + Math.random() * 0.05, 0.4 + Math.random() * 0.3
      );
    }
  }

  shellEject(pos, dir) {
    this.shellPool.eject(pos, dir);
  }

  bloodHit(pos, isHeadshot) {
    const count = isHeadshot ? 14 : 8;
    const speed = isHeadshot ? 4 : 2.5;
    for (let i = 0; i < count; i++) {
      this.bloodPool.spawn(
        pos.clone(),
        new THREE.Vector3(
          (Math.random()-.5) * speed,
          Math.random() * speed * 0.6,
          (Math.random()-.5) * speed
        ),
        0.06 + Math.random() * 0.06,
        0.3 + Math.random() * 0.3
      );
    }
  }

  dustImpact(pos) {
    for (let i = 0; i < 5; i++) {
      this.dustPool.spawn(
        pos.clone(),
        new THREE.Vector3(
          (Math.random()-.5) * 2,
          Math.random() * 1.5,
          (Math.random()-.5) * 2
        ),
        0.12 + Math.random() * 0.08,
        0.4 + Math.random() * 0.3
      );
    }
  }

  update(dt) {
    this.flashPool.update(dt);
    this.smokePool.update(dt);
    this.bloodPool.update(dt);
    this.dustPool.update(dt);
    this.shellPool.update(dt);
    this.flashLight.update(dt);
    updateHitmarker(dt);
  }

  dispose() {
    this.flashPool.dispose();
    this.smokePool.dispose();
    this.bloodPool.dispose();
    this.dustPool.dispose();
    this.shellPool.dispose();
  }
}

// ── Kill Streak Banner ──
const bannerQueue = [];
let bannerActive = false;

export function showStreakBanner(level) {
  if (level <= 1) return; // Only show banner for Double Kill and above
  bannerQueue.push(level);
  processBannerQueue();
}

function processBannerQueue() {
  if (bannerActive || bannerQueue.length === 0) return;
  bannerActive = true;
  const level = bannerQueue.shift();
  
  const container = document.getElementById('kill-streak-container');
  const title = document.getElementById('kill-streak-text');
  const sub = document.getElementById('kill-streak-sub');
  if (!container || !title || !sub) {
    bannerActive = false;
    return;
  }
  
  const texts = ["", "KILL", "DOUBLE KILL", "TRIPLE KILL", "QUADRUPLE KILL", "PENTAKILL"];
  title.textContent = texts[level] || texts[5];
  sub.textContent = level > 1 ? `STREAK +${level}` : 'FIRST BLOOD';
  
  container.className = ''; 
  void container.offsetWidth; 
  
  const capLevel = level > 5 ? 5 : level;
  container.classList.add(`streak-${capLevel}`, 'streak-active', 'streak-pop');
  if (level >= 5) container.classList.add('streak-shake');

  setTimeout(() => {
    container.classList.remove('streak-active', 'streak-pop', 'streak-shake');
    setTimeout(() => {
      bannerActive = false;
      processBannerQueue();
    }, 300); // Wait for CSS transition
  }, 2000); // Display time
}
