# Estabilizacion y Operacion de Su Voz a Diario

Fecha inicial: 1 de octubre de 2026. Actualizacion local: 2 de octubre de 2026. Estado: backend y web/PWA 256 publicados; Android 1.5.9 (41) disponible solo en pruebas internas para el propietario, instalado oficialmente desde Play y con arranque confirmado. El propietario aprobo las cuatro pruebas manuales acotadas de la Lenovo; no equivale al recorrido completo de aceptacion. Produccion Android permanece 1.5.8 (40). Las dependencias operativas indicadas abajo siguen pendientes. El rechazo Git 403 se resolvio con acceso exclusivo para el repositorio de Su Voz, guardado personalmente por el propietario en el Llavero.

## Baseline y Alcance

HEAD inicial: `2e4a136b163d8c6b7e282ffa61c332580d35f78d`, main sincronizada con origin/main. No habia cambios tracked. `marketing/` era untracked y no se modifico.

Alcance inicial de estabilizacion: PWA 255 -> 256 para invalidar el cache anterior y alinear Analytics. Android: candidato 1.5.9 (41), entonces sin subir a Google Play; AAB 1.5.8 (40) preservado. iOS conserva su version/build. Se actualizo privacy.html para la vinculacion opcional y los reportes privados, sin trackers. Se publicaron las Functions y reglas de Firestore/Storage, con respaldo previo. El push no forzado de los dos commits de estabilizacion publico la web desde af971a793072c93a977acf1fcaeebe10f28bce6a. En esa etapa no se asignaron permisos reales de moderador ni se ejecutaron limpiezas historicas. La limpieza autorizada y la publicacion interna posteriores constan en el cierre operativo.

## Hallazgos de la Auditoria

| Hallazgo | Tratamiento local | Limite o paso pendiente |
| --- | --- | --- |
| F1 Offline | Fallback consulta cache dinamico y precache estatico; dos modulos faltantes incluidos como obligatorios. Lectura previamente cargada en modo avion aprobada por el propietario en la Lenovo. | Una primera visita sin red no puede instalar recursos remotos. Otros dispositivos y contenido no precargado no quedan certificados. |
| F2 Reacciones duplicadas | ID canonico por publicacion/usuario, esquema cerrado, timestamp servidor, autor y padre validos; reglas publicadas. | Inventario no encontro IDs no canonicos. Las 888 reacciones sin padre se retiraron dentro de la limpieza de 1007 documentos autorizada; ausencia verificada. |
| F3 Denunciar y bloquear | Backend publicado: callables privados, reportes deduplicados, bloqueo por autor incluso anonimo, terminos explicitos, cola restringida y ocultacion reversible. Moderador unico asignado con aprobacion concreta; pin/claim verificados. El propietario comprobo Pendientes, Revisadas y Solicitudes de cuenta en la Lenovo, sin error. | Clientes anteriores no aplican el filtro nuevo. La operacion de eliminacion integral sigue siendo un proceso distinto de moderar. |
| F4 Respaldo roto | Ambos botones invocan exportAllData; descarga web y archivo/Share nativo; cancelacion sin falso exito. El propietario aprobo apertura y cancelacion de ambos selectores en la Lenovo. | No se compartio el respaldo ni se restauro sobre notas reales. Descarga real en Chrome e iPhone pendientes; exportacion/restauracion del contenido verificadas automaticamente. |
| F5 Avance involuntario | Un precargado por direccion, renovado por gesto; maximo automatico de ocho capitulos; anclaje al insertar. | Los botones manuales pueden ampliar la ventana intencionalmente. |
| F6 Huerfanos | Trabajo durable captura propietario/audio antes de borrar padre; lotes de respuestas/privados/reacciones/notificaciones; reanudacion tras fallo. Limpieza historica autorizada: 1007 documentos retirados y ausencia verificada. | Audio de URL no confiable se omite para no borrar otro recurso. No se eliminaron audios, cuentas ni publicaciones existentes mediante la limpieza historica. |
| F7 Anonimato y actividad | Identidad resuelta en backend privado; autor excluido del fan-out y de sus propias notificaciones. | Bloqueo no devuelve UID de autores anonimos. |
| F8 Reintentos y carreras | Ledger transaccional por evento, cursor atomico paginado, outbox de badge y metrica compartida por ambos triggers; continuidad de racha legacy. | FCM no garantiza exactamente una entrega: badge absoluto/tag reduce efectos repetidos. |
| F9 Corrupcion/cuota | Indice reconstruido desde registros; rollback parcial; borrador pendiente en memoria; error visible/reintento; respaldo incluye pendientes. | Cerrar proceso puede perder un borrador no persistido. Exportar antes y liberar espacio. |
| F10 Identidad y respaldo | Vinculacion opcional email/password conserva UID, verificacion, recuperacion explicita y solicitud privada de eliminacion; sin credenciales en respaldos. Auth habilitado conservando acceso anonimo, proteccion de enumeracion y minimo de ocho caracteres. Vinculacion/verificacion del propietario confirmadas. | Recuperacion entre dispositivos fisicos pendiente. Recuperar otra identidad no fusiona cuentas ni sincroniza notas; la eliminacion requiere tramitacion operativa. |
| F11 Dependencias | Locks actualizados sin audit fix --force; overrides acotados; Capacitor iOS alineado con core/Android. | Revisar futuras actualizaciones con CI/builds. Audit no garantiza inmunidad futura. |
| F12 Version Analytics | Landing/app/service worker y copias publicas comparten PWA 256; sync incluye landing. SDK y recepcion de ocho tipos de evento confirmados en DebugView el 2 de octubre. | Realtime no revisado por separado. La prueba web no certifica Analytics nativo ni entrega de notificaciones. |

