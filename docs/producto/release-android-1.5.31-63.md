# Navegación de comentarios: Android 1.5.31 (63)

Corrección del 18 de noviembre de 2026, America/Mexico_City. Web/PWA 283: `1c8bd25de294b16aeecfd12af90e0c31f04f1f29`. Publicación autorizada por el propietario.

## Cambio

Permite recorrer toda la obra dentro del lector de comentarios, elegir capítulo y versículo, cambiar de autor en la misma ubicación y regresar al pasaje original de la Biblia o meditación. Simplifica los créditos de Henry a «Traducción: IA». La prosa y las notas de ambos comentarios permanecen intactas. Detalles en `release-navegacion-comentarios-2026-11-18.md`.

## Paquete

- Aplicación `app.suvoz`, versión 63 / 1.5.31, PWA 283, API mínima 24 y destino 36.
- `bundleRelease`, `assembleRelease` y `lintRelease` completados con Java 21.
- 70/70 comprobaciones con emuladores locales Firestore/Auth/Storage y pruebas de navegación en cuatro tamaños de pantalla.
- AAB congelado: `artifacts/android-1.5.31-63-release/su-voz-1.5.31-63.aab`.
- SHA-256 AAB: `e00e9405038c34455ff8864b828d93a3d0ee6990198d65f3491de820443b7f17`.
- SHA-256 APK: `0b4c477952cb106f0e695532a101bbb8316cdce36f5b94f3428e885d902eb96c`.
- SHA-256 JSON Henry: `3bfa323a84f86aab1a188a53ecaac4939825b097405d8b408040f6e46ce57702`.

El auditor `--candidate63` compara la integridad del paquete con la web y Android 62, exige textos y notas idénticos y valida evidencia nativa del APK exacto. La versión 62 y sus evidencias permanecen conservadas.

Auditoría aprobada: 252 recursos coinciden con la web; firma verificada y mismo certificado de subida que Android 62; ningún permiso nuevo; cero errores de lint y 16 advertencias existentes. Textos y notas de Henry idénticos a la versión 62. Alineación estática de bibliotecas de 16 KB; no se afirma una prueba física con páginas de ese tamaño.

La fase nativa `commentary63` pasó en el APK exacto, en un emulador desechable sin conexión, con datos ficticios y sin tocar teléfonos físicos. Verificó 62/101 destinos, navegación global, salto directo, regreso al pasaje, ubicación al cambiar de obra, selección, Strong, Atrás nativo y conservación de borrador, foco, cursor y desplazamiento. Cuatro capturas tomadas tras el dibujo de WebView y revisadas visualmente. El emulador quedó apagado. Evidencia en `artifacts/android-1.5.31-63-release/native-qa/`.

## Google Play

Enviado a revisión el 18 de noviembre de 2026 a las 19:01 UTC. Play Console mostró «Cambios en la etapa de revisión» para `63 (1.5.31) — Navegación de comentarios`, con verificaciones rápidas en curso. Despliegue solicitado del 100 % en los países existentes y publicación administrada desactivada. Google no redujo dispositivos compatibles y mostró sólo la advertencia no bloqueante de símbolos de depuración nativos. La aprobación y disponibilidad pública de esta actualización Android siguen pendientes. Evidencias: `artifacts/android-1.5.31-63-release/delivery.json` y `play-production-submitted.jpg`.

Notas es-419:

> Ahora puedes recorrer todo el comentario de Apocalipsis sin volver a la Biblia: elige capítulo, versículo o sección, usa Anterior y Siguiente y vuelve a tu pasaje original. Cambia entre Matthew Henry y William Hendriksen conservando la ubicación. Simplificamos los créditos de Henry a «Traducción: IA». Conservamos tu reflexión al regresar a la meditación y la lectura sin conexión.
