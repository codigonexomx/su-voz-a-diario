# De Estadísticas a Mi camino

Investigación y propuesta · 24 de septiembre de 2026 · Código revisado: bae24ba. Estado: propuesta, sin cambios funcionales.

## Decisión recomendada

Conservar el apartado, cambiar su función y llamarlo **Mi camino** en la navegación. Su propósito: ayudar a recordar la Palabra meditada, retomar el proceso personal y revisar cómo llevarla a la vida. Las cifras describen actividad registrada; no califican la fe, la obediencia, la oración ni la madurez espiritual.

La pantalla debe responder: ¿dónde continúo?, ¿qué he aprendido?, ¿qué quiero poner en práctica?, ¿qué puedo compartir para edificar? La racha acompaña ese propósito y permanece visible, pero no ocupa toda la experiencia.

## Alcance y evidencia

Se revisaron la pantalla local real, renderizado, cálculos de progreso, guardado y migración de notas, sesiones de Profundiza, exportación/importación y código de métricas de Comunidad. Se ejecutaron cinco comprobaciones con datos sintéticos sobre las funciones puras. No se modificaron datos de usuarios, no se marcaron lecturas reales y no se probó esta propuesta en un Android instalado. La pantalla local vacía no demuestra que los datos del teléfono se hayan perdido. No se inspeccionaron notas privadas ni respaldos personales.

## Qué hace hoy

- Navegación: «Estadísticas»; encabezado interior: «Tu camino».
- Destaca racha actual, porcentaje del mes y lecturas completadas.
- Repite reflexión, oración y avance en varias tarjetas.
- Calendario del mes actual con señales y enlaces a lectura, respuesta y memoria; no ofrece navegación histórica propia.
- Recorrido por libros del plan, mejor racha y porcentajes.
- Hasta tres recuerdos por tipo: notas, resaltados y reflexiones.
- No registra por este mecanismo cuánto tiempo real se meditó, ni confirma que un paso de aplicación se haya vivido.
- La lectura cuenta cuando se pulsa «Marcar como leído». Leer, escuchar o completar una meditación no equivalen automáticamente a esa marca.

## Hallazgos técnicos

| Hallazgo | Evidencia | Consecuencia |
|---|---|---|
| Existen cálculos distintos de racha | app.js:1882–1947; utils/progress.js:74 y 202; functions/index.js:1377 | Cabecera, Estadísticas y actividad comunitaria pueden discrepar. El contador comunitario no se consume desde getStats. |
| Fecha del pasaje y fecha de actividad se confunden | markAsRead, app.js:2581, almacena dateStr en readDates; updateStreak compara con ayer real | Leer hoy una lectura atrasada altera un historial que parece representar días de práctica. |
| Error reproducible al marcar atrasadas | Con última fecha 23/09 y racha 2, marcar 20/09 usando ayer=23/09 devuelve racha 3 y última fecha 20/09 | La cabecera puede aumentar o reiniciar incorrectamente según el orden de las marcas. |
| La racha de Estadísticas aún existe | renderStats, app.js:17304; calculateCurrentPlanStreak | Si ayer está marcado, conserva la racha aunque hoy siga pendiente. No se eliminó la función. |
| «Este mes» contiene cifras históricas | getStats recorre todas las notas válidas; renderStats reutiliza reflectionDays/prayerDays sin filtro mensual | Se comparan períodos distintos en una misma sección. |
| Profundiza y Estadísticas tienen fuentes diferentes | getStats lee su-voz-note-*; MeditationSessionStorage guarda su-voz-meditation-* e índice | Estadísticas no aprovecha múltiples sesiones, favoritos, completedAt o estados. |
| Hay escritura doble de texto | saveNote, app.js:6904, guarda nota antigua y sesión actual | No es correcto afirmar que toda meditación nueva se pierde. La copia por fecha no representa todas las sesiones ni sus estados. |
| Completar meditación no marca lectura | handler complete-session, app.js:21000 | Se puede terminar Profundiza sin aumentar racha de lectura. Son acciones distintas y la interfaz debe explicarlo. |
| Respaldo general incompleto para sesiones | exportData, app.js:17602, incluye notes/highlights/selectionNotes/readDates/streak, pero no sesiones e índice | Puede conservar texto legacy sin conservar toda la biblioteca, referencias, favoritos y estados. Debe resolverse antes de una migración. |
| Datos fuera del índice dejan de contarse | calculateReadingStats filtra por planDates; getCalendarReadings depende del índice cargado | Un cambio de catálogo puede ocultar progreso sin borrar claves. No demuestra que esa sea la causa en el teléfono de Ricardo. |
| Denominadores incluyen contenido futuro | total del plan y mes completo | Añadir octubre–diciembre baja el porcentaje global aunque no se pierdan lecturas. |
| Las marcas futuras cuentan si existen | prueba sintética de calculateReadingStats | Una importación o marca futura requiere tratamiento explícito; no debe aumentar constancia de días vividos. |
| Detalle diario depende de sesión global | getStatsDayDetails llama getNote; getNote prioriza currentMeditationSessionId | Riesgo de mostrar respuesta de otra fecha si esa sesión sigue activa. Requiere prueba de navegación antes de declararlo fallo visible. |
| Libro «actual» puede ser el primer pendiente | renderStatsPlan y renderStatsBookProgress | En la pantalla vacía de septiembre propone Deuteronomio de abril; puede empujar a recuperar meses en lugar de comenzar hoy. |
| Los recuerdos se ordenan por fecha del plan | getStats, moments.sort | Una meditación antigua editada hoy no necesariamente aparece como reciente. |