## Otras Correcciones y Limites

Notificaciones: marcar leidas persiste antes de mutar estado; cliente no crea notificaciones ni escribe metricas de servidor. Listener legacy sigue desactivado; no se reactivo una segunda via de push.

Audio grabado legacy: API modular de Storage y metadata ownerUid; borrado compatible con metadata uid anterior. No se activo una funcionalidad nueva de grabacion.

Android: WRITE_EXTERNAL_STORAGE limitado a API 28, coherente con guardado legacy; READ mantiene limite 32. RECORD_AUDIO conservado para la ruta existente. iOS incorpora descripcion de microfono. Permisos efectivos requieren prueba fisica.

Coste: limites por UID para publicaciones/respuestas/oracion/denuncias/bloqueo/Biblia; fan-out paginado a 100 y maxInstances 10 en callables nuevos y triggers con reintentos. Sigue siendo O(numero de usuarios) por publicacion y las identidades anonimas pueden recrearse. No afirmar proteccion completa contra abuso sin App Check y observacion de consumo. App Check web no tiene proveedor configurado; no se activo enforcement que bloquearia a clientes existentes.

Mantenimiento: runner unico, pruebas adversariales y workflow CI; sintaxis de todo el JavaScript fuente. No se reescribio app.js ni el CSS general para limitar regresiones.

QA final encontro y corrigio dos fallos de integracion: los modulos de Comunidad usaban window.app, pero la aplicacion expone window.App; y la primera ruta directa a Comunidad se dibujaba antes de inicializar moderacion. Ahora se inicializa antes de cargar la primera ruta y no se reemplaza despues de consultar filtros. Prueba de regresion con el global real, sin alias que oculte el fallo. No se reactivo el listener legacy de notificaciones.

## Moderador Unico

Responsable declarado: propietario de Su Voz. La interfaz publica no muestra su nombre ni correo. Se exige custom claim `moderator: true` Y UID fijado en `communityConfiguration/moderation`. El 2 de octubre el propietario autorizo concretamente asignar su cuenta verificada como unico moderador; configuracion y claim verificados despues de apply. No se otorgo acceso a otras cuentas ni IAM de consola por este procedimiento.

```sh
node functions/configureModerator.js --project=PROYECTO_CONFIRMADO --expected-email=CORREO_CONFIRMADO
```

Dry-run por defecto. Rechaza cuenta deshabilitada, correo diferente/no verificado y reemplazo de otro moderador sin confirmacion especifica. `--apply` cambia acceso de seguridad: usar solo despues de verificar identidad y autorizar asignacion. No guardar UID/correo reales en Git. Renovar el token antes de comprobar el panel.

