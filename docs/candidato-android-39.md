# Candidato Android 39 — Su Voz a Diario

24 de septiembre de 2026. Versión **1.5.7 (39)**, PWA **253**, aplicación `app.suvoz`.

## Cambios incluidos
Lectura bíblica continua con audio por capítulo, continuidad del lugar y referencias/notas con atribución. Búsqueda por libro y frase exacta con regreso conservado. Notas vinculadas a su edición y fragmento. Acción Meditar conectada sin sobrescribir borradores. Retiro completo de Strong y catálogo público limitado a las versiones disponibles. Avisos de autoría en lecturas diarias; no equivalen a nuevas licencias. Corrección puntual documentada de Isaías 43:1.

## Verificación
- 27 comprobaciones de aplicación y servicios aprobadas; sintaxis de 72 archivos correcta. Octubre–diciembre completos en comprobación estricta.
- Prueba TLA ahora reproducible con hashes de los 62 textos ya confirmados en Git; admite archivo original como argumento opcional. El original de Descargas no está disponible y no se afirma una nueva cotejación editorial.
- Gradle bundleRelease, assembleRelease, testReleaseUnitTest y lintRelease completados. Lint: cero errores y 22 advertencias sobre recursos/iconos, almacenamiento, manifiesto y dependencias. No se actualizaron dependencias ajenas a esta entrega.
- Bundletool valida el AAB. Firma verificada; certificado del APK derivado del AAB coincide con versión 38. El aviso de jarsigner sobre cadena autofirmada no es un cambio de certificado.
- 119 archivos empaquetados comparados byte a byte con www; Strong, marketing y scripts de pruebas ausentes.
- Emulador desechable SuVoz_QA_36, Android API 36: actualización 38 → 39 con marcador y tamaño de lectura conservados; instalación limpia de APK derivado del AAB. Ambas pasan navegación de cinco secciones, desbordamiento horizontal cero, barra estable dentro de cada modo y apertura/cierre de teclado con gestos y tres botones.
- Las fases históricas seed36/upgrade37 del ejecutor se reutilizaron para la actualización real 38 → 39; sus nombres no indican la versión instalada.

## Paquete
`artifacts/android-1.5.7-39/su-voz-1.5.7-39.aab`

Tamaño: 30,091,774 bytes. SHA-256:

`33663c47b939a7c820d1075f7363fbc6d6f53999fdc613a34a1f07f2c04a5740`

APK universal derivado, manifest.json y evidencia de QA están en esa misma carpeta, excluida de Git. Marketing local y credenciales no se incorporan al commit ni al paquete.

## Límites y distribución
Candidato preparado para carga en Play Console, sin publicación automática. Falta informe previo al lanzamiento de Google Play y pruebas en teléfonos físicos/iPhone. No se promete ausencia absoluta de fallos ni se considera probado un recorrido de cientos de capítulos. Las pruebas de concurrencia con Firestore y de reglas no se repitieron: no hubo cambios de backend ni reglas en esta entrega.
