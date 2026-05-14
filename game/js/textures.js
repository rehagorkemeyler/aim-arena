// ─────────────────────────────────────────────────────────────
// PROCEDURAL PBR TEXTURE GENERATOR
// Generates albedo, normal, and roughness maps via Canvas2D
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// Simple value noise
function hash(x, y) {
  let n = x * 127.1 + y * 311.7;
  n = Math.sin(n) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy);
  const c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fbm(x, y, octaves = 4) {
  let v = 0, amp = 0.5, freq = 1;
  for (let i = 0; i < octaves; i++) {
    v += amp * smoothNoise(x * freq, y * freq);
    amp *= 0.5; freq *= 2;
  }
  return v;
}

// Heightmap to normal map
function heightToNormal(ctx, w, h, strength = 2.0) {
  const src = ctx.getImageData(0, 0, w, h);
  const nCtx = document.createElement('canvas').getContext('2d');
  nCtx.canvas.width = w; nCtx.canvas.height = h;
  const dst = nCtx.createImageData(w, h);
  const getH = (px, py) => {
    const i = (Math.min(h-1,Math.max(0,py)) * w + Math.min(w-1,Math.max(0,px))) * 4;
    return (src.data[i] + src.data[i+1] + src.data[i+2]) / (3 * 255);
  };
  for (let y2 = 0; y2 < h; y2++) {
    for (let x2 = 0; x2 < w; x2++) {
      const dx = (getH(x2+1,y2) - getH(x2-1,y2)) * strength;
      const dy = (getH(x2,y2+1) - getH(x2,y2-1)) * strength;
      const i = (y2 * w + x2) * 4;
      dst.data[i]   = ((-dx * 0.5 + 0.5) * 255) | 0;
      dst.data[i+1] = ((-dy * 0.5 + 0.5) * 255) | 0;
      dst.data[i+2] = 255;
      dst.data[i+3] = 255;
    }
  }
  nCtx.putImageData(dst, 0, 0);
  return nCtx.canvas;
}

function canvasToTexture(canvas, repeat = [1,1]) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── SAND TEXTURE ──
export function makeSandTextures(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 64, y / 64, 5);
      const grain = Math.random() * 0.06 - 0.03;
      const v = 0.55 + n * 0.35 + grain;
      const r = Math.min(255, (v * 220 + 30) | 0);
      const g = Math.min(255, (v * 190 + 20) | 0);
      const b = Math.min(255, (v * 130 + 10) | 0);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Scatter some pebbles
  for (let i = 0; i < 80; i++) {
    const px = Math.random() * size, py = Math.random() * size;
    const pr = 1.5 + Math.random() * 2.5;
    const shade = 100 + Math.random() * 60 | 0;
    ctx.fillStyle = `rgb(${shade},${shade-10},${shade-30})`;
    ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
  }

  const normalCanvas = heightToNormal(ctx, size, size, 3.0);
  // Roughness: sand is very rough
  const rc = document.createElement('canvas');
  rc.width = rc.height = size;
  const rctx = rc.getContext('2d');
  rctx.fillStyle = '#ccc'; rctx.fillRect(0, 0, size, size);
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const v = 180 + Math.random() * 50 | 0;
      rctx.fillStyle = `rgb(${v},${v},${v})`;
      rctx.fillRect(x, y, 2, 2);
    }
  }

  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(normalCanvas),
    roughness: canvasToTexture(rc)
  };
}

// ── BRICK TEXTURE ──
export function makeBrickTextures(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Mortar base
  ctx.fillStyle = '#8a8070'; ctx.fillRect(0, 0, size, size);

  const bw = size / 8, bh = size / 16;
  const mortarW = 4;
  for (let row = 0; row < 16; row++) {
    const offset = (row % 2) * bw * 0.5;
    for (let col = -1; col < 9; col++) {
      const bx = col * bw + offset + mortarW / 2;
      const by = row * bh + mortarW / 2;
      const w = bw - mortarW, h = bh - mortarW;
      // Per-brick color variation
      const baseR = 160 + Math.random() * 50 | 0;
      const baseG = 70 + Math.random() * 30 | 0;
      const baseB = 50 + Math.random() * 25 | 0;
      ctx.fillStyle = `rgb(${baseR},${baseG},${baseB})`;
      ctx.fillRect(bx, by, w, h);
      // Subtle noise on each brick
      for (let py = by; py < by + h; py += 3) {
        for (let px = bx; px < bx + w; px += 3) {
          const nv = Math.random() * 30 - 15 | 0;
          ctx.fillStyle = `rgba(${nv > 0 ? 255 : 0},${nv > 0 ? 255 : 0},${nv > 0 ? 255 : 0},${Math.abs(nv) / 255})`;
          ctx.fillRect(px, py, 3, 3);
        }
      }
      // Edge darkening
      ctx.strokeStyle = 'rgba(0,0,0,.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 1, by + 1, w - 2, h - 2);
    }
  }

  const normalCanvas = heightToNormal(ctx, size, size, 4.0);
  const rc = document.createElement('canvas');
  rc.width = rc.height = size;
  const rctx = rc.getContext('2d');
  rctx.fillStyle = '#b0b0b0'; rctx.fillRect(0, 0, size, size);

  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(normalCanvas),
    roughness: canvasToTexture(rc)
  };
}