Puede usar ADC o la sesion existente de Firebase CLI mediante --firebase-cli-auth-module=RUTA_LOCAL_CONFIRMADA_A_FIREBASE_TOOLS_LIB_AUTH_JS. No imprime ni guarda credenciales. Tras dry-run correcto, autorizacion concreta y apply, se comprobo que el pin y el claim corresponden a la misma cuenta. El propietario confirmo que las tres pestanas del panel abren correctamente en la Lenovo tras actualizar el token. No se crearon denuncias ni contenido real para probar. La app inicia con Firebase Anonymous Auth. No inferir identidad administrativa del feed ni otorgar permisos a una identidad anonima arbitraria.

## Recuperacion de Identidad

No exportar refresh tokens, ID tokens ni claves Firebase. Ajustes permite vincular la cuenta anonima activa con correo/contraseña, preservando el mismo UID. Si el correo pertenece a otro UID se rechaza la vinculacion, sin fusionar cuentas. Recuperacion requiere confirmar el cambio; errores de acceso conservan la sesion. Antes del cambio se retira solo el registro push propio; despues se registra de nuevo para la identidad activa, incluso si fallo el acceso. Las respuestas asíncronas de propiedad de una sesion anterior se descartan.

Probado con Firebase Auth Emulator: UID identico tras vincular, codigo de verificacion, conflicto sin cambio, contraseña incorrecta sin sign-out y recuperacion desde una segunda instancia. Pruebas de servicio: errores parciales/reintento, consentimiento, reautenticacion, bloqueo de operaciones simultaneas y limpieza de estado privado. Falta la prueba personal entre dispositivos fisicos. No se crearon cuentas reales ni contraseñas por cuenta del propietario.

Solicitudes de eliminacion: requieren sesion propia, confirmacion y reautenticacion reciente en cuentas vinculadas. Se deduplican y permanecen privadas. El moderador ve referencias y correo verificado, nunca UIDs anonimos. Tramitar desde operacion privada con prueba de titularidad, alcance documentado, respaldo y retirada de datos asociados; no marcar atendida solo por recibirla. Pagina externa: /eliminar-cuenta.html. La declaracion de Data Safety debe reflejar el correo opcional y este enlace antes de publicar la nueva release en Play.

Referencia oficial: https://firebase.google.com/docs/auth/web/account-linking

## Publicacion Controlada

1. Revisar diff/evidencia y guardar export/backup de Firestore/Storage antes de operaciones historicas.
2. Confirmar proyecto/destino; publicar nuevas Functions antes de su interfaz. Coordinar reglas de Firestore/Storage con el retiro de escrituras antiguas del cliente. No ejecutar deploy generico a ciegas.
3. Publicar web/PWA mediante GitHub Pages, confirmado por API: legacy, rama main, carpeta raiz, dominio suvoz.app. firebase.json no incluye Hosting. Push no forzado publica la web; comprobar PWA 256, precache y configuracion Analytics servidos.
4. Probar lectura, Profundizar, guardar/reabrir/exportar/restaurar, navegar, NVI/lector continuo, audio y enlaces. Datos ficticios en emulador/staging para denuncias/decisiones; no crear contenido real para QA.
5. Configurar unico moderador con cuenta verificada confirmada. Probar rechazo de no moderadores y ocultar/restaurar contenido de prueba.
6. Preparar release Android separada con versionCode nuevo, sync y auditoria del AAB nuevo. El AAB 40 existente NO contiene estas correcciones.
7. Configurar proveedores App Check compatibles con todos los clientes, observar metricas y luego considerar `COMMUNITY_ENFORCE_APP_CHECK=true`. Aplica a handlers que llaman requireUser, no a todo Firebase. `COMMUNITY_REQUIRE_TERMS=true` solo tras transicion de clientes legacy.
8. Confirmar eventos Analytics en DebugView/Realtime sin debug permanente. Observar errores, consumo y trabajos de borrado pendientes.

