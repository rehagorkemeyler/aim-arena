// ─────────────────────────────────────────────────────────────
// POST-PROCESSING — Bloom, Color Grading, FXAA
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// Color grading + vignette shader
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    vignetteStrength: { value: 0.35 },
    contrast: { value: 1.08 },
    saturation: { value: 0.95 },
    warmth: { value: 0.06 },
    damageFlash: { value: 0.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float vignetteStrength;
    uniform float contrast;
    uniform float saturation;
    uniform float warmth;
    uniform float damageFlash;
    varying vec2 vUv;

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      vec3 c = color.rgb;

      // Contrast
      c = (c - 0.5) * contrast + 0.5;

      // Warmth (shift shadows warm, highlights cool)
      c.r += warmth * 0.5;
      c.b -= warmth * 0.3;

      // Saturation
      float luma = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(luma), c, saturation);

      // Vignette
      vec2 uv = vUv * 2.0 - 1.0;
      float vig = 1.0 - dot(uv, uv) * vignetteStrength;
      c *= vig;

      // Damage flash (red overlay)
      c = mix(c, vec3(0.6, 0.05, 0.02), damageFlash);

      // Film grain (very subtle)
      float grain = fract(sin(dot(vUv * 500.0, vec2(12.9898, 78.233))) * 43758.5453);
      c += (grain - 0.5) * 0.015;

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }
  `
};

export function setupPostProcessing(renderer, scene, camera) {
  const composer = new EffectComposer(renderer);

  // Render pass
  composer.addPass(new RenderPass(scene, camera));

  // Bloom — subtle glow on bright areas (muzzle flash, tracers)
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.25,  // strength
    0.4,   // radius
    0.88   // threshold
  );
  composer.addPass(bloom);

  // Color grading + vignette
  const colorGrade = new ShaderPass(ColorGradeShader);
  composer.addPass(colorGrade);

  return { composer, bloom, colorGrade };
}

// Update damage flash intensity (call each frame)
export function setDamageFlash(colorGradePass, intensity) {
  if (colorGradePass) {
    colorGradePass.uniforms.damageFlash.value = intensity;
  }
}

// Low health desaturation
export function setHealthEffect(colorGradePass, hp) {
  if (!colorGradePass) return;
  if (hp < 30) {
    colorGradePass.uniforms.saturation.value = 0.5 + (hp / 30) * 0.45;
    colorGradePass.uniforms.vignetteStrength.value = 0.35 + (1 - hp / 30) * 0.25;
  } else {
    colorGradePass.uniforms.saturation.value = 0.95;
    colorGradePass.uniforms.vignetteStrength.value = 0.35;
  }
}

export function onResize(composer, renderer) {
  if (composer) {
    composer.setSize(window.innerWidth, window.innerHeight);
  }
}
