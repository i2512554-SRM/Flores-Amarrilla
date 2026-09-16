/* ================= scene3d.js — núcleo WebGL =================
   Renderer + cámara + cielo de atardecer + niebla + luces + post-procesado
   (Bloom + Depth of Field + ACES Tone Mapping). */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }     from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass }      from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass }     from 'three/addons/postprocessing/OutputPass.js';

export const PALETTE = {
  zenith:   new THREE.Color(0x3f6fb5),  // azul suave en el cenit
  horizon:  new THREE.Color(0xffb257),  // dorado-naranja en el horizonte
  sun:      new THREE.Color(0xffd27a),
  fog:      new THREE.Color(0xf2a35e),
  ground:   0x4a6b26,
  ambient:  0xffe3c0
};

/* ---------- cielo: domo con degradado sunset + halo de sol ---------- */
function makeSky(){
  const geo = new THREE.SphereGeometry(220, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uZenith:  { value: PALETTE.zenith },
      uHorizon: { value: PALETTE.horizon },
      uSunDir:  { value: new THREE.Vector3(0.25, 0.12, -1).normalize() },
      uSunCol:  { value: PALETTE.sun }
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDir;
      uniform vec3 uZenith, uHorizon, uSunDir, uSunCol;
      void main(){
        float h = clamp(vDir.y, 0.0, 1.0);
        // degradado cenit -> horizonte, cálido abajo
        vec3 col = mix(uHorizon, uZenith, pow(h, 0.55));
        // disco + halo del sol bajo
        float sunAmt = max(dot(normalize(vDir), uSunDir), 0.0);
        col += uSunCol * pow(sunAmt, 220.0) * 1.6;   // disco
        col += uSunCol * pow(sunAmt, 10.0) * 0.35;   // halo amplio
        gl_FragColor = vec4(col, 1.0);
      }`
  });
  return new THREE.Mesh(geo, mat);
}

/* ---------- terreno con textura procedural ---------- */
function makeGroundTexture(){
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#4a6b26'; g.fillRect(0, 0, 512, 512);
  // moteado natural
  for (let i = 0; i < 9000; i++){
    const x = Math.random() * 512, y = Math.random() * 512;
    g.fillStyle = Math.random() < 0.5
      ? `rgba(${60 + Math.random() * 40 | 0}, ${95 + Math.random() * 45 | 0}, 30, 0.25)`
      : `rgba(40, 60, 20, 0.22)`;
    g.fillRect(x, y, 2, 2 + Math.random() * 3);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createScene(canvas){
  /* ---------- renderer ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); // tope: no cocinar móviles 3x
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  /* ---------- escena y atmósfera ---------- */
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.fog, 0.022); // horizonte fundido en naranja
  scene.add(makeSky());

  /* ---------- cámara ---------- */
  const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 300);
  camera.position.set(0, 1.6, 14);

  /* ---------- luces: golden hour ---------- */
  // relleno ambiental cálido
  scene.add(new THREE.HemisphereLight(0x9fc3e8, PALETTE.ground, 0.55));
  const amb = new THREE.AmbientLight(PALETTE.ambient, 0.35);
  scene.add(amb);

  // sol bajo y frontal-diagonal: sombras largas hacia la cámara
  const sun = new THREE.DirectionalLight(0xffc06a, 2.4);
  sun.position.set(14, 7, -46);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;   sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  /* ---------- terreno ---------- */
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(140, 48),
    new THREE.MeshStandardMaterial({ map: makeGroundTexture(), roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------- post-procesado ---------- */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(
    new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.35, 0.9, 0.85);
  composer.addPass(bloom);

  const bokeh = new BokehPass(scene, camera, {
    focus: 11.0,      // franja media nítida
    aperture: 0.00028,
    maxblur: 0.0075
  });
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());

  /* ---------- resize ---------- */
  function resize(){
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
  }
  addEventListener('resize', resize);

  return { renderer, scene, camera, composer, sun, bloom, bokeh, resize };
}
