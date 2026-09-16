/* ================= quality.js — detección y control de calidad ================= */
(function(){
"use strict";
window.SF = window.SF || {};

var LEVELS = ["low", "medium", "high"];
var STORAGE_KEY = "sf-quality";

function isMobile(){ return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent); }
function isTabletSize(){ return window.innerWidth >= 700; }
function isDesktopSize(){ return window.innerWidth >= 1100; }

function deviceClass(){
  if (isDesktopSize()) return "desktop";
  if (isTabletSize()) return "tablet";
  return "mobile";
}

/* Detección automática: reduce-motion, tamaño, núcleos y memoria aproximada */
function detect(){
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "low";
  var cores = navigator.hardwareConcurrency || 4;
  var mem = navigator.deviceMemory || 4;
  var mobile = isMobile();
  if (mobile && (cores <= 4 || mem <= 3)) return "low";
  if (window.innerWidth < 380) return "low";
  if (mobile || cores <= 4 || window.innerWidth < 1100) return "medium";
  return "high";
}

/* La elección manual (o la del config) tiene prioridad sobre la automática */
function resolve(){
  var manual = null;
  try { manual = localStorage.getItem(STORAGE_KEY); } catch(e){}
  var q = window.EXPERIENCE_CONFIG && EXPERIENCE_CONFIG.quality;
  var cfg = (q && q.default) || "auto";
  if (manual && (LEVELS.indexOf(manual) >= 0 || manual === "auto")) {
    return manual === "auto" ? detect() : manual;
  }
  if (cfg !== "auto" && LEVELS.indexOf(cfg) >= 0) return cfg;
  return detect();
}

function setManual(level){
  try {
    if (level === "auto") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, level);
  } catch(e){}
}

SF.quality = {
  levels: LEVELS,
  resolve: resolve,
  detect: detect,
  setManual: setManual,
  deviceClass: deviceClass,
  isMobile: isMobile
};
})();
