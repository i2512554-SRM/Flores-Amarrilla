/* ================= interactions.js — mouse, táctil y clicks en el campo =================
   - Inclinación con física de muelle (spring: rigidez + amortiguación), no lerp lineal.
   - pointermove/touchmove con throttle por rAF (un cálculo por frame máximo).
   - Pausa total del bucle cuando la pestaña no es visible (document.hidden).
   - Toque/click resuelto por proximidad (las flores no tienen hit-area propia). */
(function(){
"use strict";
window.SF = window.SF || {};

/* --- física del muelle (ajustables) --- */
var SPRING_STIFFNESS = 0.055;  // atracción hacia el objetivo
var SPRING_DAMPING   = 0.86;   // fricción (más bajo = más rebote)
var RADIUS   = 180;            // px de influencia del cursor
var MAX_TILT = 7;              // grados máximos, efecto sutil

var entries = [];              // { outer, tilt, cx, cy, cur, vel }
var pointer = { x: -9999, y: -9999, active: false };
var lastPointerEvent = null;
var pointerDirty = false;
var reduceMotion = false;
var rafId = null, posTimer = null;
var tapCount = 0;
var onSpecialTap = null;

function refreshPositions(){
  for (var i = 0; i < entries.length; i++){
    var r = entries[i].outer.getBoundingClientRect();
    entries[i].cx = r.left;
    entries[i].cy = r.top;
  }
}

function tick(){
  // aplicar el último puntero (throttle: a lo sumo una vez por frame)
  if (pointerDirty && lastPointerEvent){
    var ev = lastPointerEvent;
    pointer.x = ev.clientX; pointer.y = ev.clientY; pointer.active = true;
    pointerDirty = false;
  }

  var hasAny = false;
  for (var i = 0; i < entries.length; i++){
    var e = entries[i];
    var dx = pointer.x - e.cx;
    var dy = pointer.y - e.cy;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var target = 0;
    if (pointer.active && dist < RADIUS){
      var force = 1 - dist / RADIUS;
      target = (dx > 0 ? -1 : 1) * force * MAX_TILT;      // se alejan del cursor
      target *= Math.max(0.3, 1 - Math.abs(dy) / (RADIUS * 2));
    }
    // muelle: aceleración proporcional a la distancia, con amortiguación
    e.vel = (e.vel + (target - e.cur) * SPRING_STIFFNESS) * SPRING_DAMPING;
    e.cur += e.vel;
    if (Math.abs(e.cur) > 0.02 || Math.abs(e.vel) > 0.02){
      e.tilt.style.transform = "rotate(" + e.cur.toFixed(2) + "deg)";
      hasAny = true;
    }
  }
  rafId = (hasAny || pointer.active) ? requestAnimationFrame(tick) : null;
}

function ensureLoop(){
  if (!rafId && !reduceMotion && !document.hidden) rafId = requestAnimationFrame(tick);
}

/* throttle por rAF: solo guardamos el último evento */
function onPointerMove(ev){
  lastPointerEvent = ev;
  pointerDirty = true;
  ensureLoop();
}

function onPointerLeave(){
  pointer.active = false;
  pointer.x = pointer.y = -9999;
}

/* pausa/reanudación al cambiar de pestaña */
function onVisibility(){
  if (document.hidden){
    if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
    if (posTimer){ clearInterval(posTimer); posTimer = null; }
  } else if (entries.length && !reduceMotion){
    refreshPositions();
    posTimer = setInterval(refreshPositions, 200);
    ensureLoop();
  }
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
  // ignorar toques sobre la UI (botones, tarjeta)
  if (ev.target.closest && ev.target.closest("#ui-controls, #final-card, button")) return;
  var hit = nearestFlower(ev.clientX, ev.clientY, 110);
  if (!hit) return;

  // reacción visual: pequeño impulso en el muelle (rebote natural)
  if (!reduceMotion){
    hit.vel += (Math.random() < 0.5 ? -1 : 1) * 2.2;
    ensureLoop();
    // cualquier flor suelta unos pétalos; las especiales, más (WAAPI, GPU-friendly)
    SF.environment.petalBurst(ev.clientX, ev.clientY,
      hit.outer.classList.contains("special") ? 6 : 2);
  }

  tapCount++;
  if (onSpecialTap) onSpecialTap(tapCount, hit.outer);
}

/* ---------- API ---------- */
function init(flowers, opts){
  destroy();
  reduceMotion = !!opts.reduceMotion;
  onSpecialTap = opts.onSpecialTap || null;
  entries = flowers.map(function(f){
    return { outer: f, tilt: f.querySelector(".flower-tilt"), cx: -9999, cy: -9999, cur: 0, vel: 0 };
  });

  var scene = document.getElementById("scene");
  if (!reduceMotion){
    scene.addEventListener("pointermove", onPointerMove, { passive: true });
    scene.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    if (!document.hidden){
      refreshPositions();
      posTimer = setInterval(refreshPositions, 200);
    }
  }
  scene.addEventListener("pointerdown", onTap);
}

function destroy(){
  var scene = document.getElementById("scene");
  if (scene){
    scene.removeEventListener("pointermove", onPointerMove);
    scene.removeEventListener("pointerleave", onPointerLeave);
    scene.removeEventListener("pointerdown", onTap);
  }
  document.removeEventListener("visibilitychange", onVisibility);
  if (rafId){ cancelAnimationFrame(rafId); rafId = null; }
  if (posTimer){ clearInterval(posTimer); posTimer = null; }
  entries = [];
  tapCount = 0;
}

SF.interactions = {
  init: init,
  destroy: destroy,
  getTapCount: function(){ return tapCount; }
};
})();
