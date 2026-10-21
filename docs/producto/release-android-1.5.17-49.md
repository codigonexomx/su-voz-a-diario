# Android 1.5.17 lector de Biblia y concurrencia

Fecha: 21 de octubre de 2026, America/Mexico_City. Candidato publicado inicialmente solo en la prueba interna del propietario. Despues de completar la QA, el propietario autorizo commit, push, publicacion web y promocion del mismo AAB a produccion. Web 264 publicada y verificada; Android 49 enviado como unico cambio productivo a revision de Google, sin acreditar todavia aprobacion ni disponibilidad publica.

## Base y Alcance

Base Git de preparacion y QA: `e34cefc3226a561658bf7a35d6830b5d73356fa1`. El candidato incorpora los cambios del lector editorial de Biblia: texto corrido, referencias consultables, seleccion nativa, acciones por versiculo, voz desde la palabra seleccionada y conservacion de capitulo, posicion y tipografia. No se altera el texto biblico ni el formato de las anotaciones y respaldos.

Android pasa de la preparacion local 48 a 49, versionName 1.5.17; PWA pasa de 263 a 264 mediante `npm run pwa:sync-version`. `npm run android:sync` copia los assets finales. No se modifican dependencias, permisos, reglas, privacy.html ni iOS. El paquete congelado 48 y las versiones anteriores se preservan.

La PWA de prueba separada Su Voz QA, version 263, ya paso las comprobaciones del propietario en iPhone: versiones, seleccion y acciones, voz desde una palabra sin notas/referencias, pausa/reanudacion/detencion, fuentes/formato, conservacion del lugar al reabrir y reapertura offline de RV1909. Esa evidencia no se transfiere como QA del binario Android 49.

## Correccion de Oracion

El fallo de concurrencia se reprodujo con trazas en la secuencia integrada de pruebas. La correccion de `togglePrayerCommitmentLogic` agrupa las dos lecturas con `transaction.getAll`, manteniendo las escrituras dentro de la transaccion y sin reintentar externamente un toggle de resultado ambiguo. Conserva las validaciones, privacidad, esquema y respuesta publica.

Pasan 25 pruebas unitarias y 14 casos reales del emulador, incluidos los 12 anteriores, seis parejas concurrentes adicionales y el caso combinado de doble toggle de un usuario con otro usuario. La suite completa paso 56/56 con Firestore emulator 1.21.0 y 56/56 con 1.20.4. La segunda ejecucion incluye PWA 264 sincronizada. Informes en `artifacts/bible-reader-2026-10-21/emulator-getall-1.21.0.json` y `emulator-getall-1.20.4.json`. Ninguna asercion se omitio para obtener estos resultados.

Con autorizacion expresa se desplego solamente `functions:togglePrayerCommitment` en `su-voz-a-diario-v2-f3a87`, us-central1, Node.js 22. Se uso una configuracion temporal equivalente que excluye tambien `**/*.log`; no se modifico firebase.json ni se transmitio firestore-debug.log.

Comando:

```text
firebase --config /private/tmp/su-voz-prayer-deploy-20261021.json \
  --project su-voz-a-diario-v2-f3a87 \
  deploy --only functions:togglePrayerCommitment --non-interactive
```

Resultado: actualizacion correcta y funcion ACTIVE. La lista conserva 36 funciones; solo cambio el hash de togglePrayerCommitment, de `b03b11d867c0e5a3f57966af8712262187d2243f` a `40bdcd30acf9d3b221f2adf4df8f0295ca903442`. Las otras 35 conservan sus hashes y no cambiaron los ajustes de runtime, memoria, concurrencia, instancia, ingress ni cuenta de servicio informados por la CLI. Una solicitud sin autenticar devolvio HTTP 401 / UNAUTHENTICATED antes de acceder a datos. No se crearon peticiones ni compromisos reales para probar. Evidencia: `artifacts/bible-reader-2026-10-21/function-deploy-verification.json`.

La CLI advierte que existe una version mas reciente de firebase-functions. No se actualizaron dependencias dentro de esta correccion. Los dos `npm audit --audit-level=moderate`, raiz y functions, informan cero vulnerabilidades.

## Paquete Congelado

- AAB: `artifacts/android-1.5.17-49-release/su-voz-1.5.17-49.aab`.
- SHA-256 AAB: `60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4`.
- APK local de auditoria, no instalada en la Lenovo: `artifacts/android-1.5.17-49-release/app-release.apk`.
- SHA-256 APK: `d28cf54213b272eabe8f785284867612c4afc250eb775b13a27b0e9d4c6ee7f7`.
- app.suvoz, 49 / 1.5.17, PWA 264, minSdk 24, targetSdk 36.

Compilacion offline con Java 21: `bundleRelease assembleRelease lintRelease`, correcta. Bundletool 1.18.3 valido el AAB; firma verificada con el mismo certificado de subida. Los 151 assets runtime coinciden byte a byte con www y no incluyen archivos privados. Sin nuevos permisos. Cuatro bibliotecas con segmentos alineados a 16 KB y PAGE_ALIGNMENT_16K; comprobacion estatica, no prueba en dispositivo de pagina de 16 KB. Lint: cero errores y 19 advertencias.

