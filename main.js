/* Viaje guiado, descubrimientos 3D y controles equivalentes por teclado/tacto. */
import * as THREE from 'three';
import { createScene } from './scene3d.js';
import { buildSunflowerField, windUniforms, pathCenter } from './sunflowerField.js';
import { createSoundscape } from './audio3d.js?v=20260918-music';
import { CONFIG } from './config3d.js?v=20260918-music';

function initialize() {
  const $ = id => document.getElementById(id);
  const ui = {
    intro: $('intro'), start: $('start-btn'), toolbar: $('toolbar'),
    journey: $('journey-ui'), chapter: $('chapter-label'), title: $('chapter-title'),
    hint: $('hint'), progress: $('progress-fill'), count: $('discovery-count'),
    flower: $('flower-action'), heart: $('heart-action'), pause: $('pause-btn'),
    next: $('continue-btn'), replay: $('replay-btn'), sound: $('sound-btn'),
    quality: $('quality-select'), motion: $('motion-btn'),
    card: $('final-card'), close: $('final-close')
  };
  const canvas = $('webgl-canvas');
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = motionPreference.matches;
  const mobile = matchMedia('(max-width: 700px)').matches;
  const qualityLevels = ['low', 'medium', 'high'];
  let qualityMode = CONFIG.quality.default;
  try { qualityMode = localStorage.getItem('sf3d-quality') || qualityMode; } catch {}
  if (!['auto', ...qualityLevels].includes(qualityMode)) qualityMode = 'auto';
  const automaticQuality = () => mobile || (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) ? 'low' : 'medium';
  let quality = qualityMode === 'auto' ? automaticQuality() : qualityMode;
  const core = createScene(canvas, { quality, reduceMotion });
  const { renderer, scene, camera, composer, bokeh } = core;
  const field = buildSunflowerField(scene, {
    count: CONFIG.quality.maximumFlowers[mobile ? 'mobile' : 'desktop'], quality, reduceMotion
  });
  const audio = createSoundscape({
    ...CONFIG.sound, musicElement: $('background-music'), onError: handleSoundError
  });
  const discoveries = field.discoveries;
  const collected = new Set();
  const lookDesired = new THREE.Vector2();
  const look = new THREE.Vector2();
  const aim = new THREE.Vector3();
  const aimDesired = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();
  const pointerTarget = new THREE.Vector2(999, 999);
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const clock = new THREE.Clock();
  let state = 'intro', stop = 0, trip = null, paused = false;
  let activationDelay = null, elapsed = 0, soundEnabled = false, disposed = false, contextFailed = false;
  let soundChoice = null, soundPending = false;
  let pointer = null, pointerNdcValid = false;
  let averageFrame = 1 / 60, sampleTime = 0, sampleFrames = 0;

  // El corazón es un objeto volumétrico al final del sendero, cercano al usuario.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0.22);
  shape.bezierCurveTo(-0.1, 0.5, -0.5, 0.48, -0.5, 0.16);
  shape.bezierCurveTo(-0.5, -0.04, -0.22, -0.23, 0, -0.45);
  shape.bezierCurveTo(0.22, -0.23, 0.5, -0.04, 0.5, 0.16);
  shape.bezierCurveTo(0.5, 0.48, 0.1, 0.5, 0, 0.22);
  shape.closePath();
  const heartGeometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.14, bevelEnabled: true, bevelThickness: 0.045,
    bevelSize: 0.04, bevelSegments: 3, steps: 1, curveSegments: 20
  });
  heartGeometry.center();
  const heartMaterial = new THREE.MeshStandardMaterial({
    color: 0xeec7a1, emissive: 0xcc8b45, emissiveIntensity: 0.45,
    roughness: 0.35, metalness: 0.16
  });
  const heartMesh = new THREE.Mesh(heartGeometry, heartMaterial);
  heartMesh.scale.setScalar(1.25);
  heartMesh.castShadow = true;
  const haloGeometry = new THREE.RingGeometry(0.72, 0.732, 80);
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: 0xffe6b1, side: THREE.DoubleSide, transparent: true,
    opacity: 0.38, depthWrite: false
  });
  const halo = new THREE.Mesh(haloGeometry, haloMaterial);
  halo.position.z = -0.15;
  const destination = new THREE.Group();
  destination.position.set(pathCenter(-28), 1.72, -28);
  destination.add(heartMesh, halo, new THREE.PointLight(0xffd096, 1.2, 6));
  destination.visible = false;
  scene.add(destination);

  function applyQuality(level) {
    quality = core.setQuality(level);
    field.setQuality(quality);
    canvas.dataset.quality = quality;
    const label = { low: 'ligera', medium: 'media', high: 'alta' }[quality];
    ui.quality.title = qualityMode === 'auto' ? 'Automática: calidad ' + label : 'Calidad ' + label;
    averageFrame = 1 / 60;
    sampleTime = 0;
    sampleFrames = 0;
  }

  function setMotion(value) {
    reduceMotion = value;
    document.documentElement.classList.toggle('reduced-motion', value);
    core.setReducedMotion(value);
    field.setReducedMotion(value);
    lookDesired.set(0, 0);
    look.set(0, 0);
    ui.motion.setAttribute('aria-pressed', String(value));
    ui.motion.textContent = value ? 'Movimiento reducido: activado' : 'Recorrido sin movimiento';
    $('loading-note').textContent = value ? 'Un recorrido tranquilo, sin desplazamientos de cámara.' : 'Puedes mirar con el ratón, arrastrar o usar las flechas.';
    if (value) activationDelay = null;
    if (value && trip) finishTrip();
  }

  function updateInterface() {
    ui.journey.dataset.phase = state;
    ui.flower.hidden = state !== 'discovery' || collected.has(stop);
    ui.heart.hidden = !['arrival', 'explore'].includes(state);
    ui.pause.hidden = state !== 'travelling';
    ui.pause.setAttribute('aria-pressed', String(paused));
    ui.pause.textContent = paused ? 'Reanudar viaje' : 'Pausar viaje';
    ui.next.hidden = state !== 'discovery';
    ui.replay.hidden = !['arrival', 'explore'].includes(state);
    ui.count.textContent = collected.size + ' de ' + discoveries.length + ' girasoles despiertos';
    canvas.classList.toggle('can-interact', ['discovery', 'arrival', 'explore'].includes(state));
  }

  function placeCamera(z) {
    camera.position.set(pathCenter(z), 1.52 + (reduceMotion ? 0 : Math.sin((14 - z) * 0.16) * 0.07), z);
  }

  function beginTrip(index) {
    if ([ui.flower, ui.next, ui.replay].includes(document.activeElement)) canvas.focus({ preventScroll: true });
    stop = index;
    paused = false;
    activationDelay = null;
    lookDesired.set(0, 0);
    state = 'travelling';
    const toZ = index < discoveries.length ? discoveries[index].object.position.z + CONFIG.journey.stopDistance : CONFIG.journey.endZ;
    trip = { fromZ: camera.position.z, toZ, elapsed: 0, duration: CONFIG.journey.durations[index], opening: false };
    if (index === discoveries.length) {
      destination.visible = true;
      ui.chapter.textContent = '04 / UN REGALO PARA TI';
      ui.title.textContent = 'Algo te espera al final';
      ui.hint.textContent = 'Sigue la luz hasta el corazón.';
    } else {
      const chapter = CONFIG.chapters[index];
      ui.chapter.textContent = chapter.label;
      ui.title.textContent = chapter.title;
      ui.hint.textContent = reduceMotion ? 'Elige el girasol para descubrir su luz.' : 'Arrastra para mirar. También puedes usar las flechas.';
    }
    updateInterface();
    if (reduceMotion) finishTrip();
  }

  function finishTrip() {
    if (!trip) return;
    placeCamera(trip.toZ);
    const opening = trip.opening;
    trip = null;
    if (opening) { showFinal(); return; }
    state = stop < discoveries.length ? 'discovery' : 'arrival';
    ui.hint.textContent = state === 'discovery' ? CONFIG.chapters[stop].hint : 'Este corazón guarda algo para ti. Tócalo para abrirlo.';
    if (reduceMotion) {
      aim.copy(state === 'discovery' ? discoveries[stop].position : destination.position);
      camera.lookAt(aim);
      camera.updateMatrixWorld();
    }
    updateInterface();
    if ([canvas, document.body, ui.pause].includes(document.activeElement)) {
      (state === 'discovery' ? ui.flower : ui.heart).focus({ preventScroll: true });
    }
  }

  function enterField() {
    if (CONFIG.sound.startOnEnter && soundChoice !== false && !soundEnabled) setSound(true);
    ui.start.disabled = true;
    ui.intro.classList.add('leaving');
    ui.intro.inert = true;
    setTimeout(() => { if (!contextFailed) ui.intro.hidden = true; }, reduceMotion ? 0 : 700);
    ui.journey.hidden = false;
    collected.clear();
    field.reset();
    destination.visible = false;
    heartMaterial.emissiveIntensity = 0.45;
    placeCamera(CONFIG.journey.startZ);
    aim.set(pathCenter(6), 1.55, 6);
    look.set(0, 0);
    canvas.focus({ preventScroll: true });
    beginTrip(0);
  }

  function awakenFlower() {
    if (state !== 'discovery' || !discoveries[stop].activate()) return;
    collected.add(stop);
    audio.chime(stop);
    ui.hint.textContent = ['Una pequeña luz para acompañarte.', 'El camino se llena de vida.', 'La última luz. Tu regalo está cerca.'][stop];
    activationDelay = reduceMotion ? null : 0.95;
    updateInterface();
    ui.next.focus({ preventScroll: true });
    // En modo reducido, el siguiente paso siempre depende de un gesto del usuario.
  }

  function openMessage() {
    if (!['arrival', 'explore'].includes(state)) return;
    state = 'opening';
    paused = false;
    lookDesired.set(0, 0);
    audio.chime(3);
    heartMaterial.emissiveIntensity = 0.8;
    trip = {
      fromZ: camera.position.z, toZ: -25.65, elapsed: 0,
      duration: CONFIG.journey.openingDuration, opening: true
    };
    ui.hint.textContent = 'Un mensaje, solo para ti.';
    updateInterface();
    if (reduceMotion) { trip = null; showFinal(); }
  }

  function showFinal() {
    state = 'final';
    const message = CONFIG.finalMessage;
    $('final-title').textContent = message.title;
    $('final-message').textContent = message.message;
    $('final-signature').textContent = message.signature;
    ui.close.textContent = message.closeButton;
    ui.toolbar.inert = true;
    ui.journey.inert = true;
    canvas.inert = true;
    ui.card.hidden = false;
    updateInterface();
    ui.close.focus({ preventScroll: true });
  }

  function closeFinal() {
    ui.card.hidden = true;
    ui.toolbar.inert = ui.journey.inert = canvas.inert = false;
    state = 'explore';
    heartMaterial.emissiveIntensity = 0.45;
    ui.chapter.textContent = 'EL CAMPO ES TUYO';
    ui.title.textContent = 'Quédate un momento más';
    ui.hint.textContent = reduceMotion ? 'Puedes volver a abrir tu mensaje o repetir los descubrimientos.' : 'Mira a tu alrededor. Puedes volver a abrir tu mensaje o recorrer el campo de nuevo.';
    updateInterface();
    ui.heart.focus({ preventScroll: true });
  }

  function togglePause() {
    if (state !== 'travelling') return;
    paused = !paused;
    ui.hint.textContent = paused ? 'El sendero puede esperar. Mira a tu alrededor.' : 'Seguimos. Deja que la luz te guíe.';
    updateInterface();
  }

  function projectHotspot(button, position) {
    if (button.hidden) return;
    projected.copy(position);
    projected.y += 0.56;
    projected.project(camera);
    const horizontalMargin = Math.min(120, innerWidth * 0.3);
    const lowerEdge = Math.max(innerHeight * 0.5, innerHeight - (innerWidth < 700 ? 215 : 150));
    const x = THREE.MathUtils.clamp((projected.x + 1) * innerWidth / 2, horizontalMargin, innerWidth - horizontalMargin);
    const y = THREE.MathUtils.clamp((1 - projected.y) * innerHeight / 2, Math.min(175, innerHeight * 0.4), lowerEdge);
    button.style.left = x + 'px';
    button.style.top = y + 'px';
  }

  function renderCamera(dt) {
    if (trip && !paused) {
      trip.elapsed += dt;
      const t = Math.min(1, trip.elapsed / trip.duration);
      const eased = t * t * (3 - 2 * t);
      placeCamera(THREE.MathUtils.lerp(trip.fromZ, trip.toZ, eased));
      if (t === 1) finishTrip();
    }
    if (state === 'discovery' && activationDelay !== null) {
      activationDelay -= dt;
      if (activationDelay <= 0) beginTrip(stop + 1);
    }
    if (['opening', 'arrival', 'explore', 'final'].includes(state)) {
      aimDesired.copy(destination.position);
    } else if (state === 'discovery') {
      aimDesired.copy(discoveries[stop].position);
    } else {
      const z = camera.position.z - 7;
      aimDesired.set(pathCenter(z), 1.55, z);
    }
    const damping = reduceMotion ? 1 : 1 - Math.exp(-dt * 3.8);
    aim.lerp(aimDesired, damping);
    look.lerp(lookDesired, reduceMotion ? 1 : 1 - Math.exp(-dt * 7));
    camera.lookAt(aim);
    camera.rotateY(look.x);
    camera.rotateX(look.y);
    camera.updateMatrixWorld();
    const focus = camera.position.distanceTo(aimDesired);
    bokeh.uniforms.focus.value = THREE.MathUtils.damp(bokeh.uniforms.focus.value, focus, 5, dt);
    const progress = THREE.MathUtils.clamp((CONFIG.journey.startZ - camera.position.z) / (CONFIG.journey.startZ - CONFIG.journey.endZ), 0, 1);
    ui.progress.style.width = (progress * 100).toFixed(1) + '%';
    core.setAmbience(progress * 0.72);
  }

  function updatePointer(ev) {
    const bounds = canvas.getBoundingClientRect();
    ndc.set((ev.clientX - bounds.left) / bounds.width * 2 - 1, -(ev.clientY - bounds.top) / bounds.height * 2 + 1);
    pointerNdcValid = true;
  }

  canvas.addEventListener('pointerdown', ev => {
    if (ev.button !== 0 || ['intro', 'opening', 'final'].includes(state)) return;
    pointer = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, lastX: ev.clientX, lastY: ev.clientY, moved: false };
    canvas.setPointerCapture(ev.pointerId);
    updatePointer(ev);
  });
  canvas.addEventListener('pointermove', ev => {
    if (state === 'intro' || state === 'final') return;
    updatePointer(ev);
    if (pointer && pointer.id === ev.pointerId) {
      pointer.moved ||= Math.hypot(ev.clientX - pointer.x, ev.clientY - pointer.y) > 8;
      if (pointer.moved) {
        lookDesired.x = THREE.MathUtils.clamp(lookDesired.x - (ev.clientX - pointer.lastX) * 0.0025, -0.48, 0.48);
        lookDesired.y = THREE.MathUtils.clamp(lookDesired.y - (ev.clientY - pointer.lastY) * 0.0018, -0.2, 0.2);
      }
      pointer.lastX = ev.clientX;
      pointer.lastY = ev.clientY;
    } else if (ev.pointerType === 'mouse' && !reduceMotion) {
      lookDesired.set(-ndc.x * 0.12, ndc.y * 0.06);
    }
  }, { passive: true });
  canvas.addEventListener('pointerup', ev => {
    if (!pointer || pointer.id !== ev.pointerId) return;
    const shouldSelect = !pointer.moved;
    pointer = null;
    if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    if (!shouldSelect) return;
    updatePointer(ev);
    raycaster.setFromCamera(ndc, camera);
    if (state === 'discovery' && raycaster.intersectObjects(discoveries[stop].hitTargets, false).length) awakenFlower();
    else if (['arrival', 'explore'].includes(state) && raycaster.intersectObject(heartMesh, false).length) openMessage();
  });
  const releasePointer = () => { pointer = null; pointerNdcValid = false; pointerTarget.set(999, 999); lookDesired.set(0, 0); };
  canvas.addEventListener('pointercancel', releasePointer);
  canvas.addEventListener('pointerleave', () => { if (!pointer) releasePointer(); });
  window.addEventListener('blur', releasePointer);

  ui.start.addEventListener('click', enterField);
  ui.flower.addEventListener('click', awakenFlower);
  ui.heart.addEventListener('click', openMessage);
  ui.next.addEventListener('click', () => { if (state === 'discovery') beginTrip(stop + 1); });
  ui.replay.addEventListener('click', enterField);
  ui.pause.addEventListener('click', togglePause);
  ui.close.addEventListener('click', closeFinal);
  ui.motion.addEventListener('click', () => setMotion(!reduceMotion));
  ui.quality.value = qualityMode;
  ui.quality.addEventListener('change', () => {
    qualityMode = ui.quality.value;
    try { localStorage.setItem('sf3d-quality', qualityMode); } catch {}
    applyQuality(qualityMode === 'auto' ? automaticQuality() : qualityMode);
  });
  function handleSoundError() {
    if (disposed || contextFailed) return;
    soundEnabled = false;
    ui.sound.textContent = 'Reintentar música';
    ui.sound.setAttribute('aria-pressed', 'false');
    const note = state === 'intro' ? $('loading-note') : ui.hint;
    note.textContent = 'Puedes continuar y volver a activar la música con el botón de arriba.';
  }

  async function setSound(value, manual = false) {
    if (disposed || contextFailed || soundPending) return;
    if (manual) soundChoice = value;
    soundPending = true;
    ui.sound.disabled = true;
    try {
      const actual = await audio.setEnabled(value);
      if (disposed || contextFailed) return;
      soundEnabled = actual;
      if (value && !actual) { handleSoundError(); return; }
      ui.sound.textContent = soundEnabled ? 'Música: activada' : 'Música: apagada';
      ui.sound.setAttribute('aria-pressed', String(soundEnabled));
    } catch { handleSoundError(); }
    finally {
      soundPending = false;
      ui.sound.disabled = disposed || contextFailed;
    }
  }
  ui.sound.addEventListener('click', () => setSound(!soundEnabled, true));
  if (!CONFIG.sound.startOnEnter) ui.sound.textContent = 'Música: apagada';

  document.addEventListener('keydown', ev => {
    if (state === 'final') {
      if (ev.key === 'Escape') { ev.preventDefault(); closeFinal(); }
      if (ev.key === 'Tab') { ev.preventDefault(); ui.close.focus(); }
      return;
    }
    if (state === 'intro' || ev.target.closest?.('button, a, select, input, textarea')) return;
    const step = 0.055;
    if (ev.key === 'ArrowLeft') lookDesired.x = Math.min(0.48, lookDesired.x + step);
    else if (ev.key === 'ArrowRight') lookDesired.x = Math.max(-0.48, lookDesired.x - step);
    else if (ev.key === 'ArrowUp') lookDesired.y = Math.min(0.2, lookDesired.y + step);
    else if (ev.key === 'ArrowDown') lookDesired.y = Math.max(-0.2, lookDesired.y - step);
    else if (ev.key === 'Escape') lookDesired.set(0, 0);
    else if (ev.key === ' ') togglePause();
    else if (ev.key === 'Enter') {
      if (state === 'discovery') awakenFlower();
      else if (['arrival', 'explore'].includes(state)) openMessage();
    } else return;
    ev.preventDefault();
  });

  function loop() {
    if (disposed || contextFailed) return;
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05);
    if (!reduceMotion) elapsed += dt;
    field.update(dt, camera);
    if (destination.visible && !reduceMotion) {
      destination.position.y = 1.72 + Math.sin(elapsed * 1.3) * 0.035;
      heartMesh.rotation.y = Math.sin(elapsed * 0.6) * 0.12;
    }
    renderCamera(dt);
    if (pointerNdcValid && !reduceMotion) {
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) pointerTarget.set(hitPoint.x, hitPoint.z);
    }
    windUniforms.uPointer.value.lerp(pointerTarget, 1 - Math.exp(-dt * 8));
    core.update(dt, camera);
    projectHotspot(ui.flower, discoveries[Math.min(stop, discoveries.length - 1)].position);
    projectHotspot(ui.heart, destination.position);
    composer.render();
    // Adaptar solo tras una muestra sostenida, sin oscilaciones de calidad.
    if (qualityMode === 'auto' && state !== 'intro' && rawDt < 0.2) {
      averageFrame += (rawDt - averageFrame) * 0.025;
      sampleTime += dt;
      sampleFrames++;
      if (sampleTime > 8 && sampleFrames > 100) {
        const index = qualityLevels.indexOf(quality);
        if (index > 0 && averageFrame > (quality === 'high' ? 0.028 : 0.038)) applyQuality(qualityLevels[index - 1]);
        else { sampleTime = 0; sampleFrames = 0; }
      }
    }
  }

  function suspend() { renderer.setAnimationLoop(null); releasePointer(); audio.suspend().catch(() => {}); }
  function resume() { if (!disposed && !contextFailed && !document.hidden) { clock.getDelta(); renderer.setAnimationLoop(loop); audio.resume().catch(handleSoundError); } }
  document.addEventListener('visibilitychange', () => { document.hidden ? suspend() : resume(); });
  motionPreference.addEventListener('change', ev => setMotion(ev.matches));
  canvas.addEventListener('webglcontextlost', ev => {
    ev.preventDefault();
    contextFailed = true;
    state = 'intro';
    trip = activationDelay = null;
    suspend();
    ui.journey.hidden = ui.card.hidden = true;
    ui.toolbar.inert = false;
    ui.intro.hidden = false;
    ui.intro.inert = false;
    ui.intro.classList.remove('leaving');
    ui.sound.disabled = ui.quality.disabled = ui.motion.disabled = true;
    canvas.inert = true;
    window.experienceReady = false;
    window.experienceFailed();
  });
  window.addEventListener('pagehide', ev => {
    suspend();
    if (ev.persisted) return;
    disposed = true;
    audio.dispose();
    field.dispose();
    scene.remove(destination);
    heartGeometry.dispose();
    heartMaterial.dispose();
    haloGeometry.dispose();
    haloMaterial.dispose();
    core.dispose();
  });
  window.addEventListener('pageshow', ev => { if (ev.persisted) resume(); });

  applyQuality(quality);
  setMotion(reduceMotion);
  placeCamera(CONFIG.journey.startZ);
  aim.set(pathCenter(6), 1.55, 6);
  camera.lookAt(aim);
  updateInterface();
  ui.start.disabled = false;
  ui.start.textContent = 'Entrar al campo  →';
  $('loading-note').textContent = reduceMotion ? 'Un recorrido tranquilo, sin desplazamientos de cámara.' : 'Puedes mirar con el ratón, arrastrar o usar las flechas.';
  window.experienceReady = true;
  renderer.setAnimationLoop(loop);
}

try { initialize(); }
catch (error) {
  console.error('No se pudo iniciar el campo 3D:', error);
  window.experienceFailed();
}
