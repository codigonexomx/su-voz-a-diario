# Calendario de lecturas: auditoría y renovación

Fecha: 21 de octubre de 2026.
Base: `c7dab9f0a9a8859fac8bd4f9c0f80069d29c513f`, `main` sincronizada antes del cambio.
Estado inicial: implementación y QA local terminadas. La publicación conjunta con Comunidad se documenta en `release-android-1.5.18-50.md`; las comprobaciones siguientes describen la fase local anterior.
Vista local en la Mac: <http://127.0.0.1:8776/?analytics_test=1#calendar>.

## Criterio de producto

El calendario debe permitir encontrar el pasaje de una fecha, regresar a hoy y reconocer la actividad real del lector. No es un calendario de citas: no se añadieron eventos, permisos de agenda, notificaciones nuevas, contenido generado ni requisitos de cuenta.

Se adoptaron navegación de fechas por teclado, foco visible, nombres completos de días para tecnologías de asistencia y controles HTML nativos, a partir del patrón de [WAI-ARIA APG para fechas](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/). El ejemplo se tomó como orientación, no como una certificación de accesibilidad.

Se revisaron los tamaños táctiles con referencia a [WCAG 2.2, Target Size Minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html). En Chrome, las celdas midieron aproximadamente 36 x 46 px a 320 px de viewport, 46 x 46 a 390 px, 52 x 64 a 768 px y 82 x 64 en escritorio. Esto no sustituye una prueba con VoiceOver/TalkBack en dispositivos reales.

## Problemas corregidos

- El filtro Pendientes incluía fechas futuras. Ahora Por leer y Próximas son estados distintos.
- Una fecha sin pasaje ofrecía un acceso a una lectura inexistente. Ahora muestra el estado real y un regreso a hoy.
- Las meditaciones modernas guardadas como sesiones no aparecían de forma fiable en el calendario. Se consultan junto con las notas anteriores, sin migrarlas ni reescribirlas.
- Las iniciales de los días eran ambiguas y faltaba navegación por teclado. Ahora hay nombres accesibles y un único día en la secuencia Tab.
- Entrar al calendario podía heredar el desplazamiento de otra pantalla. La primera entrada comienza arriba; regresar conserva la posición y fecha elegidas.
- Los filtros y la selección perdían el foco al volver a dibujar la vista. Ahora el foco vuelve al control correspondiente.
- En móvil el detalle del día quedaba fuera de vista y podía competir con la barra inferior. Al activar una fecha se revela el detalle completo; no se muestran semanas totalmente vacías.
- Se evitan solicitudes duplicadas de Meditación, respuestas de fechas obsoletas y mensajes de error de solicitudes abandonadas.

## Experiencia implementada

- Vistas Mes y Lista, selector directo de mes/año, flechas de mes y acceso a Hoy.
- Filtros Todas, Por leer, Leídas, Próximas, Meditaciones y Resaltados, con sus recuentos reales.
- Seleccionar una fecha coincidente conserva el filtro. Activar una fecha atenuada permite salir del filtro.
- Detalle con referencia, estado, Leer pasaje y Meditación; las fechas futuras no abren un editor de meditación.
- Acceso a una sesión guardada concreta; las notas anteriores continúan mediante el flujo existente.
- Progreso calculado solo sobre lecturas programadas hasta la fecha local actual, sin penalizar lecturas futuras.
- Estados vacíos sin duplicaciones, mensaje de historial no disponible ante fallos de almacenamiento y ausencia de extractos privados en el calendario.
- Diseño propio de herramienta de lectura: superficies sin tarjetas anidadas, iconos Lucide locales, controles coherentes, tema claro/oscuro y adaptación móvil/tablet/escritorio.
- Flechas, Inicio/Fin y Page Up/Down recorren días, semanas y meses; Shift + Page Up/Down cambia de año. Enter activa el detalle del día.

## Alcance técnico

`CalendarModel.js` calcula fechas, actividad y filtros; `CalendarView.js` genera HTML escapado; `CalendarController.js` integra la navegación y sus guardas. `app.js` delega solo los eventos del calendario. Los estilos están limitados a `.calendar-planner`.

No se cambiaron las claves ni formatos de notas, sesiones, lecturas o respaldos. No se añadieron dependencias, trackers, permisos, reglas ni funciones Firebase. Se conservaron los controles del lector bíblico y de Meditación existentes.

El candidato web local usa PWA 265. La sincronización de versión actualiza también las referencias de caché de la landing existente, sin cambiar su comportamiento. Los tres módulos y el CSS nuevos son recursos obligatorios de la instalación offline. `www` está sincronizado como copia de los archivos públicos; esto no construye un nuevo paquete Android.

## Comprobaciones realizadas

- `node scripts/validate-calendar.mjs`: fechas canónicas, bisiestos y límites de año; meses de 28 a 31 días; zonas horarias y cambio de horario; filtros, progreso y estados vacíos; HTML escapado; notas anteriores y sesiones; fallos de almacenamiento sin escrituras; navegación exacta, foco, desplazamiento y carreras asíncronas.
- `npm test`: 47/47 comprobaciones aprobadas.
- Suite completa con emuladores Auth/Firestore/Storage: 57/57, repetida después de los ajustes finales. Solo proyectos `demo-*`, sin despliegue ni datos productivos. Informe: `artifacts/validation/tests.json`.
- Navegación real en Chrome de la Mac: Mes/Lista, pendientes sin futuro, próximas, filtro vacío sin duplicación, enero de 2027 sin accesos inexistentes, Hoy, teclado entre meses/años y apertura de la lectura correcta.
- Se abrió y cerró una meditación vacía del 5 de octubre en el origen local de QA, sin escribir texto, enviar ni publicar contenido. El borrador vacío no se contabilizó como meditación escrita.
- Regreso desde la lectura al calendario conservando el día seleccionado. Selección de fechas con detalle y botones fuera de la barra de navegación.
- Inspección visual a 320, 390 y 768 px y en el viewport normal de escritorio; temas claro y oscuro; sin desbordamiento horizontal de controles y sin errores JavaScript capturados en la pestaña de QA.
- Evidencias: `artifacts/validation/calendar-mobile-2026-10-21.png` y `artifacts/validation/calendar-desktop-2026-10-21.png`.
- `git diff --check` sin errores. Directorio ajeno `marketing/` sin incluir ni modificar.

## Límites y siguiente publicación

No se probó todavía este calendario en el iPhone físico ni dentro de un nuevo binario nativo de la Lenovo. La revisión responsive en Chrome y las pruebas automatizadas no se presentan como una validación física de esos dispositivos. La cobertura offline nueva es de integración/caché; falta repetir su uso físico después de publicar el candidato correspondiente.

El catálogo actual termina el 31 de diciembre de 2026. Enero de 2027 se presenta honestamente vacío: preparar lecturas aprobadas para 2027 es trabajo editorial separado, no una falla que deba ocultarse o rellenarse automáticamente.

No se modificaron la versión Android ni el AAB 1.5.17 (49). Su SHA-256 se volvió a comprobar: `60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4`. No se consultó ni modificó el estado de revisión de Google Play en esta fase.

Tras la revisión local del propietario, el recorrido de publicación será commit/push web, validación del calendario en iPhone y un candidato Android nuevo para pruebas internas en la Lenovo antes de promoverlo. La versión web productiva y el paquete 49 no recibieron estos cambios locales.