Las claves locales son distintas de los datos de Comunidad en Firestore. Safari, Chrome y la aplicación instalada pueden tener almacenes distintos. El código revisado no prueba sincronización entre ellos para readDates y notas. No prometer recuperación ni sincronía sin respaldo y pruebas específicas.

## Qué aporta la investigación

**YouVersion** distingue racha por abrir la aplicación de racha por completar su recorrido diario; la documentación indica que la web no cuenta en esas rachas. Es una referencia útil sobre la importancia de definir lo que se mide, no una regla que debamos copiar. Para Su Voz propongo igual semántica en web y Android, aunque compartir historial entre dispositivos requiere un proyecto adicional de sincronización.
Fuente: https://help.youversion.com/l/en/article/ni583tllli-streak-ios

**Formación de hábitos:** Lally y colaboradores estudiaron conductas de alimentación, bebida y actividad en 96 participantes durante 12 semanas. Encontraron variación considerable y que omitir una ocasión no alteró materialmente el proceso. No estudiaron meditación bíblica; aplicar esta evidencia aquí es una inferencia de diseño: favorecer la repetición y el regreso, sin presentar una interrupción como pérdida de todo el camino.
Fuente: https://doi.org/10.1002/ejsp.674

**Motivación:** la teoría de autodeterminación destaca autonomía, competencia y vinculación. Como criterio de producto, propongo metas voluntarias, progreso comprensible y comunidad que edifica. No concluyo que cualquier insignia sea dañina; sí evitaría que publicar mucho o recibir reacciones equivalga a valor espiritual.
Fuente: https://selfdeterminationtheory.org/about-the-theory/

## Pantalla propuesta, en orden

| Bloque | Qué muestra | Para qué sirve | Acción |
|---|---|---|---|
| Continúa tu camino | Última meditación personal en curso; si no existe, lectura de hoy | Dar un siguiente paso inmediato | Continuar meditación / Meditar hoy |
| Tu ritmo | Días de práctica registrados en los últimos 7; racha actual y mejor racha en segundo plano | Reconocer constancia sin exigir perfección | Ver historial y definición del contador |
| Lo que quiero vivir | Un paso personal guardado desde Aplicación | Volver a una decisión nacida de la Palabra | Revisar / Escribir cómo me fue / Seguir meditando |
| Palabra para recordar | Una meditación favorita o reciente, con fecha y pasaje | Recuperar aprendizaje propio | Abrir la sesión exacta |
| Tu recorrido | Calendario navegable y lecturas del plan completadas | Encontrar historia sin repetir todo Calendario | Elegir mes y día; abrir actividad |
| Para edificar | Invitación discreta desde una reflexión elegida | Compartir voluntariamente lo aprendido | Preparar borrador para Comunidad |

