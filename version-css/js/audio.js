/* ================= audio.js — música ambiental con controles =================
   Nunca reproduce sin interacción del usuario. Si el archivo no existe,
   los controles se ocultan discretamente y nada se rompe. */
(function(){
"use strict";
window.SF = window.SF || {};

var audio = null;
var pendingPlay = false;   // el usuario ya dio el gesto, esperando a que cargue
var fadeTimer = null;
var els = {};

function setPressed(btn, on){ btn.setAttribute("aria-pressed", on ? "true" : "false"); }

function syncUI(){
  if (!audio) return;
  els.toggle.classList.toggle("playing", !audio.paused);
  els.toggle.setAttribute("aria-label", audio.paused ? "Reproducir música" : "Pausar música");
  setPressed(els.toggle, !audio.paused);
  els.mute.classList.toggle("muted", audio.muted);
  setPressed(els.mute, audio.muted);
}

function tryPlay(){
  if (!audio) return;
  var p = audio.play();
  if (p && p.catch) p.catch(function(){ /* bloqueado o sin archivo: se queda en pausa */ });
}

function init(){
  var cfg = EXPERIENCE_CONFIG.audio;
  els.controls = document.getElementById("audio-controls");
  els.toggle = document.getElementById("audio-toggle");
  els.mute = document.getElementById("audio-mute");
  els.volume = document.getElementById("audio-volume");

  if (!cfg.enabled) return;

  audio = new Audio();
  audio.preload = "metadata";   // suficiente para comprobar que el archivo existe
  audio.loop = true;
  audio.volume = cfg.volume;
  audio.src = cfg.source;

  audio.addEventListener("error", function(){
    // sin archivo de audio: ocultamos los controles, la experiencia continúa
    pendingPlay = false;
    els.controls.hidden = true;
  });
  audio.addEventListener("loadedmetadata", function(){
    els.controls.hidden = false;
    if (pendingPlay){ pendingPlay = false; tryPlay(); }
  });

  els.volume.value = Math.round(cfg.volume * 100);

  els.toggle.addEventListener("click", function(){
    if (!audio) return;
    if (audio.paused) tryPlay(); else audio.pause();
  });
  els.mute.addEventListener("click", function(){
    if (!audio) return;
    audio.muted = !audio.muted;
    syncUI();
  });
  els.volume.addEventListener("input", function(){
    if (!audio) return;
    audio.volume = els.volume.value / 100;
    if (audio.muted && audio.volume > 0) audio.muted = false;
    syncUI();
  });
  audio.addEventListener("play", syncUI);
  audio.addEventListener("pause", syncUI);
}

/* Llamar tras un gesto del usuario (botón "Ver el campo") */
function start(){
  if (!audio) return;
  pendingPlay = true;
  tryPlay(); // forzar el gesto dentro del evento del usuario
}

/* Fundido suave de volumen (sin cortes bruscos). target: 0–1 */
function fadeTo(target, ms){
  if (!audio) return;
  clearInterval(fadeTimer);
  var from = audio.volume;
  var steps = Math.max(1, Math.round(ms / 50));
  var i = 0;
  fadeTimer = setInterval(function(){
    i++;
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * (i / steps)));
    if (i >= steps){ clearInterval(fadeTimer); fadeTimer = null; syncUI(); }
  }, 50);
}

SF.audio = { init: init, start: start, fadeTo: fadeTo };
})();
