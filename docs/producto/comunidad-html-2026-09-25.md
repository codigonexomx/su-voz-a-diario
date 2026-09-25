# Comunidad: publicaciones pegadas y aislamiento del contenido

Corrección PWA 254 y candidato Android 1.5.8 (40). El AAB 1.5.7 (39) no incluye esta corrección.

## Problema reproducido

Una publicación contenía HTML pegado con muchos atributos externos, cortado dentro de una etiqueta. Al insertarlo, las publicaciones posteriores quedaban dentro de la primera. El sanitizador anterior recortaba el HTML a 1.200 caracteres antes de limpiarlo, por lo que podía eliminar la respuesta antes de llegar a su texto visible.

## Corrección

- Parsear el contenido en un fragmento inerte y reconstruir únicamente texto y formato permitido, sin atributos externos.
- No recortar HTML serializado al publicar, mostrar o guardar un borrador; mantener la validación de longitud del texto visible.
- Limpiar el contenido pegado en el editor y usar el mismo formato seguro en el detalle de la publicación.
- Mostrar un aviso cuando una publicación no contiene texto legible.
- Incluir el módulo nuevo en la caché y sincronizar los recursos web y nativos.

## Verificación

- 16 comprobaciones del archivo `scripts/community-richtext-check.html` aprobadas en Chromium y Safari de macOS: atributos largos, texto de 1.200 caracteres, etiquetas truncadas, eliminación de contenido activo, párrafos, estabilidad del formato y aislamiento de publicaciones y reacciones.
- Feed real leído desde la aplicación local: 20 tarjetas, ninguna anidada dentro de otra después de corregir el renderizado. No se modificaron publicaciones remotas.
- Pruebas de conexiones, audio de Comunidad, integración de Comunidad, intenciones, identidad y biblioteca aprobadas; sintaxis y diff sin errores.
- Recursos copiados a Android e iOS. AAB 1.5.8 (40) generado y validado con bundletool; compilación y lint aprobados (0 errores, 22 advertencias). Sin prueba de esta corrección en dispositivos físicos. La tarea testReleaseUnitTest no está disponible en esta configuración; no se afirma que se ejecutó.

## Respuesta afectada

La publicación que desencadenó el problema no ofrece texto legible recuperable al renderizarla con la corrección. Se verificó en lectura el documento público de Firestore: contiene 629 caracteres de HTML truncado dentro de un atributo, sin la respuesta. No se inspeccionaron copias de seguridad. No se ha reconstruido, reemplazado ni eliminado la respuesta del usuario.
