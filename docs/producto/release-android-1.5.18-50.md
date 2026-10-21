# Android 1.5.18: Calendario, Comunidad y oración

Fecha: 21 de octubre de 2026, America/Mexico_City.
Base de la interfaz: `c7dab9f0a9a8859fac8bd4f9c0f80069d29c513f`.
Backend separado: `63138e6156de7511ce5dc7faf685f0657d9bd73f`.

## Alcance

Publicación conjunta del Calendario renovado y Comunidad con seguimiento de peticiones, bandeja interna y avisos genéricos de oración. La implementación, investigación y pruebas se describen en `calendario-lecturas-2026-10-21.md` y `comunidad-oracion-premium-2026-10-21.md`.

Android pasa de 49 / 1.5.17 a 50 / 1.5.18. PWA pasa de 264 a 265; las referencias sincronizadas de la landing cambian únicamente de versión de caché. No se modifican dependencias, permisos, privacy.html, reglas, iOS ni licencias. No se cambian los formatos de meditaciones o respaldos. `marketing/` queda fuera de esta entrega.

## Backend publicado

Dos índices nuevos READY, con los diez existentes preservados. Se crearon `notifyNewPrayerRequest`, `notifyPrayerSupport`, `notifyPrayerAnswered`, `listMyPrayerRequests` y `cleanupDeletedPrayerActivity`; se actualizaron `deliverCommunityBadgeUpdates`, `sendDailyNotification` y `sendTestNotification`. Verificación: ocho cambios previstos, 33 funciones sin cambios, total 41 ACTIVE, Node.js 22.

Se usó una configuración temporal equivalente con rutas absolutas y exclusión adicional de logs. El primer intento se detuvo por una ruta relativa fuera del directorio temporal y otro por la confirmación de reintentos; ninguno publicó funciones. El intento final con `--force` aceptó solo la política de reintentos idempotentes de los disparadores nuevos. No se borraron funciones ni datos y no se alteraron reglas o roles.

No se crearon peticiones, acompañamientos o testimonios en producción para probar. La consulta administrativa de registros push se limitó al propietario: un registro Android habilitado correspondiente a la Lenovo. Los tokens no se registraron en evidencias.

## Candidato congelado

- AAB: `artifacts/android-1.5.18-50-release/su-voz-1.5.18-50.aab`.
- SHA-256: `c3510d8f1afca864ac46b5423499283613dff44d1f477dc73e1a9574650de283`.
- app.suvoz, 50 / 1.5.18, PWA 265, minSdk 24, targetSdk 36.
- Compilación offline Java 21: `bundleRelease assembleRelease lintRelease`, correcta.
- Bundletool valida el paquete; firma y certificado de subida coinciden con los anteriores.
- 157 assets runtime coinciden con `www`; sin archivos privados ni nuevos permisos.
- Cuatro bibliotecas con segmentos de 16 KB y PAGE_ALIGNMENT_16K. Comprobación estática, no QA física de un dispositivo de páginas de 16 KB.
- Lint: cero errores, 19 advertencias. Capacitor 8.5.1 conserva la corrección de GHSA-rvm3-566m-v7fv.
- Auditoría: `node scripts/audit-android-44.mjs --candidate50`; evidencia `artifacts/android-1.5.18-50-release/audit-release.json`.

El paquete 49 conserva SHA-256 `60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4`; no se sobrescribió. No se instaló una APK local encima de la aplicación de Play.

## Verificación previa a publicar

Suite completa anterior al congelado: 59/59, repetida dos veces; ambos `npm audit --audit-level=moderate` sin vulnerabilidades. La nueva ejecución final también terminó 59/59, en puertos aislados porque Docker ocupa 8080; no se detuvo ni modificó Docker. Los emuladores de esta ejecución se cerraron correctamente al terminar.

Inspección de Play: interna 49 disponible y solo la lista Su Voz QA - propietario 2026-10-02 seleccionada, un miembro. Las listas de 14 y 29 personas permanecen desmarcadas. Se solicitó aprobación concreta para cargar únicamente el AAB 50 con el hash anterior, sin promoverlo antes de la QA. El estado de publicación se actualizará después de comprobarlo, no a partir del resultado del compilador.

