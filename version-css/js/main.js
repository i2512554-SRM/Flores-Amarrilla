/* ================= main.js — orquestación de la experiencia ================= */
(function(){
"use strict";

var cfg = window.EXPERIENCE_CONFIG;
var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var built = false;
var currentQuality = null;
var currentDevice = null;

/* ---------- textos desde la configuración ---------- */
function applyConfig(){
  document.title = "Campo de girasoles";
  document.getElementById("intro-title").textContent = cfg.intro.title;
  document.getElementById("intro-subtitle").textContent = cfg.intro.subtitle;
  document.getElementById("start-btn").textContent = cfg.intro.startButton;
  var sceneEl = document.getElementById("scene");
  sceneEl.style.setProperty("--sunset-dur", cfg.environment.sunsetDuration + "ms");
  sceneEl.style.setProperty("--altar-dur", cfg.altar.approachDuration + "ms");
  sceneEl.style.setProperty("--altar-blur", cfg.altar.farBlur + "px");
}

/* ---------- construir/reconstruir la escena ---------- */
function flowersPerSide(quality){
  var t = cfg.flowers.perSide[quality];
  return t[SF.quality.deviceClass()];
}
function windCount(quality){
  var w = cfg.particles.wind[quality];
  return (typeof w === "number") ? w : w[SF.quality.deviceClass()];
}

function buildScene(){
  var device = SF.quality.deviceClass();
  var tunnel = document.getElementById("flower-tunnel");

  var flowers = SF.flowers.buildField(tunnel, {
    seed: cfg.seed,
    perSide: flowersPerSide(currentQuality),
    specialCount: cfg.flowers.specialCount[currentQuality],
    reduceMotion: reduceMotion
  });

  SF.flowers.buildBouquet(document.getElementById("bouquet-left"), false, SF.flowers.makeRng(cfg.seed + 1));
  SF.flowers.buildBouquet(document.getElementById("bouquet-right"), true, SF.flowers.makeRng(cfg.seed + 2));

  if (!reduceMotion){
    SF.environment.buildWind(windCount(currentQuality));
  } else {
    document.getElementById("wind-layer").innerHTML = "";
  }
  SF.environment.buildClouds(currentQuality === "low" ? 1 : 3);

  SF.interactions.init(flowers, {
    reduceMotion: reduceMotion,
    onSpecialTap: function(count){ SF.scenes.onFlowerTap(count); }
  });

  currentDevice = device;
}

/* ---------- selector de calidad ---------- */
function initQualityUI(){
  var btn = document.getElementById("quality-btn");
  var menu = document.getElementById("quality-menu");
  var items = menu.querySelectorAll("button");

  function currentManual(){
    try { return localStorage.getItem("sf-quality") || "auto"; } catch(e){ return "auto"; }
  }
  function mark(){
    var m = (cfg.quality.default !== "auto" ? cfg.quality.default : currentManual());
    items.forEach(function(b){
      b.setAttribute("aria-checked", b.dataset.quality === m ? "true" : "false");
    });
  }

  btn.addEventListener("click", function(){
    var open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function(ev){
    if (!menu.hidden && !ev.target.closest(".quality-control")){
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
  });

  items.forEach(function(b){
    b.addEventListener("click", function(){
      SF.quality.setManual(b.dataset.quality);
      mark();
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      var next = SF.quality.resolve();
      if (built && next !== currentQuality){
        currentQuality = next;
        buildScene();
      }
    });
  });
  mark();
}

/* ---------- arranque ---------- */
function start(){
  if (!built){
    currentQuality = SF.quality.resolve();
    buildScene();
    built = true;
  }
  var startScreen = document.getElementById("start-screen");
  startScreen.classList.add("leaving");
  startScreen.setAttribute("aria-hidden", "true");
  document.getElementById("start-btn").disabled = true;
  SF.audio.start();
  SF.scenes.go("field");
}

/* ---------- resize: solo reconstruir si cambia la clase de dispositivo ---------- */
var resizeTimer;
function onResize(){
  if (!built) return;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(function(){
    if (SF.quality.deviceClass() !== currentDevice) buildScene();
  }, 250);
}

document.addEventListener("DOMContentLoaded", function(){
  applyConfig();

  // mini girasol del intro
  SF.flowers.buildPetalRing(document.getElementById("mini-sun-petals"), 60, 60, 13, 46, 11);

  SF.audio.init();
  SF.scenes.init(cfg);
  initQualityUI();

  document.getElementById("start-btn").addEventListener("click", start);
  window.addEventListener("resize", onResize);
});
})();
