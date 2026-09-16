/* ================= sunflowerField.js — campo instanciado =================
   Un solo girasol procedural (tallo + hojas + disco de semillas en espiral de
   Fibonacci + 2 anillos de pétalos texturizados) renderizado miles de veces
   con 3 InstancedMesh (3 draw calls totales, no miles).
   El viento y la interacción del puntero se resuelven en el vertex shader. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------- textura: centro con espiral de Fibonacci (phyllotaxis) ---------- */
function makeSeedTexture(){
  const S = 256, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(S/2, S/2, 10, S/2, S/2, S/2);
  grd.addColorStop(0, '#7a4c22'); grd.addColorStop(1, '#3c2410');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  const GA = Math.PI * (3 - Math.sqrt(5)); // ángulo áureo
  for (let i = 0; i < 420; i++){
    const r = 4.1 * Math.sqrt(i), a = i * GA;
    const x = S/2 + r * Math.cos(a), y = S/2 + r * Math.sin(a);
    if (r > S/2 - 6) break;
    g.fillStyle = i % 2 ? 'rgba(30,16,6,0.85)' : 'rgba(96,58,24,0.85)';
    g.beginPath();
    g.ellipse(x, y, 2.6, 1.7, a, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- textura de pétalo + mapa de normales procedural ---------- */
function makePetalTextures(){
  const W = 64, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, H, 0, 0);
  grad.addColorStop(0, '#e8940f'); grad.addColorStop(0.55, '#ffc83d');
  grad.addColorStop(1, '#ffe27a');
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // nervaduras longitudinales
  g.strokeStyle = 'rgba(190,120,10,0.35)'; g.lineWidth = 1.4;
  for (let i = 0; i <= 5; i++){
    g.beginPath();
    g.moveTo(W/2 + (i - 2.5) * 3, H);
    g.quadraticCurveTo(W/2 + (i - 2.5) * 10, H * 0.5, W/2 + (i - 2.5) * 11, 4);
    g.stroke();
  }
  // normal map aproximado a partir de las mismas nervaduras (bump lateral)
  const n = document.createElement('canvas'); n.width = W; n.height = H;
  const ng = n.getContext('2d');
  ng.fillStyle = '#8080ff'; ng.fillRect(0, 0, W, H); // normal neutra
  for (let i = 0; i <= 5; i++){
    const x0 = W/2 + (i - 2.5) * 11;
    const gg = ng.createLinearGradient(x0 - 4, 0, x0 + 4, 0);
    gg.addColorStop(0, '#8080ff'); gg.addColorStop(0.5, '#a0a0ff'); gg.addColorStop(1, '#8080ff');
    ng.fillStyle = gg; ng.fillRect(x0 - 4, 0, 8, H);
  }
  const map = new THREE.CanvasTexture(c); map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = new THREE.CanvasTexture(n);
  return { map, normalMap };
}

/* ---------- geometría de un girasol (para instanciar) ---------- */
const H = 1.35; // altura de referencia

function buildGeometries(){
  // tallo + hojas
  const stem = new THREE.CylinderGeometry(0.012, 0.022, H * 0.92, 5);
  stem.translate(0, H * 0.46, 0);
  const leafGeo = () => {
    const p = new THREE.PlaneGeometry(0.09, 0.26, 1, 3);
    const pos = p.attributes.position;
    for (let i = 0; i < pos.count; i++){ // curva suave de hoja
      pos.setZ(i, Math.sin((pos.getY(i) / 0.26 + 0.5) * Math.PI) * 0.05);
    }
    return p;
  };
  const leaf1 = leafGeo();
  leaf1.rotateX(-0.7); leaf1.rotateY(0.5);
  leaf1.translate(0.07, H * 0.42, 0.03);
  const leaf2 = leafGeo();
  leaf2.rotateX(-0.5); leaf2.rotateY(-2.2);
  leaf2.translate(-0.06, H * 0.58, -0.02);
  const stemGeo = mergeGeometries([stem, leaf1, leaf2]);

  // cabeza: disco de semillas
  const headGeo = new THREE.CircleGeometry(0.135, 24);
  headGeo.rotateX(0.18);      // primero orientar…
  headGeo.translate(0, H, 0); // …luego posicionar (el orden importa)

  // pétalos: dos anillos
  const petalParts = [];
  const mkPetal = (len, wdt) => {
    const p = new THREE.PlaneGeometry(wdt, len, 1, 3);
    const pos = p.attributes.position;
    for (let i = 0; i < pos.count; i++){
      const t = pos.getY(i) / len + 0.5;
      pos.setZ(i, Math.sin(t * Math.PI) * 0.035);      // curvatura natural
      pos.setX(i, pos.getX(i) * (1 - 0.35 * t * t));   // punta afilada
    }
    p.translate(0, len / 2, 0);
    return p;
  };
  const rings = [
    { n: 18, r: 0.115, len: 0.16,  w: 0.055, up: 0.28 },
    { n: 14, r: 0.10,  len: 0.11,  w: 0.05,  up: 0.45, off: 0.14 }
  ];
  for (const rg of rings){
    for (let i = 0; i < rg.n; i++){
      const a = (i / rg.n) * Math.PI * 2 + (rg.off || 0);
      const p = mkPetal(rg.len, rg.w);
      // 1) acostar: la punta apunta hacia +Z, casi en el plano de la cabeza
      p.rotateX(-Math.PI / 2 + rg.up);
      // 2) distribuir radialmente alrededor del centro
      p.rotateY(-a);
      p.translate(Math.sin(a) * rg.r, 0.012, Math.cos(a) * rg.r);
      petalParts.push(p);
    }
  }
  // la cabeza (mirando +Z y levemente hacia arriba) a la altura del tallo
  const petalGeo = mergeGeometries(petalParts);
  petalGeo.rotateX(0.18);
  petalGeo.translate(0, H, 0.01);

  return { stemGeo, headGeo, petalGeo };
}

/* ---------- shader de viento + empuje del puntero (inyectado) ---------- */
export const windUniforms = {
  uTime:    { value: 0 },
  uPointer: { value: new THREE.Vector2(999, 999) },
  uWind:    { value: 1.0 }   // 0 = campo quieto (reduce motion)
};

function injectWind(mat){
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uWind;
        uniform vec2 uPointer;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          // fase única por instancia a partir de su posición en el mundo
          vec4 ipos = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float phase = ipos.x * 1.31 + ipos.z * 1.73;
          float hK = smoothstep(0.15, ${H.toFixed(2)}, transformed.y);
          // viento global: dos senos desfasados = brisa irregular
          float sway  = sin(uTime * 1.35 + phase) * 0.055
                      + sin(uTime * 2.3 + phase * 1.7) * 0.028;
          float swayZ = cos(uTime * 1.1 + phase * 0.9) * 0.045;
          // empuje del puntero: repulsión suave en radio ~2.2 m
          vec2 dp = ipos.xz - uPointer;
          float dist = length(dp);
          float push = smoothstep(2.2, 0.0, dist) * 0.38;
          vec2 dir = dp / max(dist, 0.001);
          transformed.x += (sway  + dir.x * push) * hK * uWind;
          transformed.z += (swayZ + dir.y * push) * hK * uWind;
        }`);
  };
}

/* ---------- construcción del campo ---------- */
export function buildSunflowerField(scene, opts = {}){
  const count = opts.count ?? (innerWidth < 700 ? 1500 : 4200);
  const { stemGeo, headGeo, petalGeo } = buildGeometries();
  const seeds = makeSeedTexture();
  const petals = makePetalTextures();

  const stemMat = new THREE.MeshStandardMaterial({ color: 0x4f7f2f, roughness: 0.9 });
  const headMat = new THREE.MeshStandardMaterial({ map: seeds, roughness: 0.95 });
  const petalMat = new THREE.MeshStandardMaterial({
    map: petals.map, normalMap: petals.normalMap,
    roughness: 0.6, side: THREE.DoubleSide,
    emissive: 0x664411, emissiveIntensity: 0.28 // pseudo-translucidez al atardecer
  });
  injectWind(stemMat); injectWind(headMat); injectWind(petalMat);

  const stems  = new THREE.InstancedMesh(stemGeo,  stemMat,  count);
  const heads  = new THREE.InstancedMesh(headGeo,  headMat,  count);
  const petalsI = new THREE.InstancedMesh(petalGeo, petalMat, count);
  stems.castShadow = petalsI.castShadow = true;
  heads.castShadow = true;

  /* ---------- colocación: franjas densas a los lados del camino ---------- */
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  for (let i = 0; i < count; i++){
    const side = Math.random() < 0.5 ? -1 : 1;
    // distancia al camino: de 1.2 a 26 m, más densas cerca
    const lane = 1.2 + Math.pow(Math.random(), 1.4) * 24.8;
    const x = side * lane;
    const z = 10 - Math.random() * 42;              // de z=10 a z=-32
    const s = 0.75 + Math.random() * 0.55;          // variación de tamaño
    dummy.position.set(x, 0, z);
    dummy.rotation.set(
      (Math.random() - 0.5) * 0.12,
      Math.random() * Math.PI * 2,
      (Math.random() - 0.5) * 0.12
    );
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    stems.setMatrixAt(i, dummy.matrix);
    heads.setMatrixAt(i, dummy.matrix);
    petalsI.setMatrixAt(i, dummy.matrix);
    // tono amarillo variable por instancia
    color.setHSL(0.11 + Math.random() * 0.02, 0.9, 0.5 + Math.random() * 0.12);
    petalsI.setColorAt(i, color);
  }
  stems.instanceMatrix.needsUpdate = true;
  heads.instanceMatrix.needsUpdate = true;
  petalsI.instanceMatrix.needsUpdate = true;
  if (petalsI.instanceColor) petalsI.instanceColor.needsUpdate = true;

  scene.add(stems, heads, petalsI);

  return {
    count,
    update(dt){ windUniforms.uTime.value += dt; }
  };
}
