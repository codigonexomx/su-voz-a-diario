# Vínculos RVR1960 y cotejo de lecturas

Auditoría del 17 de noviembre de 2026. Este documento registra el comportamiento anterior, la conexión RVR1960 implementada y el cotejo del contenido diario. El estado al cerrar este registro es implementación local, con publicación de la actualización pendiente. El cotejo textual y las comprobaciones visuales citadas se ejecutaron sobre los archivos y la vista locales.

## Mapa de conexiones

| Entrada | Antes de la unificación | Comportamiento implementado |
|---|---|---|
| Primer acceso a Biblia y versión guardada inválida | RV1909 por defecto. | RVR1960 local; una elección válida del lector sigue siendo explícita. |
| Su Voz Hoy, lectura histórica y Calendario → «Ver en Biblia» | Heredaba la última versión de Biblia, incluso NBLA. | Abre el capítulo completo en RVR1960, con edición identificada y regreso a la misma fecha, posición y foco. |
| Comunidad → referencia bíblica | Heredaba la versión de Biblia. | Acceso explícito al pasaje RVR1960. |
| Aprender | Solicitaba NBLA remota. | Los 80 pasajes y 475 versículos solicitan RVR1960 del corpus local; se valida identidad, rango y edición de la respuesta. |
| Nueva meditación diaria | La metadata tomaba la versión de Biblia, aunque el texto diario podía ser de otra edición. | Registra la edición realmente presentada en la lectura; sus referencias nuevas usan RVR1960. NTV/TLA diarias no se solicitan como Biblias completas, pues no hay proveedores completos para ellas. |
| Búsqueda con fuente local alternativa y recuperación tras error remoto | Alternativa RV1909. | Alternativa RVR1960 con etiqueta y destino concordantes; la búsqueda de una edición local elegida explícitamente conserva esa edición. |
| Referencias cruzadas, notas y ubicación guardada | Ya transportaban una edición explícita. | Conservan esa edición, el pasaje y la navegación de regreso. |

Los enlaces `/hoy`, `/lectura?date=AAAA-MM-DD` y `/compartir` dirigen a las pantallas diarias, sin transportar una versión bíblica. Las lecturas mensuales, su respaldo y el cuaderno usan `versions.rvr60` cuando corresponde: el texto diario no se obtiene automáticamente del proveedor de capítulos completos.

La edición de una meditación nueva se obtiene con `getDailyReadingVersionId`, que sigue el mismo resultado de `getDailyReadingText`. Ejemplo comprobado: las 24 lecturas del 7 al 30 de abril no tienen TLA. Si la preferencia guardada es TLA, se presenta el texto RVR1960 disponible y la nueva meditación registra RVR1960. Esta alternativa no rellena ni modifica los textos TLA ausentes. Cuando la edición solicitada sí existe, su metadata conserva esa edición; las referencias nuevas del cuaderno usan RVR1960.

Las meditaciones existentes conservan su edición y contenido guardados. Una clave histórica como `bible-jhn-3` sigue identificando RV1909; no debe reinterpretarse como RVR1960. Las claves `bible-rvr60-jhn-3` y `bible-rvr60-strong-jhn-3` mantienen sus anotaciones separadas. Los resultados de búsqueda y las referencias cruzadas abren la edición que mostraron al usuario.

## Cotejo del texto diario

Se revisaron las 269 fechas del catálogo, desde el 7 de abril hasta el 31 de diciembre de 2026: 3,603 apariciones de versículos. Se cotejaron tanto los nueve archivos mensuales referidos por el índice como `data/readings.json`, y también la copia alternativa `data/readings/2026-07.json`. Mensuales y respaldo coinciden semánticamente; el orden de propiedades JSON difiere en dos registros sin cambiar su contenido.

Se eliminaron únicamente etiquetas HTML y espacios de presentación para la comparación inicial. Se comprobaron números de versículo y rangos entre capítulos. Las categorías siguientes describen diferencias mecánicas; no reinterpretan el texto.

| Resultado | Antes | Después de las correcciones puntuales |
|---|---:|---:|
| Coincidencia tras retirar HTML y normalizar espacios/Unicode | 3,427 | 3,429 |
| Sólo puntuación | 2 | 2 |
| Mayúsculas, admitiendo puntuación | 70 | 70 |
| Tildes, admitiendo mayúsculas y puntuación | 94 | 94 |
| «Aleluya.» en el versículo diario y en el encabezado del corpus | 8 | 8 |
| Diferencias de palabras | 2 | 0 |
| Referencias con extremo fuera del capítulo | 1 | 0 |

Se corrigieron tres discrepancias:

- 6 de julio, Salmos 104:4: `llamas` → `flamas`, en el respaldo y ambas copias de julio.
- 15 de septiembre, 1 Samuel 10:14: `parecían` → `aparecían`, en septiembre y el respaldo.
- 18 de junio: referencia `II Timoteo 3:10-18` → `II Timoteo 3:10-17`, en junio, respaldo e índice. El texto ya contenía exactamente los versículos 10–17; el índice conserva `bookId: 2ti`.

Los dos originales fijados en `data/rvr1960-source.json` —mrk214 y thiagobodruk— corroboran las dos palabras y el final de 2 Timoteo 3 en el versículo 17. Sus hashes coinciden con el manifiesto. El módulo Strong de 2019 también confirma `flamas` y el límite 17, pero contiene la variante `parecían`: se documentó y no se modificaron ese módulo ni sus mapas. El texto mostrado sigue el corpus RVR1960 elegido y sus dos fuentes concordantes.

Las correcciones afectan seis archivos y ocho campos. No cambiaron NTV, TLA, notas editoriales, acentuación, mayúsculas, encabezados ni configuración de introducciones. El cotejo completo posterior encontró 0 diferencias de palabras y 0 extremos de referencia inválidos; conserva las 174 diferencias de presentación u ortografía documentadas. `validate-reading-catalog.mjs` y `git diff --check` sobre los datos afectados aprobaron.

## Casos de navegación de regresión

- Hoy, 17/11/2026: Oseas 14:1–9, con NBLA seleccionada previamente → capítulo completo RVR1960 → misma lectura y posición.
- Calendario, 24/10/2026: 2 Pedro 1:1–11 → Biblia → retorno histórico.
- Enlace `/lectura?date=2026-09-09`: 1 Samuel 5:1–12 → Biblia RVR1960.
- Nueva meditación RVR1960, NTV o TLA: metadata fiel al texto presentado y referencias nuevas RVR1960; sesión histórica conservada.
- Génesis 1:3 → 2 Corintios 4:6: una sola cita, edición preservada y retorno al origen.
- Nota RV1909 antigua, nota RVR1960 y nota Strong: cada una abre su edición; cambiar el valor predeterminado no mueve ni mezcla anotaciones.

Verificación visual local de la PWA 279 del 17 de noviembre: con NBLA previamente seleccionada, Su Voz Hoy abrió Oseas 14 completo en RVR1960 y regresó a la misma fecha con el foco restaurado. Aprender, lección 1, mostró el texto RVR1960 de 1 Juan 1:3 y Josué 1:8. Estos resultados corresponden a la vista local examinada.

Registros detallados: [cotejo anterior](../../artifacts/validation/rvr1960-daily-text-audit-2026-11-17.json) y [correcciones, fuentes y verificación posterior](../../artifacts/validation/rvr1960-daily-text-corrections-2026-11-17.json). Incluyen hashes, textos distintos, clasificación, campos modificados y resultados de las comprobaciones.
