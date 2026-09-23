# Integración de lecturas de octubre a diciembre de 2026

La copia local contiene los 92 días del trimestre: 31 de octubre, 30 de noviembre y 31 de diciembre. Cada día incluye RVR60, NTV, TLA y una pregunta. Se conservaron literalmente las 89 preguntas del Word aprobado; las tres de Hageo son propuestas nuevas para revisión. Las lecturas anteriores mantienen sus datos originales.

## Contenido y fuentes

Se incorporaron los cuatro JSON de Descargas y `Preguntas_reflexion_Octubre_Diciembre_2026.docx`. Los nombres, hashes SHA-256 y ajustes de sintaxis están registrados en `fuentes-lecturas-octubre-diciembre-2026.json`. Ese manifiesto también registra el hash del texto de cada versión para detectar alteraciones posteriores. Los originales de Descargas no se modificaron.

Noviembre contenía una barra invertida inválida antes de `»`; diciembre tenía un punto en lugar de la coma entre dos objetos. Se reparó exclusivamente esa sintaxis. El archivo adicional de Hageo ya era JSON válido.

Los archivos mensuales, el respaldo `data/readings.json` y el índice coinciden. Los libros están vinculados a sus identificadores canónicos: 1 Samuel, 2 Pedro, Oseas, Apocalipsis, Hageo y Malaquías. Los tres meses se añadieron al precaché del service worker. Los recursos se sincronizaron con `www` y con los assets de Android.

## Corrección del lector

La prueba del 29 de noviembre en NTV detectó que el lector infería números de versículo a partir del texto completo e interpretaba cifras como `144.000` y `12.000` como separadores. El lector ahora respeta los marcadores HTML `sup` que ya contienen las lecturas, sin duplicar sus números. Se conserva el soporte de marcadores de API.Bible y se escapa el texto para preservar caracteres literales.

## Validación ejecutada

- `npm run check:readings-q4-release`: pasa; 92 fechas consecutivas, 276 textos contrastados por hash, 89 preguntas literales del Word y tres propuestas de Hageo, índice, referencias, vínculos y copia `www`.
- `node scripts/validate-deep-links.mjs`: pasa.
- `npm run test:bottom-nav`: pasa, incluidas pulsaciones rápidas, repetidas, cambios de dirección y geometría de la gota.
- `scripts/readings-browser-check.html`, ejecutado en Safari de macOS y en el navegador integrado: pasa en ambos. La aplicación se renderizó en un marco de 390 × 844 px.
- En cada navegador: 92 lecturas, 276 cambios/textos de versión, 92 preguntas visibles, 92 fechas y vínculos del calendario, contexto de la pregunta en Comunidad, siete transiciones entre fechas en ambos sentidos y respaldo de las 92 lecturas cuando se simula un fallo de carga mensual.
- Regresión del lector en cada navegador: 456 textos de meses anteriores conservan su contenido renderizado; pasan tres casos específicos de números internos, reinicio de capítulo y caracteres especiales. No se detectó desbordamiento horizontal en el recorrido móvil.
- Comparación con HEAD: los 177 registros previos del respaldo y del índice mantienen exactamente sus datos.
- Comparación de archivos: datos y recursos relevantes de raíz, `www` y `android/app/src/main/assets/public` son idénticos.
- `git diff --check`: pasa.

El antiguo `npm run test:tla` no pudo ejecutarse porque depende del archivo externo `Downloads/readings_tla_jul_aug_2026.json`, que ya no existe en esa ubicación. No se fabricó una fuente sustituta. La prueba nueva verificó los textos incorporados con sus fuentes; la prueba de navegador también recorrió los 456 textos históricos disponibles.

## Estado para commit y siguiente candidato

PWA 238. Android preparado con `versionCode 38` y `versionName 1.5.6`. En esta tarea no se hizo commit, push, compilación de un AAB ni subida a Play Console. El candidato 37 anterior no representa estos cambios.

Los cambios están disponibles para revisión. Las tres preguntas nuevas se encuentran en `preguntas-propuestas-hageo-2026.json`, y el documento `preguntas-integradas-octubre-diciembre-2026.md` muestra el trimestre completo. Las propuestas originales de la tarea anterior son material histórico, no la fuente de las preguntas integradas.

Antes de distribuir el próximo AAB corresponde revisar las tres preguntas de Hageo, compilar el candidato a partir de estos recursos, registrar su hash y probar ese paquete en Android. La prueba móvil en un navegador y la sincronización de recursos no sustituyen la instalación limpia, la actualización desde producción ni las pruebas de Play.

Para repetir la validación de datos: `npm run check:readings-q4-release`. Para repetir la prueba del lector, servir el repositorio localmente, abrir `/scripts/readings-browser-check.html` y pulsar «Probar 92 lecturas y tres versiones». Esa página de prueba no se incluye en el paquete Android.
