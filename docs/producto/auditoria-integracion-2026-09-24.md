# Auditoría de integración — Su Voz a Diario

24 de septiembre de 2026. Revisión local posterior a Mi camino. PWA final **241**.

## Alcance y resultado

Se revisaron las conexiones entre Su Voz Hoy, versiones de lectura, Biblia, calendario, cuadernillo, Biblioteca, Mi camino, Comunidad, respaldos, enlaces públicos y recursos web/Android. Se combinaron revisión de código, casos automatizados con datos aislados, recorridos de interfaz y pruebas en emuladores. No es una certificación exhaustiva de todos los dispositivos, servicios externos ni de contenido editorial palabra por palabra.

## Hallazgos corregidos

| Problema encontrado | Corrección y evidencia |
|---|---|
| La sesión abierta podía devolver sus notas al consultar otra fecha y recibir cambios dirigidos a otra lectura. | Lectura y guardado de notas comprueban `readingId`. Caso automatizado con dos fechas distintas. |
| Archivar/completar desde controles asociados a otra fecha podía afectar la sesión activa. | Las acciones comprueban la fecha del control antes de modificarla. |
| El cuadernillo podía seleccionar una sesión archivada al no encontrar un borrador. | Solo reutiliza sesiones activas; conserva la archivada. |
| Si faltaba el indicador de migración, las notas antiguas ya representadas podían crear otra sesión. | La migración omite las fechas presentes en el índice. No se borran las notas ni sesiones existentes. |
| Mi camino podía seguir mostrando el contenido anterior después de editar en el cuadernillo. | Se vuelve a renderizar al cerrar el editor. |
| Abrir Biblioteca desde Mi camino dejaba la barra sin una sección activa. | Biblioteca y sus detalles pertenecen a Mi camino para la navegación. Verificado `aria-current=page`. |
| La cabecera del pasaje indicaba el último capítulo marcado, no el que se estaba mostrando. | Ahora usa el capítulo del pasaje visible. Se aclara que los indicadores representan capítulos con lecturas registradas, no meditaciones completas. |
| Al salir de una lectura histórica podía continuar su audio. | La limpieza de audio contempla tanto Inicio como rutas de lectura. Prueba de transición a Ajustes. |
| Faltaban las 30 preguntas de septiembre en el agregado usado como respaldo. | Se copiaron exactamente desde el archivo mensual existente; sin reescritura editorial. Índice, archivo mensual y respaldo coinciden. |
| Dos dependencias de arranque no estaban en precaché: DeepLinkService y bibleIcons. | Se incluyen y los 34 módulos transitivos de app.js son obligatorios antes de activar una nueva instalación del service worker. |
| En pasajes antiguos sin TLA podía aparecer TLA seleccionada con texto de RVR60. | Se deshabilita la opción no disponible y se identifica la versión mostrada. La preferencia se conserva para otros pasajes. Al elegir NTV desaparece el aviso anterior. Verificado en interfaz. |
| Plurales incorrectos en Biblioteca. | Corrección de «meditaciones» y del anuncio de un único resultado. |

## Matriz de comprobación

