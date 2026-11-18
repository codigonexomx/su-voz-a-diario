# Navegación completa de comentarios

Corrección solicitada por el propietario el 18 de noviembre de 2026. Web/PWA 283 y Android 63 / 1.5.31.

## Lectura

El lector de comentarios permite elegir cualquier capítulo y versículo de Apocalipsis sin volver a la Biblia. Anterior y Siguiente recorren la obra completa; el selector de secciones y el índice permiten acceder directamente a sus 62 secciones en Henry y a los 101 destinos legibles de Hendriksen, incluidos preliminares e índices.

La ubicación explorada se conserva al cambiar de obra. «Volver a mi pasaje» regresa al pasaje de origen, que se conserva por separado; cerrar el comentario devuelve a la Biblia o a la meditación con el borrador, cursor, foco y desplazamiento. El salto bíblico utiliza los rangos confirmados y no los números de capítulos editoriales de Hendriksen. En 22:1 se muestra íntegra su sección 21:9–22:5.

El encabezado y los controles ocupan menos espacio. Los créditos visibles de Henry se reducen a la atribución de la obra, «Traducción: IA» y la fuente MHCC 2.0. La procedencia editorial detallada se conserva en los registros; los 62 textos, sus notas y el comentario de Hendriksen permanecen idénticos a la versión anterior.

JSON Henry: 160,278 bytes, SHA-256 `3bfa323a84f86aab1a188a53ecaac4939825b097405d8b408040f6e46ce57702`. El cambio del archivo corresponde sólo a los metadatos visibles de la obra. Hendriksen conserva SHA-256 `332e16359dfbaebad14ad659c1d01eb87b7c6efd5837acb9a0af02e63da411fa`.

## Verificación

La aplicación completa pasó en 390×844 y 1280×900: navegación fuera del pasaje de origen y entre capítulos, salto hasta 22:21, cambio de obra en 22:1, selección de versículo, RVR1960 + Strong, las dos notas de traducción y meditación entre 11:15 y 12:6 con borrador y foco preservados. Sin errores JavaScript. Evidencia en `artifacts/validation/commentary-navigation63-app/`.

La prueba específica del panel pasó también en 320×568 y 844×390, con texto de 20 px, sin desbordamiento horizontal. Cubre todos los destinos, límites de versículos, preliminares, índice, respuestas asíncronas, reintentos y cierre cuando el pasaje de origen deja de estar activo. Evidencias en `artifacts/validation/commentary-ui-navigation63.log` y `artifacts/validation/commentary-navigation-layout/`.

Pasaron 70/70 comprobaciones del proyecto con emuladores locales Firestore/Auth/Storage y datos ficticios. `bundleRelease`, `assembleRelease` y `lintRelease` de Android 63 completaron correctamente con Java 21.

La web 283 quedó publicada en `https://suvoz.app` desde el commit `1c8bd25de294b16aeecfd12af90e0c31f04f1f29`. Se comprobaron el JSON y el código exactos del panel; la prueba de la aplicación pública pasó en móvil y escritorio sin errores JavaScript ni escrituras en producción. Evidencia en `artifacts/validation/commentary-navigation63-app-live/`.

Android 63 / 1.5.31 pasó la auditoría y la prueba nativa sin conexión y quedó enviado a revisión de Google Play. La disponibilidad pública Android queda pendiente de Google; detalles en `release-android-1.5.31-63.md`.
