# Biblioteca y Mi camino: auditoría y propuesta

Fecha: 24 de septiembre de 2026. Alcance: revisión del código y de los recorridos definidos en la versión local. Sin modificaciones funcionales ni medición de uso real.

## Dictamen

Conservar la función, integrarla como «Mis meditaciones» dentro de Mi camino y unificar sus accesos. Mi camino acompaña la práctica presente; Mis meditaciones permite recuperar lo escrito. No crear una segunda colección ni eliminar registros.

## Evidencias

- `index.html`: Biblioteca está en el desplegable de controles de lectura, junto a tamaño de letra, tema y Strong. Su ubicación mezcla contenidos personales con ajustes.
- `js/JourneyView.js`: «Palabra para recordar» muestra favoritas y recientes; «Ver mis meditaciones» navega a `meditations-history`. Ambas entradas ya conducen a la misma pantalla.
- `js/app.js`: Biblioteca permite buscar, filtrar por colección/estado/versión/libro, explorar por lista/libros/cronología y ordenar. El detalle conserva Cómo es Dios, Enseñanza, Aplicación y Oración; permite editar, favoritos, archivar y restaurar.
- El buscador visible usa `getMeditationDisplayModel().searchText`, construido con referencia, fecha, versión, estado, extracto y libro. El extracto toma el primer campo no vacío y se recorta. Aunque `MeditationLibrary` tiene un índice de contenido completo, la pantalla filtra los modelos resumidos: puede no encontrar una palabra escrita en Aplicación u Oración.
- «Compartir» desde Biblioteca llama a `exportReflectionPDF`; desde Mi camino se prepara un extracto editable para Comunidad. La misma idea de compartir tiene resultados distintos y debe explicitarse.
- El estado vacío explica qué aparecerá, pero no ofrece una acción para comenzar a meditar.
- El detalle no ofrece una acción directa para volver al pasaje ni para revisar la aplicación personal en Mi camino.
- Mi camino admite recuperación de notas antiguas además de sesiones; Biblioteca usa el índice de sesiones. Antes de unificar la presentación se debe comprobar paridad de contenido antiguo y migrado, sin duplicarlo.
- El almacenamiento de sesiones es local. No se consultó Analytics ni se dispone aquí de cifras de visitas; la poca visibilidad es una hipótesis de diseño, no una conclusión de uso.

## Propuesta

1. Nombre consistente: «Mis meditaciones». Acceso destacado cerca del inicio de Mi camino, con explicación «Vuelve a lo que has escrito al meditar». Conservar inicialmente el atajo del menú con ese mismo nombre. Mantener ruta antigua compatible.
2. Mi camino conserva continuación, práctica, aplicación y revisión semanal. Mis meditaciones concentra la colección completa. Favoritas/recientes en Mi camino funcionan como una selección que abre los mismos registros.
3. Vista inicial sencilla: buscador de texto completo y accesos Todas, En curso, Favoritas. Libro, versión, cronología y archivadas quedan como opciones secundarias. No añadir otra pestaña inferior.
4. Detalle con acciones claras: Continuar/Editar, Leer el pasaje, Revisar mi aplicación, Preparar extracto para Comunidad y Exportar PDF. El extracto requiere selección y revisión; no incluir automáticamente la oración ni la revisión privada.
5. Descubrimiento desde el contexto: al guardar, comunicar «Guardado en Mis meditaciones» con enlace; si no hay contenido, botón «Comenzar con la lectura de hoy». Explicar guardado local y facilitar acceso al respaldo existente.
6. Medir utilidad con eventos mínimos de entrada, apertura, búsqueda con/sin resultados y continuación. No enviar texto de búsqueda, notas, oraciones ni fragmentos personales. Adaptar el esquema de analítica existente antes de instrumentar. Evaluar recuperación y continuación de meditaciones, no solamente visitas.

## Orden de implementación propuesto

Primero corregir búsqueda y comprobar paridad de datos; después nombre, ubicación y estados vacíos; luego conexiones del detalle con lectura, aplicación y Comunidad; al final instrumentación y evaluación de uso.

## Criterios de aceptación

- Una meditación guardada se encuentra desde ambos accesos y conserva el mismo identificador.
- Buscar una palabra exclusiva de cada uno de los cuatro campos encuentra el registro, también después del extracto y sin depender de acentos.
- Favoritos, archivo/restauración, edición y regreso actualizan las vistas pertinentes.
- Notas antiguas, sesiones múltiples del mismo día y registros cuyo pasaje no esté disponible se conservan y reciben una salida comprensible.
- Ninguna oración/revisión privada se publica automáticamente; PDF y Comunidad se distinguen antes de actuar.
- Estado vacío conduce a la lectura de hoy; navegación atrás mantiene filtros y posición.
- Comprobar Safari/iPhone web, PWA y Android, estados claro/oscuro y tamaños móviles.

No se propone retirar todavía el acceso del menú: primero se debe hacer visible y consistente la nueva entrada y evaluar su uso.
