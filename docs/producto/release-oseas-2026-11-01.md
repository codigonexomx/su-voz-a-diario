# Introducción a Oseas: web 271 y Android 1.5.24 (56)

Fecha: 29 de octubre de 2026, America/Mexico_City.
Base: `7923becd1972a40d2da84df7a24fdeb308d481f7`.

El propietario solicitó incorporar https://youtu.be/f2h5FYVawSU y confirmó web/PWA y actualización Android. Se verificaron título «Introducción al libro de Oseas», canal Suvozadiario App y duración 7:36. El catálogo existente inicia Oseas el domingo 1 de noviembre de 2026; no se modifica el calendario ni el contenido bíblico.

La tarjeta se muestra del 1 al 4 de noviembre, ambos inclusive, antes del pasaje en Su Voz Hoy y en la lectura histórica. Se conserva el mismo período de cuatro días de la última introducción, Segunda de Pedro. Portada oficial local y reproductor youtube-nocookie al pulsar Ver introducción; enlace alternativo a YouTube y aviso de conexión. Las fechas y el comportamiento de las seis introducciones anteriores se conservan.

## Validación previa a publicación

- 64/64 comprobaciones con Auth, Firestore y Storage demo locales; emuladores cerrados al terminar. Las pruebas amplían fechas y límites de Oseas, portada local sin iframe previo, reproducción del ID correcto, modo sin conexión y prevención de reproductores duplicados.
- Las auditorías npm de la raíz y Functions informaron cero vulnerabilidades. No se cambiaron dependencias ni backend.
- Navegador local: lectura Oseas 1:1-9, inicio real del video y tiempo transcurrido 0:12. Cambiar al 2 de noviembre retiró el reproductor; los días 3 y 4 conservan la tarjeta y el 5 no la muestra. La revisión local bloqueó conexiones Firebase productivas mediante CSP. No se marcaron lecturas ni se editaron notas.
- `bundleRelease assembleRelease lintRelease` correctos, Java 21, compilación offline. Auditoría candidate56 correcta: 166 recursos públicos idénticos a www, firma válida y mismo certificado de subida, API 24+, target 36, sin permisos nuevos ni archivos privados, 0 errores lint y 16 advertencias. Alineación estática de 16 KB; no es prueba física de memoria de 16 KB.
- Los paquetes anteriores congelados se cotejaron y permanecen intactos. iOS solo recibió la sincronización local requerida por la validación; no se construye ni publica una release iOS.

Paquete congelado: `artifacts/android-1.5.24-56-release/su-voz-1.5.24-56.aab`.
SHA-256: `c6ea3f16570f334b147d3a6512b0c71998d3063ab8c2cc6ea7b121a84a5b0590`.

Estado de esta nota: implementación y auditoría completadas; publicación web, prueba interna, QA física y envío de producción se verifican por separado. La bitácora local de entrega se guarda junto al paquete en `delivery.json`, con capturas de los estados observados. La compilación no se presenta como actualización disponible al público.
