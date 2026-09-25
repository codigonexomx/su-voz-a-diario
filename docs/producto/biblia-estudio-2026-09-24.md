# Biblia: recorrido de estudio — 24 de septiembre de 2026

## Implementación
- Strong retirado del menú público; la ruta antigua vuelve a Biblia. Se conservan recursos internos.
- Consulta por palabras, frase exacta con comillas rectas o tipográficas, libro y testamento; conserva consulta, filtro, página y posición al volver desde el lector.
- Notas guardadas distinguen versión; abren el fragmento original cuando está disponible. Una edición no disponible no sustituye silenciosamente el texto ni borra la nota.
- Botón Meditar conectado: añade el pasaje a Enseñanza en el borrador del día sin reemplazar notas ni modificar sesiones terminadas. Deduplicación y bloqueo durante guardado.
- Guía de lectura, contexto, referencias, notas y aplicación personal en Biblioteca, lector y ajustes. Reutiliza Mis meditaciones y Comunidad, sin publicación automática.
- Catálogo público RV1909; proveedores remotos pendientes solo en modo interno explícito. Este control de interfaz no sustituye autorizaciones del backend.
- Se mantienen títulos, notas y referencias existentes con sus fuentes; no se presentan como aparato original de RV1909.

## Corrección textual puntual
Isaías 43:1 contenía la repetición «Formador tuyo, oh Israel: No temas» y «fakporque». Se sustituyó únicamente ese fragmento tras contrastarlo con Sociedad Bíblica Peruana: https://www.sbp.org.pe/biblia/RVR09/ISA.43 y RVR09 de YouVersion: https://www.bible.com/es/bible/1718/ISA.43.1.RVR09 . No equivale a una cotejación editorial completa de los 66 libros.

## Verificación
Pruebas automatizadas: bible-study, bible-continuous, bible-phase3/6/7, connections, journey, library, community-voice y bottom-nav. Los proveedores remotos se comprueban con datos simulados, no como licencia o servicio público habilitado.
Safari macOS: consulta por frase exacta, apertura de contexto y regreso a los resultados. Se corrigió el escape de comillas en el campo para conservar la consulta al volver.
Navegador local: frase «no temas» filtrada a Isaías (11 resultados), abrir Isaías 41:10, volver conservando filtro y posición; guardar nota, recuperarla en Notas y regresar al fragmento visible. Pruebas de meditación: pulsaciones simultáneas/repetidas, borrador existente, oración privada y sesión terminada intactas, lectura ausente sin escritura.

## Entrega
PWA 252, recursos sincronizados a www. No se generó AAB ni se publicó ni se hizo commit/push en esta tarea. Pendiente prueba física en iPhone y Android; el navegador estrecho no sustituye esos equipos. Se conserva el límite ya documentado de la sesión de lectura continua: sin poda de capítulos visitados, falta estrés de sesiones muy extensas.
