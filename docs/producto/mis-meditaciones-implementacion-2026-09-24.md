# Mis meditaciones — implementación local PWA 243

Se implementaron las seis propuestas aprobadas: nombre consistente en menú y pantallas; entrada destacada en Mi camino; búsqueda de los cuatro apartados completos con filtros rápidos Todas/En curso/Favoritas y opciones avanzadas recogidas; acciones para volver al pasaje y revisar la aplicación; PDF separado del extracto editable hacia Comunidad; enlace desde el estado de guardado y comienzo guiado en la colección vacía.

La colección utiliza los mismos registros recuperables que Mi camino, incluyendo sesiones fuera del índice antiguo. Las notas antiguas sin sesión abren su lectura para continuar allí, sin crear registros virtuales persistentes ni duplicar fechas. Se conserva la ruta `meditations-history` y el almacenamiento existente. Las meditaciones archivadas deben restaurarse antes de revisar su aplicación. Si falta el pasaje del catálogo, se explica y se conserva la meditación.

La revisión personal recibe el foco sobre la aplicación seleccionada. Preparar un extracto utiliza Enseñanza o Cómo es Dios; no copia Oración ni revisiones privadas. El usuario puede editarlo y luego abrir un borrador en Comunidad, sin publicar automáticamente ni sobrescribir un borrador previo. Exportar PDF conserva el comportamiento anterior e indica que incluye los apartados escritos, incluida la oración.

Se agregaron eventos mínimos de visita, apertura, continuación y búsqueda con/sin resultados mediante Analytics existente. No incluyen consultas, notas, oraciones ni identificadores de meditaciones. No se verificó recepción en Analytics de producción.

## Verificación

- `test:library`: búsqueda por cada campo, acentos, favoritos, archivo, identidad, recuperación fuera del índice, notas antiguas, filtro de borradores sin falsos positivos y ejecución del flujo de extracto con protección de borradores.
- `test:journey`, `test:connections`, `test:bottom-nav`, `test:analytics`, `test:community-voice`: pasan.
- Safari macOS con datos de prueba locales: detalle, preparación/cancelación de extracto y acceso a la aplicación correcta con foco en su revisión.
- Navegador integrado a 390 × 844: colección, búsqueda por palabra fuera del extracto, estado vacío y revisión visual. Se corrigieron etiquetas accesibles duplicadas y ocultamiento del buscador vacío.
- `android:sync` y compilación `:app:assembleRelease --offline`: completadas. Advertencias Gradle preexistentes; sin cambios de versionCode.

No se publicó, no se hizo commit/push y no se generó AAB de distribución. Falta validación de estos recorridos en iPhone físico y Android físico; la vista móvil y la compilación no sustituyen esa prueba. El PDF y el respaldo reutilizan las funciones existentes, sin una exportación manual nueva durante esta tarea.
