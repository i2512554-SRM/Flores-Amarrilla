// Edita aquí el mensaje, los tiempos y la calidad inicial de la versión 3D.
export const CONFIG = {
  finalMessage: {
    title: 'Para ti',
    message: `Hoy quisiera regalarte flores amarillas,
              pero también algo que no pueda marchitarse:
              unas palabras que se queden contigo
              cuando las flores ya hayan perdido sus pétalos
              y este día se haya convertido en un recuerdo.

              Llegaste a mi vida de una forma tan bonita
              que, sin darme cuenta, empecé a encontrarte
              en mis pensamientos más simples:
              en una canción, en una sonrisa inesperada,
              en esas ganas de contarle algo a alguien
              y pensar primero en ti.

              Y es curioso, porque entre tantas personas
              tu manera de ser consiguió volverse especial para mí.
              No porque todo sea perfecto,
              sino porque incluso en nuestros días normales,
              en nuestras pequeñas locuras, conversaciones y momentos,
              encuentro razones para quererte un poquito más.

              Por eso hoy estas flores amarillas son para ti. 🌻
              Porque dicen que representan alegría, esperanza y cariño,
              y cuando pienso en esas palabras,
              inevitablemente también pienso en ti.

              Quiero seguir compartiendo contigo
              muchos días que todavía no conocemos,
              seguir descubriendo nuevas razones para sonreír,
              acompañarte cuando las cosas sean bonitas
              y quedarme también cuando los días sean difíciles.

              Tal vez algún día olvidemos la fecha exacta,
              o no recordemos cada palabra que nos dijimos,
              pero espero que nunca olvides algo:

              **entre todas las flores que podría regalarte,
              siempre voy a preferir la sonrisa que aparece en tu rostro
              cuando sabes que son para ti.**

              Feliz Día de las Flores Amarillas, mi amor. 💛🌻
              Gracias por ser una parte tan bonita de mi vida
              y por darle a mis días un color que antes no tenían.`,
    signature: '— Con cariño',
    closeButton: 'Volver al campo'
  },
  journey: {
    startZ: 14,
    endZ: -24,
    stopDistance: 4.1,
    durations: [4, 5, 5, 5.2],
    openingDuration: 1.6
  },
  quality: { default: 'auto', maximumFlowers: { mobile: 1100, desktop: 2100 } },
  sound: {
    volume: 0.18,
    source: 'assets/audio/prueba-inexistente.mp3',
    musicVolume: 0.45,
    startOnEnter: true
  },
  chapters: [
    { label: '01 / LA PRIMERA LUZ', title: 'Todo empieza con una flor', hint: 'Toca el girasol iluminado. Guarda una pequeña luz.' },
    { label: '02 / ENTRE PÉTALOS', title: 'Hay belleza en el camino', hint: 'Este girasol también tiene algo que compartir.' },
    { label: '03 / CASI AHÍ', title: 'Algunas cosas florecen para ti', hint: 'Despierta la última flor y sigue su luz.' }
  ]
};

