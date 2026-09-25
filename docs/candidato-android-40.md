# Candidato Android 40 — corrección de Comunidad

25 de septiembre de 2026. Versión 1.5.8 (40), PWA 254.

Corrige publicaciones anidadas en un bloque largo por HTML pegado y truncado. Conserva el texto visible al limpiar formato; evita recortar etiquetas en publicaciones y borradores. Las publicaciones ya guardadas sin texto legible muestran un aviso.

## Verificación

16 comprobaciones de HTML en Chromium y Safari de macOS; feed real de 20 publicaciones sin tarjetas anidadas. Pruebas de audio, integración, intención, identidad y conexiones aprobadas. Gradle bundleRelease, assembleRelease y lintRelease correctos: 0 errores y 22 advertencias. La tarea testReleaseUnitTest no está disponible en esta configuración. Bundletool valida el paquete y se compararon los recursos corregidos empaquetados contra www. No se repitieron pruebas físicas ni instalación limpia/actualización en emulador para esta corrección.

## Archivo

`artifacts/android-1.5.8-40/su-voz-1.5.8-40.aab`

SHA-256: `238b4ea901225db3e192bf59c5d2282dade27bf0c35daec070d4966f3859354a`

Reemplaza el candidato 39 para próximas cargas. Preparado para Play Console, no subido ni publicado en Google Play por el agente.
