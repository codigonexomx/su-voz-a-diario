# Matthew Henry: Android 1.5.30 (62)

Preparación del 18 de noviembre de 2026, America/Mexico_City. Base web/PWA 282: `94c903fe15a2f456c6e6545ed1456c578087245f`. Publicación solicitada por el propietario.

## Cambio

Incorpora los 22 capítulos del comentario conciso de Matthew Henry y sus continuadores sobre Apocalipsis, traducidos por DeepSeek y cotejados mediante revisión asistida. Se consulta en Biblia RVR1960, RVR1960 + Strong y las meditaciones, junto al comentario de William Hendriksen. El selector conserva el pasaje y el regreso al borrador de meditación; el contenido está incluido en Android para lectura sin conexión.

62 secciones, 404 versículos, 36 meditaciones y dos notas de traducción sobre dificultades no resueltas de la fuente. La revisión humana independiente sigue pendiente y no se presenta una conjetura como texto del autor. Procedencia y límites detallados en `release-matthew-henry-apocalipsis-2026-11-18.md`.

## Paquete

- Aplicación `app.suvoz`, versión 62 / 1.5.30, PWA 282, API mínima 24 y destino 36.
- `bundleRelease`, `assembleRelease` y `lintRelease` completados con Java 21.
- 70/70 comprobaciones con emuladores locales Firestore/Auth/Storage; pruebas de la aplicación real en móvil y escritorio también aprobadas en el sitio público.
- AAB congelado: `artifacts/android-1.5.30-62-release/su-voz-1.5.30-62.aab`.
- SHA-256 AAB: `68a700a21ed79a31811c65b0a267076059bc182009e8a75557023b3fbee62e56`.
- SHA-256 APK: `b374d06068a66ddb0de1519952be7d1f5f6c78bdfb924799510353233ef4b2be`.
- SHA-256 JSON Henry: `6f6f91b89fcf3ca9592cf71bb18b9e5396ae07d736aadfd41a7e672483e35153`.

El auditor `--candidate62` compara los recursos empaquetados con la web, las firmas y los permisos con Android 61, conserva las versiones anteriores y exige evidencia nativa del paquete exacto. La prueba nativa utiliza un emulador desechable en modo avión y sin Wi-Fi, con datos ficticios, sin escritura en producción ni intervención en un teléfono físico.

Auditoría aprobada: 252 recursos idénticos a la web, firma verificada, mismo certificado de subida, ningún permiso nuevo, cero errores de lint y 16 advertencias existentes. Las bibliotecas conservan alineación estática de 16 KB; no se afirma una prueba física de dispositivos con páginas de ese tamaño.

La fase nativa `commentary62` pasó con el APK exacto: Henry en Apocalipsis 1 y 22, selección de versículo, Strong, Atrás nativo y meditación que cruza de 11 a 12; cambio a Hendriksen y preservación de borrador, cursor, foco y desplazamiento. Las cinco capturas se tomaron después del dibujo de WebView y se revisaron visualmente. El primer intento detectó una expectativa equivocada del test (la sección fuente de Henry empieza en 11:14, no en 11:15); se corrigió sólo la prueba y se repitió sin modificar ni recompilar el paquete de producción. Emulador apagado al terminar.

## Google Play

Canal solicitado: producción, despliegue completo y cobertura existente. El estado observado, la auditoría y las evidencias quedan en `artifacts/android-1.5.30-62-release/`. La aprobación de Google se distingue del envío a revisión.

Enviado a revisión el 18 de noviembre de 2026. Play Console mostró **«Cambios en la etapa de revisión»** para `62 (1.5.30) — Matthew Henry en Apocalipsis`, con verificaciones rápidas en curso. Despliegue solicitado del 100 % en los países existentes; publicación administrada desactivada. La disponibilidad pública de esta versión aún no está confirmada. Google mostró una advertencia no bloqueante sobre símbolos de depuración de código nativo y ningún dispositivo perdió compatibilidad. Evidencia: `delivery.json` y `play-production-submitted.jpg`.

Notas es-419:

> Añadimos el comentario conciso completo de Matthew Henry sobre Apocalipsis, traducido al español, en Biblia y en las meditaciones. Elige entre Matthew Henry y William Hendriksen, consulta el índice por capítulos y lee sin conexión. Se conservan tu pasaje y tu reflexión al volver. Incluimos créditos y notas de traducción donde la fuente requiere aclaración.
