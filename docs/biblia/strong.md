# RVR1960 + Strong: integración, diccionarios y procedencia

Preparación local del 16 de noviembre de 2026 por solicitud del propietario del proyecto. La solicitud actual de incorporar Strong sustituye el retiro de esta función documentado en septiembre de 2026. El propietario autorizó publicar la versión web el mismo 16 de noviembre de 2026. Esta entrega no genera un paquete nuevo para tiendas.

Los códigos Strong remiten a entradas del diccionario. Su presentación conserva la posición documentada en la fuente de números; no certifica por sí sola una correspondencia semántica exacta con cada palabra española. La ficha muestra el lema original, el identificador, su transliteración y la definición española. La Biblia RVR1960 sin Strong conserva su texto y funcionamiento.

## Diccionarios

Se incluyen 14,197 entradas léxicas: 8,674 en `data/strong/hebrew.json` (8,003 hebreas y 671 identificadas expresamente como arameas) y 5,523 en `data/strong/greek.json`. Cada entrada se consulta por un identificador sin ceros iniciales, por ejemplo `H430` o `G3056`.

Las definiciones y transliteraciones españolas proceden del módulo `StrongEsp.dct.mybible`, descargado desde el [enlace de Strong en español](https://www.mediafire.com/download/xgqux32ye221wx9/StrongEsp.dct.mybible) publicado en el [catálogo de módulos para My-Sword](https://sites.google.com/view/iglesiadecristodaule/inicio/m%C3%B3dulos-para-my-sword). La ficha del módulo identifica la obra de James Strong publicada por Editorial Caribe en 2002, la compilación de Equipo Internacional e-Sword / Biblioteca Hispana y una revisión del 17 de julio de 2012. Su SHA-256 es `d39d4fed729656f9b20fce727d6a8746921050c03d22a3dd2366f84d79a21d2f`.

Los lemas vocalizados proceden de [Open Scriptures Strong’s Dictionaries](https://github.com/openscriptures/strongs/tree/0acd2f251c2d35ff8db2dece4e0593979d3ac223), revisión `0acd2f251c2d35ff8db2dece4e0593979d3ac223`, consultados por el mismo identificador. No se usaron los lemas sin vocales del módulo español ni se generaron vocalizaciones o traducciones con IA. Las fuentes de los lemas se fijan por hash en el importador.

Los archivos de Open Scriptures declaran “CC-BY-SA” sin indicar versión. No se atribuye CC BY-SA 4.0 a esos archivos. Se conservan los avisos exactos de JSON hebreo © 2010 Open Scriptures y JSON griego © 2009 Open Scriptures, junto con los créditos a David Instone-Brewer, David Troidl y Ulrik Petersen. La licencia de los lemas no se atribuye a las definiciones españolas.

El módulo español declara © 2002 Editorial Caribe Inc., una división de Thomas Nelson, y dice: “Solo para uso personal. Prohibida su venta.” También declara no estar asociado a los propietarios del copyright. Estos avisos se conservan; la disponibilidad de la descarga no se presenta como licencia abierta de redistribución ni como autorización concedida por el titular a Su Voz a Diario.

## Conversión y límites del original

Se retiraron HTML y estilos y se decodificaron entidades. Se conserva el texto español completo de etimología, acepciones, variantes y traducciones. Los enlaces relacionados sólo se activan cuando su identificador existe en el diccionario. No se ejecutó el JavaScript de las fuentes: se extrajo su objeto JSON.

La clasificación aramea se usa únicamente cuando la definición hebrea comienza con la indicación explícita “(caldeo)”. La transliteración española se muestra como tal; `pronunciation` queda vacío porque no se inventa una pronunciación fonética distinta.

`G2717` es una nota editorial del original, no una palabra; se conserva en el manifiesto. Los números `G3203`–`G3302` tampoco tienen entradas en la numeración histórica. Se preservan como texto seis remisiones que no resuelven a entradas: `G12023`, `G3203`, `G35624`, `G6085`, `G6578` y `G6606`. No se corrigen por conjetura ni se crean enlaces falsos para ellas.

Los datos de procedencia, los conteos, los hashes de salida, los textos de créditos y los avisos originales se encuentran en `data/strong/lexicon-source.json`. `data/strong/NOTICE.txt` ofrece una copia legible de los créditos y avisos, generada por el mismo importador.

## Regeneración

```sh
node scripts/import-strong-dictionaries.mjs '/Volumes/Almacenamiento/imagenes/Produccion audiovisual/Proyectos de la iglesia/Su Voz a Diario - RVR1960/Strong/Fuentes'
```

Se requiere Python con SQLite, además de las dependencias Node del proyecto. Puede indicarse su ejecutable con `PYTHON_BINARY`. Los originales permanecen en el disco externo y no se incorporan a la distribución pública completa del proyecto.

La validación comprueba hashes, identificadores, conteos y entradas no vacías. Las muestras revisadas incluyen `H430` (אֱלֹהִים), `H7225` (רֵאשִׁית), `H1254` (בָּרָא), `H2` (arameo), `G3056` (λόγος) y `G26` (ἀγάπη). La cobertura frente a los números usados por la fuente bíblica se coteja por separado al regenerar o cambiar su mapa.

## Uso en Su Voz a Diario

En Biblia, elegir **RVR1960 + Strong**. Tocar un número `H…` o `G…` abre la ficha sin abandonar la lectura. Incluye lema original, transliteración, significado en español, entradas relacionadas y regreso. El botón **Diccionario** permite buscar por número, lema, transliteración o palabras de la definición y filtrar por hebreo, arameo o griego. La búsqueda no requiere servicios remotos.

El panel se adapta a la parte inferior del celular y al lateral del escritorio cuando hay espacio. Admite teclado, cierre con Escape y estados de carga, error y reintento. Las respuestas tardías no reabren una ficha cerrada ni una versión abandonada. La navegación entre términos conserva su historial.

Los números aparecen en la posición literal del módulo. Se enlaza el número, sin convertir el fragmento español precedente en una equivalencia léxica certificada. El botón **＋** reúne otras entradas del versículo cuyos códigos no tienen posición trasladable. Los códigos de títulos de Salmos se muestran por separado. Copiar, buscar o escuchar conserva el texto bíblico sin leer los códigos Strong; las referencias bíblicas y notas siguen funcionando.

## Fuente de los números y cobertura

Se utilizó la [edición de Biblioteca Hispana revisada en junio de 2019](https://bibliotecahispana.net/index.php/2019/06/22/rvr1960-reina-valera-1960-strong-morfologias/), módulo interno RVR1960+ 2.5, con fecha declarada de publicación 31 de enero de 2020. El archivo `RVR1960+.bbl.mybible` tiene SHA-256 `4fcc8382769712618007c77cdf90a81220646ba26fac848106f5eba1273d5fe7`. Sustituye como fuente de trabajo a la edición anterior de 2012, que presentaba errores observados. El original y las auditorías permanecen en la carpeta externa `Strong/Fuentes`.

El mapa contiene los 66 libros y 1,189 capítulos. De los 31,104 versículos, 30,863 admiten trasladar posiciones al coincidir su secuencia completa de palabras, normalizando únicamente mayúsculas, acentos y puntuación. En los 241 restantes se conservan sus códigos como entradas adicionales, sin forzar asociaciones. Se preservan además los códigos de 116 títulos de Salmos. Los 14,143 identificadores válidos distintos usados por esta fuente existen en los diccionarios.

Las 491,610 etiquetas originales incluyen cinco códigos concatenados fuera del rango Strong: Éxodo 16:29, 16:33, 17:7 y Salmos 69:12, 69:13. Se documentan literalmente en el manifiesto y no se convierten en enlaces ni se dividen por conjetura. Esta auditoría verifica fidelidad a la fuente, no certifica la exactitud filológica de cada anotación original. La morfología del módulo no se incorpora en esta entrega.

`data/strong/rvr1960-map-manifest.json` registra políticas, conteos, incidencias, avisos y hashes por libro. La fuente declara uso personal y prohíbe venta o utilización comercial; no declara licencia abierta de redistribución. Se conservan dichos avisos sin atribuir a esa descarga una autorización adicional.

## Implementación y validación

`LocalRvr1960StrongProvider` comparte el texto de `LocalRvr1960Provider` y añade datos separados de `StrongRepository`. `StrongStudyPanel` presenta las consultas. Los 66 mapas se cargan por libro y los diccionarios se conservan en caché. Los recursos están incluidos en la precarga del service worker y en la copia pública `www` para el siguiente empaquetado Android. En web, el uso sin conexión requiere que la descarga y almacenamiento iniciales hayan concluido.

Para regenerar el mapa fijado:

```sh
node scripts/import-rvr1960-strong.mjs '/Volumes/Almacenamiento/imagenes/Produccion audiovisual/Proyectos de la iglesia/Su Voz a Diario - RVR1960/Strong/Fuentes/RVR1960+.bbl.mybible'
npm test
npm run android:copy
```

Validación final local del 16 de noviembre de 2026, PWA **278**: **56/56 comprobaciones aprobadas** y `git diff --check` limpio. Se cotejaron 94 archivos entre fuente y `www`, incluidos 71 archivos de datos Strong, sin diferencias. La auditoría independiente contra SQLite verifica los inventarios de versículos y títulos, y el renderizado conserva los 31,104 versículos. Las pruebas cubren selección y voz, referencias, escape HTML, búsqueda, fallos y reintentos, navegación del panel y respuestas tardías.

Revisión real en navegador a 390 × 844 y 1440 × 900: hebreo H430, griego G26 y G3056, búsqueda por número y significado, entradas relacionadas, regreso, apertura con Enter, cierre con Escape y cambio a RVR1960 normal. Capturas guardadas en el disco externo, carpeta `Strong`. La publicación web de PWA 278 fue autorizada por el propietario; su verificación se registra en el informe externo de la entrega. No se generó ni subió un APK/AAB nuevo.
