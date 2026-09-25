# Lector continuo — implementación y revisión

Estado: implementación local, PWA 249; sin commit, push ni distribución. Los cambios anteriores de atribución diaria se conservan.

## Comportamiento

- Carga progresiva en ambas direcciones, con límites entre libros y al inicio/final de la Biblia.
- Cada capítulo conserva su superficie de selección y clave de anotaciones. No se fusionan versículos de distintos capítulos.
- Selector y encabezado siguen el capítulo visible. El encabezado permanece fijo bajo la cabecera de la app.
- Se conserva el lector de datos existente: no se activan traducciones remotas ni se incorporan nuevos textos bíblicos.
- Las cargas pendientes se descartan al abandonar la vista; las solicitudes repetidas en la misma dirección se agrupan. Un fallo ofrece reintento explícito.
- La ubicación se guarda por libro, capítulo, versión y versículo, con desplazamiento dentro de pantalla. Se mantiene compatibilidad con posiciones antiguas basadas en scrollY.
- El audio conserva capítulo y lista de versículos independientemente del desplazamiento. Los controles persistentes pausan/reanudan ese audio y permiten regresar al versículo que está sonando. Cada capítulo puede iniciar su propia lectura, cancelando la anterior. Al terminar un capítulo se detiene; no hay avance sonoro automático.
- Se marca visualmente el versículo del audio sin desplazar la pantalla automáticamente.
- El módulo nuevo está incluido en precaché; fuentes y www sincronizados mediante android:copy. Esto NO equivale a generar ni instalar una nueva compilación Android.

## Recursos auditados

Inventario de archivos existentes, no nuevo cotejo editorial de cada entrada:

- Títulos: 3,102 encabezados en 3,086 referencias de inicio, según metadata y conteo de `data/section-headings-español.json`. Adaptación española de encabezados de Berean Standard Bible.
- Notas: metadata declara 4,846 notas en 4,308 referencias en `data/footnotes-espanol-rv1909-FINAL.json`; algunas notas no se muestran por su política de anclaje. Son adaptaciones de BSB a RV1909, no notas originales de esa edición.
- Referencias: 344,799 relaciones en 29,364 referencias de origen, según metadata y conteo de `data/cross-references.json`, procedentes de OpenBible.info; la interfaz filtra valoraciones positivas.
- Se conserva la restricción de estos recursos locales a RV1909. Las otras traducciones solo reciben los recursos que proporcione su fuente.
- Se añade «Acerca de las ayudas de estudio» al pie del capítulo RV1909 para explicar la adaptación y enlazar las fuentes.

Fuentes verificadas: https://www.openbible.info/labs/cross-references/ y https://berean.bible/.

## Verificaciones realizadas

Pruebas automáticas nuevas:

- `npm run test:bible-continuous`: límites y tránsito entre libros; carga repetida rápida; respuesta obsoleta tras salir; fallo/reintento; identidad de audio separada de la lectura visible.
- Máquina de estados real del audio extraída de app.js, con motor simulado: reproducción/pausa/reanudación rápidas, sustitución de capítulo, callbacks antiguos, fin de capítulo y detener.

Regresiones ejecutadas: conexiones, fases bíblicas 3/6/7, Mi camino, biblioteca, barra inferior y audio de Comunidad. Las pruebas de proveedores remotos usan fixtures; no acreditan acceso real a esas traducciones.

Prueba de interfaz en navegador integrado, ancho móvil:

- Génesis 1 → 2 mediante desplazamiento, sin cambiar de página.
- Apertura directa de Génesis 3 y carga del capítulo anterior sin cambiar el punto de entrada.
- Audio de Génesis 1 mientras el encabezado indica Génesis 2; pausa y regreso al audio.
- Salir a Su Voz Hoy y volver a Génesis 3: versículo 4 a 173.97 px antes y 174.08 px después (diferencia de redondeo de 0.11 px).
- Abrir nota de Génesis 3:1 y referencia a 2 Corintios 11:3 sin reemplazar la lectura.
- Resaltar Génesis 3:1 no resalta Génesis 2:1. Se retiró el resaltado de prueba.
- Apariencia clara y oscura inspeccionada. Registro de errores del navegador vacío al final.

Safari de Mac:

- Apertura del lector; títulos, notas y carga de Génesis 2.
- Reproducción de Génesis 1, desplazamiento a Génesis 2, pausa, regreso a Génesis 1 y detener.

## Límites pendientes antes de distribución

No se ha validado esta revisión en un iPhone físico ni en Android instalado. Safari de Mac no sustituye iOS. Falta la prueba en esos dispositivos de audio, interrupciones del sistema, gestos, tres botones y teclado. Tampoco se ha hecho un recorrido de estrés de cientos de capítulos: los capítulos visitados se conservan en el DOM durante la sesión para no destruir selecciones ni audio; al abrir otro destino se libera la sesión. No afirmar perfección ni cobertura editorial completa con estas pruebas.

La vista previa local queda en http://127.0.0.1:8767/index.html#bible-reading.