La Lenovo conectada conserva 49 instalada desde Play y el permiso de notificaciones ya concedido. Falta instalar 50 desde la prueba oficial y comprobar Calendario, Comunidad, listas personales, bandeja, recepción y apertura del aviso controlado. La QA de 49 y las pruebas responsive no se transfieren como QA nativa de 50. Tampoco se acredita todavía la prueba física de estos cambios en iPhone.

La web se publica desde main en GitHub Pages, no mediante Firebase Hosting. El backend quedó disponible antes del push de la interfaz. Los resultados de publicación y las verificaciones HTTP/CI figuran más abajo.

No se promete ausencia absoluta de fallos ni más descargas por el rediseño. Preparar lecturas de 2027, licencias editoriales y certificación VoiceOver/TalkBack siguen siendo asuntos separados, no se declaran cerrados por esta entrega.

## Publicación web verificada

Commit de interfaz y preparación Android: `1d2c7ab23b18675422039946355fdae9400ef171`. Push normal junto con el commit separado de backend; HEAD y origin/main coinciden. Solo `marketing/` permanece untracked; queda fuera de los commits.

[GitHub Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39648036800) y [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39648038261) terminaron correctamente. La validación incluye ambos análisis de vulnerabilidades, la suite completa con emuladores y `git diff --exit-code` después de preparar los assets nativos. Los dos análisis locales finales también informan cero vulnerabilidades.

Producción https://suvoz.app devuelve HTTP 200 y PWA 265. Doce recursos, incluidos módulos y estilos nuevos, app.js, bandeja, worker y privacy.html, coinciden por SHA-256 con las fuentes locales. G-X95Y1G3BE0 y el import de Firebase Analytics permanecen presentes; el módulo remoto devuelve 200. La función privada de listas responde 401 / UNAUTHENTICATED a una consulta sin sesión. Evidencia: `artifacts/community-2026-10-21-release/production-http.json`.

En el navegador productivo con `analytics_test=1` se comprobaron Calendario Mes/Lista, Por leer sin fechas futuras, apertura exacta de 2026-10-01 y regreso a hoy. Inspección móvil de 390 px y escritorio sin desbordamiento horizontal. Comunidad abrió Reflexiones y Oración, las consultas Mis peticiones y Orando y la bandeja con sus controles, sin errores visibles ni errores de consola consultados. No se publicaron textos, reacciones o compromisos ni se marcaron avisos existentes como leídos. No se abrieron notas ni meditaciones privadas. Se conserva la distinción entre revisión responsive y prueba física de iPhone.

El propietario aprobó expresamente cargar y distribuir únicamente el AAB 50 con el hash auditado en su prueba interna exclusiva. Se eligió un único archivo mediante el selector normal de macOS, sin ampliar permisos de la extensión. Play reconoce 50 (1.5.18), API 24+, target 36, con ReTrace adjunto; 49 no se incluye en la nueva release interna.

## Distribución interna confirmada

Play confirma release interna 11, 50 (1.5.18), disponible para verificadores internos, un código de versión, publicada el 21 de octubre a las 12:05 p.m. Se mantiene exclusivamente la lista del propietario de un miembro; las otras listas no se seleccionaron ni modificaron. No se promovió 50 a producción ni se aceptaron condiciones nuevas. Evidencia: `artifacts/android-1.5.18-50-release/play-internal-published.png`.

Validación de Play sin errores bloqueantes ni dispositivos anteriormente compatibles perdidos. Persiste la advertencia de código nativo sin símbolos de depuración; no se ocultó ni se fabricaron símbolos. El paquete congelado conserva el hash aprobado después de la carga.

La ficha oficial de la Lenovo todavía muestra la versión anterior y Abrir durante la propagación inicial; también se comprobó el enlace oficial de prueba con la cuenta ya inscrita. No se borraron cachés, datos ni la app, no se cambió de cuenta y no se instaló una APK local. La QA nativa 50 no se declara terminada mientras no esté instalada desde Play.

