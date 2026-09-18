// Edita aquí el mensaje, los tiempos y la calidad inicial de la versión 3D.
export const CONFIG = {
  finalMessage: {
    title: 'Para ti',
    message: 'Escribe aquí tu mensaje.\nPuede ocupar varias líneas.',
    signature: '— Con cariño',
    closeButton: 'Volver al campo'
  },
  journey: {
    startZ: 14,
    endZ: -24,
    stopDistance: 4.1,
    durations: [3.2, 4, 4, 4.2],
    openingDuration: 1.3
  },
  quality: { default: 'auto', maximumFlowers: { mobile: 1100, desktop: 2100 } },
  sound: { volume: 0.18 },
  chapters: [
    { label: '01 / LA PRIMERA LUZ', title: 'Todo empieza con una flor', hint: 'Toca el girasol iluminado. Guarda una pequeña luz.' },
    { label: '02 / ENTRE PÉTALOS', title: 'Hay belleza en el camino', hint: 'Este girasol también tiene algo que compartir.' },
    { label: '03 / CASI AHÍ', title: 'Algunas cosas florecen para ti', hint: 'Despierta la última flor y sigue su luz.' }
  ]
};