Ocultar por moderacion retira contenido de la UI actual y bloquea nuevas respuestas/reacciones, pero no convierte documentos publicos en privados ni garantiza retirada en clientes anteriores. Una retirada legal/inmediata necesita evaluacion separada.

Rollback: restaurar fuentes mediante commit reversible, sin reset destructivo ni eliminar ledgers. Mantener Functions nuevas mientras haya clientes que las llamen. Borrados requieren backup; ocultacion del moderador si es reversible.

Referencias oficiales: https://firebase.google.com/docs/auth/admin/custom-claims ; https://firebase.google.com/docs/app-check/cloud-functions ; https://firebase.google.com/docs/functions/firestore-events

## Validacion Local

- Suite integrada: 45 comprobaciones con reglas/concurrencia y Auth en emulador; ultima ejecucion completa 45/45. Incluye inicializacion de moderacion antes de la primera ruta, persistencia de su instancia, limpieza historica con alcance fijo e inventario de eliminacion de cuenta sin escrituras. Storage se prueba con metadata ficticia explicita, no con archivos reales ni un emulador GCS.
- Casos nuevos: duplicados, timestamps, acceso privado, moderador unico, bloqueo anonimo, limites/terminos/App Check, fan-out concurrente/reintentos, 520 respuestas en cascada, trabajo interrumpido, respaldo/restore con cuota y borradores, offline y lector continuo.
- Android Debug/unit tests/lint y build de simulador iOS sin firma: correctos; no son certificacion en dispositivo/tienda. Lint de la app: cero errores y 19 advertencias de versiones/iconos/recursos heredados; Gradle tambien avisa de flatDir, deprecaciones y formatos SDK XML. No se ocultaron mediante nuevos suppressions.
- npm audit raiz/Functions: cero vulnerabilidades reportadas durante el trabajo.
- QA local: lectura diaria, abrir/cerrar Profundizar, Salmos 66/NVI, cambio de version y recarga con capitulo estable; sin overflow horizontal a 390 px. Tras publicar el backend, Autores bloqueados consulta el callable real y abre correctamente. La primera carga directa muestra Denunciar/Bloquear autor; denuncia abre y cancelar cierra, sin enviar reportes ni crear contenido real. Respaldo llega al aviso; navegador integrado no permite certificar descarga completa.
- git diff --check correcto. Backend probado sin tokens reales de push.
- Git 403 resuelto: el token anterior solo tenia acceso a otro proyecto. El propietario genero y guardo un token exclusivo para Su Voz, con Contents/Workflows de escritura y vencimiento el 1 de noviembre. No se reemplazo el acceso del otro proyecto ni se guardaron secretos en fuentes, archivos de respaldo o informes.
- Primera ejecucion real de CI: 39/41. Faltaban los recursos nativos generados en el checkout limpio y una prueba de migracion heredaba el proyecto demo de Firebase CLI, distinto del proyecto de sus fixtures. Se reproduce el fallo en emuladores y se corrige preparando recursos con cap copy y fijando el proyecto de los procesos hijos de la prueba. No se omiten comprobaciones ni se cambia el migrador de produccion. Suite completa posterior bajo emulators:exec: 41/41; los logs de esta ejecucion se generan fuera del repositorio. La nueva ejecucion de GitHub verifica estas correcciones despues del push.

## Produccion e Inventario

Respaldo Firestore en el bucket del mismo proyecto: export gestionado completo SUCCESSFUL, 3196 documentos; referencia de operacion privada en artifacts/validation/production-backup-operation.json. Un export no es una instantanea transaccional de escrituras concurrentes; no demuestra restauracion real. Referencia: https://firebase.google.com/docs/firestore/manage-data/export-import

Inventario inicial de solo lectura: 243 posts, 71 replies, 1981 reacciones, 612 userActivity y 19 registros push. Huerfanos: 49 replies, 21 documentos communityPostPrivate y 888 reacciones; cero privados de reply huerfanos y cero IDs no canonicos de reaccion. Dos posts superan 90 dias, sujetos a la retencion diaria preexistente. Hasta ese inventario no se habian ejecutado migraciones ni borrados historicos; la ejecucion autorizada posterior consta abajo.