// ── CONCRETE TEXTURE ──
export function makeConcreteTextures(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 50, y / 50, 4);
      const v = 0.65 + n * 0.25;
      const g = Math.min(255, (v * 240 + 30) | 0);
      ctx.fillStyle = `rgb(${Math.min(255,g+8)},${Math.min(255,g+4)},${g})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // Cracks
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    let cx = Math.random() * size, cy = Math.random() * size;
    ctx.moveTo(cx, cy);
    for (let j = 0; j < 8; j++) {
      cx += Math.random() * 40 - 20;
      cy += Math.random() * 40 - 5;
      ctx.lineTo(cx, cy);
    }
    ctx.strokeStyle = 'rgba(40,35,30,.3)';
    ctx.lineWidth = 1 + Math.random();
    ctx.stroke();
  }

  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(heightToNormal(ctx, size, size, 2.5)),
    roughness: canvasToTexture((() => {
      const rc = document.createElement('canvas');
      rc.width = rc.height = size;
      rc.getContext('2d').fillStyle = '#999';
      rc.getContext('2d').fillRect(0, 0, size, size);
      return rc;
    })())
  };
}

// ── METAL TEXTURE ──
export function makeMetalTextures(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Brushed steel look — horizontal streaks
  for (let y = 0; y < size; y++) {
    const baseV = 140 + fbm(0.1, y / 30, 3) * 50;
    for (let x = 0; x < size; x++) {
      const streak = Math.random() * 14 - 7;
      const v = Math.min(255, (baseV + streak) | 0);
      ctx.fillStyle = `rgb(${Math.min(255,v+12)},${Math.min(255,v+10)},${Math.min(255,v+6)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(heightToNormal(ctx, size, size, 1.5)),
    roughness: canvasToTexture((() => {
      const rc = document.createElement('canvas');
      rc.width = rc.height = size;
      rc.getContext('2d').fillStyle = '#555';
      rc.getContext('2d').fillRect(0, 0, size, size);
      return rc;
    })()),
    metalness: 0.85,
    roughnessVal: 0.35
  };
}

// ── WOOD TEXTURE ──
export function makeWoodTextures(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const grain = fbm(x / 10, y / 120, 4);
      const ring = Math.sin(grain * 20 + y / 25) * 0.5 + 0.5;
      const v = 0.3 + ring * 0.35 + Math.random() * 0.03;
      const r = (v * 160 + 40) | 0;
      const g = (v * 110 + 20) | 0;
      const b = (v * 60 + 10) | 0;
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(heightToNormal(ctx, size, size, 2.0)),
    roughness: canvasToTexture((() => {
      const rc = document.createElement('canvas');
      rc.width = rc.height = size;
      rc.getContext('2d').fillStyle = '#aaa';
      rc.getContext('2d').fillRect(0, 0, size, size);
      return rc;
    })())
  };
}

// ── CAMO TEXTURE ──
export function makeCamoTextures(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Base olive
  ctx.fillStyle = '#5a6332'; ctx.fillRect(0, 0, size, size);
  const colors = ['#3d4a2a', '#6b5c3e', '#7a7a50', '#4a5530', '#2e3320'];
  for (let i = 0; i < 35; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    const cx = Math.random() * size, cy = Math.random() * size;
    // Irregular blob
    ctx.moveTo(cx, cy);
    for (let a = 0; a < Math.PI * 2; a += 0.3) {
      const r = 15 + Math.random() * 25;
      ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  }

  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(heightToNormal(ctx, size, size, 0.5)),
    roughness: canvasToTexture((() => {
      const rc = document.createElement('canvas');
      rc.width = rc.height = size;
      rc.getContext('2d').fillStyle = '#bbb';
      rc.getContext('2d').fillRect(0, 0, size, size);
      return rc;
    })())
  };
}