Durante la espera se comprobó la web productiva en Chrome de la Lenovo: Calendario cargó sus 31 lecturas de octubre, cambió a Lista y abrió exactamente 2026-10-01 / 1 Samuel 17:50-18:5. Comunidad abrió sus controles de Reflexiones y Oración. Esa evidencia es web física, no nativa. La revisión automática bloqueó abrir Mis peticiones por posible exposición de oraciones personales; la apertura no se ejecutó ni se eludió. Se solicitó al propietario comprobarlo personalmente o autorizar exclusivamente una revisión de controles y errores sin leer ni capturar textos.

La prueba push física del nuevo destino sigue pendiente de instalar 50. Se preparó una comprobación privada al único registro habilitado del propietario, con guardas para exigir versión 50 instalada por Play, no repetir automáticamente el envío y no escribir datos de Comunidad. Todavía no se ha enviado ese aviso. No se transfieren pruebas anteriores como evidencia de entrega actual.

## Instalación y QA nativa posterior

La propagación terminó y Play mostró Actualizar con las notas de esta release. Se actualizó exclusivamente Su Voz, sin desinstalar, borrar datos, cambiar cuentas ni instalar una APK local. A las 12:20:20, Android confirmó versionCode 50, versionName 1.5.18, instalador e iniciador com.android.vending y firstInstallTime original 2026-09-24 20:41:57. El permiso POST_NOTIFICATIONS sigue concedido; no se modificaron permisos ni volumen.

En la Lenovo TB351FU, dentro del binario 50, se comprobaron el inicio con 1 Samuel 30:1-17, Calendario con 31 lecturas de octubre, vistas Mes y Lista y apertura exacta de 2026-10-01 / 1 Samuel 17:50-18:5. La captura del calendario confirma el tema oscuro, controles completos y detalle del día sin superposición en la pantalla observada. Comunidad conserva Reflexiones, Oración, los filtros y el acceso de Moderación del propietario. La preferencia de avisos ya estaba activada y no se cambió. Evidencias en `artifacts/android-1.5.18-50-release/lenovo-qa/`.

No se abrieron meditaciones, notas, listas personales ni acciones destructivas. La apertura de Mis peticiones sigue sujeta a la comprobación personal o autorización específica solicitada tras el bloqueo de revisión automática. No se presenta la presencia de ese botón como prueba de su consulta nativa; las consultas ya cuentan con pruebas de emulador y de navegador descritas anteriormente.

Se reprodujeron unos segundos de la lectura de hoy; Android mostró Pausar y Detener, y al detener se restableció Escuchar lectura. Eso prueba los controles y la respuesta del motor, no la audición humana: se solicitó al propietario confirmar el sonido de esta versión y la conservación de sus meditaciones, sin que el agente las lea.

La inspección del proceso actual de app.suvoz no encontró FATAL EXCEPTION, AndroidRuntime fatal, Uncaught, Unhandled ni errores de recursos ERR_FILE_NOT_FOUND / FAILED / NAME_NOT_RESOLVED / CONNECTION_REFUSED. Se guardaron solo contadores, no registros crudos ni logs de otras apps: `lenovo-qa/process-errors.json`.

## Aviso físico al propietario

Se realizó una única prueba privada el 21 de octubre a las 18:24 UTC, exclusivamente al registro Android habilitado de la cuenta verificada del propietario y correspondiente a la Lenovo. Se exigió 50 instalada por Play antes del envío. Se utilizó el código real de `sendNotification` con transporte FCM real, consultando la guarda de eliminación mediante REST; no se suplantó una sesión de usuario ni se creó un endpoint de prueba.

El mensaje dice explícitamente Su Voz: prueba privada y Prueba de avisos de oración del propietario. Toca para abrir Oración. Destino: `https://suvoz.app/#community?section=prayer`. No incluye una petición ficticia ni datos de otra persona. No se modificaron preferencias, contadores, notificaciones Firestore, peticiones, compromisos o testimonios, ni se borraron registros push.

FCM confirmó un destinatario, un envío aceptado y cero fallos. Android mostró exactamente un aviso con el tag exclusivo `suvoz-owner-prayer-qa50`. Se abrió desde el sistema, después de volver a Inicio, enviar la app a segundo plano y cerrar solo su proceso con am kill, sin force-stop. Tras el arranque, app.suvoz mostró Oración, Peticiones y la preferencia de avisos activada; el aviso de prueba quedó consumido, cero avisos de ese tag. Solo se inspeccionaron el título y texto conocidos de la prueba, no notificaciones de otras apps. Evidencia sin tokens: `artifacts/community-2026-10-21-release/owner-push-attempt.json`.

