# Hendriksen junto a Apocalipsis

La edición web/PWA 280 permite abrir «Más que vencedores», de William Hendriksen, desde el pasaje que se está leyendo en Biblia (RVR1960 o RVR1960 + Strong) y desde las meditaciones de Apocalipsis. El texto se presenta dentro de la aplicación; no abre un PDF.

El botón «Comentario» usa el versículo visible. Las acciones de un versículo seleccionado ofrecen «Comentario · Hendriksen». Al cerrar el comentario se conservan la selección, el lugar de lectura y cualquier nota. En la meditación, «Seguir meditando» devuelve al mismo borrador, cursor y posición. El comentario no se inserta automáticamente en las reflexiones personales.

El lector incluye las secciones correspondientes al pasaje, navegación por el índice completo, introducciones, notas originales, diagrama, preliminares y créditos editoriales. Las 36 lecturas programadas de Apocalipsis están vinculadas, incluidos los intervalos entre capítulos. Las secciones mantienen los límites del autor: no se fabricó un comentario individual por versículo.

## Fuente y conversión

Se utiliza el PDF completo aportado por el propietario: «Más que vencedores», Libros Desafío ©2005, traducción de Benjamín Galán, revisión de Derk Oostendorp y Alejandro Pimentel. Se conservan estos créditos en el lector y en `data/commentaries/NOTICE.txt`. No se declara la obra de dominio público.

La edición procede de 243 páginas y contiene 94 entradas jerárquicas, 50 secciones vinculadas a los 404 versículos de Apocalipsis y 273 notas en 14 grupos. La corrección asistida del OCR se cotejó con el escaneo; el proyecto editorial externo conserva las fuentes sin modificar, posiciones, hashes, evidencias y decisiones. Las erratas ya impresas se distinguen de los errores del reconocimiento y no se armonizan las citas con otra traducción bíblica. Esto no se presenta como una certificación editorial humana.

La importación es reproducible mediante `node scripts/import-hendriksen.mjs /ruta/al/paquete-corregido.json`. La distribución contiene sólo la edición de lectura; las rutas privadas, imágenes de auditoría y OCR duplicado permanecen fuera del sitio público.

Paquete editorial final SHA-256: `e587f81cab2a628bf5109257c629a4b4b53e90393db119326a06402c910d5aae`. El registro contiene 1,122 correcciones en 213 páginas. Las 1,118 diferencias entre motores se cotejaron: 798 corregidas y 320 lecturas originales conservadas, sin discrepancias pendientes. La auditoría independiente aprobó 6,715 comprobaciones de aplicación e integridad. Las fuentes sin corregir permanecen intactas.

## Comportamiento y comprobaciones

- Consulta inclusiva por versículo o intervalo entre capítulos, sin duplicar secciones; cobertura de los 404 versículos y las 36 lecturas programadas.
- Carga compartida entre Biblia y meditación, reintento tras fallo, escape del texto y rechazo de recursos de imagen no admitidos.
- Panel dentro de DeepeningShell, manejo de Escape/atrás, foco, borradores y cargas obsoletas. Índice completo y padres estructurales con acceso a sus subsecciones.
- Recursos de interfaz requeridos por el service worker y datos disponibles en la copia pública `www`.
- El capítulo activo del lector continuo sigue los versículos visibles. El pie de copyright de Judas ya no mantiene activo ese libro al comenzar Apocalipsis.
- Pruebas del panel con DeepeningShell real en 390×844 y 1280×900; pruebas adicionales de la aplicación completa, con conexiones externas bloqueadas y perfiles de navegador aislados.

Pruebas reproducibles: `scripts/validate-commentary.mjs`, `scripts/validate-commentary-ui.mjs` y `scripts/validate-continuous-reader.mjs`. Informes y capturas de la comprobación local completa en `artifacts/validation/commentary-app/` (no publicados).

Validación local: 59/59 comprobaciones generales aprobadas con Node 22.23.5. La prueba de aplicación completa aprobó ambos tamaños sin errores JavaScript, con RVR60, Strong, selección de versículo, ocultación fuera de Apocalipsis y meditación entre capítulos. La prueba del panel verificó además notas, diagrama, índice, reintentos, foco y cargas obsoletas.

Esta entrega corresponde a web/PWA. La sincronización de `www` prepara los recursos nativos, pero no equivale a un nuevo envío a Google Play.
