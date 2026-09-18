/* ================= config.js — contenido editable de la experiencia =================
   Cambia aquí textos, mensaje final, música, calidad y ritmos sin tocar la lógica. */
window.EXPERIENCE_CONFIG = {

  /* Escena 1 — Intro */
  intro: {
    title: "Un campo te espera",
    subtitle: "Presiona el botón y deja que la brisa mueva los girasoles.",
    startButton: "Ver el campo"
  },

  /* Ritmo de las escenas (ms). Nada debe sentirse apurado. */
  scenes: {
    explorationTime: 16000,   // pausa mínima de exploración antes de la pista
    flowersRequired: 4,       // o este número de flores tocadas, lo que ocurra primero
    hintDuration: 6500,       // cuánto permanece visible la pista
    hintRepeatDelay: 26000,   // si no interactúa, la pista vuelve a aparecer (0 = nunca)
    /* transición final por etapas (tiempos desde que se toca la flor especial) */
    stages: {
      calm: 900,              // el entorno baja el ritmo
      light: 1600,            // la iluminación profundiza el atardecer
      heart: 2600,            // aparece el elemento central
      final: 5400             // aparece la tarjeta con el mensaje
    }
  },

  /* Escena 3 — Descubrimiento */
  discovery: {
    hint: "Creo que hay algo por aquí…"
  },

  /* Escena 5 — Mensaje final (edítalo libremente, \n = salto de línea) */
  finalMessage: {
    title: "Para ti",
    message: "Escribe aquí tu mensaje.\nPuede ocupar varias líneas.",
    signature: "— Con cariño",
    closeButton: "Volver al campo"
  },

  /* Audio: coloca tu archivo en assets/audio/ y ajusta la ruta */
  audio: {
    enabled: true,
    source: "../assets/audio/Milo J - Niño (Letra).mp3",
    volume: 0.6,
    /* al encontrar la flor especial, la música baja suavemente a este nivel (0–1) */
    calmVolume: 0.35,
    calmFadeMs: 2600
  },

  /* Calidad: "auto" | "low" | "medium" | "high" */
  quality: { default: "auto" },

  /* Semilla del campo: mismo número = mismo campo en cada visita */
  seed: 20260921,

  /* Cantidad de flores por lado del camino según calidad y dispositivo */
  flowers: {
    perSide: {
      low:    { mobile: 12, tablet: 20, desktop: 30 },
      medium: { mobile: 26, tablet: 42, desktop: 60 },
      high:   { mobile: 40, tablet: 60, desktop: 85 }
    },
    /* flores del campo que brillan y sueltan pétalos al tocarlas */
    specialCount: { low: 1, medium: 3, high: 4 }
  },

  particles: {
    wind: { low: 5, medium: { mobile: 10, tablet: 16, desktop: 22 }, high: 30 }
  },

  /* Altar y cámara: el acercamiento usa translateZ real sobre la perspectiva
     existente de #tunnel-scene (no un scale plano).
     Los valores de profundidad finos se ajustan en css/field.css y responsive.css;
     aquí controlas el ritmo de la narrativa. */
  altar: {
    approachDuration: 11250, // duración del acercamiento al altar (ms)
    revealDelay: 1200,       // pausa tras llegar el altar antes de revelar la flor
    farBlur: 1.4             // difuminado del altar cuando está lejos (px)
  },

  /* Ambiente: transición día → atardecer, siempre gradual */
  environment: {
    sunsetStart: 30000,       // cuándo inicia el atardecer tras entrar al campo
    sunsetDuration: 120000    // qué tan lento es (no bloquea el final)
  }
};
