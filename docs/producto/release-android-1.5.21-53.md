# Meditacion: web 268 y Android 1.5.21 (53)

Fecha: 23 de octubre de 2026, America/Mexico_City.
Base: `8a7e13b8b9731832ee6d86c08c2ef4215148b795`, main sincronizada con origin/main.

## Alcance

El propietario autorizo el cierre completo de la entrega, commit, push, web y actualizacion Android. Incluye Meditacion y el enlace contextual de sus cuatro etapas con Aprender; conserva la fecha, sesion, respuesta, version biblica y posicion al regresar.

Se incorporan estado real de guardado, reintento y respaldo ante fallos, cierre protegido, revision y Terminar por hoy. El teclado conserva el espacio del pasaje y de la respuesta; permite seleccionar versiculos consecutivos, consultar preguntas, cambiar de etapa y volver de Revisar o Aprender sin tener que tocar de nuevo el editor si se estaba escribiendo. La ayuda de la barra usa un icono de interrogacion de Lucide, diferenciado de Aprender y Revisar.

No cambia la logica del backend, reglas, IAM, politica de privacidad, contenido de Comunidad, traducciones ni iOS nativo. El parche de una dependencia del servidor detectado durante CI se detalla abajo. Las respuestas no se incorporan a Analytics ni se envian a Firebase. Quedan fuera marketing/ y los documentos previos de investigacion y propuesta.

## Validacion previa

- 51/51 comprobaciones locales; 62/62 con Auth, Firestore y Storage en proyectos demo. Emuladores cerrados al terminar, sin escrituras productivas.
- Auditorias npm de raiz y Functions: cero vulnerabilidades.
- Compilacion Java 21 y Gradle offline: bundleRelease, assembleRelease y lintRelease correctos. Cero errores de lint; 17 advertencias existentes, sin nuevas supresiones.
- Firma y certificado de subida verificados con bundletool y jarsigner. Los 164 recursos runtime coinciden con www; no hay permisos nuevos ni archivos privados en el paquete.
- Cuatro bibliotecas nativas con segmentos alineados a 16 KB y PAGE_ALIGNMENT_16K. No equivale a QA fisica en un dispositivo con paginas de 16 KB.
- Los paquetes previos congelados, incluido 52, mantienen sus hashes.

La QA web cubrio pantallas de 320 y 390 pixeles, controles tactiles de 44 pixeles, foco, cursor, cambio de etapas, errores de guardado, revision y retorno. Se cotejaron cuatro respuestas extensas en las pruebas de persistencia y una respuesta ficticia de 18129 caracteres en el navegador: texto completo y cursor visible tras cambiar de etapa, consultar ayuda y cerrar Revisar.

El propietario confirmo en el iPhone desde el icono separado Meditacion QA la distribucion del teclado, seleccion consecutiva de versiculos, referencias, preguntas, Aprender, retorno a la respuesta y cierre de Revisar. La ultima simplificacion del icono y el reajuste del cursor con respuestas largas se verificaron posteriormente en navegador. Las pruebas previas de la Lenovo fueron de la web en Chrome por USB, no del nuevo binario 53. No se inspeccionaron meditaciones ni oraciones personales.

## Paquete congelado

`artifacts/android-1.5.21-53-release/su-voz-1.5.21-53.aab`

SHA-256: `99f37e3f5ef854722d4f8ee493ac26eeca88060a964539326ef345d6ceb30f1c`.

Auditoria: `node scripts/audit-android-44.mjs --candidate53`, con Command Line Tools seleccionadas solo para el proceso. Evidencia local: audit-release.json y tests.json en la carpeta de la entrega.

## Publicacion y QA nativa

La web se publica mediante GitHub Pages desde main, raiz. El canal interno de Play conserva exclusivamente Su Voz QA - propietario 2026-10-02, un miembro; las listas de 14 y 29 personas siguen sin seleccionar.

Antes de esta entrega, Play mostraba produccion 52 / 1.5.20 al 100% y ningun cambio ajeno sin publicar. La 53 se cargo una sola vez y se publico unicamente en la prueba interna: release 14, disponible para verificadores el 23 de octubre a las 16:25. La lista sigue limitada al propietario; no se cambiaron paises, declaraciones, permisos ni condiciones.

