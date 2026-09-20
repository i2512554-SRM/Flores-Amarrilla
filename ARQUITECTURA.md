# Sistema "Campo de girasoles" — Documento de arquitectura y guía de reutilización

> Propósito de este archivo: guardar cómo está hecho este proyecto (estructura, módulos,
> patrones y decisiones) para poder replicar la misma intención en futuros proyectos:
> **una experiencia web sentimental/regalo: un viaje narrativo interactivo con flores,
> música ambiental y un mensaje final personalizado.**

---

## 1. Qué es el proyecto

Experiencia web en español, sin backend, ni build step (JS plano con módulos ES).
Tema: un campo 3D de girasoles al atardecer. La persona destinataria:

1. Lee una intro ("Un campo te espera").
2. Pulsa «Entrar» → empieza la música y un viaje guiado por un sendero.
3. En 3 paradas, "despierta" girasoles protagonistas (capítulos 01, 02, 03).
4. Al final del sendero hay un corazón 3D que abre un mensaje personalizado.
5. Después puede explorar libremente o repetir el recorrido.

Stack: **Three.js 0.160.0 desde CDN (jsDelivr) vía importmap**, WebGL con postprocesado,
Web Audio API para efectos, `<audio>` HTML para la música. Sin dependencias instaladas.

## 2. Estructura de archivos

```
Flores Amarrilla/
├── index.html            # Página principal (versión 3D). Fallback integrado.
├── main.js               # Orquestador: viaje, estados, UI, entrada, audio, calidad. (~493 líneas)
├── scene3d.js            # Renderer, cielo, terreno, sendero, hierba, polvo, calidad gráfica.
├── sunflowerField.js     # Campo instanciado por sectores, girasoles protagonistas, partículas.
├── audio3d.js            # createSoundscape(): música + efectos (viento sintetizado, campanas).
├── config3d.js           # TODA la personalización: mensaje, tiempos, música, calidad, capítulos.
├── styles.css            # Estilos de la UI de la versión 3D.
├── assets/audio/         # MP3 local de la música.
├── version-css/          # Versión ligera de respaldo (sin WebGL, DOM+CSS).
│   └── js/ + css/        # Sistema modular propio (SF namespace): audio, escenas, flores...
├── campo-de-girasoles.html # Versión antigua monolítica (histórica).
├── js/  css/             # Copia/variante del sistema DOM+CSS.
├── .qa/                  # Páginas de prueba para casos de error (sin mp3, sin config).
└── README.md / ARQUITECTURA.md
```

