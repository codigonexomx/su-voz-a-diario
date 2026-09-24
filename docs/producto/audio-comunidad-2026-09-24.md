# Audio de Comunidad — corrección local, PWA 242

## Problemas encontrados

El menú conservaba la clase `open`, cuyo CSS utiliza `display: flex !important`; ocultarlo únicamente mediante estilo inline no lo cerraba. El lector esperaba `voiceschanged` cuando la lista inicial de voces estaba vacía. Además, si otro lector estaba hablando, el primer toque se limitaba a detenerlo.

## Corrección

- Cierre centralizado: selección, toque fuera, Escape y apertura de otro menú. `aria-expanded` actualizado y devolución de foco al disparador cuando corresponde.
- `speak()` web en el evento original del toque, incluso sin voces cargadas, con idioma español como alternativa. No espera ni modifica `onvoiceschanged`.
- Referencia persistente al utterance; tokens impiden que callbacks de una reflexión anterior cambien la actual.
- Preparación e inicio real diferenciados. Control visible «Detener lectura» junto al texto, sin volver a abrir opciones. Errores permiten reintentar.
- Cambio entre lectores cancela el anterior e inicia el solicitado. Salir de la vista detiene la lectura comunitaria.
- Android espera la detención antes de iniciar y verifica cancelación entre fragmentos; evita detenciones nativas duplicadas al reiniciar lectores.

## Validación realizada

`npm run test:community-voice`: lista de voces vacía sin evento posterior, inicio síncrono, otro lector hablando, cambio rápido, mismo botón, callbacks antiguos, motor pausado, error/reintento, excepción síncrona, finalización y cancelación nativa entre fragmentos.

Safari de macOS, app local en origen limpio `127.0.0.1:8783`: al pulsar Escuchar una vez apareció «Leyendo reflexión…» (estado emitido por `onstart`) y el menú se cerró. Detener desde el control visible eliminó el estado. Escape cerró el menú y devolvió el foco. No se publicaron ni modificaron reflexiones.

También pasan: conexiones, navegación inferior, Biblia fases 6 y 7, Mi camino y hotfix comunitario 203. Recursos sincronizados mediante `android:sync`; no se generó ni distribuyó un paquete nuevo en esta tarea.

Pendiente: prueba en iPhone físico, tanto Safari como aplicación instalada en pantalla de inicio. No se dispone de ese dispositivo en esta sesión. Verificar primer toque tras apertura en frío, cambio rápido de reflexión, detener, salir de Comunidad y finalizar una reflexión larga. El resultado de Safari de escritorio no certifica iOS.

## Referencias técnicas

- [WebKit: requisito de gesto para síntesis en iOS](https://bugs.webkit.org/show_bug.cgi?id=223473).
- [MDN: getVoices](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices).
- [MDN: voiceschanged](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/voiceschanged_event).

Cambios locales; sin commit, push ni publicación durante esta tarea.