La auditoria inicial se detuvo al intentar usar objdump del Xcode cuyo acuerdo no esta aceptado. Se completo con `DEVELOPER_DIR=/Library/Developer/CommandLineTools` y el PATH de esas herramientas ya instaladas, sin aceptar acuerdos, cambiar la seleccion global de Xcode ni recompilar el paquete congelado. Auditor: `scripts/audit-android-44.mjs --candidate49`; resultado `artifacts/android-1.5.17-49-release/audit-release.json`.

## Prueba Interna y Lenovo

Ricardo autorizo expresamente publicar solo el AAB con el hash indicado en la prueba interna exclusiva. Play confirma release interna 10, 49 (1.5.17), disponible para verificadores internos, con un codigo de version. Solo esta seleccionada Su Voz QA - propietario 2026-10-02, un miembro; las listas de 14 y 29 personas no se seleccionaron ni modificaron. Produccion no se modifico.

Se cargo una sola vez el AAB congelado mediante el selector nativo de archivos de macOS. La carga automatica de la extension pidio acceso a URLs de archivo; no se activo ese permiso. El selector nativo permitio elegir exclusivamente el archivo aprobado. No se aceptaron condiciones nuevas ni se cambiaron otros permisos.

Play no mostro errores bloqueantes ni perdida de dispositivos compatibles. Mantiene la advertencia existente de codigo nativo sin simbolos de depuracion; no se oculto ni se marco resuelta. Las notas de version describen el lector y explican que es una prueba interna.

La propagacion inicial mostro 48 y Abrir, sin Actualizar. Se espero y se uso el enlace oficial del verificador, sin borrar caches, cambiar cuentas ni salir del programa. Cuando aparecio Actualizar, se actualizo exclusivamente Su Voz desde Play. A las 06:23:03, dumpsys confirmo versionCode 49, versionName 1.5.17 e instalador e iniciador com.android.vending. Se conserva firstInstallTime 2026-09-24 20:41:57. No se instalo una APK local, no se desinstalo ni se borraron datos.

En el binario 49 de la Lenovo TB351FU se comprobaron la lectura de hoy, RV1909 y NBLA, avance a Genesis 2, seleccion nativa de la palabra soplo en Genesis 2:7 y aparicion de Desde aqui. La reproduccion paso por los controles Pausar, Reanudar y Detener, manteniendo Genesis 2. El panel del versiculo abrio y se cerro sin guardar, resaltar, copiar ni compartir contenido. Las capturas confirman Merriweather, Cormorant Garamond e Inter y el cambio entre texto corrido y por versiculos. Se restablecieron Inter, texto corrido, tamano normal y espaciado comodo, los ajustes iniciales.

Tras desplazarse a mitad de Genesis 2 NBLA, se detuvo solo Su Voz y se reabrio MainActivity. La app inicio en Su Voz Hoy; al entrar en Biblia recupero Genesis 2 y el mismo lugar visible con Inter, sin regresar a Genesis 1. Evidencias native-position-before-reopen.png y native-position-after-reopen.png en artifacts/android-1.5.17-49-release/lenovo-qa.

Se realizo una sola prueba offline autorizada el 21 de octubre, de 06:38:37 a 06:38:55. Antes de apagar Wi-Fi se cargo Genesis 2 RV1909. Con wifi_on=0 y Active default network: none, se detuvo solo Su Voz, se reabrio y se entro en Biblia: el capitulo mostro texto real en el lugar guardado. El bloque finally restablecio inmediatamente solo Wi-Fi: wifi_on=1 y red predeterminada activa; una comprobacion adicional confirmo wifi_on=1. No se tocaron datos moviles, Bluetooth, cuentas, permisos ni notas. Evidencias offline-result.json y native-rv1909-offline.png en el mismo directorio. Esta prueba no acredita disponibilidad offline de las Biblias remotas.

La inspeccion limitada a errores del proceso actual de Su Voz, PID 9570, no encontro lineas FATAL EXCEPTION, AndroidRuntime, Uncaught, Unhandled, ERR_FAILED ni ERR_FILE_NOT_FOUND. No se leyeron registros de otras apps ni meditaciones. Se retiro solamente el XML temporal de inspeccion creado en la Lenovo para esta QA. Las redirecciones USB preexistentes no se alteraron.

Enlace oficial de la prueba: https://play.google.com/apps/internaltest/4701700649729684709

El 21 de octubre el propietario confirmo ambas comprobaciones finales en 1.5.17 (49): audio desde la palabra seleccionada sin pronunciar numeros de notas ni referencias, y conservacion de sus meditaciones anteriores. La evidencia auditiva y de notas corresponde expresamente a 49, no se transfiere de 48, Chrome o iPhone. El agente no abrio ni leyo las meditaciones. Con estas respuestas queda completada la QA fisica planificada de 49 en la Lenovo, junto con las comprobaciones operativas y offline anteriores. Este cierre no acredita ausencia absoluta de fallos ni autoriza por si mismo la publicacion en produccion.