// ── MATERIAL BUILDERS ──
export function makePBR(textures, opts = {}) {
  return new THREE.MeshStandardMaterial({
    map: textures.albedo,
    normalMap: textures.normal || null,
    roughnessMap: textures.roughness || null,
    roughness: opts.roughness ?? 0.8,
    metalness: opts.metalness ?? 0.0,
    ...opts
  });
}

// ── COBBLESTONE TEXTURE (for Inferno) ──
export function makeCobblestoneTextures(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Mortar base
  ctx.fillStyle = '#706858'; ctx.fillRect(0, 0, size, size);
  // Irregular cobblestones
  const stoneColors = ['#9a9080','#8a8070','#7a7060','#a09888','#b0a898'];
  for (let row = 0; row < 12; row++) {
    const offset = (row % 2) * (size / 8);
    let cx2 = offset;
    while (cx2 < size + 20) {
      const sw = 30 + Math.random() * 40;
      const sh = size / 12 - 6;
      const sy = row * (size / 12) + 3;
      ctx.fillStyle = stoneColors[(row * 7 + Math.floor(cx2)) % stoneColors.length];
      // Rounded rect
      const rr = 4 + Math.random() * 3;
      ctx.beginPath();
      ctx.moveTo(cx2 + rr, sy);
      ctx.lineTo(cx2 + sw - rr, sy);
      ctx.quadraticCurveTo(cx2 + sw, sy, cx2 + sw, sy + rr);
      ctx.lineTo(cx2 + sw, sy + sh - rr);
      ctx.quadraticCurveTo(cx2 + sw, sy + sh, cx2 + sw - rr, sy + sh);
      ctx.lineTo(cx2 + rr, sy + sh);
      ctx.quadraticCurveTo(cx2, sy + sh, cx2, sy + sh - rr);
      ctx.lineTo(cx2, sy + rr);
      ctx.quadraticCurveTo(cx2, sy, cx2 + rr, sy);
      ctx.closePath();
      ctx.fill();
      // Noise per stone
      for (let py = sy; py < sy + sh; py += 4) {
        for (let px = cx2; px < cx2 + sw; px += 4) {
          const nv = Math.random() * 20 - 10 | 0;
          ctx.fillStyle = `rgba(${nv > 0 ? 255 : 0},${nv > 0 ? 255 : 0},${nv > 0 ? 255 : 0},${Math.abs(nv) / 255})`;
          ctx.fillRect(px, py, 4, 4);
        }
      }
      ctx.strokeStyle = 'rgba(0,0,0,.2)';
      ctx.lineWidth = 1;
      ctx.stroke();
      cx2 += sw + 4 + Math.random() * 6;
    }
  }
  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(heightToNormal(ctx, size, size, 3.5)),
    roughness: canvasToTexture((() => {
      const rc = document.createElement('canvas');
      rc.width = rc.height = size;
      rc.getContext('2d').fillStyle = '#aaa';
      rc.getContext('2d').fillRect(0, 0, size, size);
      return rc;
    })())
  };
}

// ── TERRACOTTA TEXTURE (for Inferno roofs/accents) ──
export function makeTerracottaTextures(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = fbm(x / 40, y / 40, 3);
      const v = 0.5 + n * 0.3;
      const r = Math.min(255, (v * 180 + 60) | 0);
      const g = Math.min(255, (v * 90 + 30) | 0);
      const b = Math.min(255, (v * 55 + 15) | 0);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(heightToNormal(ctx, size, size, 2.0)),
    roughness: canvasToTexture((() => {
      const rc = document.createElement('canvas');
      rc.width = rc.height = size;
      rc.getContext('2d').fillStyle = '#b0b0b0';
      rc.getContext('2d').fillRect(0, 0, size, size);
      return rc;
    })())
  };
}

