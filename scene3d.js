/* ================= scene3d.js — paisaje y calidad WebGL ================= */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const PALETTE = {
  zenith: new THREE.Color(0x4c80b9), horizon: new THREE.Color(0xffdfa5),
  sun: new THREE.Color(0xffdf9b), fog: new THREE.Color(0xdaba85),
  ground: 0x647539, ambient: 0xffe5bd
};
const QUALITY = {
  low: { dpr: 1, shadow: 0, bloom: 0, bokeh: false, grass: 320, dust: 55 },
  medium: { dpr: 1.35, shadow: 1024, bloom: 0.13, bokeh: false, grass: 760, dust: 110 },
  high: { dpr: 1.7, shadow: 2048, bloom: 0.19, bokeh: true, grass: 1200, dust: 180 }
};
function pathCenter(z){ return Math.sin((14 - z) * 0.16) * 1.5; }
function seededRandom(seed){
  return function(){
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function terrainHeight(x, z){
  // Una franja llana acompaña todo el sendero, incluso en las curvas.
  const blend = THREE.MathUtils.smoothstep(Math.abs(x - pathCenter(z)), 1.35, 4);
  return blend * (Math.sin(x * 0.21) * Math.cos(z * 0.14) * 0.14 +
    Math.sin(x * 0.7 + z * 0.23) * 0.045);
}
function makeSky(){
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: {
      uZenith: { value: PALETTE.zenith.clone() }, uHorizon: { value: PALETTE.horizon.clone() },
      uSunDir: { value: new THREE.Vector3(0.32, 0.23, -1).normalize() },
      uSunCol: { value: PALETTE.sun.clone() }
    },
    vertexShader: /* glsl */`
      varying vec3 vDirection;
      void main(){
        vDirection = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      varying vec3 vDirection;
      uniform vec3 uZenith, uHorizon, uSunDir, uSunCol;
      void main(){
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y, 0.0, 1.0);
        vec3 color = mix(uHorizon, uZenith, pow(height, 0.6));
        float alignment = max(dot(direction, uSunDir), 0.0);
        color += uSunCol * pow(alignment, 950.0) * 1.7;
        color += uSunCol * pow(alignment, 26.0) * 0.15;
        gl_FragColor = vec4(color, 1.0);
      }`
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 20), material);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  return sky;
}
function makeTerrainTexture(isPath = false){
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const context = canvas.getContext('2d');
  const random = seededRandom(isPath ? 7238 : 7211);
  context.fillStyle = isPath ? '#bea478' : '#647539';
  context.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++){
    context.fillStyle = isPath
      ? (random() < 0.5 ? 'rgba(92,68,36,0.12)' : 'rgba(242,220,172,0.19)')
      : (random() < 0.5 ? 'rgba(34,60,20,0.18)' : 'rgba(153,160,76,0.2)');
    context.fillRect(random() * 256, random() * 256, 1 + random() * 2, 1 + random() * 3);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(isPath ? 1.6 : 28, isPath ? 35 : 28);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
function makeTerrain(){
  const geometry = new THREE.PlaneGeometry(220, 220, 100, 100);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, 0, -12);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++){
    positions.setY(i, terrainHeight(positions.getX(i), positions.getZ(i)) - 0.018);
  }
  geometry.computeVertexNormals();
  const ground = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: makeTerrainTexture(), roughness: 1, metalness: 0
  }));
  ground.receiveShadow = true;
  return ground;
}
function makePath(){
  const positions = [], uvs = [], indices = [];
  const segments = 180;
  for (let i = 0; i <= segments; i++){
    const z = 36 - i / segments * 126;
    const slope = -0.24 * Math.cos((14 - z) * 0.16);
    const normalLength = Math.hypot(1, slope);
    const halfWidth = 1.05 + Math.sin(i * 0.3) * 0.035;
    for (const side of [-1, 1]){
      positions.push(pathCenter(z) + side * halfWidth / normalLength, 0.004,
        z - side * halfWidth * slope / normalLength);
      uvs.push(side < 0 ? 0 : 1, i / segments);
    }
    if (i < segments){
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const path = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    map: makeTerrainTexture(true), roughness: 1, metalness: 0,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
  }));
  path.receiveShadow = true;
  return path;
}
function makeGrass(){
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.035, 0, 0, 0.035, 0, 0, 0.012, 0.28, 0.015,
    0, 0, -0.03, 0, 0, 0.03, 0.018, 0.23, 0
  ], 3));
  geometry.computeVertexNormals();
  const time = { value: 0 };
  const material = new THREE.MeshStandardMaterial({ color: 0x76913e, roughness: 1, side: THREE.DoubleSide });
  material.onBeforeCompile = shader => {
    shader.uniforms.uGrassTime = time;
    shader.vertexShader = 'uniform float uGrassTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', /* glsl */`
      #include <begin_vertex>
      float phase = instanceMatrix[3].x * 1.7 + instanceMatrix[3].z * 0.8;
      transformed.x += sin(uGrassTime * 1.3 + phase) * position.y * 0.1;
    `);
  };
  const grass = new THREE.InstancedMesh(geometry, material, QUALITY.high.grass);
  const random = seededRandom(8288);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  for (let i = 0; i < grass.instanceMatrix.count; i++){
    // El orden aleatorio mantiene hierba en todo el trayecto con cualquier calidad.
    const z = 26 - random() * 92;
    const x = pathCenter(z) + (random() < 0.5 ? -1 : 1) * (1.22 + random() * 1.25);
    dummy.position.set(x, terrainHeight(x, z) - 0.015, z);
    dummy.rotation.set(0, random() * Math.PI, (random() - 0.5) * 0.22);
    dummy.scale.setScalar(0.6 + random() * 0.9);
    dummy.updateMatrix();
    grass.setMatrixAt(i, dummy.matrix);
    color.setHSL(0.21 + random() * 0.035, 0.43, 0.23 + random() * 0.12);
    grass.setColorAt(i, color);
  }
  grass.computeBoundingSphere();
  return { mesh: grass, time };
}
function makeDust(){
  const random = seededRandom(9481), positions = [], sizes = [];
  for (let i = 0; i < QUALITY.high.dust; i++){
    positions.push((random() - 0.5) * 25, 0.25 + random() * 3.8, 26 - random() * 94);
    sizes.push(0.55 + random() * 0.7);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: {
      uTime: { value: 0 }, uPixelRatio: { value: 1 }, uColor: { value: new THREE.Color(0xffe2a4) },
      uFogColor: { value: PALETTE.fog.clone() }, uFogDensity: { value: 0.013 }
    },
    vertexShader: /* glsl */`
      attribute float aSize;
      uniform float uTime, uPixelRatio;
      varying float vDepth;
      void main(){
        vec3 point = position;
        point.x += sin(uTime * 0.22 + position.z) * 0.24;
        point.y += sin(uTime * 0.4 + position.x) * 0.14;
        vec4 view = modelViewMatrix * vec4(point, 1.0);
        vDepth = max(-view.z, 0.0);
        gl_PointSize = clamp(aSize * 25.0 / max(vDepth, 1.0), 1.0, 3.0) * uPixelRatio;
        gl_Position = projectionMatrix * view;
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor, uFogColor;
      uniform float uFogDensity;
      varying float vDepth;
      void main(){
        float distanceToCenter = length(gl_PointCoord - 0.5);
        float opacity = (1.0 - smoothstep(0.08, 0.5, distanceToCenter)) * 0.42;
        opacity *= smoothstep(0.7, 2.0, vDepth);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
        gl_FragColor = vec4(mix(uColor, uFogColor, fog), opacity * (1.0 - fog));
      }`
  });
  const dust = new THREE.Points(geometry, material);
  dust.frustumCulled = false;
  return dust;
}
export function createScene(canvas, opts = {}){
  let reduceMotion = !!opts.reduceMotion;
  let disposed = false, quality = 'medium';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(PALETTE.fog.clone(), 0.013);
  const camera = new THREE.PerspectiveCamera(58, innerWidth / Math.max(1, innerHeight), 0.08, 260);
  camera.position.set(pathCenter(14), 1.6, 14);
  camera.lookAt(pathCenter(6), 1.4, 6);
  const sky = makeSky();
  const hemisphere = new THREE.HemisphereLight(0xb9d5ef, 0x526329, 1.1);
  const ambient = new THREE.AmbientLight(PALETTE.ambient, 0.28);
  const sun = new THREE.DirectionalLight(0xffdfad, 2.3);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -19;
  sun.shadow.camera.right = sun.shadow.camera.top = 19;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.035;
  const ground = makeTerrain(), path = makePath(), grass = makeGrass(), dust = makeDust();
  const ownedObjects = [sky, ground, path, grass.mesh, dust];
  scene.add(...ownedObjects, hemisphere, ambient, sun, sun.target);
  const composer = new EffectComposer(renderer);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.13, 0.35, 1.05);
  const bokeh = new BokehPass(scene, camera, { focus: 9, aperture: 0.000055, maxblur: 0.002 });
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(bloom);
  composer.addPass(bokeh);
  composer.addPass(new OutputPass());
  const evening = {
    zenith: new THREE.Color(0x62649a), horizon: new THREE.Color(0xffb579),
    sun: new THREE.Color(0xffcb87), fog: new THREE.Color(0xdfac83),
    hemisphere: new THREE.Color(0xafbddc), light: new THREE.Color(0xffc78b)
  };
  const dayHemisphere = new THREE.Color(0xb9d5ef), dayLight = new THREE.Color(0xffdfad);
  const sunDirection = new THREE.Vector3();
  function setAmbience(progress){
    if (disposed) return;
    const amount = THREE.MathUtils.clamp(Number(progress) || 0, 0, 1);
    const uniforms = sky.material.uniforms;
    uniforms.uZenith.value.copy(PALETTE.zenith).lerp(evening.zenith, amount);
    uniforms.uHorizon.value.copy(PALETTE.horizon).lerp(evening.horizon, amount);
    uniforms.uSunCol.value.copy(PALETTE.sun).lerp(evening.sun, amount);
    sunDirection.set(0.32 + amount * 0.04, 0.23 - amount * 0.1, -1).normalize();
    uniforms.uSunDir.value.copy(sunDirection);
    scene.fog.color.copy(PALETTE.fog).lerp(evening.fog, amount);
    scene.fog.density = 0.013 + amount * 0.0025;
    hemisphere.color.copy(dayHemisphere).lerp(evening.hemisphere, amount);
    hemisphere.intensity = 1.1 - amount * 0.15;
    ambient.intensity = 0.28 + amount * 0.04;
    sun.color.copy(dayLight).lerp(evening.light, amount);
    sun.intensity = 2.3 - amount * 0.25;
    dust.material.uniforms.uFogColor.value.copy(scene.fog.color);
    dust.material.uniforms.uFogDensity.value = scene.fog.density;
    renderer.setClearColor(scene.fog.color);
  }
  function resize(){
    if (disposed) return;
    const width = Math.max(1, innerWidth), height = Math.max(1, innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (bokeh.uniforms.aspect) bokeh.uniforms.aspect.value = camera.aspect;
    renderer.setSize(width, height);
    composer.setSize(width, height);
  }
  function clearShadowTargets(){
    sun.shadow.map?.dispose();
    sun.shadow.mapPass?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapPass = null;
  }
  function setQuality(level){
    if (disposed) return quality;
    quality = Object.prototype.hasOwnProperty.call(QUALITY, level) ? level : 'medium';
    const settings = QUALITY[quality], ratio = Math.min(window.devicePixelRatio || 1, settings.dpr);
    renderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    dust.material.uniforms.uPixelRatio.value = ratio;
    const shadowsChanged = renderer.shadowMap.enabled !== !!settings.shadow;
    const shadowSizeChanged = sun.shadow.mapSize.x !== settings.shadow;
    renderer.shadowMap.enabled = !!settings.shadow;
    sun.castShadow = !!settings.shadow;
    if (shadowsChanged || shadowSizeChanged){
      clearShadowTargets();
      if (settings.shadow) sun.shadow.mapSize.set(settings.shadow, settings.shadow);
      sun.shadow.needsUpdate = true;
      renderer.shadowMap.needsUpdate = true;
      scene.traverse(object => {
        if (!object.material) return;
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach(material => { material.needsUpdate = true; });
      });
    }
    bloom.enabled = settings.bloom > 0;
    bloom.strength = settings.bloom;
    bokeh.enabled = settings.bokeh;
    grass.mesh.count = settings.grass;
    dust.geometry.setDrawRange(0, settings.dust);
    resize();
    return quality;
  }
  function update(dt, activeCamera = camera){
    if (disposed) return;
    const step = THREE.MathUtils.clamp(Number(dt) || 0, 0, 0.05);
    if (!reduceMotion){
      grass.time.value += step;
      dust.material.uniforms.uTime.value += step;
    }
    sky.position.copy(activeCamera.position);
    sun.target.position.set(activeCamera.position.x, 0, activeCamera.position.z - 9);
    sun.position.copy(sun.target.position).addScaledVector(sunDirection, 55);
    sun.target.updateMatrixWorld();
  }
  function setReducedMotion(value){
    reduceMotion = !!value;
  }
  function dispose(){
    if (disposed) return;
    disposed = true;
    removeEventListener('resize', resize);
    renderer.setAnimationLoop(null);
    for (const object of ownedObjects){
      object.geometry.dispose();
      object.material.map?.dispose();
      object.material.dispose();
      object.dispose?.();
      scene.remove(object);
    }
    clearShadowTargets();
    for (const pass of composer.passes) pass.dispose?.();
    composer.dispose();
    renderer.dispose();
  }
  setAmbience(0);
  setQuality(opts.quality || 'medium');
  update(0);
  addEventListener('resize', resize);
  return { renderer, scene, camera, composer, sun, bloom, bokeh, resize,
    setQuality, setAmbience, update, setReducedMotion, dispose };
}
