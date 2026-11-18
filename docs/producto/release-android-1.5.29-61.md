# Hendriksen: Android 1.5.29 (61)

Preparación del 17 de noviembre de 2026, America/Mexico_City. Base web/PWA 281: `b25d5e725b29471a6839a14dd2a3e4746bdc3bb7`. El propietario solicitó incorporar el comentario a Android y publicarlo en Google Play.

## Cambio para el lector

«Más que vencedores», de William Hendriksen, se consulta dentro de Biblia en RVR1960 y RVR1960 + Strong y desde las meditaciones de Apocalipsis. Incluye el texto completo, índice, introducciones, notas, diagrama y créditos de la edición aportada. Las secciones mantienen los límites del autor y cubren los 404 versículos y las 36 lecturas programadas.

El contenido se incluye en el paquete Android y abre sin conexión. Al cerrar se conserva la selección bíblica o el borrador de meditación, el cursor y la posición. El botón Atrás de Android cierra primero el comentario. También incorpora la corrección de navegación entre Judas y Apocalipsis publicada en PWA 281.

## Paquete y validación

- Aplicación `app.suvoz`, versión 61 / 1.5.29, API mínima 24 y destino 36.
- `bundleRelease`, `assembleRelease` y `lintRelease` correctos con Java 21. Firma y certificado de subida iguales a Android 60, permisos sin cambios y alineación estática de bibliotecas de 16 KB.
- 70/70 comprobaciones aprobadas con emuladores locales Firestore/Auth/Storage. El primer intento tuvo una transacción invalidada por contención en el emulador; la repetición completa en un entorno limpio pasó sin modificar las funciones ni debilitar las pruebas.
- Auditor `--candidate61`: recursos públicos idénticos a `www`, datos privados excluidos, Strong íntegro y JSON de Hendriksen exacto: 94 entradas, 273 notas y 14 grupos.
- Prueba nativa con APK de producción firmado en emulador Android 36 desechable, modo avión y Wi-Fi apagado antes de abrir la aplicación: RVR60, Strong, versículo seleccionado, Atrás nativo, ocultación fuera de Apocalipsis y meditación entre capítulos. Verifica borrador, cursor, foco y desplazamiento al regresar. Las capturas esperan el dibujo real de WebView.
- Sólo datos ficticios, sin cuenta, sin escrituras en producción ni intervención en un dispositivo físico. Emuladores apagados al terminar. No equivale a una prueba física de todos los dispositivos ni de memoria con páginas de 16 KB.

AAB congelado: `artifacts/android-1.5.29-61-release/su-voz-1.5.29-61.aab`.

SHA-256: `615ccafb1726239f90ab83ced629e24ceb53ac578d69f2cf946b5dcbfdbe82d9`.

JSON Hendriksen SHA-256: `332e16359dfbaebad14ad659c1d01eb87b7c6efd5837acb9a0af02e63da411fa`. Los créditos, la corrección OCR y su trazabilidad están documentados en `release-hendriksen-apocalipsis-2026-11-17.md`.

Evidencias locales no publicadas: `audit-release.json`, `native-qa/environment.json`, `native-qa/evidence/commentary61.json` y capturas en la carpeta de esta versión.

## Entrega en Google Play

Play Console confirmó Android 60 (1.5.28) publicado al 100 %, 178 países o regiones y ningún cambio pendiente. Android 61 se prepara para ese mismo canal de producción y cobertura, según la solicitud del propietario. No se modifican precios, permisos, privacidad, listas de pruebas ni datos personales.

El estado final observado y la captura de Play Console se registran en `artifacts/android-1.5.29-61-release/delivery.json`. Subir el paquete o enviarlo a revisión no equivale a su aprobación y disponibilidad pública.

Notas es-419:

> Incorporamos el comentario completo de William Hendriksen sobre Apocalipsis en Biblia y en las meditaciones. Consulta la sección del pasaje, el índice y las notas sin conexión, junto a RVR1960 y RVR1960 + Strong. Al volver a meditar se conserva tu reflexión. También mejoramos la navegación entre capítulos.