No añadir seis paneles enormes: primera vista con una acción principal, tira semanal y una tarjeta de memoria/aplicación. Historial y detalle del plan progresivos. Tipografía, crema/azul profundo y oro de la aplicación; espacios amplios; sin trofeos gigantes ni confeti protagonista. Mantener la barra de navegación existente, cambiando solo etiqueta si se aprueba.

Ejemplo ilustrativo, no datos reales: «Esta semana registraste 4 días con la Palabra. Continúa tu meditación de 1 Samuel. Tu paso: responder con paciencia antes de decidir. ¿Cómo lo viviste?». La aplicación muestra lo que la persona escribió; no lo inventa ni lo interpreta automáticamente.

## Definición de métricas propuesta

1. **Lecturas completadas:** pasajes únicos que la persona marca como leídos/escuchados. Mide avance de contenido; no días consecutivos de actividad.
2. **Día de práctica registrado:** día local en que la persona confirma haber leído/escuchado o termina explícitamente una meditación. Una sola vez por día, aunque complete varias lecturas. Abrir la app, tiempo de pantalla, reacciones y mero autosalvado no cuentan.
3. **Racha:** días consecutivos de práctica registrada. Hoy pendiente conserva el tramo de ayer hasta terminar el día. Tras una interrupción el contador reinicia, pero la historia, los recuerdos y el total acumulado permanecen. Sin comprar ni inventar días. Permitir ocultar la racha.
4. **Meditaciones:** sesiones guardadas/concluidas, separadas por estado; no confundir una sesión con un día. Confirmación personal, no umbral de cinco palabras como medida de profundidad. Conservar inicialmente la regla existente del cuadernillo hasta revisar ese flujo.
5. **Aplicación:** intenciones y revisiones declaradas por la persona. No «porcentaje de obediencia». «Lo revisé» no significa «lo cumplí».
6. **Oración:** «Oraciones escritas guardadas». Ausencia de texto no equivale a ausencia de oración.
7. **Comunidad:** publicaciones propias confirmadas, si se integra más adelante. No premios por cantidad ni rachas obligatorias de publicación. Sin red mostrar estado desconocido/pendiente, no cero inventado.

Filtros explícitos: últimos 7 días, mes seleccionado, todo el historial. Cada tarjeta indica período y unidad. No duplicar un porcentaje mensual en tres lugares. Todo dato personal con alcance «en este dispositivo» mientras no exista sincronización real.

## Modelo y conservación de datos

- Separar readingDate (fecha asignada del pasaje), occurredAt (momento de acción), localDate y zona/offset de captura. Guardar identificador estable, tipo y origen del evento; deduplicar acciones repetidas/importadas.
- Mantener sesiones como fuente de contenido y eventos como fuente temporal. Servicio puro compartido para derivar métricas; no tres contadores independientes.
- Los cambios de zona no deben reinterpretar retrospectivamente días ya registrados. Definir pruebas de medianoche, viaje y reloj alterado. Sin telemetría invasiva.
- Leer datos antiguos sin borrarlos. Copia de seguridad versionada, migración idempotente y rollback. Reconciliar sesiones con su copia legacy mediante procedencia; no fusionar sesiones distintas solo porque tengan mismo texto.
- Historial antiguo: readDates prueba qué lectura se marcó, no cuándo se leyó. Presentarlo como recorrido heredado, no fabricar fechas de actividad. completedAt puede aportar fecha cuando sea fiable; updatedAt solo prueba edición, no práctica terminada; createdAt de una migración no prueba actividad antigua.
- Conservar racha antigua como dato histórico identificado mientras se reconcilia; no sumarla a la nueva sin evidencia. Si faltan datos, explicar la limitación.
- Exportación/importación completa: sesiones, índice reconstruible, referencias, favoritos, archivo, pasos personales, actividad y ajustes. Verificar restauración en almacenamiento aislado, no en datos reales.
- No enviar textos de oración, reflexiones o aplicación a analítica. Compartir abre borrador y exige la acción voluntaria habitual de publicar.