Esta evidencia confirma transporte y apertura nativa del destino de Oración. La creación, deduplicación, destinatarios y entrega por cola de una petición real se probaron con emuladores y dobles de transporte, no provocando publicaciones de prueba en producción. No se afirma una prueba productiva completa del fanout a otros usuarios ni entrega FCM exactamente una vez.

## Estado de distribución

La web 265 y el backend están publicados; Android 50 está solo en la prueba interna exclusiva, no en producción. El propietario confirmó iPhone, sonido, conservación de meditaciones y apertura de Mis peticiones. La prueba offline de 50 también pasó, como se detalla abajo. El agente no abrió la lista personal de peticiones.

El AAB 50 conserva SHA-256 `c3510d8f1afca864ac46b5423499283613dff44d1f477dc73e1a9574650de283` y el AAB 49 conserva su hash anterior. No hubo recompilación posterior al congelado. El commit de evidencias web/interna `e8d5fb2e18e727dc87af7533948a4d142b0bce72` también pasó [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39651106284) y [Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39651108222).

## Confirmaciones y offline de 50

El 21 de octubre el propietario confirmó que Calendario, Oración y Actividad funcionan en el iPhone, abierto desde el icono de Su Voz. Confirmó también audio claro y conservación de sus meditaciones en la Lenovo 1.5.18 (50). El agente no abrió ni leyó esas meditaciones. Estas respuestas sustituyen los pendientes respectivos, no se extrapolan a otros dispositivos o versiones de iOS.

Con autorización expresa se ejecutó una sola prueba offline el 21 de octubre, entre las 14:02:05 y las 14:02:19 de Ciudad de México. El preflight exigió 50 / 1.5.18 instalada por Play, lectura de hoy cargada y conexión activa. Se apagó únicamente Wi-Fi; Android confirmó wifi_on=0 y Active default network: none. Se cerró exclusivamente Su Voz con force-stop y se reabrió MainActivity: cargó la lectura 2026-10-21 / 1 Samuel 30:1-17 con texto real sin red. Desde esa lectura se abrió Calendario, que mostró las 31 lecturas de octubre y el pasaje seleccionado, sin error de historial.

El bloque finally restableció inmediatamente Wi-Fi y esperó la conexión: wifi_on=1 y red predeterminada activa. Una comprobación independiente volvió a confirmar ambos estados. No se tocaron datos móviles, cuentas, permisos ni notas y no se abrieron listas personales. El resultado pertenece expresamente al binario 50, no a 49, Chrome o una PWA. No acredita disponibilidad offline de Biblias remotas ni operaciones de Comunidad que requieran red.

Evidencia: `artifacts/android-1.5.18-50-release/lenovo-qa/offline-result.json`, `native-daily-reading-offline.png` y `native-calendar-offline.png`. El registro impide repetir automáticamente esta única prueba aprobada. La última confirmación personal queda registrada en el cierre siguiente; estas respuestas no autorizan promover Android a producción.

## Cierre de QA

El 21 de octubre el propietario confirmó expresamente en la Lenovo 1.5.18 (50): «Sí, Mis peticiones abre sin error». Es una comprobación personal del propietario; el agente no abrió, leyó ni capturó los textos de esa lista. El resultado se registró también en `artifacts/android-1.5.18-50-release/lenovo-qa/owner-confirmations.json`.

Con esta respuesta se completa el plan de QA descrito para esta release, sin incidencias bloqueantes detectadas en el alcance comprobado. Esto no equivale a garantizar ausencia de errores ni sustituye licencias de contenido, una prueba física en dispositivos de páginas de memoria de 16 KB, una auditoría completa de accesibilidad o la prueba productiva de distribución de avisos a otros usuarios.

La web 265 y el backend permanecen publicados; Android 50 permanece exclusivamente en pruebas internas. Este cierre solo actualiza evidencias, sin cambios de aplicación, recompilación ni promoción a producción.