Plan privado posterior: artifacts/validation/production-orphan-cleanup-plan.json, fuera de Git y con permisos 0600. Incluye 49 respuestas, sus 49 privados, 21 privados de posts inexistentes y 888 reacciones: 1007 documentos. SHA-256 d20d6003b7f4eaa35bb60527849ab8931c7997921a41c7d2bcdc4a749c978dd0. El propietario autorizo expresamente ese alcance el 2 de octubre. Tras dry-run real de 1007 candidatos y 43/43 pruebas, se ejecutaron transacciones con lectura del padre ausente, updateTime exacto y pares publicos/privados atomicos. Resultado: 1007 eliminados, cero omitidos; lectura posterior de los 1007 nombres: cero restantes. Bitacora privada y verificacion en artifacts/validation/orphan-cleanup-apply-2026-10-02.jsonl y orphan-cleanup-verification-2026-10-02.json. Ningun write de esta herramienta apunta a communityPosts, cuentas o Storage. La retencion programada, por separado, registro tres publicaciones retiradas a las 06:00 UTC; no comparar inventarios de distinta hora como si no hubiera escrituras concurrentes.

Backend: 36 Functions ACTIVE, runtime nodejs22, sin eliminar nombres anteriores. Despliegue con filtro explicito por nombre; --force solo confirmo failurePolicy/reintentos idempotentes. Firestore y Storage compilados y publicados. Firebase CLI aviso de una version mas nueva de firebase-functions; npm audit no reporta vulnerabilidades en la instalada.

Publicacion del 2 de octubre: Pages build and deployment finalizo correctamente para af971a793072c93a977acf1fcaeebe10f28bce6a. suvoz.app, sw.js y /eliminar-cuenta.html devuelven 200; PWA 256 y measurementId G-X95Y1G3BE0 presentes. Diez archivos criticos coinciden byte a byte con las fuentes locales, incluidos privacy.html, la pagina de eliminacion, recuperacion de cuenta y moderacion.

QA web posterior: lectura diaria, abrir/cerrar Profundizar, iniciar/detener los controles de lectura en voz alta, Genesis 1/RV1909, Calendario y Mi camino cargan. El SDK Analytics inicializa y registra dispatch sin advertencias/errores en la consola revisada. Debug usado unicamente mediante el parametro temporal y retirado al volver a la URL normal; no se escribe la preferencia persistente. No se afirma recepcion en DebugView/Realtime ni prueba auditiva en dispositivos fisicos. Ajustes muestra Cuenta y recuperacion; se solicito al propietario vincular/verificar personalmente su correo antes de asignar moderacion.

GitHub avisa que el repositorio se traslado a codigonexomx/su-voz-a-diario. El origin anterior sigue redirigiendo y acepto el push normal; no se cambio el remoto ni se ampliaron permisos para eludir el bloqueo.

## Pendientes que No Deben Ocultarse

- Moderador unico operativo y panel comprobado por el propietario. Completar ejecucion integral de eliminacion de cuenta: inventario ya probado, no equivale a un ejecutor de borrado.
- Completar QA en dispositivos; recepcion web en DebugView ya confirmada. Git 403 y publicacion web ya resueltos; backend y Auth publicados. No desviar Hosting ni forzar push.
- Catalogo editorial aprobado para 2027; guard de cobertura ya avisa/bloquea faltantes cercanos.
- Limpieza historica de 1007 documentos autorizada, aplicada y verificada. Definir retencion de reportes/ledgers/outbox antes de borrar trazabilidad. Los ledgers evitan replays duplicados y no se eliminan a ciegas.
- App Check y pruebas fisicas Android/iOS: permisos, modo avion, descarga/Share y actualizacion sin perdida.
- Licencias escritas/condiciones por traduccion. Atribucion o acceso API no concede derechos. Revisados los hilos de seguimiento a Logos y a SBU/ABS enviados el 1 de octubre: no contienen respuesta al momento de consulta. No se duplicaron solicitudes enviadas hace pocas horas ni se aceptaron contratos.

## Artefacto Android Preservado

`artifacts/android-1.5.8-40/su-voz-1.5.8-40.aab`

SHA-256: `238b4ea901225db3e192bf59c5d2282dade27bf0c35daec070d4966f3859354a`.