// ── INDUSTRIAL PANEL TEXTURE (for Bind high-tech walls) ──
export function makeIndustrialTextures(size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  // Base grey panel
  ctx.fillStyle = '#c0bab0'; ctx.fillRect(0, 0, size, size);
  // Panel grid lines
  ctx.strokeStyle = '#a09888'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const y = (i + 1) * size / 4;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(size, y); ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    const x = (i + 1) * size / 4;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, size); ctx.stroke();
  }
  // Teal accent strips
  ctx.fillStyle = '#1a8c8c';
  ctx.fillRect(0, size / 2 - 4, size, 8);
  // Subtle noise
  for (let y = 0; y < size; y += 2) {
    for (let x = 0; x < size; x += 2) {
      const nv = Math.random() * 10 - 5;
      ctx.fillStyle = `rgba(${nv > 0 ? 255 : 0},${nv > 0 ? 255 : 0},${nv > 0 ? 255 : 0},${Math.abs(nv) / 255})`;
      ctx.fillRect(x, y, 2, 2);
    }
  }
  return {
    albedo: canvasToTexture(c),
    normal: canvasToTexture(heightToNormal(ctx, size, size, 1.5)),
    roughness: canvasToTexture((() => {
      const rc = document.createElement('canvas');
      rc.width = rc.height = size;
      rc.getContext('2d').fillStyle = '#888';
      rc.getContext('2d').fillRect(0, 0, size, size);
      return rc;
    })())
  };
}

// ── THEME MATERIAL SETS ──
// 'bind' = Valorant-Bind: sandy stone, teal industrial, bright desert sky
// 'inferno' = CSGO-Inferno: cobblestone, brick, terracotta, golden-hour sky
const _themeCache = {};
export function getThemeMaterials(theme) {
  // Normalize: levels 1-5 use 'bind', levels 6-10 use 'inferno'
  const key = (theme === 'bind') ? 'bind' : (theme === 'inferno') ? 'inferno' : 'bind';
  if (_themeCache[key]) return _themeCache[key];

  if (key === 'bind') {
    const sand = makeSandTextures(512);
    sand.albedo.repeat.set(8,8); sand.normal.repeat.set(8,8); sand.roughness.repeat.set(8,8);
    const indus = makeIndustrialTextures(256);
    const conc = makeConcreteTextures(512);
    const metal = makeMetalTextures(256);
    const wood = makeWoodTextures(256);
    _themeCache.bind = {
      ground:   makePBR(sand, { roughness: 0.95 }),
      wall:     makePBR(indus, { roughness: 0.7 }),
      cover:    makePBR(conc, { roughness: 0.8 }),
      metal:    makePBR(metal, { roughness: 0.35, metalness: 0.85 }),
      wood:     makePBR(wood, { roughness: 0.75 }),
      accent:   new THREE.MeshStandardMaterial({ color: 0x1abc9c, roughness: 0.3, metalness: 0.5, emissive: 0x0d6655, emissiveIntensity: 0.3 }),
      crate:    new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6 }),
      crateEdge:new THREE.MeshStandardMaterial({ color: 0x1abc9c, roughness: 0.2, metalness: 0.6, emissive: 0x1abc9c, emissiveIntensity: 0.4 }),
      fog:      0xc8b898,
      skyTop:   [0.35, 0.55, 0.85],
      skyMid:   [0.65, 0.75, 0.88],
      horizon:  [0.85, 0.78, 0.60],
      sunTint:  [1.0, 0.9, 0.6],
    };
    return _themeCache.bind;
  } else {
    const cobble = makeCobblestoneTextures(512);
    cobble.albedo.repeat.set(6,6); cobble.normal.repeat.set(6,6); cobble.roughness.repeat.set(6,6);
    const brick = makeBrickTextures(512);
    const terra = makeTerracottaTextures(256);
    const metal = makeMetalTextures(256);
    const wood = makeWoodTextures(256);
    _themeCache.inferno = {
      ground:   makePBR(cobble, { roughness: 0.9 }),
      wall:     makePBR(brick, { roughness: 0.85 }),
      cover:    makePBR(terra, { roughness: 0.8 }),
      metal:    makePBR(metal, { roughness: 0.4, metalness: 0.7 }),
      wood:     makePBR(wood, { roughness: 0.75 }),
      accent:   new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.7 }),
      crate:    makePBR(wood, { roughness: 0.7 }),
      crateEdge:new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 0.8 }),
      fog:      0xc8a868,
      skyTop:   [0.55, 0.45, 0.30],
      skyMid:   [0.75, 0.62, 0.42],
      horizon:  [0.92, 0.72, 0.45],
      sunTint:  [1.0, 0.75, 0.35],
    };
    return _themeCache.inferno;
  }
}