Play acepto 53 / 1.5.21, API 24+, target 36 y ReTrace adjunto. La vista previa no muestra errores bloqueantes ni perdida de dispositivos compatibles. Persiste una advertencia sobre simbolos nativos de dependencias no suministrados.

Se actualizo la Lenovo directamente con Actualizar en Google Play, sin instalar APK local ni desinstalar o borrar datos. ADB confirmo versionCode 53, versionName 1.5.21 e instalador com.android.vending, lastUpdateTime 2026-10-23 16:28:01 y firstInstallTime 2026-09-24 20:41:57. El enlace oficial /hoy abrio Su Voz y cargo 1 Samuel 31:1-13, versiones y fuentes; evidencia lenovo-public-reading-53.png.

El propietario confirmo en la Lenovo 53 el teclado y cambio de etapas, icono de ayuda, Aprender y retorno, Revisar y cierre con X. Tambien confirmo audio audible, meditaciones anteriores conservadas y Comunidad -> Oracion sin errores. No se abrieron ni capturaron sus meditaciones u oraciones. No se repitio una prueba fisica offline en 53; las comprobaciones offline automatizadas si se ejecutaron.

Con autorizacion especifica del propietario se proceso en memoria solamente el log del proceso 19230 de Su Voz 53. Resultado: cero excepciones fatales, cero errores uncaught y cero unhandled. No se mostro ni guardo el texto del log; solo se conservaron contadores en lenovo-process-errors-53.json. Es una comprobacion acotada al proceso y momento observados, no una garantia de ausencia de errores futuros.

Se preparo la vista previa de produccion con el mismo paquete de la biblioteca, sin otra carga ni compilacion. Tras cerrar la QA, una nueva revision automatica bloqueo el acceso a play.google.com por el alcance del origen completo; el propietario autorizo expresamente ese acceso y se retomo exclusivamente la consola de app.suvoz, sin eludir el bloqueo ni acceder a otras apps.

Se recupero el borrador existente 53, sin duplicarlo. Se verificaron paquete, notas es-419, cero errores bloqueantes, la advertencia conocida de simbolos nativos y cero dispositivos que dejan de ser compatibles. Se mantuvieron 100% y los 178 paises o regiones de destino existentes. Tras Guardar, el resumen contenia exactamente un cambio: Produccion / 53 (1.5.21) / Iniciar lanzamiento completo. Se pulso Enviar 1 cambio a revision y se confirmo Envia cambios a revision, sin aceptar condiciones nuevas ni cambiar declaraciones, permisos o la prueba interna.