| Área | Verificación | Resultado |
|---|---|---|
| Catálogo completo | 269 fechas, 9 archivos mensuales, 732 textos disponibles, referencias, duplicados, agregado y copias Android | Aprobada |
| Tres versiones | 269 RVR60, 269 NTV, 194 TLA; selección y disponibilidad honesta en las otras 75 lecturas | Aprobada sobre el catálogo actual |
| Octubre–diciembre | 92 lecturas, 276 textos, preguntas y vínculos; prueba de lanzamiento existente | Aprobada |
| Mi camino | 17 casos del servicio y 2 flujos: rachas, días locales, sesiones, revisiones, respaldo, privacidad | Aprobada |
| Nuevas conexiones | Notas entre fechas, archivo, migración, editor, navegación de Biblioteca, capítulo mostrado, audio y selector | Aprobada con `test:connections` |
| Navegación inferior | Animación, clic rápido/repetido, inversión, resize y movimiento reducido | Aprobada |
| Biblia | Proveedor, versiones, continuidad y fallback, fases 3/6/7 | Aprobada con fixtures; no certifica disponibilidad remota de producción |
| Enlaces públicos | hoy, lectura, compartir, fechas inválidas y orígenes rechazados | Aprobada |
| Comunidad | Identidad, oración, migración, contadores, descubrimiento, modelo editorial, integración e intenciones | Aprobada |
| Seguridad de Comunidad | Reglas de Firestore y Oración R1–R16 en proyecto demo local | Aprobada |
| Concurrencia | Identidad y respuestas simultáneas; backfill de 521 posts de prueba e idempotencia | Aprobada en emulador, sin modificar producción |
| Interfaz web | Recuerdo → detalle → favorito → biblioteca → archivo → filtro archivados → restauración → Mi camino | Aprobada con contenido ficticio |
| Lectura y constancia | TLA en pasaje disponible → marcar lectura → Mi camino muestra un día registrado | Aprobada |
| Biblia → lectura del día | Abre 1 Samuel 15:1–16 con cabecera de capítulo 15 | Aprobada |
| Lectura antigua sin TLA | Aviso de RVR60, TLA deshabilitada; cambio a NTV conserva el pasaje y retira el aviso | Aprobada |
| Errores web | Consulta de errores capturados durante los recorridos | Sin errores registrados |
| Android | Compilación release, instalación conservando datos, navegación de las cinco secciones, gestos/tres botones y teclado | Ver informe de instrumentación adjunto |
| Empaquetado | index, SW, CSS, app, JourneyView, JourneyService y catálogo agregado idénticos entre fuente, www y APK | Aprobada |

## Evidencias reproducibles

En `qa-auditoria-2026-09-24/`: resultados de catálogo, conexiones y Mi camino; hash SHA-256 del paquete; resultado Android. Las pruebas de integración agregadas se ejecutan con:

```sh
npm run test:connections
npm run test:catalog
npm run test:journey
npm run test:bottom-nav
npm run check:readings-q4-release
node scripts/validate-deep-links.mjs
node scripts/test-community-hotfix-203.mjs
npm run test:community-rules
```

Los scripts existentes de `functions/package.json` cubren identidad, oración, descubrimiento, contadores, modelo editorial, intenciones y concurrencia. Se ejecutaron en esta auditoría. Las pruebas de reglas/concurrencia utilizan únicamente proyectos demo con emulador local.

## Límites y pendientes explícitos

- `npm run test:tla`, que coteja la importación histórica de julio/agosto contra su original, no pudo ejecutarse: falta `~/Downloads/readings_tla_jul_aug_2026.json`. No se fabricó una fuente sustituta. Sí pasó la consistencia del catálogo actual y la prueba de disponibilidad real del selector.
- No se ha probado cada dispositivo físico, Safari de iPhone, lector de pantalla, teclado de fabricante ni entrega real de notificaciones push. Las verificaciones de Safari escritorio de Mi camino y de presentación móvil anteriores siguen documentadas en su informe; esta auditoría añadió recorridos en el navegador integrado y Android emulado.
- No se realizaron publicaciones, envíos sociales, donaciones, cambios de cuenta ni pruebas destructivas sobre datos personales o sobre Firestore de producción.
- Los 34 módulos quedaron cubiertos por el contrato de precaché; no se simula en esta ejecución un corte real de red durante instalación/actualización. No equivale a certificar todos los servicios offline.
- Los respaldos se verificaron con datos aislados y fallos de escritura simulados; sigue pendiente la experiencia de descarga/importación en teléfonos físicos.
- El APK final es de prueba, conserva versionCode 38 / 1.5.6 y sustituye el APK local anterior. El registro de hash de PWA 239 es histórico. Para distribuir, preparar un nuevo AAB con incremento de versionCode y pruebas del canal de Play.
- No se hicieron commit, push ni despliegue durante esta auditoría.