Contiene PWA 254 y no es candidato para publicar esta estabilizacion.

## Candidato Android Nuevo

artifacts/android-1.5.9-41/su-voz-1.5.9-41.aab. VersionName 1.5.9, versionCode 41, PWA 256. El SHA-256 vigente y resultados de auditoria se guardan fuera de Git en artifacts/android-1.5.9-41/audit-release.json despues de reconstruir desde el HEAD final.

Bundletool valida el paquete y jarsigner verifica la firma; certificado de subida identico al AAB anterior. Los 124 recursos de ejecucion de www coinciden byte a byte con el paquete, normalizando nombres Unicode para comparar rutas. .nojekyll y .well-known son metadata web excluida por el empaquetado Android, no recursos de ejecucion faltantes. No se incluyen logs, marketing, node_modules, Functions, artefactos ni keystores.

Jarsigner avisa de certificado autofirmado, ausencia de timestamp y diferencias de lectura JarFile/JarInputStream por el orden del manifiesto. La ultima advertencia tambien aparece en el AAB anterior; no se oculta ni se atribuye a los cambios funcionales. Bundletool no rechazo el paquete. Al construirlo no se habia subido a tienda; la aceptacion posterior como borrador consta abajo. La validacion fisica no queda certificada por el empaquetado.

## Cierre Operativo del 2 de Octubre

CI del commit 1083bf1: Product Validation y Pages correctos. Runs: https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37059663839 y https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37059663193.

DebugView de la propiedad conectada a Firebase recibio page_view, analytics_validation, app_open, reading_view, daily_question_view, deepen_open, reading_start y audio_start. Prueba mediante query temporal; regreso a https://suvoz.app/ sin debug, audio detenido y sin publicar contenido. Cero warnings/errors en la consola revisada. Evidencia local fuera de Git: /tmp/suvoz-debugview-recepcion-2026-10-02.jpg. No se afirma prueba auditiva fisica ni recepcion nativa Android.

App Check: recorrido inicial de consola completado, sin registrar proveedor ni activar enforcement. Storage, Firestore y Auth muestran No se aplica. Web/Android siguen Sin registrar. reCAPTCHA Classic aparece obsoleto y deshabilitado; el proveedor web debe prepararse con Google Cloud Fraud Defense, comprobando cuota, coste y condiciones antes de registro. No se creo una clave, no se acepto un plan de pago y no se modifico la variable de enforcement del backend.

Google Play consultado en modo lectura: produccion 1.5.8 (40), 100%, desde el 25 de septiembre; sin cambios no publicados en el panel antes de esta gestion. Declaracion de datos del 8 de septiembre: no creacion de cuentas, no solicitud de eliminacion, correo no seleccionado. Nombre/UID, interacciones, contenido de usuarios e IDs ya declarados. Preparar correo opcional, metodo email/password y URL https://suvoz.app/eliminar-cuenta.html antes de publicar 41. No afirmar que la declaracion vigente ya refleja la nueva recuperacion de cuenta. Ver procedimiento separado de operacion.

Android conectado para QA: tableta Lenovo con Android 16 y Su Voz 1.5.8 (40) instalada por Play. Firma de Play coincide con assetlinks.json y el sistema muestra dominio verified, pero la preferencia del dispositivo deshabilita su apertura en la app. No se cambio esa preferencia. La APK local usa otra firma: no desinstalar ni forzar sustitucion, que perderia datos. El propietario autorizo subir exclusivamente el AAB 41 existente a borrador interno, sin produccion, recompilacion ni nuevas condiciones. Google Play acepto 41 (1.5.9) y mostro Se guardaron los cambios; el explorador confirma Borrador, artefacto 4860236552466626415. No se publico a verificadores ni a produccion. Evidencia fuera de Git: /tmp/suvoz-play-borrador-1.5.9-41-2026-10-02.jpg.

