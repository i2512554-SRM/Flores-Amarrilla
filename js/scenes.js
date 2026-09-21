/* ================= scenes.js — máquina de escenas =================
   intro → field → discovery → special → final
   La transición final ocurre por etapas: reacción → calma → luz → corazón → mensaje. */
(function(){
"use strict";
window.SF = window.SF || {};

var state = "intro";
var timers = [];
var cfg = null;
var els = {};
var ambientStarted = false;
var stopSparkles = null;

function later(fn, ms){
  var id = setTimeout(fn, ms);
  timers.push(id);
  return id;
}
function clearTimers(){ timers.forEach(clearTimeout); timers = []; }

function $(id){ return document.getElementById(id); }

function cacheEls(){
  els.scene = $("scene");
  els.hint = $("hint");
  els.special = $("special-flower");
  els.finalCard = $("final-card");
  els.finalTitle = $("final-title");
  els.finalMsg = $("final-message");
  els.finalSig = $("final-signature");
  els.finalClose = $("final-close");
}

/* ---------- hint: aparece, respira, desaparece; puede repetirse ---------- */
function showHint(){
  els.hint.textContent = cfg.discovery.hint;
  els.hint.classList.add("visible");
  later(function(){
    els.hint.classList.remove("visible");
    // si el usuario sigue explorando sin actuar, la pista vuelve más tarde
    if (cfg.scenes.hintRepeatDelay > 0){
      later(function(){
        if (state === "discovery") showHint();
      }, cfg.scenes.hintRepeatDelay);
    }
  }, cfg.scenes.hintDuration);
}
function hideHint(){ els.hint.classList.remove("visible"); }

function renderLetter(element, text){
  var parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  element.textContent = "";
  parts.forEach(function(part){
    if (!part) return;
    if (part.indexOf("**") === 0 && part.slice(-2) === "**"){
      var strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      element.appendChild(strong);
    } else {
      element.appendChild(document.createTextNode(part));
    }
  });
}

/* ---------- transiciones ---------- */
function go(next){
  state = next;
  var st = cfg.scenes.stages;

  switch (next){

    case "field":
      els.scene.classList.add("visible");
      els.scene.setAttribute("aria-hidden", "false");
      if (!ambientStarted){
        ambientStarted = true;
        later(function(){ SF.environment.setAmbience("sunset"); }, cfg.environment.sunsetStart);
      }
      later(function(){
        if (state === "field") go("discovery");
      }, cfg.scenes.explorationTime);
      break;

    case "discovery":
      // la pista aparece y permanece unos segundos
      showHint();
      // el entorno respira un poco más lento…
      SF.environment.calm(0.6);
      // …y la cámara empieza a acercarse al altar (translateZ real)
      els.scene.classList.add("approaching");
      // la flor especial solo se revela cuando el altar ya está cerca
      later(revealSpecialFlower, cfg.altar.approachDuration + cfg.altar.revealDelay);
      break;

    case "special":
      // 1. la flor reacciona: deja de pulsar una vez encontrada
      clearTimers();
      hideHint();
      if (stopSparkles){ stopSparkles(); stopSparkles = null; }
      els.special.classList.add("chosen");
      els.special.disabled = true;
      // la cámara da el último paso: altar en primer plano
      els.scene.classList.add("altar-close");
      // 2. el entorno se calma y la música baja suavemente
      later(function(){
        SF.environment.calm(0.25);
        SF.audio.fadeTo(cfg.audio.calmVolume, cfg.audio.calmFadeMs);
      }, st.calm);
      // 3. la luz profundiza hacia el atardecer final
      later(function(){ SF.environment.setAmbience("final"); }, st.light);
      // 4. aparece el elemento central
      later(function(){ els.scene.classList.add("heart-visible"); }, st.heart);
      // 5. por último, el mensaje
      later(function(){ go("final"); }, st.final);
      break;

    case "final":
      showFinalCard();
      break;
  }
}

/* ---------- revelación de la flor especial (fin del acercamiento) ---------- */
function revealSpecialFlower(){
  if (state !== "discovery") return;
  els.scene.classList.add("discovered");
  els.special.hidden = false; // accesible por teclado
  // micro-brillos suaves junto a la flor especial (nada estridente)
  stopSparkles = SF.environment.startSparkles(function(){
    var r = els.special.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height * 0.3 };
  });
}

/* ---------- tarjeta final ---------- */
function showFinalCard(){
  els.finalTitle.textContent = cfg.finalMessage.title;
  renderLetter(els.finalMsg, cfg.finalMessage.message);
  els.finalSig.textContent = cfg.finalMessage.signature;
  els.finalClose.textContent = cfg.finalMessage.closeButton;
  els.finalCard.hidden = false;
  // doble frame para que la transición CSS se ejecute tras quitar hidden
  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      els.finalCard.classList.add("show");
      els.finalCard.querySelector(".final-panel").scrollTop = 0;
      els.finalTitle.focus({ preventScroll: true });
    });
  });
}

/* cerrar: volver al campo, el mundo respira de nuevo; se puede repetir */
function closeFinal(){
  els.finalCard.classList.remove("show");
  setTimeout(function(){ els.finalCard.hidden = true; }, 400);
  SF.environment.restore();
  SF.audio.restoreVolume();
  els.special.disabled = false;
  els.special.classList.remove("chosen");
  state = "discovery";
  els.special.focus();
}

/* ---------- API ---------- */
function init(config){
  cfg = config;
  cacheEls();

  els.special.innerHTML = SF.flowers.specialFlowerSVG();
  els.special.addEventListener("click", function(){
    if (state === "discovery" || state === "field") go("special");
  });
  els.finalClose.addEventListener("click", closeFinal);
  document.addEventListener("keydown", function(ev){
    if (ev.key === "Escape" && state === "final") closeFinal();
  });

  var finalPetals = $("final-sun-petals");
  if (finalPetals) SF.flowers.buildPetalRing(finalPetals, 60, 60, 13, 46, 11);
}

/* si el usuario toca varias flores, adelantamos el descubrimiento */
function onFlowerTap(count){
  if (state === "field" && count >= cfg.scenes.flowersRequired){
    // conservamos el timer del atardecer, cancelamos el resto
    clearTimers();
    if (ambientStarted && !els.scene.classList.contains("amb-sunset") &&
        !els.scene.classList.contains("amb-final")){
      later(function(){ SF.environment.setAmbience("sunset"); }, cfg.environment.sunsetStart);
    }
    go("discovery");
  }
}

SF.scenes = {
  init: init,
  go: go,
  onFlowerTap: onFlowerTap,
  getState: function(){ return state; }
};
})();
