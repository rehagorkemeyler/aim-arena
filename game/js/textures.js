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
