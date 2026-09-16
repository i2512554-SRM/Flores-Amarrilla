/* ================= audio.js — música ambiental con Web Audio API =================
   Los cambios de volumen (play/pause/cambio de escena) se hacen con rampas
   exponenciales en un GainNode: sin cortes ni clics audibles.
   Si el archivo no existe, los controles se ocultan y nada se rompe. */
(function(){
"use strict";
window.SF = window.SF || {};

var audio = null;
var ctx = null, gainNode = null;   // Web Audio
var pendingPlay = false;
var baseVolume = 0.6;
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

/* ---------- grafo de audio (se crea tras un gesto del usuario) ---------- */
function ensureGraph(){
  if (ctx || !audio) return;
  var AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return; // fallback: se usa audio.volume directo
  try{
    ctx = new AC();
    gainNode = ctx.createGain();
    gainNode.gain.value = baseVolume;
    ctx.createMediaElementSource(audio).connect(gainNode).connect(ctx.destination);
  }catch(e){ ctx = null; gainNode = null; }
}

/* rampa de volumen: Web Audio si está disponible, si no, interpolación manual */
function rampTo(target, seconds){
  target = Math.max(0.0001, Math.min(1, target));
  if (gainNode){
    var now = ctx.currentTime;
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(Math.max(0.0001, gainNode.gain.value), now);
    gainNode.gain.exponentialRampToValueAtTime(target, now + seconds);
  } else if (audio){
    audio.volume = target;
  }
}

function tryPlay(){
  if (!audio) return;
  ensureGraph();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(function(){});
  // fade-in desde silencio
  if (gainNode) rampTo(0.0001, 0.01);
  var p = audio.play();
  if (p && p.catch) p.catch(function(){});
  if (p && p.then) p.then(function(){ rampTo(baseVolume, 1.2); });
}

function softPause(){
  if (!audio) return;
  if (gainNode){
    rampTo(0.0001, 0.6);
    setTimeout(function(){ if (audio) audio.pause(); }, 650);
  } else {
    audio.pause();
  }
}

function init(){
  var cfg = EXPERIENCE_CONFIG.audio;
  els.controls = document.getElementById("audio-controls");
  els.toggle = document.getElementById("audio-toggle");
  els.mute = document.getElementById("audio-mute");
  els.volume = document.getElementById("audio-volume");

  if (!cfg.enabled) return;

  baseVolume = cfg.volume;
  audio = new Audio();
  audio.preload = "metadata";
  audio.loop = true;
  audio.volume = cfg.volume;
  audio.src = cfg.source;

  audio.addEventListener("error", function(){
    pendingPlay = false;
    els.controls.hidden = true; // sin archivo: sin controles, sin errores
  });
  audio.addEventListener("loadedmetadata", function(){
    els.controls.hidden = false;
    if (pendingPlay){ pendingPlay = false; tryPlay(); }
  });

  els.volume.value = Math.round(cfg.volume * 100);

  els.toggle.addEventListener("click", function(){
    if (!audio) return;
    if (audio.paused) tryPlay(); else softPause();
  });
  els.mute.addEventListener("click", function(){
    if (!audio) return;
    audio.muted = !audio.muted;
    syncUI();
  });
  els.volume.addEventListener("input", function(){
    if (!audio) return;
    baseVolume = els.volume.value / 100;
    if (!audio.paused) rampTo(baseVolume, 0.15);
    if (audio.muted && baseVolume > 0) audio.muted = false;
    syncUI();
  });
  audio.addEventListener("play", syncUI);
  audio.addEventListener("pause", syncUI);
}

/* llamado tras un gesto del usuario (botón "Ver el campo") */
function start(){
  if (!audio) return;
  pendingPlay = true;
  tryPlay();
}

/* cambio de etapa: fundido suave a otro nivel (sin detener la música) */
function fadeTo(target, ms){
  rampTo(target, Math.max(0.1, ms / 1000));
}

SF.audio = { init: init, start: start, fadeTo: fadeTo };
})();