## Plan de ejecución y puertas de salida

**Fase 1 — Fiabilidad.** Crear inventario de claves y respaldo completo; pruebas sintéticas de legacy/sesiones; separar períodos; resolver cálculo de racha, fecha de actividad y selección de sesión; definir migración sin pérdida. Entrega: diagnóstico y respaldo/restauración verificables antes de nuevo diseño.

**Fase 2 — Primera versión de Mi camino.** Continuar meditación, ritmo semanal con racha secundaria, memoria ligada a sesión exacta y acceso al historial. Unificar origen de los contadores y aclarar datos locales. Sin cambios en textos bíblicos ni nueva infraestructura de nube. Entrega: web y Android con mismas reglas y sin corrupción de datos existentes.

**Fase 3 — Vivir y compartir.** Paso de aplicación opcional, revisión semanal breve y compartir extracto elegido mediante borrador existente. No asumir que notas privadas están destinadas a Comunidad. No duplicar la biblioteca ya existente.

**Fase 4 — Piloto y ajuste.** Probar con 5–8 personas: nuevas, constantes, quien retoma y quien escucha sin escribir. Tareas: entender el contador, encontrar una meditación, revisar un paso y retomar tras pausa. Durante dos semanas observar si esos recorridos sirven; no lanzar AAB hasta cerrar defectos y revisar visualmente con Ricardo.

## Pruebas de aceptación

- Hoy/ayer, dos días de pausa, cambio de mes/año, año bisiesto, medianoche y zonas horarias.
- Misma lectura marcada dos veces; varias lecturas antiguas en un día; fecha futura inválida; reapertura sin acción; escuchar sin escribir.
- Meditación completada sin marca de lectura; varios borradores/múltiples sesiones por fecha; sesiones archivadas y restauradas; legado y copia nueva sin duplicados.
- Septiembre no cuenta respuestas de agosto. Añadir un mes al catálogo no reduce días acumulados ni cambia racha.
- Índice no cargado/offline produce estado claro, no cero definitivo ni borrado. Datos fuera del plan siguen en memoria personal.
- Importar dos veces no duplica, exportar/restaurar conserva sesiones y referencias, respaldo viejo sigue compatible.
- Tras salir de Profundiza, cada día del calendario abre su propia sesión, no la sesión global anterior.
- Safari escritorio/iPhone, Chrome y Android WebView; modo claro/oscuro, letra grande, teclado, gestos/tres botones y lector de pantalla. No depender exclusivamente del color para indicar actividad.
- Primera visita: invitación útil, no una pared de ceros; pausa: conserva memoria y ofrece retomar; historial largo: sin bloqueos por recorrer localStorage repetidamente.

## Cómo sabremos si vale la pena

Criterio principal: la persona puede recuperar algo que meditó y usarlo para continuar. En piloto, comprobar que al menos 4 de 5 encuentran una meditación y entienden qué cuenta la racha sin explicación del facilitador; es un objetivo propuesto, no un resultado obtenido. Después comparar uso de Continuar, apertura de recuerdos y revisiones voluntarias frente al punto de partida. Retorno a 7/28 días solo con medición consentida disponible; sin atribuir crecimiento espiritual a esas cifras. Si un bloque no ayuda a una acción útil, simplificarlo o retirarlo.

## Pendiente para precisar la pérdida reportada

Comparar el teléfono afectado, navegador/origen utilizado, versión previa, readDates, racha almacenada y respaldo disponible, con autorización y sin exponer textos privados. El análisis actual identifica defectos y límites reales, pero no certifica qué datos concretos perdió ese dispositivo. No recuperar números por estimación.
