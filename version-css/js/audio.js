/* Música con un único control de volumen y pausa al salir de la página. */
(function(){
"use strict";
window.SF = window.SF || {};

var audio = null;
var userLevel = 0.6;
var desiredPlaying = false;
var started = false;
var playPending = false;
var playGeneration = 0;
var pageHidden = false;
var failed = false;
var fadeTimer = null;
var initialized = false;
var els = {};

function clamp(value){
  var number = Number(value);
  return Math.max(0, Math.min(1, Number.isFinite(number) ? number : 0));
}
function suspended(){ return document.hidden || pageHidden; }
function setPressed(btn, on){
  if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
}
function syncUI(){
  if (!audio) return;
  var playing = !audio.paused && !suspended();
  els.toggle.classList.toggle("playing", playing);
  els.toggle.setAttribute("aria-label", playing ? "Pausar música" : "Reproducir música");
  setPressed(els.toggle, playing);
  els.mute.classList.toggle("muted", audio.muted);
  els.mute.setAttribute("aria-label", audio.muted ? "Activar sonido" : "Silenciar música");
  setPressed(els.mute, audio.muted);
  els.volume.value = Math.round(audio.volume * 100);
}
function cancelFade(){
  clearInterval(fadeTimer);
  fadeTimer = null;
}
function applyVolume(value){
  if (!audio) return;
  audio.volume = clamp(value);
  syncUI();
}
function transitionVolume(target, ms){
  if (!audio) return;
  cancelFade();
  target = clamp(target);
  var duration = Math.max(0, Number(ms) || 0);
  var from = audio.volume;
  if (!duration || Math.abs(target - from) < 0.001){ applyVolume(target); return; }
  var began = Date.now();
  fadeTimer = setInterval(function(){
    var progress = Math.min(1, (Date.now() - began) / duration);
    applyVolume(from + (target - from) * progress);
    if (progress === 1) cancelFade();
  }, 50);
}
function pausePlayback(){
  playGeneration++;
  playPending = false;
  if (audio) audio.pause();
  syncUI();
}
function tryPlay(){
  if (!audio || failed || !desiredPlaying || suspended() || !audio.paused || playPending) return;
  var generation = ++playGeneration;
  playPending = true;
  var promise;
  try { promise = audio.play(); }
  catch (error){
    playPending = false;
    desiredPlaying = false;
    syncUI();
    return;
  }
  if (promise && promise.then){
    promise.then(function(){
      if (generation === playGeneration) playPending = false;
      // Un play pendiente puede completarse después de ocultar o pausar.
      if (!desiredPlaying || suspended()) audio.pause();
      syncUI();
    }, function(){
      if (generation !== playGeneration) return;
      playPending = false;
      desiredPlaying = false;
      syncUI();
    });
  } else {
    playPending = false;
    if (!desiredPlaying || suspended()) audio.pause();
    syncUI();
  }
}
function init(){
  if (initialized) return;
  initialized = true;
  var cfg = EXPERIENCE_CONFIG.audio;
  els.controls = document.getElementById("audio-controls");
  els.toggle = document.getElementById("audio-toggle");
  els.mute = document.getElementById("audio-mute");
  els.volume = document.getElementById("audio-volume");
  if (els.controls) els.controls.hidden = true;
  if (!cfg.enabled || !els.controls || !els.toggle || !els.mute || !els.volume) return;

  userLevel = clamp(cfg.volume);
  audio = new Audio();
  audio.preload = "metadata";
  audio.loop = true;
  audio.volume = userLevel;
  audio.addEventListener("error", function(){
    failed = true;
    desiredPlaying = false;
    cancelFade();
    pausePlayback();
    els.controls.hidden = true;
  });
  audio.addEventListener("loadedmetadata", function(){
    if (failed) return;
    els.controls.hidden = false;
    // No duplicar play si la petición del gesto aún está pendiente.
    tryPlay();
    syncUI();
  });
  audio.addEventListener("play", syncUI);
  audio.addEventListener("pause", syncUI);
  audio.addEventListener("volumechange", syncUI);

  els.toggle.addEventListener("click", function(){
    started = true;
    desiredPlaying = !desiredPlaying;
    if (desiredPlaying) tryPlay(); else pausePlayback();
  });
  els.mute.addEventListener("click", function(){
    audio.muted = !audio.muted;
    syncUI();
  });
  els.volume.addEventListener("input", function(){
    // La elección manual prevalece sobre cualquier fundido narrativo pendiente.
    cancelFade();
    userLevel = clamp(els.volume.value / 100);
    applyVolume(userLevel);
    if (audio.muted && userLevel > 0) audio.muted = false;
    syncUI();
  });
  document.addEventListener("visibilitychange", function(){
    if (document.hidden) pausePlayback();
    else tryPlay();
  });
  window.addEventListener("pagehide", function(){
    pageHidden = true;
    pausePlayback();
  });
  window.addEventListener("pageshow", function(){
    pageHidden = false;
    tryPlay();
  });
  // La ruta es relativa al HTML de cada alternativa.
  audio.src = cfg.source;
  syncUI();
}

/* Se llama dentro del gesto inicial; repetir no reinicia ni fuerza la música. */
function start(){
  if (!audio || started || failed) return;
  started = true;
  desiredPlaying = true;
  tryPlay();
}

/* Una escena puede bajar la música, sin superar el nivel elegido por el usuario. */
function fadeTo(target, ms){
  transitionVolume(Math.min(userLevel, clamp(target)), ms);
}
function restoreVolume(ms){
  transitionVolume(userLevel, ms === undefined ? 1200 : ms);
}

SF.audio = { init: init, start: start, fadeTo: fadeTo, restoreVolume: restoreVolume };
})();
