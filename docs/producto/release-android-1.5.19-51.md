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

## Web y GitHub publicados

Commit de version: `2ccb0fff968d19504df08f0e9a14c6ed594fd18c`. Push normal a main; HEAD y origin/main coinciden. [Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39673208281) y [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39673208927) terminaron correctamente. Quince recursos productivos devuelven 200 y coinciden por SHA-256, incluida la portada local; Analytics conserva G-X95Y1G3BE0 y su import devuelve 200. Evidencia: `artifacts/android-1.5.19-51-release/production-http.json`.

En la pestaña productiva existente, navegar dentro de la SPA todavia mostraba el codigo que ya estaba cargado. Una recarga normal, sin borrar almacenamiento ni reinstalar, mostro el video nuevo. Se reprodujo dentro de suvoz.app y se termino volviendo a Su Voz Hoy, que retiro el iframe y cargo la lectura de hoy. No hubo errores de consola consultados. No se marcaron lecturas ni se editaron notas.

## Prueba interna y Lenovo

Play acepto un unico AAB 51, con el SHA-256 auditado intacto, API 24+, target 36 y ReTrace adjunto. No hay perdida de dispositivos compatibles ni errores bloqueantes. Persiste la advertencia del proveedor sobre simbolos de depuracion nativos; no se fabricaron simbolos ni se oculto la advertencia.

La release interna 12 aparece disponible para verificadores el 21 de octubre a las 14:51. Se cotejo la lista: solo Su Voz QA - propietario 2026-10-02, un miembro; las listas de 14 y 29 personas permanecen sin seleccionar. La carga uso el selector normal de macOS despues de que la herramienta de extension requiriera ampliar permisos. No se amplio ningun permiso ni se cargo otro archivo.

La Lenovo TB351FU se actualizo por Play a 51 / 1.5.19, lastUpdateTime 2026-10-21 14:52:59, instalador e iniciador com.android.vending. Se conserva firstInstallTime 2026-09-24 20:41:57 y el permiso de notificaciones previamente concedido. No hubo APK local, desinstalacion, borrado de datos ni cambio de cuentas, permisos, volumen o conectividad.

Se comprobo la lectura de hoy 1 Samuel 30:1-17, apertura de 2026-10-24 / 2 Pedro 1:1-11, portada y reproduccion real del video dentro de la app. Android mostro Introduccion de 2 Pedro, Suvozadiario App, Pausar video y tiempo transcurrido; la captura muestra imagen real y 0:01 / 6:30, sin error 153. Volver a hoy retiro el reproductor. Calendario muestra octubre, 31 lecturas y las vistas Mes y Lista. Evidencia publica, sin notas: `lenovo-qa/native-video-preview.png`, `native-video-playing.png`, `native-daily-reading.png`, `native-calendar.png` y `native-calendar-list.png`.

La inspeccion del proceso actual de Su Voz dio cero FATAL EXCEPTION, AndroidRuntime fatal, Uncaught, Unhandled y fallos de recursos contados. Solo se conservaron contadores, no logs crudos: `lenovo-qa/process-errors.json`.

## Aprobaciones y envio productivo

La inspeccion adicional de Comunidad fue bloqueada por revision automatica: incluso una salida filtrada podia materializar textos visibles y exceder la autorizacion limitada a controles. La accion rechazada no se ejecuto ni se eludio. El propietario comprobo personalmente Comunidad y Oracion en 1.5.19 y confirmo que abren sin error y que el video se escucha. No se atribuye la QA personal de 50 a 51. No se abrieron Mis peticiones, meditaciones o notas privadas.

Contenido de la app muestra las diez declaraciones completadas; Seguridad de los datos conserva su modificacion del 3 de octubre. El propietario aprobo expresamente declarar posibles anuncios de YouTube. Se cambio y guardo unicamente Anuncios a Si, mi app contiene anuncios, para la etiqueta Contiene anuncios. No se anadio AdMob, SDK publicitario, campana ni publicidad propia; tampoco se modifico la declaracion de ID de publicidad. Capturas anterior y posterior: `play-ads-baseline.png` y `play-ads-saved.png`.

La web 266 esta publicada y Android 51 sigue disponible en la prueba interna exclusiva. No se aceptaron acuerdos ni condiciones nuevas, no hubo despliegues de backend y no se publico contenido de prueba. El mismo AAB congelado conserva el SHA-256 indicado; no se recompilo despues de la QA.

Se completo la release de produccion 27 del segmento 4698001730505189813, con solo 51 (1.5.19) desde la biblioteca y las notas de actualizacion. Lanzamiento completo al 100% en los paises de destino existentes, sin ampliar paises ni perder dispositivos compatibles. La vista previa mostro cero errores bloqueantes y una advertencia sobre simbolos nativos del proveedor no suministrados.

Se enviaron exactamente dos cambios: Produccion 51 e informacion de Anuncios. Play confirmo Cambios en la etapa de revision, con verificaciones rapidas en curso. La publicacion administrada permanece desactivada; el lanzamiento queda solicitado para publicarse tras las comprobaciones y aprobacion de Google. No se afirma que 51 ya este disponible para el publico: la produccion anterior es 49 hasta que Google complete este proceso. Evidencia: `play-production-submitted.png` y `artifacts/android-1.5.19-51-release/delivery.json`.

El commit de registro previo `47d179df51a92e6b1d11bfa6ece578e26ba7d537` tambien completo correctamente [Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39675578688) y [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39675579211). El cierre documental no cambia codigo ni paquetes. Las licencias editoriales pendientes no se consideran concedidas por este envio.
