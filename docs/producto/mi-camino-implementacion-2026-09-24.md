# Mi camino — implementación y verificación

Fecha: 24 de septiembre de 2026. PWA: 239. Implementación local, sin publicación ni cambios en los textos bíblicos. Investigación y decisiones: `mi-camino-investigacion-2026-09-24.md`.

## Resultado

Estadísticas ahora se llama **Mi camino**. Su propósito es retomar la meditación, recordar lo aprendido, revisar su aplicación personal y preparar una enseñanza para edificar a otros.

- Última meditación en proceso, acceso a la lectura de hoy y confirmación explícita de meditación completada.
- Ritmo de los últimos siete días; racha opcional y explicación de su cálculo. La racha anterior permanece identificada como historial heredado.
- Selección de un paso de Aplicación y revisión personal privada. Los borradores de revisión se mantienen durante la navegación de la sesión; hay botón explícito para guardarlos de forma persistente.
- Revisión de los últimos siete días y consulta de revisiones semanales anteriores.
- Meditaciones favoritas y recientes, con acceso a la sesión exacta y a la biblioteca existente.
- Calendario por mes, detalle por fecha y separación entre fechas del pasaje y fechas de práctica.
- Extracto editable elegido por la persona → borrador de Comunidad. No se publican notas automáticamente. No se sobrescribe un borrador comunitario existente. Oraciones y revisiones privadas quedan fuera del texto propuesto.
- Respaldo completo de sesiones, referencias, estados, favoritos, actividad y revisiones; importación compatible con respaldos antiguos.

## Conservación y semántica

`JourneyService` lee las sesiones y sus copias antiguas sin migrarlas destructivamente. No duplica el espejo por fecha como una segunda meditación. Las sesiones archivadas se conservan y respaldan, pero no aparecen como meditaciones activas.

La práctica nueva se guarda en `su-voz-journey-v1`: fecha local de acción, instante y offset horario, tipo y pasaje. Varias acciones en un mismo día suman un solo día. Lecturas antiguas marcadas hoy cuentan hoy; fechas futuras no incrementan la racha. Abrir la aplicación, guardar borradores o publicar en Comunidad no cuenta como práctica. Completar una meditación no marca automáticamente el pasaje como leído.

No se inventan fechas de actividad antigua a partir de la fecha asignada del pasaje. `su-voz-streak` queda conservado como registro anterior. Los datos personales siguen siendo locales; no se implementó sincronización entre dispositivos.

La importación valida antes de escribir, crea una copia local anterior en `su-voz-journey-before-import`, une lecturas y eventos, conserva sesiones locales más recientes, reconstruye el índice y revierte los datos personales si falla la escritura. La transacción cubre el historial personal; perfil y preferencias conservan su flujo de importación existente. Un respaldo con JSON personal corrupto se puede exportar en bruto para diagnóstico, pero se rechaza su importación hasta repararlo.

## Verificación realizada

| Comprobación | Resultado |
|---|---|
| 17 casos del servicio y 2 flujos de integración | Correctos en America/Mexico_City y Europe/Madrid |
| Fechas, medianoche, cambio de horario, año bisiesto, duplicados y días futuros | Correctos |
| Múltiples sesiones, archivo, favoritos, legado, separación de meses | Correctos |
| Respaldo completo y antiguo, importación repetida, conflicto de antigüedad, fallo de escritura y datos inválidos | Correctos en almacenamiento aislado |
| Privacidad del extracto y protección del borrador comunitario | Correctas; no se publicó contenido de prueba |
| Safari de escritorio | Carga y finalización de meditación anterior: registra hoy, conserva el pasaje original |
| Navegador integrado, escritorio y 390 × 844 | Revisión guardada tras recargar, calendario agosto/septiembre, detalle correcto, reapertura de meditación, borrador comunitario, estados vacío/con historial |
| Apariencia clara y oscura | Revisada visualmente; sin desbordamiento horizontal en el tamaño móvil comprobado |
| Pruebas existentes de barra inferior y efecto líquido | Correctas: pulsación rápida, repetida, inversión, resize, movimiento reducido |
| Lecturas octubre–diciembre | 92 lecturas, 276 textos, preguntas y vínculos correctos |
| Analítica y continuidad de Biblia (fase 7) | Correctas |
| Android debug y release | Compilación local correcta |
| Actualización del emulador con firma release | Instalada con `-r`, sin borrar datos |
| Instrumentación Android | Cinco secciones, gestos/tres botones, borde estable, ausencia de desbordamiento, márgenes nativos y teclado: PASS |
| Copias web, www y APK | Los seis recursos modificados principales coinciden byte a byte |

La instalación debug fue rechazada por firma distinta a la app existente; se resolvió usando la firma release sin desinstalarla. Gradle muestra advertencias preexistentes de flatDir, metadatos SDK y APIs obsoletas, sin fallo de compilación.

## Evidencias y reproducción

- `qa-mi-camino/android-navigation.json`: resultado de la instrumentación del emulador.
- `qa-mi-camino/paquete-pruebas.json`: SHA-256 del APK, versiones y recursos comprobados.
- `qa-mi-camino/primera-visita-movil.png`: primera visita en viewport móvil, datos aislados.
- `npm run test:journey`
- `TZ=Europe/Madrid npm run test:journey`
- `npm run test:bottom-nav`
- `npm run check:readings-q4-release`
- `npm run android:sync`
- En android: `./gradlew :app:assembleRelease --offline`
- Instrumentación existente optativa: `./gradlew -PnavQa assembleReleaseAndroidTest --offline`; ejecutar solamente en emulador mediante `app.suvoz.test/app.suvoz.NavAuditInstrumentation`.

## Antes de distribución

El APK es de prueba; mantiene Android versionCode 38 / 1.5.6. No es un nuevo candidato publicable en Play: al preparar el próximo AAB habrá que incrementar versionCode y ejecutar su validación de lanzamiento. No se ha hecho commit, push, despliegue web ni publicación en Play en esta tarea.

Quedan para validación externa: Safari en iPhone físico, Android físico con teclado y tamaños de letra del usuario, actualización desde instalaciones personales y prueba del flujo de descarga/restauración en esos dispositivos. La prueba actual del emulador actualiza su instalación existente, no vuelve a certificar una actualización desde 3.36. Tampoco se simuló la pérdida completa de red ni se certificó un lector de pantalla físico. El piloto de 5–8 personas y dos semanas requiere usuarios reales; no se presenta como realizado.

La revisión del dispositivo donde se reportó pérdida de rachas sigue siendo necesaria para determinar si sus datos antiguos faltan, están en otro navegador/origen o solo dejaron de verse. Esta implementación no recupera datos borrados por estimación.
