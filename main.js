/* ================= main.js — orquestación de la experiencia 3D ================= */
import * as THREE from 'three';
import { createScene } from './scene3d.js';
import { buildSunflowerField, windUniforms } from './sunflowerField.js';

/* ---------- contenido editable ---------- */
const CONFIG = {
  hintText: 'Creo que hay algo por aquí…',
  hintDelay: 9000,
  finalMessage: {
    title: 'Para ti',
    message: 'Escribe aquí tu mensaje.\nPuede ocupar varias líneas.',
    signature: '— Con cariño',
    closeButton: 'Volver al campo'
  },
  camera: {
    start: { x: 0, y: 1.6, z: 14 },
    end:   { x: 0, y: 1.35, z: -2 },  // el viaje atraviesa el campo
    duration: 14,                      // segundos, ease power2.inOut
    focusFar: 11, focusNear: 6
  },
  flowerCount: innerWidth < 700 ? 1500 : 4200
};

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- arranque ---------- */
const canvas = document.getElementById('webgl-canvas');
let core;
try {
  core = createScene(canvas);
} catch (err) {
  document.getElementById('intro-subtitle').textContent =
    'Tu navegador no pudo iniciar WebGL.';
  throw err;
}
const { renderer, scene, camera, composer, bokeh } = core;

const field = buildSunflowerField(scene, { count: CONFIG.flowerCount });

/* ---------- destino del recorrido: un corazón luminoso al fondo ---------- */
const heartShape = new THREE.Shape();
(function(s){
  s.moveTo(0.5, 0.5);
  s.bezierCurveTo(0.5, 0.8, 0, 0.8, 0, 0.35);
  s.bezierCurveTo(0, 0.05, 0.5, 0, 0.5, 0.2);
  s.bezierCurveTo(0.5, 0, 1, 0.05, 1, 0.35);
  s.bezierCurveTo(1, 0.8, 0.5, 0.8, 0.5, 0.5);
})(heartShape);
const heart = new THREE.Mesh(
  new THREE.ExtrudeGeometry(heartShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelSegments: 2 }),
  new THREE.MeshStandardMaterial({ color: 0xdf3f5c, emissive: 0x611828, roughness: 0.4 })
);
heart.scale.setScalar(1.6);
heart.position.set(-0.8, 1.1, -26);
heart.visible = false;
scene.add(heart);

/* ---------- puntero → raycast sobre el suelo → uniform del shader ---------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hitPoint = new THREE.Vector3();
const smoothPointer = new THREE.Vector2(999, 999);

addEventListener('pointermove', (ev) => {
  ndc.set((ev.clientX / innerWidth) * 2 - 1, -(ev.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  if (raycaster.ray.intersectPlane(groundPlane, hitPoint)){
    // lerp suave hacia el punto: sin saltos
    smoothPointer.lerp(new THREE.Vector2(hitPoint.x, hitPoint.z), 0.12);
  }
}, { passive: true });

/* ---------- bucle de render (pausado en pestaña oculta) ---------- */
const clock = new THREE.Clock();
let running = true;
document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) { clock.getDelta(); renderer.setAnimationLoop(loop); }
  else renderer.setAnimationLoop(null);
});

function loop(){
  const dt = Math.min(clock.getDelta(), 0.05);
  if (!reduceMotion) field.update(dt);
  windUniforms.uPointer.value.lerp(smoothPointer, 0.2);
  composer.render(); // RenderPass + Bloom + Bokeh + Output
}
renderer.setAnimationLoop(loop);

/* ---------- narrativa: viaje de cámara con GSAP ---------- */
const ui = {
  intro: document.getElementById('intro'),
  hint: document.getElementById('hint'),
  card: document.getElementById('final-card')
};
const camTarget = new THREE.Vector3(0, 1.3, 0);

function enterField(){
  // la intro se desvanece mientras la cámara empieza a avanzar
  gsap.to(ui.intro, {
    opacity: 0, duration: 1.4, ease: 'power2.out',
    onComplete(){ ui.intro.style.display = 'none'; }
  });

  const tl = gsap.timeline();
  // pista tras unos segundos de viaje
  tl.to(ui.hint, { opacity: 1, duration: 1.2, delay: CONFIG.hintDelay / 1000 })
    .to(ui.hint, { opacity: 0, duration: 1.5 }, '+=4');

  // viaje cinematográfico: power2.inOut, mirando al frente durante todo el trayecto
  const cam = CONFIG.camera;
  gsap.to(camera.position, {
    x: cam.end.x, y: cam.end.y, z: cam.end.z,
    duration: cam.duration, ease: 'power2.inOut',
    onUpdate(){
      // la cámara avanza mirando un punto que también avanza
      camTarget.set(0, 1.25, camera.position.z - 8);
      camera.lookAt(camTarget);
      // El foco del bokeh la sigue: franja media siempre nítida
      bokeh.uniforms.focus.value = gsap.utils.interpolate(
        cam.focusFar, cam.focusNear,
        1 - (camera.position.z - cam.end.z) / (cam.start.z - cam.end.z)
      );
    },
    onComplete: revealHeart
  });
}

function revealHeart(){
  heart.visible = true;
  heart.scale.setScalar(0.01);
  gsap.to(heart.scale, { x: 1.6, y: 1.6, z: 1.6, duration: 2.4, ease: 'elastic.out(1, 0.5)' });
  gsap.to(heart.rotation, { y: Math.PI * 2, duration: 20, repeat: -1, ease: 'none' });
  gsap.delayedCall(2.2, showFinal);
}

function showFinal(){
  const f = CONFIG.finalMessage;
  document.getElementById('final-title').textContent = f.title;
  document.getElementById('final-message').textContent = f.message;
  document.getElementById('final-signature').textContent = f.signature;
  document.getElementById('final-close').textContent = f.closeButton;
  ui.card.hidden = false;
  ui.card.classList.add('show');
  gsap.fromTo('.final-panel',
    { opacity: 0, y: 24, scale: 0.96 },
    { opacity: 1, y: 0, scale: 1, duration: 1.2, ease: 'power2.out' });
  document.getElementById('final-close').focus();
}

document.getElementById('final-close').addEventListener('click', () => {
  ui.card.classList.remove('show');
  setTimeout(() => { ui.card.hidden = true; }, 400);
});
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape' && !ui.card.hidden) document.getElementById('final-close').click();
});

/* el único gesto requerido del usuario */
document.getElementById('start-btn').addEventListener('click', () => {
  if (typeof gsap === 'undefined'){
    // GSAP no llegó del CDN: entrar sin animación, con aviso claro
    ui.intro.style.display = 'none';
    const b = document.getElementById('err-banner');
    b.style.display = 'block';
    b.textContent += '⚠ GSAP no cargó (revisa tu conexión). Entraste sin animaciones.\n';
    revealHeart();
    return;
  }
  enterField();
}, { once: true });

/* posición inicial de cámara */
camera.position.set(CONFIG.camera.start.x, CONFIG.camera.start.y, CONFIG.camera.start.z);
camera.lookAt(0, 1.3, 0);