APK universal descargada desde ese artefacto de Play, sin publicarlo ni recompilar: artifacts/android-1.5.9-41/su-voz-1.5.9-41-play-universal.apk. SHA-256 29a10f1ac816795d1f57abae72cc9ecfe3bec9de0c069ca544c459c431e67b5e. Firma v2/v3 y SourceStamp validos; certificado 7b012399470f581edb98cb7062fe3babb634c468886a43411f0b36c699ccf40f, identico al instalado. Paquete app.suvoz, versionCode 41, versionName 1.5.9, recursos PWA 256. Actualizacion de la tableta autorizada por separado; no inferir de la firma o el comando que QA ni preservacion funcional de datos ya esten completadas.

Actualizacion fisica: adb install -r de esa APK termino Success. Consulta posterior: 41/1.5.9, mismo appId, directorio de datos, inodes CE/DE y firstInstallTime que antes; no desinstalacion ni clear data. Microfono y notificaciones continuan sin concederse. Play Protect solicito enviar la app para analizarla: el propietario aprobo Enviar esta vez y completo personalmente el aviso. No se activo envio permanente ni se omitio la proteccion. La conservacion del directorio no certifica por si sola la integridad de cada meditacion; lectura, Profundizar, audio audible y datos previos se solicitaron al propietario para QA manual. Actualizar este registro solo con resultados confirmados.

Incidencia posterior confirmada por el propietario: la proteccion de origen de Play impidio abrir la APK instalada por USB aunque su firma era correcta. installerPackageName=null e initiatingPackageName=com.android.shell. No se desinstalo ni se falseo origen ni se desactivo proteccion. Con aprobacion especifica posterior, el mismo AAB 41 se publico en pruebas internas a las 15:34 del 2 de octubre, limitado a una lista exclusiva de un miembro; las listas anteriores de 14 y 29 personas quedaron sin seleccionar. Play confirma Disponible para verificadores internos y produccion permanece 40/1.5.8. La cuenta ya participa en el programa. Recuperacion oficial completada a las 15:40:16: Play sustituyo 41 por su distribucion oficial 41, conservando appId, directorio, inodes CE/DE y fecha de primera instalacion; el propietario confirma arranque normal. Instalador e iniciador nuevamente com.android.vending. Revision del proceso actual: cero errores JS criticos/fatales nativos detectados, sin certificar historico ni todo el recorrido. QA funcional solicitada sigue pendiente de resultados. Procedimiento e incidencia detallados en operacion-y-publicacion-2026-10-02.md.

Commit operativo 16c8523: limpieza acotada, dos pruebas nuevas y registro operativo; sin modificar runtime ni PWA. Push correcto, HEAD y origin/main coincidentes. Product Validation y Pages correctos: https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37066701669 y https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37066700903. HTTP posterior: index.html, sw.js, privacy.html y AnalyticsService.js con 200 y contenido identico al local; PWA 256.

No hay solicitudes de eliminacion ni denuncias en el inventario consultado. Consulta posterior mediante la herramienta de solo lectura: cero solicitudes pendientes. Moderador unico asignado y panel confirmado por el propietario. Enero de 2027 no tiene lecturas; se solicito fuente aprobada. Ninguna traduccion obtiene licencia por estas comprobaciones.

QA manual posterior confirmada por el propietario: las cuatro pruebas solicitadas pasaron en la Lenovo con instalacion oficial 41. Alcance: lectura diaria, Profundizar y audio audible; meditaciones anteriores conservadas; selectores de compartir de los dos respaldos abiertos y cancelados sin envio; lectura previamente cargada disponible en modo avion y conectividad restablecida. Es un resultado comunicado por el propietario, no observacion automatizada del contenido de sus notas. No certifica importacion sobre datos reales, App Links, permisos de notificaciones/microfono, recuperacion entre dispositivos ni QA de iPhone. Moderacion asignada con autorizacion concreta: pin y claim comprobados y tres pestanas del panel aprobadas por el propietario. Analytics: cuatro preferencias promocionales guardadas desactivadas con aprobacion; geolocalizacion granular activa, Signals inactivo y sin vinculos Google Ads. Se inspeccionaron los AAB originales de Alpha 14 y prueba abierta 15, sin cambiar canales ni instalar sus paquetes. Datos compartidos por contenido integrado y declaracion final de Play siguen en revision; detalle en operacion-y-publicacion-2026-10-02.md.
