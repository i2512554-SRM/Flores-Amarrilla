/* ================= flowers.js — fábrica de flores SVG con variedad =================
   RNG con semilla (campo estable entre visitas) + sprite-sheet de símbolos:
   se generan pocas variantes únicas y cada flor las reutiliza con <use>,
   reduciendo drásticamente el tamaño del DOM en densidades altas. */
(function(){
"use strict";
window.SF = window.SF || {};

function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeRng(seed){
  var f = mulberry32(seed);
  return {
    rand: function(a, b){ return a + (b - a) * f(); },
    int: function(a, b){ return Math.floor(a + f() * (b - a + 1)); },
    pick: function(arr){ return arr[Math.floor(f() * arr.length)]; }
  };
}

var PETAL_FILLS = ["url(#petalGrad)", "url(#petalGradB)", "url(#petalGradC)"];
var SMALL_TONES = ["#ffe066", "#ffd23f", "#fff0a8", "#f7c948"];
var STEM_TONES  = ["#4f7f2f", "#557f33", "#477a2c"];

/* ---------- contenido de un girasol (sin envoltorio <svg>) ---------- */
function sunflowerContent(rng){
  var petals  = rng.int(11, 16);
  var rOuter  = rng.rand(37, 42);
  var w       = rng.rand(8.2, 9.8);
  var fill    = rng.pick(PETAL_FILLS);
  var fillIn  = rng.pick(PETAL_FILLS);
  var headTilt= rng.rand(-9, 9);
  var stem    = rng.pick(STEM_TONES);
  var leafFlip= rng.rand(0, 1) < 0.5;
  var cx = 50, cy = 55;

  var s = "", i, angle, y;
  for (i = 0; i < petals; i++){ // anillo interior
    angle = (360 / petals) * i + (180 / petals);
    y = cy - rOuter * 0.36;
    s += '<ellipse cx="' + cx + '" cy="' + y.toFixed(1) + '" rx="' + (w * 0.8).toFixed(1) +
      '" ry="' + (rOuter * 0.34).toFixed(1) + '" fill="' + fillIn +
      '" transform="rotate(' + angle.toFixed(1) + ' ' + cx + ' ' + cy + ')"/>';
  }
  for (i = 0; i < petals; i++){ // anillo exterior
    angle = (360 / petals) * i;
    y = cy - rOuter * 0.5;
    s += '<ellipse cx="' + cx + '" cy="' + y.toFixed(1) + '" rx="' + w.toFixed(1) +
      '" ry="' + (rOuter * 0.46).toFixed(1) + '" fill="' + fill +
      '" transform="rotate(' + angle.toFixed(1) + ' ' + cx + ' ' + cy + ')"/>';
  }

  var leafL = '<path d="M48 170 C 20 160, 10 190, 22 210 C 34 205, 46 190, 48 170 Z" fill="#5c9438"/>';
  var leafR = '<path d="M46 140 C 74 132, 86 160, 76 182 C 62 176, 48 160, 46 140 Z" fill="#4f7f2f"/>';

  return (
    '<line x1="50" y1="95" x2="' + rng.rand(43, 49).toFixed(1) + '" y2="260" stroke="' + stem +
      '" stroke-width="6" stroke-linecap="round"/>' +
    (leafFlip ? leafR + leafL : leafL + leafR) +
    '<g transform="rotate(' + headTilt.toFixed(1) + ' 50 55)">' +
      s +
      '<circle cx="50" cy="55" r="' + rng.rand(22, 25).toFixed(1) + '" fill="url(#seedGrad)"/>' +
    '</g>'
  );
}

function smallFlowerContent(rng){
  var petals = rng.int(5, 8);
  var rOuter = rng.rand(15, 18);
  var color  = rng.pick(SMALL_TONES);
  var cx = 25, cy = 28;
  var s = "";
  for (var i = 0; i < petals; i++){
    var angle = (360 / petals) * i;
    s += '<ellipse cx="' + cx + '" cy="' + (cy - rOuter * 0.55).toFixed(1) +
      '" rx="6" ry="' + (rOuter * 0.55).toFixed(1) + '" fill="' + color +
      '" transform="rotate(' + angle.toFixed(1) + ' ' + cx + ' ' + cy + ')"/>';
  }
  return (
    '<line x1="25" y1="45" x2="' + rng.rand(21, 24).toFixed(1) + '" y2="150" stroke="#4f7f2f" stroke-width="3" stroke-linecap="round"/>' +
    '<path d="M24 95 C 8 90, 4 108, 12 118 C 20 114, 26 104, 24 95 Z" fill="#5c9438"/>' +
    '<g>' + s + '</g>' +
    '<circle cx="25" cy="28" r="' + rng.rand(8, 10).toFixed(1) + '" fill="url(#seedGrad)"/>'
  );
}

/* ---------- sprite-sheet de variantes ---------- */
var BIG_VARIANTS = 8, SMALL_VARIANTS = 6;
var bigRatios = [], smallRatios = []; // altura/ancho de cada variante

function ensureSpriteSheet(container, seed){
  if (document.getElementById("sf-sprites")) return;
  var rng = makeRng(seed + 500);
  var html = "";
  var i;
  for (i = 0; i < BIG_VARIANTS; i++){
    bigRatios[i] = rng.rand(2.4, 2.8);
    html += '<symbol id="sf-big-' + i + '" viewBox="0 0 100 260">' + sunflowerContent(rng) + '</symbol>';
  }
  for (i = 0; i < SMALL_VARIANTS; i++){
    smallRatios[i] = rng.rand(2.7, 3.2);
    html += '<symbol id="sf-small-' + i + '" viewBox="0 0 50 150">' + smallFlowerContent(rng) + '</symbol>';
  }
  var sheet = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  sheet.id = "sf-sprites";
  sheet.setAttribute("width", "0");
  sheet.setAttribute("height", "0");
  sheet.setAttribute("aria-hidden", "true");
  sheet.style.position = "absolute";
  sheet.innerHTML = html;
  container.appendChild(sheet);
}

/* ---------- SVG completo (para ramos y flor especial: unidades sueltas) ---------- */
function sunflowerSVG(rng, opts){
  opts = opts || {};
  var size = opts.size || rng.int(34, 48);
  return (
    '<svg width="' + size + '" height="' + Math.round(size * rng.rand(2.4, 2.8)) +
    '" viewBox="0 0 100 260" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    sunflowerContent(rng) + '</svg>'
  );
}
function smallFlowerSVG(rng, opts){
  opts = opts || {};
  var size = opts.size || rng.int(18, 27);
  return (
    '<svg width="' + size + '" height="' + Math.round(size * rng.rand(2.7, 3.2)) +
    '" viewBox="0 0 50 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    smallFlowerContent(rng) + '</svg>'
  );
}

/* ---------- una flor del túnel (2 nodos SVG vía <use>) ---------- */
function makeTunnelFlower(rng, side, reduceMotion, zStatic){
  var big = rng.rand(0, 1) < 0.6;
  var laneX = rng.rand(12, 300) * side;
  var groundY = rng.rand(70, 210);
  var dur = rng.rand(5, 9);
  var size = big ? rng.int(34, 48) : rng.int(18, 27);
  var variant = big ? rng.int(0, BIG_VARIANTS - 1) : rng.int(0, SMALL_VARIANTS - 1);
  var ratio = big ? bigRatios[variant] : smallRatios[variant];

  var outer = document.createElement("div");
  outer.className = "tflower";
  outer.style.setProperty("--lane-x", laneX.toFixed(1) + "px");
  outer.style.setProperty("--ground-y", groundY.toFixed(1) + "px");

  if (reduceMotion){
    outer.style.animation = "none";
    outer.style.opacity = "1";
    outer.style.transform =
      "translate(-50%,0) translateX(" + laneX.toFixed(1) + "px) translateY(" +
      groundY.toFixed(1) + "px) translateZ(" + zStatic.toFixed(0) + "px)";
  } else {
    outer.style.animationDuration = dur.toFixed(2) + "s";
    outer.style.animationDelay = "-" + rng.rand(0, dur).toFixed(2) + "s";
  }

  var tilt = document.createElement("div");
  tilt.className = "flower-tilt";

  var inner = document.createElement("div");
  inner.className = "flower-inner";
  inner.style.setProperty("--sway", rng.rand(3, 6.5).toFixed(1) + "deg");
  if (!reduceMotion){
    inner.style.animationDuration = rng.rand(2.6, 4.6).toFixed(2) + "s";
    inner.style.animationDelay = "-" + rng.rand(0, 4).toFixed(2) + "s";
  }
  inner.innerHTML =
    '<svg width="' + size + '" height="' + Math.round(size * ratio) +
    '" viewBox="0 0 ' + (big ? "100 260" : "50 150") + '" aria-hidden="true">' +
    '<use href="#sf-' + (big ? "big" : "small") + '-' + variant + '"/></svg>';

  var shadow = document.createElement("div");
  shadow.className = "flower-shadow";
  var shadowW = size * (big ? 1.5 : 1.9);
  shadow.style.width = shadowW + "px";
  shadow.style.height = (shadowW * 0.32) + "px";

  tilt.appendChild(inner);
  outer.appendChild(shadow);
  outer.appendChild(tilt);
  return outer;
}

/* ---------- construir el campo completo ---------- */
function buildField(container, opts){
  var rng = makeRng(opts.seed);
  container.innerHTML = "";
  ensureSpriteSheet(document.body, opts.seed); // una sola vez por página
  var frag = document.createDocumentFragment();
  var total = opts.perSide * 2;
  var specialIdx = {};
  var i;
  for (i = 0; i < opts.specialCount; i++){
    specialIdx[Math.floor((i + 0.5) / opts.specialCount * total)] = true;
  }

  var flowers = [];
  for (i = 0; i < opts.perSide; i++){
    var pair = [
      makeTunnelFlower(rng, -1, opts.reduceMotion, -1250 + (1550 / opts.perSide) * i),
      makeTunnelFlower(rng,  1, opts.reduceMotion, -1250 + (1550 / opts.perSide) * i)
    ];
    for (var j = 0; j < 2; j++){
      var idx = i * 2 + j;
      if (specialIdx[idx]) pair[j].classList.add("special");
      pair[j].dataset.index = idx;
      frag.appendChild(pair[j]);
      flowers.push(pair[j]);
    }
  }
  container.appendChild(frag);
  return flowers;
}

/* ---------- flor especial del altar ---------- */
function specialFlowerSVG(){
  var rng = makeRng(777);
  var svg = sunflowerSVG(rng, { size: 64 });
  return svg.replace('aria-hidden="true"', 'aria-hidden="true" class="special-svg"');
}

/* ---------- ramos del altar ---------- */
function buildBouquet(el, mirrored, rng){
  if (!el) return;
  el.style.position = "relative";
  var html = "";
  for (var i = 0; i < 3; i++){
    var tilt = (mirrored ? -1 : 1) * (8 - i * 7);
    html += '<div style="transform:rotate(' + tilt + 'deg); margin-bottom:' + (i * 2) + 'px;">' +
            sunflowerSVG(rng, { size: 30 - i * 3 }) + '</div>';
  }
  el.innerHTML = html;
  var ribbon = document.createElement("div");
  ribbon.className = "ribbon";
  el.appendChild(ribbon);
}

/* ---------- pétalos para mini girasoles ---------- */
function buildPetalRing(container, cx, cy, count, rOuter, w){
  var ns = "http://www.w3.org/2000/svg";
  for (var i = 0; i < count; i++){
    var angle = (360 / count) * i;
    var ellipse = document.createElementNS(ns, "ellipse");
    ellipse.setAttribute("cx", cx);
    ellipse.setAttribute("cy", cy - rOuter * 0.55);
    ellipse.setAttribute("rx", w);
    ellipse.setAttribute("ry", rOuter * 0.5);
    ellipse.setAttribute("fill", "url(#petalGrad)");
    ellipse.setAttribute("transform", "rotate(" + angle + " " + cx + " " + cy + ")");
    container.appendChild(ellipse);
  }
}

SF.flowers = {
  makeRng: makeRng,
  sunflowerSVG: sunflowerSVG,
  smallFlowerSVG: smallFlowerSVG,
  buildField: buildField,
  buildBouquet: buildBouquet,
  buildPetalRing: buildPetalRing,
  specialFlowerSVG: specialFlowerSVG
};
})();