A las 20:54 del 23 de octubre (America/Mexico_City), Play mostro Cambios en la etapa de revision con esa unica version. Las verificaciones rapidas previas seguian en curso y la publicacion administrada continuaba desactivada. El envio esta confirmado; no equivale a aprobacion de Google ni a disponibilidad publica de 53. Produccion 52 sigue siendo la ultima version publicada mientras se completa la revision. Evidencia: play-production-53-review.png. [Estado de publicacion](https://play.google.com/console/u/0/developers/5466794951356714708/app/4974496459300724158/publishing).

## Parche de seguridad detectado en CI

El commit de la entrega es `9cb2f4a421b31f690ce92d3a59b8809632cc3d48`; el push normal a main fue correcto. Pages finalizo correctamente, pero Product Validation detecto el aviso [GHSA-27r3-jxmh-p828](https://github.com/advisories/GHSA-27r3-jxmh-p828), incorporado a la base de avisos el 23 de octubre, despues de las primeras auditorias locales sin vulnerabilidades.

Se actualizo exclusivamente el arbol transitivo de body-parser dentro del rango ya permitido: body-parser 2.3.0 a 2.4.0, su content-type 2.0.0 a 2.1.0 y qs 6.16.0 a 6.16.1. Solo cambia functions/package-lock.json; firebase-functions, firebase-admin y la logica de negocio no se modifican. npm audit vuelve a reportar cero vulnerabilidades.

La bateria completa se repitio con la dependencia corregida: 62/62. Una prueba adicional de bucle local uso cargas sinteticas pequenas gzip, deflate y Brotli con bytes sobrantes; el proceso siguio atendiendo solicitudes posteriores. No se enviaron cargas de prueba al servidor real.

El AAB 53 no contiene las dependencias de Functions y conserva su hash. El primer intento de redespliegue fue detenido antes de ejecutarse por requerir autorizacion especifica para ese alcance productivo. El propietario la concedio expresamente y el despliegue posterior termino correctamente: 41/41 funciones existentes actualizadas, todas en us-central1 / gcfv2. Se uso una seleccion explicita functions:<nombre> de las 41 funciones, sin --force ni creacion o eliminacion de funciones. El inventario posterior conserva los mismos nombres, cantidad, region y plataforma; no se cambiaron reglas ni IAM. getRemoteBibleChapter respondio con 401 UNAUTHENTICATED al sobre callable sin credenciales, no con HTTP 500. Una primera comprobacion sin el sobre data fue rechazada correctamente con HTTP 400.

### Parche adicional undici

Una nueva auditoria al cierre detecto tres avisos de undici incorporados a la base de GitHub el mismo 23 de octubre: [EventSource](https://github.com/advisories/GHSA-4qv8-2p9j-2685), [integridad de recursos](https://github.com/advisories/GHSA-f72v-6w45-q472) y [codificaciones excesivas](https://github.com/advisories/GHSA-xjj6-f33q-929c). La dependencia llega exclusivamente mediante cheerio; no forma parte del AAB.

Se actualizo unicamente undici 7.30.0 a 7.30.1 dentro del rango transitivo existente. functions/package.json y la logica permanecen intactos. npm audit de Functions volvio a cero vulnerabilidades. Se repitieron las 62 comprobaciones con los tres emuladores locales: 62/62, cerrados al terminar. Una prueba adicional pequena y exclusivamente en 127.0.0.1 verifico integridad con SHA256 en mayusculas, rechazo de hash incorrecto y de codificaciones excesivas, continuidad de solicitudes y parsing HTML de cheerio; no se enviaron cargas sinteticas a produccion. Evidencia: undici-security.cjs.

El despliegue correcto de body-parser ya descrito precedio a este segundo parche. El propietario autorizo expresamente aplicar tambien undici 7.30.1 a las mismas 41 funciones existentes. Se cotejo el inventario antes de ejecutar firebase deploy con la lista explicita de esos 41 nombres, proyecto su-voz-a-diario-v2-f3a87 y --non-interactive, sin --force. Firebase confirmo 41/41 actualizaciones correctas y Deploy complete. El inventario posterior coincide exactamente en cantidad, nombres, region us-central1 y plataforma gcfv2; no se crearon ni eliminaron funciones ni se cambiaron logica, datos, reglas o permisos.

La consulta publica NBLA en la web se comprobo despues del primer despliegue: Genesis 1 cargo correctamente; evidencia production-nbla-after-functions.png. Tras el segundo despliegue se comprobo Genesis 2 NBLA desde la navegacion de la web y no aparecieron errores de consola en esa comprobacion. El endpoint callable sin credenciales devolvio de nuevo 401 UNAUTHENTICATED, sin HTTP 500. npm audit de Functions reporto cero vulnerabilidades. No se ejecutaron pruebas de carga ni se publico contenido para probar.

## Git, CI y web

El parche body-parser quedo en `922ce4df5ddb129a9feba40e5d3fea9274602d8d`, subido normalmente a origin/main. [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/40033669198) y [Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/40033668893) finalizaron correctamente. Tambien finalizaron correctamente [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/40034762289) y [Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/40034762051) para el informe posterior 231c8f6.

El parche undici se registro en `465ecb69489886968bb7ecc7ba89a2088f56dc7f`, con push normal y HEAD igual a origin/main. [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/40054213658) y [Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/40054213324) terminaron correctamente. npm audit de raiz y Functions reportaron cero vulnerabilidades tras ese parche.

En https://suvoz.app se comprobaron HTTP 200 y coincidencia SHA-256 para sw.js, MeditationDocument.js, DeepeningShell.js, deepening-shell.css y WorkshopController.js. La web sirve PWA 268. Aprender abrio su portada y los registros de consola de esa comprobacion no mostraron errores; no se leyeron ejercicios privados. Evidencia: production-web-268.png.

Los AAB 52 y 53 se cotejaron nuevamente sin cambios. Fuera de esta entrega permanecen marketing/ y los dos documentos previos de investigacion/propuesta sin seguimiento.
