# Campo de girasoles 3D

Abre una terminal en esta carpeta y ejecuta:

```powershell
python -m http.server 8779 --bind 127.0.0.1
```

Después entra a `http://127.0.0.1:8779/index.html`. El proyecto usa módulos JavaScript y necesita un servidor HTTP; abrir el HTML directamente desde el explorador no es suficiente.

El recorrido tiene tres girasoles interactivos y un corazón que abre el mensaje. Puedes tocar las flores o sus indicadores, seguir adelante sin activarlas, pausar el viaje y repetirlo después del mensaje. Arrastra o usa las flechas con el lienzo enfocado para mirar; Enter activa el descubrimiento y Espacio pausa el viaje. Escape cierra el mensaje o centra la mirada.

Edita `config3d.js` para personalizar el mensaje final, la firma, los tiempos y la cantidad máxima de flores. El sonido ambiental se genera con Web Audio y permanece apagado hasta activarlo. No necesita un archivo MP3.

La calidad automática empieza en ligera para móviles y media para escritorio. Reduce resolución, densidad, sombras y efectos si detecta frames lentos de manera sostenida. El selector permite elegir ligera, media o alta manualmente.

La preferencia del sistema de movimiento reducido y el botón «Recorrido sin movimiento» detienen las animaciones decorativas y sustituyen el viaje por cambios de escena tras acciones del usuario.

Three.js 0.160.0 se carga desde jsDelivr: la primera visita requiere conexión. Si no carga o WebGL no está disponible, se ofrece `version-css/index.html` como alternativa ligera. Esta versión anterior se conserva para recuperación y no incorpora el recorrido nuevo.
