/* Campo por sectores: dos niveles de detalle y tres flores para descubrir. */
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

const FLOWER_HEIGHT = 1.35;
const QUALITY = {
  low: { density: 0.45, near: 9, shadows: false },
  medium: { density: 0.7, near: 12, shadows: true },
  high: { density: 1, near: 16, shadows: true }
};

export function pathCenter(z){
  return Math.sin((14 - z) * 0.16) * 1.5;
}

// Las geometrías que componen una cabeza comparten el plano XY y miran +Z.
function mergeParts(parts){
  const geometry = mergeGeometries(parts, false);
  parts.forEach(part => part.dispose());
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function makePetal(length, width, segments){
  const geometry = new THREE.PlaneGeometry(width, length, 1, segments);
  const positions = geometry.attributes.position;
  for (let i = 0; i < positions.count; i++){
    const t = positions.getY(i) / length + 0.5;
    positions.setX(i, positions.getX(i) * Math.sin(Math.PI * (0.08 + 0.92 * t)));
    positions.setZ(i, Math.sin(t * Math.PI) * 0.04 + t * t * 0.018);
  }
  geometry.computeVertexNormals();
  geometry.translate(0, length / 2, 0);
  return geometry;
}

function buildGeometries(detailed){
  const h = FLOWER_HEIGHT;
  const stem = new THREE.CylinderGeometry(0.014, 0.025, h, detailed ? 6 : 4);
  stem.translate(0, h / 2, 0);
  const stemParts = [stem];
  if (detailed){
    for (let side = -1; side <= 1; side += 2){
      const leaf = makePetal(0.3, 0.13, 3);
      leaf.rotateZ(side * 1.05);
      leaf.rotateY(side * 0.6);
      leaf.translate(side * 0.018, h * (side < 0 ? 0.45 : 0.6), 0);
      stemParts.push(leaf);
    }
  }
  const backing = new THREE.SphereGeometry(0.145, detailed ? 16 : 8, detailed ? 8 : 4);
  backing.scale(1, 1, 0.32);
  backing.translate(0, h, -0.025);
  stemParts.push(backing);

  const disk = new THREE.CircleGeometry(0.135, detailed ? 24 : 10);
  disk.translate(0, 0, 0.032);
  const rim = new THREE.CylinderGeometry(0.135, 0.135, 0.055, detailed ? 20 : 8, 1, true);
  rim.rotateX(Math.PI / 2);
  const headGeo = mergeParts([disk, rim]);
  headGeo.rotateX(-0.1);
  headGeo.translate(0, h, 0);

  const petalParts = [];
  const rings = detailed
    ? [{ n: 16, radius: 0.112, length: 0.185, width: 0.074, z: 0.004 },
       { n: 12, radius: 0.105, length: 0.135, width: 0.068, z: 0.018, offset: 0.18 }]
    : [{ n: 10, radius: 0.108, length: 0.185, width: 0.09, z: 0.012 }];
  for (const ring of rings){
    for (let i = 0; i < ring.n; i++){
      const angle = i / ring.n * Math.PI * 2 + (ring.offset || 0);
      const petal = makePetal(ring.length, ring.width, detailed ? 4 : 2);
      petal.rotateZ(-angle);
      petal.translate(Math.sin(angle) * ring.radius, Math.cos(angle) * ring.radius, ring.z);
      petalParts.push(petal);
    }
  }
  const petalGeo = mergeParts(petalParts);
  petalGeo.rotateX(-0.1);
  petalGeo.translate(0, h, 0);
  return { stemGeo: mergeParts(stemParts), headGeo, petalGeo };
}

export const windUniforms = {
  uTime: { value: 0 },
  uPointer: { value: new THREE.Vector2(999, 999) },
  uWind: { value: 1 }
};

// La misma deformación se utiliza en el material visible y en sus sombras.
function injectWind(material){
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime, uWind;
        uniform vec2 uPointer;
        vec3 fieldBend(vec3 point){
          #ifdef USE_INSTANCING
            mat4 worldInstance = modelMatrix * instanceMatrix;
            vec3 base = (worldInstance * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            float phase = base.x * 1.31 + base.z * 1.73;
            float heightFactor = smoothstep(0.15, ${FLOWER_HEIGHT.toFixed(2)}, point.y);
            vec2 delta = base.xz - uPointer;
            float distanceToPointer = length(delta);
            float push = (1.0 - smoothstep(0.0, 2.2, distanceToPointer)) * 0.3;
            vec2 direction = delta / max(distanceToPointer, 0.001);
            vec3 worldOffset = vec3(
              sin(uTime * 1.35 + phase) * 0.055 + sin(uTime * 2.3 + phase * 1.7) * 0.028 + direction.x * push,
              0.0,
              cos(uTime * 1.1 + phase * 0.9) * 0.045 + direction.y * push
            ) * heightFactor * uWind;
            mat3 basis = mat3(worldInstance);
            return vec3(
              dot(worldOffset, basis[0]) / max(dot(basis[0], basis[0]), 0.001),
              dot(worldOffset, basis[1]) / max(dot(basis[1], basis[1]), 0.001),
              dot(worldOffset, basis[2]) / max(dot(basis[2], basis[2]), 0.001)
            );
          #else
            return vec3(0.0);
          #endif
        }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec3 bendSlope = (fieldBend(position + vec3(0.0, 0.01, 0.0)) - fieldBend(position)) * 100.0;
        objectNormal.y -= dot(objectNormal, bendSlope);
        objectNormal = normalize(objectNormal);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += fieldBend(transformed);`);
  };
  material.customProgramCacheKey = () => 'sunflower-sector-wind-v2';
  return material;
}

export function buildSunflowerField(scene, opts = {}){
  const maximumCount = Math.max(0, Math.floor(opts.count ?? (innerWidth < 700 ? 1100 : 2100)));
  let reduceMotion = Boolean(opts.reduceMotion);
  const nearGeometry = buildGeometries(true);
  const farGeometry = buildGeometries(false);
  const seeds = makeSeedTexture();
  const petals = makePetalTextures();
  const root = new THREE.Group();
  root.name = 'sunflower-field';
  scene.add(root);
  const materials = [
    new THREE.MeshStandardMaterial({ color: 0x467c33, roughness: 0.88, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: seeds, roughness: 0.84, side: THREE.DoubleSide }),
    new THREE.MeshStandardMaterial({ map: petals.map, normalMap: petals.normalMap,
      roughness: 0.65, side: THREE.DoubleSide, emissive: 0x7c4c09, emissiveIntensity: 0.22 })
  ];
  materials.forEach(injectWind);
  const depthMaterial = injectWind(new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, side: THREE.DoubleSide
  }));
  windUniforms.uWind.value = reduceMotion ? 0 : 1;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();
  const sectorRows = 7;
  const buckets = Array.from({ length: sectorRows * 2 }, () => []);
  for (let i = 0; i < maximumCount; i++){
    const z = 12 - Math.random() * 49;
    const side = Math.random() < 0.5 ? -1 : 1;
    const lane = 1.35 + Math.pow(Math.random(), 1.55) * 23;
    const x = pathCenter(z) + side * lane;
    // Dejar espacio a las tres flores protagonistas, sin intersecciones.
    const heroIndex = [6, -5, -16].findIndex((heroZ, id) =>
      Math.abs(z - heroZ) < 0.7 && Math.abs(x - pathCenter(heroZ) - (id === 1 ? -1.65 : 1.65)) < 0.6);
    dummy.position.set(x + (heroIndex >= 0 ? side * 1 : 0), 0, z);
    dummy.rotation.set((Math.random() - 0.5) * 0.08,
      (Math.random() - 0.5) * 0.85, (Math.random() - 0.5) * 0.1);
    dummy.scale.setScalar(0.78 + Math.random() * 0.43);
    dummy.updateMatrix();
    const row = Math.min(sectorRows - 1, Math.floor((12 - z) / 7));
    tint.setHSL(0.115 + Math.random() * 0.016, 0.85, 0.59 + Math.random() * 0.1);
    buckets[row * 2 + (side > 0 ? 1 : 0)].push({ matrix: dummy.matrix.clone(), color: tint.clone() });
  }
  const sectors = [];
  const geometryKeys = ['stemGeo', 'headGeo', 'petalGeo'];
  buckets.forEach((records, index) => {
    if (!records.length) return;
    const levels = [nearGeometry, farGeometry].map((geometries, detail) => {
      const group = new THREE.Group();
      group.visible = detail === 1;
      const meshes = geometryKeys.map((key, part) => {
        const mesh = new THREE.InstancedMesh(geometries[key], materials[part], records.length);
        records.forEach((record, i) => {
          mesh.setMatrixAt(i, record.matrix);
          if (part === 2) mesh.setColorAt(i, record.color);
        });
        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.customDepthMaterial = depthMaterial;
        mesh.computeBoundingSphere();
        // Reservar amplitud para viento y repulsión al hacer frustum culling.
        mesh.boundingSphere.radius += 0.45;
        group.add(mesh);
        return mesh;
      });
      root.add(group);
      return { group, meshes };
    });
    const row = Math.floor(index / 2);
    const z = 8.5 - row * 7;
    sectors.push({ capacity: records.length, active: records.length, levels,
      center: new THREE.Vector3(pathCenter(z) + (index % 2 ? 7 : -7), FLOWER_HEIGHT / 2, z),
      near: false });
  });

  const heroMaterials = [];
  const heroHeadGeometry = nearGeometry.headGeo.clone().translate(0, -FLOWER_HEIGHT, 0);
  const heroPetalGeometry = nearGeometry.petalGeo.clone().translate(0, -FLOWER_HEIGHT, 0);
  const haloGeometry = new THREE.RingGeometry(0.33, 0.35, 48);
  const particleGeometry = makePetal(0.08, 0.035, 2);
  const particleMaterial = new THREE.MeshStandardMaterial({ color: 0xffd658,
    map: petals.map, side: THREE.DoubleSide, emissive: 0x9b6717, emissiveIntensity: 0.35 });
  const particleMesh = new THREE.InstancedMesh(particleGeometry, particleMaterial, 30);
  particleMesh.count = 0;
  particleMesh.frustumCulled = false;
  root.add(particleMesh);
  const particles = [];
  const heroState = [];
  let elapsed = 0;
  let quality = 'high';
  let disposed = false;

  const discoveries = [6, -5, -16].map((z, id) => {
    const object = new THREE.Group();
    object.name = `discovery-${id + 1}`;
    object.position.set(pathCenter(z) + (id === 1 ? -1.65 : 1.65), 0, z);
    object.rotation.y = id === 1 ? 0.12 : -0.12;
    object.scale.setScalar(1.28);
    object.userData.discoveryId = id;
    const stemMaterial = new THREE.MeshStandardMaterial({ color: 0x397a2e,
      roughness: 0.85, side: THREE.DoubleSide });
    const headMaterial = new THREE.MeshStandardMaterial({ map: seeds, color: 0xffedd0,
      roughness: 0.75, side: THREE.DoubleSide, emissive: 0x73511b, emissiveIntensity: 0.12 });
    const petalMaterial = new THREE.MeshStandardMaterial({ map: petals.map,
      normalMap: petals.normalMap, color: 0xfff09f, roughness: 0.5,
      side: THREE.DoubleSide, emissive: 0xd99217, emissiveIntensity: 0.34 });
    const haloMaterial = new THREE.MeshBasicMaterial({ color: 0xffe595,
      transparent: true, opacity: 0.18, side: THREE.DoubleSide,
      depthWrite: false, blending: THREE.AdditiveBlending });
    heroMaterials.push(stemMaterial, headMaterial, petalMaterial, haloMaterial);
    const stem = new THREE.Mesh(nearGeometry.stemGeo, stemMaterial);
    const head = new THREE.Mesh(heroHeadGeometry, headMaterial);
    const crown = new THREE.Mesh(heroPetalGeometry, petalMaterial);
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    head.position.y = crown.position.y = halo.position.y = FLOWER_HEIGHT;
    halo.position.z = -0.04;
    crown.scale.set(0.9, 0.9, 1);
    [stem, head, crown].forEach(mesh => { mesh.castShadow = true; });
    [head, crown].forEach(mesh => { mesh.userData.discoveryId = id; });
    object.add(stem, head, crown, halo);
    root.add(object);
    object.updateWorldMatrix(true, false);
    const position = object.localToWorld(new THREE.Vector3(0, FLOWER_HEIGHT, 0));
    const state = { object, head, crown, halo, headMaterial, petalMaterial, haloMaterial,
      active: false, progress: 0, baseYaw: object.rotation.y, position };
    heroState.push(state);
    return { id, object, position, hitTargets: [head, crown], activate(){
      if (disposed || state.active) return false;
      state.active = true;
      object.userData.activated = true;
      if (reduceMotion){
        state.progress = 1;
        crown.scale.set(1.14, 1.14, 1);
        petalMaterial.emissiveIntensity = 1.65;
        headMaterial.emissiveIntensity = 0.58;
        haloMaterial.opacity = 0.58;
      } else {
        for (let i = 0; i < 10 && particles.length < 30; i++){
          particles.push({ position: position.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.25, 0.08)),
            velocity: new THREE.Vector3((Math.random() - 0.5) * 0.7,
              0.35 + Math.random() * 0.4, 0.15 + Math.random() * 0.2),
            age: 0, life: 1.3 + Math.random() * 0.45,
            spin: Math.random() * Math.PI * 2 });
        }
      }
      return true;
    } };
  });

  function setQuality(level){
    const next = typeof level === 'number' ? ['low', 'medium', 'high'][level] : level;
    quality = QUALITY[next] ? next : 'medium';
    const settings = QUALITY[quality];
    sectors.forEach(sector => {
      sector.active = Math.floor(sector.capacity * settings.density);
      sector.levels.forEach((levelData, detail) => levelData.meshes.forEach(mesh => {
        mesh.count = sector.active;
        mesh.castShadow = detail === 0 && settings.shadows;
      }));
    });
  }

  function reset(){
    if (disposed) return;
    elapsed = 0;
    windUniforms.uTime.value = 0;
    windUniforms.uPointer.value.set(999, 999);
    windUniforms.uWind.value = reduceMotion ? 0 : 1;
    particles.length = 0;
    particleMesh.count = 0;
    heroState.forEach(state => {
      state.active = false;
      state.progress = 0;
      state.object.userData.activated = false;
      state.object.rotation.set(0, state.baseYaw, 0);
      state.crown.scale.set(0.9, 0.9, 1);
      state.petalMaterial.emissiveIntensity = 0.34;
      state.headMaterial.emissiveIntensity = 0.12;
      state.haloMaterial.opacity = 0.18;
      state.halo.scale.setScalar(1);
      state.object.updateWorldMatrix(true, false);
      state.position.set(0, FLOWER_HEIGHT, 0);
      state.object.localToWorld(state.position);
    });
  }

  function setReducedMotion(value){
    if (disposed) return;
    reduceMotion = Boolean(value);
    windUniforms.uWind.value = reduceMotion ? 0 : 1;
    if (!reduceMotion) return;
    particles.length = 0;
    particleMesh.count = 0;
    heroState.forEach(state => {
      state.object.rotation.set(0, state.baseYaw, 0);
      state.halo.scale.setScalar(1);
      state.progress = state.active ? 1 : 0;
      const openness = state.active ? 1.14 : 0.9;
      state.crown.scale.set(openness, openness, 1);
      state.petalMaterial.emissiveIntensity = state.active ? 1.65 : 0.34;
      state.headMaterial.emissiveIntensity = state.active ? 0.58 : 0.12;
      state.haloMaterial.opacity = state.active ? 0.58 : 0.18;
      state.object.updateWorldMatrix(true, false);
      state.position.set(0, FLOWER_HEIGHT, 0);
      state.object.localToWorld(state.position);
    });
  }

  function update(dt, camera){
    if (disposed) return;
    const delta = Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.05));
    if (!reduceMotion){
      elapsed += delta;
      windUniforms.uTime.value += delta;
    }
    if (camera){
      const range = QUALITY[quality].near;
      sectors.forEach(sector => {
        const distance = camera.position.distanceTo(sector.center);
        // Histéresis: evitar cambiar de geometría a cada frame en el límite.
        sector.near = distance < range + (sector.near ? 1.5 : -1.5);
        sector.levels[0].group.visible = sector.near && sector.active > 0;
        sector.levels[1].group.visible = !sector.near && sector.active > 0;
      });
    }
    if (reduceMotion) return;
    heroState.forEach((state, id) => {
      state.object.rotation.z = Math.sin(elapsed * 1.05 + id) * 0.014;
      state.object.rotation.y = state.baseYaw + Math.sin(elapsed * 0.65 + id) * 0.035;
      if (state.active) state.progress += (1 - state.progress) * (1 - Math.exp(-delta * 5));
      const openness = 0.9 + state.progress * 0.24;
      state.crown.scale.set(openness, openness, 1);
      state.petalMaterial.emissiveIntensity = 0.34 + state.progress * 1.31;
      state.headMaterial.emissiveIntensity = 0.12 + state.progress * 0.46;
      state.haloMaterial.opacity = (state.active ? 0.5 : 0.18) + Math.sin(elapsed * 2 + id) * 0.04;
      state.halo.scale.setScalar(1 + Math.sin(elapsed * 1.7 + id) * 0.035);
      state.object.updateWorldMatrix(true, false);
      state.position.set(0, FLOWER_HEIGHT, 0);
      state.object.localToWorld(state.position);
    });
    for (let i = particles.length - 1; i >= 0; i--){
      const particle = particles[i];
      particle.age += delta;
      if (particle.age >= particle.life) particles.splice(i, 1);
    }
    particles.forEach((particle, i) => {
      particle.velocity.y -= delta * 0.5;
      particle.position.addScaledVector(particle.velocity, delta);
      dummy.position.copy(particle.position);
      dummy.rotation.set(particle.spin + particle.age * 2.4, particle.age, particle.spin);
      dummy.scale.setScalar(Math.max(0.01, 1 - particle.age / particle.life));
      dummy.updateMatrix();
      particleMesh.setMatrixAt(i, dummy.matrix);
    });
    particleMesh.count = particles.length;
    if (particles.length) particleMesh.instanceMatrix.needsUpdate = true;
  }

  function dispose(){
    if (disposed) return;
    disposed = true;
    scene.remove(root);
    root.traverse(object => { if (object.isInstancedMesh) object.dispose(); });
    [...Object.values(nearGeometry), ...Object.values(farGeometry),
      heroHeadGeometry, heroPetalGeometry, haloGeometry, particleGeometry].forEach(geometry => geometry.dispose());
    [...materials, ...heroMaterials, depthMaterial, particleMaterial].forEach(material => material.dispose());
    [seeds, petals.map, petals.normalMap].forEach(texture => texture.dispose());
    particles.length = 0;
  }

  setQuality(opts.quality || 'high');
  return { get count(){ return sectors.reduce((sum, sector) => sum + sector.active, 0); },
    discoveries, update, setQuality, setReducedMotion, reset, dispose };
}