**Regla clave de servicio:** módulos ES ⇒ requiere servidor HTTP.
`python -m http.server 8779 --bind 127.0.0.1` y abrir `http://127.0.0.1:8779/index.html`.
No funciona con doble clic al archivo (file://).

## 3. Arquitectura por capas (versión 3D)

### 3.1 index.html — el cascarón resiliente
- Contiene SOLO el DOM de UI: toolbar (botón Música, selector Calidad), overlay de intro
  (botón start, botón movimiento reducido, enlace a versión ligera oculto), UI del viaje
  (capítulos, hotspots, barra de progreso, botones pausa/seguir/repetir), tarjeta final
  (dialog accesible), `<audio id="background-music">` y el `<canvas>`.
- **Patrón de fallback inline (muy reutilizable):** `window.experienceFailed()` +
  `window.experienceReady`. Script inline clásico (no módulo) que escucha:
  - `error` capturado del tag `<script id="experience-module">`,
  - `unhandledrejection`,
  - `load` sin que `experienceReady` sea true.
  Si algo falla (sin internet, sin WebGL, navegador viejo): muestra el enlace a la
  versión ligera CSS y deshabilita controles. El módulo pone `experienceReady = true`
  al iniciar con éxito.
- Importmap fija `three` y `three/addons/` al CDN. Los imports locales llevan
  `?v=20260918-music` como rompe-caché manual al editar.

### 3.2 config3d.js — única fuente de personalización
Todo lo editable por el "regalador" está en un solo objeto exportado:
- `finalMessage { title, message, signature, closeButton }`
- `journey { startZ, endZ, stopDistance, durations[4], openingDuration }`
- `quality { default, maximumFlowers { mobile, desktop } }`
- `sound { volume (efectos), source (mp3 relativo), musicVolume, startOnEnter }`
- `chapters[3] { label, title, hint }` — textos de cada parada.

**Patrón:** separar contenido/regalo de la mecánica. Cambiar la canción o el mensaje
no toca lógica.

### 3.3 scene3d.js — mundo estático y calidad
`createScene(canvas, opts)` devuelve `{ renderer, scene, camera, composer, bokeh, setQuality, setAmbience, update, setReducedMotion, dispose }`.
- Cielo con **shader propio** (gradiente cenit→horizonte + disco solar con dos potencias).
- Terreno: plano con altura por seno/coseno; franja llana a lo largo del sendero
  (`pathCenter(z) = sin((14-z)*0.16)*1.5`, el sendero serpentea).
- Sendero: franja triangular generada (180 segmentos, 2 vértices por lado) con textura
  canvas procedimental (`seededRandom` => determinista).
- Hierba instanciada (2 triángulos) que ondula inyectando GLSL con `onBeforeCompile`
  (`#include <begin_vertex>` reemplazado al vuelo).
- Polvo/motas flotantes: `THREE.Points` con shader propio y niebla manual.
- **Sistema de calidad en 3 niveles** (`QUALITY = {low, medium, high}`): DPR, sombras
  (0/1024/2048), bloom, bokeh, conteo de hierba y polvo. `setQuality` reconfigura en
  caliente, limpiando shadow maps y marcando `material.needsUpdate`.
- **Paleta diurna→atardecer**: `setAmbience(progress)` interpola cielo, niebla, luces y
  sol según el avance del viaje (0..1·0.72). El recorrido "oscurece" hacia el atardecer.
- Postprocesado: EffectComposer = RenderPass + UnrealBloomPass + BokehPass (DOF suave,
  solo en high) + OutputPass. ACES tone mapping.

### 3.4 sunflowerField.js — miles de flores con instancing y LOD
- Geometrías construidas por código (nada importado): pétalos = planos curvados,
  disco+borde, tallo cilíndrico, hojas. Dos niveles de detalle (near/far).
- Texturas **100% procedurales con canvas 2D**: corazón de semillas con espiral de
  Fibonacci (ángulo áureo), pétalo con gradiente y nervaduras + normal map sintético.
- **Campo dividido en sectores** (7 filas × 2 lados). Cada sector es un `InstancedMesh`
  por parte (tallo/cabeza/pétalos). LOD por distancia con **histéresis** (±1.5) para no
  parpadear. La calidad reduce `mesh.count`, no re-instancia.
- **Viento global en shader** (uniforms compartidos `windUniforms`): curva cada flor por
  altura; además el puntero del ratón "empuja" las flores cercanas (`uPointer`), con el
  mismo código GLSL inyectado también en `customDepthMaterial` para que las sombras
  coincidan. `customProgramCacheKey` fijo para no recompilar.
- **3 girasoles protagonistas** (`discoveries`, z = 6, -5, -16) con materiales propios,
  halo aditivo y `activate()`: apertura progresiva de corona, emisividad creciente y
  explosión de hasta 30 pétalos-partícula con física simple. `reset()` devuelve todo al
  estado inicial para "Recorrer de nuevo".
- Todo con `dispose()` completo (geometrías, materiales, texturas).

### 3.5 audio3d.js — patrón estrella de música ambiental (reutilizable tal cual)
`createSoundscape({ volume, source, musicVolume, musicElement, onError })`.
- Dos capas: **música** = elemento `<audio>` HTML (loop, preload metadata, volumen
  `musicVolume`); **efectos** = Web Audio (viento = ruido rosa en loop por buffer +
  lowpass + gain master; `chime(n)` = campanitas con osciladores seno de notas C/E/G/C).
- **Respeta la política de autoplay**: `music.play()` se invoca síncronamente dentro del
  gesto del usuario («Entrar» o botón Música), antes de cualquier `await`.
- Máquina de estados robusta con `revision` (contador): evita condiciones de carrera al
  activar/apagar/suspender repetidamente (un play rechazado tardío no corrompe el estado).
- `suspend()` al ocultar pestaña, `resume()` al volver (reanuda solo si estaba activa).
  `dispose()` en `pagehide`. Nunca reinicia ni duplica la pista al repetir el viaje.
- Errores: `music.addEventListener('error')` → `onError()` y la UI ofrece "Reintentar
  música". Si Web Audio no existe, la música sigue funcionando.

### 3.6 main.js — orquestador / máquina de estados del viaje
Estados: `intro → travelling → discovery → (arrival|opening) → final → explore`.
- Viaje guiado: `trip = {fromZ, toZ, elapsed, duration}` con easing smoothstep;
  `placeCamera(z)` sigue el sendero. Cada parada espera que se "despierte" el girasol
  (botón, clic 3D por raycast, o Enter) → campanada → retardo 0.95 s → siguiente tramo.
- **Mirada**: arrastre táctil/ratón, flechas, y paralaje suave al mover el ratón; todo
  con lerp exponencial (`1 - exp(-dt*k)`). Hotspots (botones HTML) se posicionan
  proyectando posiciones 3D (`project()`) y se recortan a la pantalla.
- **Calidad automática adaptativa**: promedio exponencial del frame time; tras >8 s y
  >100 frames malos, baja un nivel (sin subir nunca = sin oscilaciones). Selector manual
  persiste en `localStorage`.
- **Accesibilidad**: `prefers-reduced-motion` + botón propio → sin movimiento de cámara
  (transiciones instantáneas por gesto), foco gestionado entre botones, ARIA en todo,
  teclado completo (flechas mirar, Enter descubrir, Espacio pausar, Esc cerrar/centrar).
- **Ciclo de vida**: `visibilitychange` suspende render+audio; `pagehide` dispone TODO
  (a menos que sea bfcache); `pageshow(persisted)` reanuda; `webglcontextlost` vuelve a
  la intro con la vía de fallback. Protección `disposed`/`contextFailed` en cada async.
- Intro: botón deshabilitado hasta `experienceReady` ("Preparando el campo…" → "Entrar al campo →").

## 4. Versión CSS de respaldo (`version-css/`)
Sistema independiente sin WebGL ni CDN. Namespace global `SF` con módulos IIFE:
`config.js` (otro EXPERIENCE_CONFIG), `audio.js` (misma canción con fade volumétrico y
pausa por visibilidad), `scenes.js` (paseo por escenas DOM), `flowers.js`,
`interactions.js`, `environment.js`, `quality.js`, `main.js`. Sirve para navegadores
viejos, sin internet, o si WebGL falla. Cambiar la canción aquí requiere copiar el mp3 a
`version-css/assets/audio/`.

## 5. Checklist de QA (carpeta `.qa/`)
- `media.html`: página que vuelca estado del `<audio>` (src, readyState, errorCode...) —
  para depurar música en navegadores reales.
- `missing-music.html` + `missing-config.js`: prueban la ruta de error con un mp3
  inexistente (vía importmap que redirige config3d.js). Verifican que la UI degreda con
  elegancia ("Reintentar música").
- Pruebas manuales habituales: sintaxis con `node --check`, servidor local y HEAD al mp3
  con su URL exacta (nombre con espacios y "ñ" codificados).

## 6. Patrones reutilizables para futuros proyectos "regalo"

1. **Un solo archivo de configuración** con todo el contenido emocional (mensaje,
   textos, canción). La mecánica nunca se edita.
2. **Triple red de seguridad**: (a) script inline clásico que detecta fallo del módulo,
   (b) ruta de error del audio con reintento, (c) versión ligera sin dependencias como
   destino final. La experiencia nunca es una pantalla muerta.
3. **Audio ambiental**: música HTMLAudioElement + efectos Web Audio; play() dentro del
   gesto; contador de revisión contra carreras; suspend/resume/dispose con el ciclo de
   vida de la página; pausa al ocultar la pestaña; al repetir el viaje no se reinicia.
4. **Narrativa = máquina de estados** (intro → tramos → descubrimiento → llegada →
   mensaje → exploración) con `hidden`/`inert` en el DOM y foco movido explícitamente.
5. **Calidad adaptativa**: 3 niveles, selector + auto con degradación sostenida sin
   histeresis; persistencia en localStorage.
6. **Todo procedural** (texturas canvas, geometrías por código, seed fijo): cero assets
   binarios salvo la música; reproducible y liviano.
7. **Romper caché con `?v=fecha-tema`** en imports y el tag script, para que el
   destinatario siempre vea la última versión.
8. **Accesibilidad desde el inicio**: reduced-motion, teclado, ARIA, foco gestionado.
9. **Dispose completo** y listeners de ciclo de vida: la página no deja sonido ni bucles
   colgados jamás.
10. **Personalización del destinatario en texto plano** (español, tono cálido) en todos
    los microcopy: hints, estados de botones, notas de carga.

## 7. Cómo usar este sistema en un proyecto nuevo (misma intención)

1. Copiar la carpeta como plantilla.
2. Editar SOLO `config3d.js`: mensaje final, textos de capítulos, nombre del mp3.
3. Sustituir `assets/audio/*.mp3` (nombre exacto, preferir sin caracteres especiales).
4. Opcional: retocar paleta en `scene3d.js` (`PALETTE`/`evening`) y número/posición de
   descubrimientos en `sunflowerField.js` (`[6, -5, -16]`).
5. Subir la carpeta tal cual a cualquier hosting estático (Netlify, GitHub Pages...).
   Verificar música con `.qa/media.html` y la ruta de error con `.qa/missing-music.html`.
