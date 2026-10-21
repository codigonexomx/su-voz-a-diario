# Android 1.5.19: introduccion de Segunda de Pedro

Fecha: 21 de octubre de 2026, America/Mexico_City.
Base: `7214ab59a3647c09633530940922671e0db3b4cb`.

## Alcance

El propietario autorizo commit, push, publicacion web y nueva actualizacion Android. Esta entrega acumula el Calendario y Comunidad de 50 y anade el video `c3FzB5MiJ38` de Suvozadiario App. La introduccion se muestra en las lecturas del 24 al 27 de octubre de 2026, ambos inclusive, en el bloque habitual antes del pasaje. No cambia el calendario editorial: Segunda de Pedro sigue programada del 24 al 31.

Portada local, sin peticiones a YouTube antes de la accion explicita. Al pulsar Ver introduccion se inserta el reproductor youtube-nocookie dentro de la lectura, con Referer de origen, controles nativos y reproduccion inline en iOS. El modo de privacidad mejorada no implica ausencia de tratamiento de datos despues de cargar el reproductor. Se mantiene una alternativa para abrir YouTube y un aviso si el dispositivo declara estar offline. Las cinco introducciones anteriores conservan sus fechas y apertura externa.

PWA 266; Android 51 / 1.5.19. No se modifican dependencias, permisos, reglas, Functions, politica de privacidad, datos de Comunidad, meditaciones ni iOS. `marketing/` queda fuera de esta entrega.

## Validacion y paquete congelado

- Suite completa con Auth, Firestore y Storage locales: 60/60 comprobaciones correctas. Emuladores aislados, cerrados al terminar; sin escrituras productivas ni sustitucion de logs existentes.
- Ambos `npm audit --audit-level=moderate`: cero vulnerabilidades.
- Java 21, Gradle offline: `bundleRelease assembleRelease lintRelease`, correcto; lint sin errores, 19 advertencias heredadas.
- AAB: `artifacts/android-1.5.19-51-release/su-voz-1.5.19-51.aab`.
- SHA-256: `b150e025db583183062bdb2b197ce14162a1771a4bf56c70a30fe85d29e1b72f`.
- Bundletool y firma correctos; mismo certificado de subida; 158 recursos runtime coinciden con www; ningun permiso nuevo ni archivo privado.
- Cuatro bibliotecas con segmentos de 16 KB y PAGE_ALIGNMENT_16K. Es comprobacion estatica, no prueba fisica de un dispositivo de paginas de 16 KB.
- El AAB 50 conserva `c3510d8f1afca864ac46b5423499283613dff44d1f477dc73e1a9574650de283`; los anteriores tambien se cotejaron. No se reemplazan candidatos congelados.
- Auditoria: `node scripts/audit-android-44.mjs --candidate51`, con Command Line Tools seleccionadas solo para el proceso. No se aceptaron condiciones de Xcode ni se cambiaron ajustes del sistema.

Chrome aislado: reproduccion real del video, fechas interiores y limites, variante de hoy, carga solo al pulsar, aviso offline y retirada del iframe al cambiar de lectura. Pantallas de 320, 390, 768 y 1280 px, temas claro/oscuro, sin desbordamiento horizontal. Contraste del titulo superior a 16:1. No hubo excepciones JS. Se bloqueo Firebase productivo en estas pruebas. Evidencia: `artifacts/intro-2peter-20261021/`.

## Distribucion

Preflight Play: produccion 49 (1.5.17) al 100%, interna 50 (1.5.18), sin cambios ajenos pendientes. La lista interna exclusiva del propietario se conservara. La web se publica mediante GitHub Pages desde main; no corresponde desplegar Firebase Hosting ni backend.

La autorizacion no sustituye las comprobaciones posteriores: el resultado del push, CI, HTTP, carga interna, QA nativa y envio productivo se registrara al verificar cada paso. No se declara una version disponible por el mero resultado del compilador. No se crean oraciones o publicaciones reales para probar, ni se abren textos personales. Licencias editoriales y la ausencia de fallos en todos los dispositivos no quedan acreditadas por esta entrega.
