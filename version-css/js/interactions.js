/* ================= interactions.js — mouse, táctil y clicks en el campo =================
   Delegación de eventos sobre #flower-tunnel (sin listeners por flor).
   Inclinación suave por proximidad con posiciones cacheadas. */
(function(){
"use strict";
window.SF = window.SF || {};

var entries = [];        // { outer, tilt, cx, cy }
var pointer = { x: -9999, y: -9999, active: false };
var reduceMotion = false;
var running = false;
var rafId = null, posTimer = null;
var tapCount = 0;
var onSpecialTap = null; // callback hacia scenes

var RADIUS = 180;        // px de influencia del cursor
var MAX_TILT = 7;        // grados máximos, efecto sutil

function refreshPositions(){
  for (var i = 0; i < entries.length; i++){
    var r = entries[i].outer.getBoundingClientRect();
    entries[i].cx = r.left;
    entries[i].cy = r.top;
  }
}

function tick(){
  var hasAny = false;
  for (var i = 0; i < entries.length; i++){
    var e = entries[i];
    var dx = pointer.x - e.cx;
    var dy = pointer.y - e.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var target = 0;
    if (pointer.active && dist < RADIUS){
      var force = 1 - dist / RADIUS;
      // se inclinan alejándose levemente del cursor
      target = (dx > 0 ? -1 : 1) * force * MAX_TILT;
      target *= Math.max(0.3, 1 - Math.abs(dy) / (RADIUS * 2));
    }
    e.cur = (e.cur || 0) + (target - (e.cur || 0)) * 0.08;
    if (Math.abs(e.cur) > 0.05 || target !== 0){
      e.tilt.style.transform = "rotate(" + e.cur.toFixed(2) + "deg)";
      hasAny = true;
    }
  }
  // seguimos animando solo si hay movimiento pendiente
  rafId = (hasAny || pointer.active) ? requestAnimationFrame(tick) : null;
}

function ensureLoop(){
  if (!rafId && !reduceMotion) rafId = requestAnimationFrame(tick);
}

function onPointerMove(ev){
  var x = ev.clientX, y = ev.clientY;
  if (ev.touches && ev.touches[0]){ x = ev.touches[0].clientX; y = ev.touches[0].clientY; }
  pointer.x = x; pointer.y = y; pointer.active = true;
  ensureLoop();
}

function onPointerLeave(){
  pointer.active = false;
  pointer.x = pointer.y = -9999;
}

function nearestFlower(x, y, maxDist){
  refreshPositions(); // las flores se mueven: medimos en el momento del toque
  var best = null, bestD = maxDist;
  for (var i = 0; i < entries.length; i++){
    var dx = x - entries[i].cx;
    var dy = y - entries[i].cy;
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < bestD){ bestD = d; best = entries[i]; }
  }
  return best;
}

function onTap(ev){
  if (!entries.length) return;
  var hit = nearestFlower(ev.clientX, ev.clientY, 110);
  if (!hit) return;
  var tiltEl = hit.tilt;
  var outer = hit.outer;

  // reacción visual: pequeño rebote
  if (!reduceMotion){
    tiltEl.style.setProperty("--tap-dir", (Math.random() < 0.5 ? -6 : 6) + "deg");
    tiltEl.classList.remove("tapped");
    void tiltEl.offsetWidth; // reinicia la animación
    tiltEl.classList.add("tapped");
  }

  // las flores especiales sueltan pétalos (sin partículas en reduce-motion)
  if (!reduceMotion && outer.classList.contains("special")){
    SF.environment.petalBurst(ev.clientX, ev.clientY, 6);
  }

  tapCount++;
  if (onSpecialTap) onSpecialTap(tapCount, outer);
}

/* ---------- API ---------- */
function init(flowers, opts){
  destroy();
  reduceMotion = !!opts.reduceMotion;
  onSpecialTap = opts.onSpecialTap || null;
  entries = flowers.map(function(f){
    return { outer: f, tilt: f.querySelector(".flower-tilt"), cx: -9999, cy: -9999, cur: 0 };
  });

  var scene = document.getElementById("scene");
  if (!reduceMotion){
    scene.addEventListener("pointermove", onPointerMove, { passive: true });
    scene.addEventListener("pointerleave", onPointerLeave);
    refreshPositions();
    posTimer = setInterval(refreshPositions, 200);
  }
  // click y toque usan el mismo manejador, delegado sobre la escena
  // (las flores no tienen hit-area propia: se resuelve por proximidad)
  scene.addEventListener("pointerdown", onTap);
  running = true;
}

function destroy(){
  var scene = document.getElementById("scene");
  if (scene){
    scene.removeEventListener("pointermove", onPointerMove);
    scene.removeEventListener("pointerleave", onPointerLeave);
  }
  if (scene) scene.removeEventListener("pointerdown", onTap);
  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
  if (posTimer){ clearInterval(posTimer); posTimer = null; }
  entries = [];
  tapCount = 0;
  running = false;
}

SF.interactions = {
  init: init,
  destroy: destroy,
  getTapCount: function(){ return tapCount; }
};
})();