Hasta el cierre de QA no se habia publicado el lector en la web productiva ni en Google Play produccion y no hubo commit ni push. Las unicas publicaciones anteriores a la autorizacion final fueron la funcion puntual y el AAB 49 en la prueba interna exclusiva.

## Publicacion Productiva Autorizada

Tras confirmar las dos comprobaciones finales, el propietario pidio completar commit, push y publicacion web y Android en produccion. La web usa GitHub Pages desde main y raiz, no Firebase Hosting. La revision previa confirma HEAD y origin/main en e34cefc, cero vulnerabilidades en ambos npm audit y 151 assets publicos identicos entre raiz, www y el AAB congelado 49. No se recompila ni se cambia el hash. Marketing queda fuera de los commits.

Baseline de Play verificado: produccion 47 (1.5.15), lanzamiento 100%, sin cambios no publicados; interna 49 (1.5.17). La promocion mantendra los paises y configuracion actuales. La disponibilidad publica de 49 depende de la revision de Google; una solicitud enviada no se presentara como aprobada. No se aceptaran condiciones nuevas ni se modificaran Data Safety, permisos, reglas o licencias dentro de esta publicacion.

## Resultado de Publicacion

Commits creados y push normal a main, sin force push:

- `3840a02a140c2c28bac8432fdeda05b65b0d9ccc`: fix(community): batch prayer commitment transaction reads. Incluye exclusivamente la correccion ya desplegada y sus pruebas.
- `99f49d606e958b67b47ceebbffcd45dac292ceb2`: feat(bible): ship editorial reader and Android 1.5.17. Lector, copias publicas, validaciones, preparacion Android y documentacion de QA 48/49.

HEAD y origin/main coincidieron en 99f49d6 tras el push. El remoto conserva su URL historica y GitHub informa la redireccion oficial a codigonexomx/su-voz-a-diario; no se cambio configuracion de Git ni credenciales. Marketing permanece untracked y fuera de los commits. No hubo nueva compilacion, subida de otro paquete, despliegue de Functions, reglas ni cambio de iOS en esta publicacion.

[GitHub Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39610558711) termino correctamente para 99f49d6. [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39610559587) termino correctamente: el log confirma 56/56 checks passed, ambos npm audit sin vulnerabilidades y git diff --exit-code sin cambios despues de preparar las copias nativas.

Web productiva: https://suvoz.app. HTTP 200 y PWA 264. Coincidencia SHA-256 con las fuentes de index.html, sw.js, js/app.js, css/bible-reader.css, ambos modulos nuevos del lector, readingIcons.js y privacy.html. La configuracion servida conserva G-X95Y1G3BE0 y el import de Firebase Analytics; el modulo oficial devuelve HTTP 200. Evidencia en artifacts/android-1.5.17-49-release/production-http-verification.json.

Comprobacion de navegador productivo con analytics_test=1, sin analytics_debug ni modificacion de contenido: lectura de hoy 1 Samuel 30:1-17; lector en 2 Reyes 5, cambio de BL a NBLA y regreso a BL; Comunidad con 20 tarjetas cargadas, comprobando solo conteo y estado, sin leer/capturar sus textos; Calendario y vuelta a Biblia. Sin errores de carga, sin desbordamiento horizontal en el viewport observado y sin warnings/errors registrados en la consola consultada. No se abrieron meditaciones privadas ni se publicaron peticiones o compromisos de prueba. No se acredita recepcion de eventos en DebugView mediante esta sesion excluida de Analytics. Captura publica del lector: production-bible-reader.png en el directorio del candidato.

Play: se promovio el paquete existente 49 desde su release interna 10, sin nueva carga ni recompilacion. Solo 49 incluido; 47 excluido del nuevo lanzamiento. Se conservaron 100% y todos los paises de destino actuales, 178 en el baseline. Cero errores bloqueantes y cero dispositivos previamente compatibles perdidos en la comparacion. ReTrace adjunto; persiste una advertencia por simbolos de depuracion nativos ausentes, no se fabricaron simbolos ni se oculto la advertencia.

Se confirmo Enviar 1 cambio a revision exclusivamente para Produccion / 49 (1.5.17) / Iniciar lanzamiento completo. El [resumen de publicacion](https://play.google.com/console/u/0/developers/5466794951356714708/app/4974496459300724158/publishing) confirmo Cambios en la etapa de revision, con verificaciones rapidas en curso y envio a revision al completarlas correctamente. Publicacion administrada permanece desactivada, sin modificarla. Google aun debe completar sus verificaciones y aprobar la distribucion: no se afirma que 49 este disponible publicamente. Evidencia: artifacts/android-1.5.17-49-release/play-production-review.png. No se aceptaron acuerdos nuevos ni se modificaron otras declaraciones o canales.

SHA-256 del AAB reconfirmado despues del envio: `60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4`. El auditor local conserva sus campos de distribucion predeterminados como evidencia de prepublicacion; este resultado posterior, basado en Play, es la referencia para el estado de distribucion. Las licencias editoriales y otros expedientes operativos pendientes no se consideran concedidos ni cerrados por esta entrega tecnica.
