# Matthew Henry: Apocalipsis en web y Android

Preparación del 18 de noviembre de 2026, America/Mexico_City. Web/PWA 282; Android 62 / 1.5.30. El propietario pidió continuar con DeepSeek, convertir el comentario de Apocalipsis a JSON e incorporarlo y publicarlo en ambas aplicaciones.

## Lectura

Biblia RVR1960 y RVR1960 + Strong, y las meditaciones de Apocalipsis, ofrecen un selector entre William Hendriksen y Matthew Henry. Conserva el pasaje, la sección y la posición de cada comentario mientras el panel permanece abierto. Al regresar a la meditación se preservan borrador, cursor, foco y desplazamiento. La edición concisa de Henry tiene un índice por los 22 capítulos.

Se integra Apocalipsis completo de **Matthew Henry's Concise Commentary on the Whole Bible**, módulo MHCC 2.0: 62 secciones que cubren los 404 versículos y las 36 meditaciones programadas. No es el comentario extenso ni la traducción completa de todos los libros de la Biblia. «Más que vencedores» permanece idéntico: SHA-256 `332e16359dfbaebad14ad659c1d01eb87b7c6efd5837acb9a0af02e63da411fa`.

## Traducción y procedencia

DeepSeek produjo todas las traducciones y todos los reemplazos. El cotejo asistido compara las entradas completas con el inglés, identifica errores precisos y devuelve esas observaciones a DeepSeek; el importador no redacta, resume ni modifica la prosa. Conserva el texto y las notas exactos de las entregas revisadas, con huellas del original, entrega, parche e informe.

Fuente: MHCC 2.0, distribuido como dominio público por CrossWire SWORD y convertido a JSON por GetBible. El texto fuente se identifica con SHA-256 `47f53f332510344ef532821108fb53e00c59db14332b8b5707482e85d0b8406a`. Las 17,220 palabras inglesas de Apocalipsis se repartieron en seis lotes. Atribución: «Comentario conciso de Matthew Henry y sus continuadores». Henry concluyó su exposición hasta Hechos; Apocalipsis de la obra extensa fue completado por William Tong. La edición abreviada no identifica la autoría individual de cada frase.

Se conservan las interpretaciones históricas y sus modalidades originales, sin convertir «parece» o «probablemente» en certezas. Dos dificultades de la fuente en Apocalipsis 21 permanecen señaladas: «in order hearts» y la relación «of the heirs of salvation». Las notas de traducción y la conjetura no comprobada se presentan por separado del comentario. No se reconstruye el texto por conjetura.

La revisión es asistida; no se afirma revisión humana independiente. Las entregas e informes editoriales originales mantienen `humanReview: pending` y `publishable: false`, que describen su estado de borrador en ese flujo de trabajo. La solicitud posterior del propietario autoriza esta publicación; no convierte retrospectivamente esos informes en una aprobación humana ni resuelve las incertidumbres anotadas.

JSON público: `data/commentaries/matthew-henry-apocalipsis.json`, 160,690 bytes. SHA-256 `6f6f91b89fcf3ca9592cf71bb18b9e5396ae07d736aadfd41a7e672483e35153`.

Las fuentes, entregas y revisiones completas permanecen en el proyecto editorial del disco externo. El JSON público excluye rutas locales y credenciales. Los créditos se incluyen también en `MATTHEW-HENRY-NOTICE.txt`.

## Validación y entrega

La validación de contenido exige exactamente una sección de Henry por cada versículo, cobertura de las 36 meditaciones, integridad de los 62 textos, seis entregas identificadas por SHA y las dos notas preservadas fuera del texto del autor. Las pruebas de interfaz cubren obras concurrentes, respuestas tardías, reintentos, índice, selección, notas escapadas y preservación del borrador.

Pasaron 70/70 comprobaciones con emuladores locales Firestore/Auth/Storage y datos ficticios. La prueba completa de la aplicación con el JSON real pasó en 390×844 y 1280×900, sin errores JavaScript: selector de obras, índice de 22 capítulos, capítulos 17 y 22, selección de versículo, Strong, notas separadas y meditación entre capítulos con borrador y foco preservados. Evidencias en `artifacts/validation/matthew-henry-app/`; no se hicieron escrituras en producción.

La web 282 quedó publicada y comprobada en `https://suvoz.app`: JSON y versión exactos, pruebas reales en móvil y escritorio correctas. La auditoría Android 62 y la prueba nativa sin conexión también pasaron; la versión 1.5.30 quedó enviada a revisión en Google Play. La aprobación y disponibilidad de esa actualización Android siguen pendientes de Google. Evidencia en los artefactos locales de la versión y detalles en `release-android-1.5.30-62.md`.

Notas previstas para Google Play, es-419:

> Añadimos el comentario conciso completo de Matthew Henry sobre Apocalipsis, traducido al español, en Biblia y en las meditaciones. Elige entre Matthew Henry y William Hendriksen, consulta el índice por capítulos y lee sin conexión. Se conservan tu pasaje y tu reflexión al volver. Incluimos créditos y notas de traducción donde la fuente requiere aclaración.
