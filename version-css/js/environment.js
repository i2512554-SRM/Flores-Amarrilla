/* ================= environment.js — cielo, viento, nubes y ambiente ================= */
(function(){
"use strict";
window.SF = window.SF || {};

/* ---------- partículas de viento ---------- */
function buildWind(count){
  var layer = document.getElementById("wind-layer");
  layer.innerHTML = "";
  var rng = SF.flowers.makeRng(999);
  var frag = document.createDocumentFragment();
  for (var i = 0; i < count; i++){
    var p = document.createElement("div");
    p.className = "particle";
    var s = rng.rand(2, 5);
    p.style.width = s + "px";
    p.style.height = s + "px";
    p.style.top = rng.rand(4, 90) + "%";
    var dur = rng.rand(22, 42);
    p.style.animationDuration = dur + "s";
    p.style.animationDelay = "-" + rng.rand(0, dur).toFixed(2) + "s";
    p.style.setProperty("--pop", rng.rand(0.35, 0.75).toFixed(2));
    p.style.setProperty("--drift-y", rng.rand(-30, 30).toFixed(0) + "px");
    frag.appendChild(p);
  }
  layer.appendChild(frag);
}

/* ---------- nubes con forma de corazón (filtro compartido: cloud-fluff) ---------- */
function heartPathSVG(scale){
  var w = Math.round(100 * scale), h = Math.round(90 * scale);
  return (
    '<svg width="' + w + '" height="' + h + '" viewBox="0 0 100 90" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      '<path d="M50 88 C 46 84, 6 54, 6 28 C 6 12, 18 2, 32 2 C 41 2, 47 7, 50 14 C 53 7, 59 2, 68 2 C 82 2, 94 12, 94 28 C 94 54, 54 84, 50 88 Z" ' +
        'fill="#ffffff" opacity="0.55" filter="url(#cloud-fluff)" transform="translate(-2,3) scale(1.05)"/>' +
      '<path d="M50 88 C 46 84, 6 54, 6 28 C 6 12, 18 2, 32 2 C 41 2, 47 7, 50 14 C 53 7, 59 2, 68 2 C 82 2, 94 12, 94 28 C 94 54, 54 84, 50 88 Z" ' +
        'fill="#ffffff" filter="url(#cloud-fluff)"/>' +
    '</svg>'
  );
}

function buildClouds(count){
  var layer = document.getElementById("clouds-layer");
  layer.innerHTML = "";
  var configs = [
    { scale: 2.0, top: 6,  dur: 78, left0: -35 },
    { scale: 1.3, top: 30, dur: 58, left0: -20 },
    { scale: 1.6, top: 15, dur: 66, left0: -50 }
  ].slice(0, count);
  var frag = document.createDocumentFragment();
  configs.forEach(function(cfg, idx){
    var c = document.createElement("div");
    c.className = "heart-cloud";
    c.style.top = cfg.top + "%";
    c.style.left = cfg.left0 + "vw";
    c.style.animationDuration = cfg.dur + "s";
    c.style.animationDelay = "-" + (cfg.dur * (idx / configs.length)).toFixed(1) + "s";
    c.innerHTML = heartPathSVG(cfg.scale);
    frag.appendChild(c);
  });
  layer.appendChild(frag);
}

/* ---------- cambio de ambiente: día → atardecer → final ---------- */
function setAmbience(name){
  var scene = document.getElementById("scene");
  scene.classList.toggle("amb-sunset", name === "sunset" || name === "final");
  scene.classList.toggle("amb-final", name === "final");
}

function setSunsetDuration(ms){
  document.getElementById("scene").style.setProperty("--sunset-dur", ms + "ms");
}

/* ---------- calmar el entorno (Web Animations API) ---------- */
var calmFactor = 1;
function calm(factor){
  if (!document.getAnimations) return;
  calmFactor = factor;
  document.getAnimations().forEach(function(a){
    // no tocar la UI (tarjeta, controles)
    var el = a.effect && a.effect.target;
    if (el && el.closest && el.closest("#ui-controls, #final-card")) return;
    try { a.playbackRate = factor; } catch(e){}
  });
}
function restore(){
  calm(1);
}

/* ---------- ráfaga de pétalos (partículas de interacción, limitadas) ---------- */
var fxCount = 0;
var FX_MAX = 40;
function petalBurst(x, y, count){
  var layer = document.getElementById("fx-layer");
  if (!layer || fxCount > FX_MAX) return;
  for (var i = 0; i < count; i++){
    if (fxCount > FX_MAX) break;
    fxCount++;
    var p = document.createElement("div");
    p.className = "fx-petal";
    layer.appendChild(p);
    var ang = Math.random() * Math.PI * 2;
    var dist = 40 + Math.random() * 90;
    var dx = Math.cos(ang) * dist;
    var dy = Math.sin(ang) * dist - 50;
    var rot = (Math.random() * 2 - 1) * 260;
    var anim = p.animate([
      { transform: "translate(" + x + "px," + y + "px) rotate(0deg)", opacity: 1 },
      { transform: "translate(" + (x + dx) + "px," + (y + dy) + "px) rotate(" + rot + "deg)", opacity: 0 }
    ], { duration: 900 + Math.random() * 700, easing: "cubic-bezier(.2,.7,.3,1)" });
    (function(el, an){ an.onfinish = function(){ el.remove(); fxCount--; }; })(p, anim);
  }
}

/* ---------- destellos suaves junto a la flor especial ----------
   Devuelve una función para detenerlos. Respeta reduce-motion y calidad baja. */
function startSparkles(getPos){
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce || SF.quality.resolve() === "low") return function(){};
  var layer = document.getElementById("fx-layer");
  if (!layer) return function(){};
  var stopped = false;
  var timer = setInterval(function(){
    if (stopped || document.hidden) return;
    if (fxCount > FX_MAX - 3) return;
    var pos = getPos();
    if (!pos || !pos.x) return;
    fxCount++;
    var s = document.createElement("div");
    s.className = "fx-sparkle";
    layer.appendChild(s);
    var dx = (Math.random() - 0.5) * 90;
    var dy = -20 - Math.random() * 50;
    var anim = s.animate([
      { transform: "translate(" + pos.x + "px," + pos.y + "px) scale(0.4)", opacity: 0 },
      { opacity: 0.9, offset: 0.3 },
      { transform: "translate(" + (pos.x + dx) + "px," + (pos.y + dy) + "px) scale(1)", opacity: 0 }
    ], { duration: 2200 + Math.random() * 1200, easing: "ease-out" });
    anim.onfinish = function(){ s.remove(); fxCount--; };
  }, 1500);
  return function(){ stopped = true; clearInterval(timer); };
}

SF.environment = {
  buildWind: buildWind,
  buildClouds: buildClouds,
  setAmbience: setAmbience,
  setSunsetDuration: setSunsetDuration,
  calm: calm,
  restore: restore,
  petalBurst: petalBurst,
  startSparkles: startSparkles
};
})();
