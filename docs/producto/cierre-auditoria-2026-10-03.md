# Auditoria: Seguimiento de Cierre

Fecha: 3 de octubre de 2026. Estado parcial acreditado, no auditoria cerrada ni autorizacion para produccion. Este documento separa hechos comprobados, propuestas no aplicadas y decisiones externas. No contiene identidades privadas, contenido de usuarios, credenciales ni correspondencia legal.

## Actualizacion del 5 de octubre

El candidato actual y sus puertas de entrega estan en [Android 1.5.13 candidato final de la auditoria](release-android-1.5.13-45.md): 45 / 1.5.13, PWA 260, SHA-256 `e3d619b87eacd65dec99e0b2d1b756584daa02361ee19adaf06fe0283b3997b2`. Integra la correccion de cabecera de Comunidad y conserva recuperacion, importacion completa, FileProvider de respaldo, recursos locales y avatares escapados. Nueva suite 52/52, auditoria de 146 assets, cero errores de lint y pruebas nativas de respaldo/navegacion/teclado en ambas orientaciones correctas. App Check sigue OFF. Todavia no esta subido a Play, instalado en la Lenovo ni publicado en la web.

La ultima consulta de Play acredita interna 44 / 1.5.12 exclusivamente para la lista del propietario de un miembro y produccion 40 / 1.5.8. En la Lenovo con 44 instalada desde Play pasaron los dos enlaces en frio y sus fechas, audio confirmado por el propietario, Biblia, calendario, teclado de busqueda/Profundizar, las tres vistas de Moderacion y el selector de exportacion cancelado sin envio. El solapamiento de Comunidad detectado en esa prueba esta corregido en 45 y su matriz de presentacion paso 12/12. Los paquetes congelados anteriores permanecen intactos; la QA fisica de 44 y la confirmacion offline/meditaciones de 43 no se transfieren a 45. Historia y evidencias de 44 en [su informe](release-android-1.5.12-44.md). No hubo deploy web ni promocion a produccion.

Data Safety envio 47 y pausa de Alpha envio 46 ya figuran PUBLICADOS en Play. La restauracion Firestore aislada ya estaba completada. Llegaron respuestas sustantivas de SBU, Tyndale y Logos: evaluacion RVR1960 pendiente, NTV canalizada a API.BIBLE y Logos a su area de permisos; ninguna concede licencia. Se prepararon borradores para revision, sin adjuntos antiguos ni compromisos. Licencias, App Check operativo, decisiones de retencion, condiciones/avisos y calendario 2027 permanecen abiertos. Las secciones siguientes conservan el registro historico del 3 de octubre; sus referencias a envios/respuestas pendientes o a integracion App Check no instalada no describen el estado posterior.

## Version y QA

Baseline de esta revision: main y origin/main en 28e36cb8e09b6eb35381c98b9d03fddb0aeb29c9, inicialmente sin cambios tracked; marketing/ preexistente conservado. AAB 42 intacto con SHA-256 `91d395748fd208e2cae68ae8d7decea43b76f3bae9dd9caad65b34023d93cd92`. La incidencia de recuperacion posterior requiere una correccion de producto local y otro candidato; no se reemplaza ni recompila el AAB 42 aprobado.

| Comprobacion de 42 | Estado real |
| --- | --- |
| Distribucion oficial de Play | Instalador com.android.vending, 1.5.10 (42), Lenovo conectada. |
| Lectura de hoy | Aprobada por el propietario. |
| Escritura en Profundizar / teclado | Aprobada por el propietario. |
| Audio audible | Aprobada por el propietario. |
| Meditaciones conservadas | Aprobada por el propietario; no se leyeron sus textos. |
| App Links en caliente | /hoy y /lectura?date=2026-10-01 entregados a MainActivity; no verificacion visual ni arranque frio de 42. |
| Offline, moderacion y selector del respaldo | Comprobacion solicitada para 42; las pruebas previas de 41 no la sustituyen. |
| Recuperacion entre dispositivos / importacion nativa | Pendientes; solo datos ficticios y almacenamiento aislado para importar. El usuario introduce sus credenciales personalmente. |
| iPhone desde pantalla de inicio | Correccion de teclado PWA 257 confirmada por el propietario; no acredita todos los flujos de audio/Share/importacion en iPhone. |

Play sigue en produccion 40 (1.5.8). Tras la autorizacion concreta posterior del propietario, la prueba interna exclusiva se actualizo de 42 a 43 (1.5.11) y Play confirma Disponible para verificadores internos. La lista exclusiva de un miembro y las otras listas sin seleccionar se comprobaron de nuevo. El propietario confirma actualizacion, arranque normal, recuperacion correcta, tres pestanas de Moderacion y cuenta verificada conservada tras cerrar desde recientes/reabrir en 1.5.11; USB confirma 43 e instalador/iniciador com.android.vending. Tambien confirma lectura, teclado de Profundizar, audio, meditaciones conservadas, lectura previamente cargada en modo avion y selector de respaldo cancelado sin envio; restablecio internet. Son resultados fisicos nuevos de 43, no transferidos de 42. Los App Links en frio y su fecha visual ya estan aprobados en la comprobacion instrumental posterior descrita abajo. Quedan separados recuperacion entre dispositivos e importacion nativa aislada. Alpha 14 figura pausado/inactivo en la consulta anterior; su unico cambio de pausa estaba en revision de Google, no acreditado como aprobacion final. No se seleccionaron otras listas ni se promovio produccion.

Incidencia de moderacion en 42: el propietario no ve el boton en Comunidad. El 3 de octubre a las 19:41 UTC se verifico sin escrituras que la cuenta autorizada sigue habilitada, con correo verificado, claim de moderador y pin coincidente. No se otorgo acceso a otra identidad ni se sustituyo el pin. La tableta muestra una identidad sin correo vinculado; el intento de recuperacion personalmente confirmado termina en el aviso generico de fallo. No repetir intentos, volver a vincular el correo, desinstalar ni borrar datos para resolverlo. Offline y Share no se registran como aprobados por esta respuesta.

Diagnostico: initAuth comprobaba currentUser antes de finalizar la restauracion persistida; una prueba determinista confirma que podia iniciar una identidad anonima sobre una cuenta vinculada. La misma decision debe esperar Auth en el cliente remoto de Biblia. Separadamente, el paso previo de notificaciones impedia validar credenciales ante NOT_OWNER. Se observaron 403 recientes del callable; el servicio tiene invocacion publica correcta y no es un bloqueo IAM. La relacion exacta con las peticiones de la tableta es una inferencia del codigo y los logs, no una inspeccion de credenciales ni del estado privado del dispositivo.

Correccion: esperar authStateReady; continuar recuperacion solo ante functions/permission-denied con mensaje NOT_OWNER, sin modificar registros ajenos; mantener errores distintos, validacion de contrasena y restricciones del servidor. La primera prueba del arranque fallo antes del cambio y pasa despues. La suite completa NUEVA tras el ajuste del cliente remoto termino 49/49 en emuladores locales; no se reutiliza el resultado historico de 42. Se compilo y audito el candidato separado 1.5.11 (43), PWA 258, y despues de la aprobacion se publico exclusivamente en prueba interna. SHA-256: `1e8d3ed45de42b34948c106ac0a8642929f00be6a4f755b58fecd5d11da99ae7`, sin recompilacion durante la entrega. Instalacion oficial confirmada por USB; el propietario confirma recuperacion, correo verificado, tres pestanas y conservacion de cuenta/Moderacion al cerrar/reabrir. La incidencia queda validada como resuelta en ese recorrido de la Lenovo; no equivale a cierre global ni QA de otro dispositivo. Detalle en release-android-1.5.11-43.md. No hubo commit, push ni deploy web/Firebase de esta correccion; las fuentes quedan pendientes de publicacion controlada y la PWA publica no se actualizo por la subida a Play.

La pagina de informe previo al lanzamiento pide subir artefactos y no presenta un informe de 42. No se cuenta como aprobado ni se abre otro canal para generarlo sin autorizacion. Vitals sin datos no significa cero fallas. Sigue la advertencia de simbolos nativos: consultar al proveedor, no fabricar simbolos de bibliotecas ya despojadas de ellos.

Registro de Android comprobado el 3 de octubre en Verificacion de desarrolladores de Android: la fila Su Voz a Diario / app.suvoz muestra Registrada, una clave y ultima actualizacion 4 jun 2026. El aviso general del 8 de septiembre no demuestra una falta de registro de Su Voz. No se registro un paquete adicional, cambio una clave, envio identificacion ni acepto un acuerdo. Evidencia local de solo lectura: /private/tmp/suvoz-play-registro-android-2026-10-03.jpg. Esta comprobacion no sustituye Data Safety ni derechos editoriales.

Actualizacion QA posterior: los App Links en frio de 43 ya no estan pendientes. Tras autorizacion especifica para ADB, se detuvo solo Su Voz y se abrieron /hoy y /lectura?date=2026-10-01. Ambos muestran Status ok, LaunchState COLD y app.suvoz/.MainActivity. Se verificaron visualmente 3 DE OCTUBRE / 1 Samuel 19:1-17 y 1 DE OCTUBRE / 1 Samuel 17:50-18:5, coincidentes con el catalogo. La pantalla negra inicial era el dispositivo dormido/Dozing; el propietario desbloqueo personalmente y no se cambio ningun ajuste. Evidencias publicas en /private/tmp/suvoz-43-cold-hoy-despierta.png y /private/tmp/suvoz-43-cold-lectura-fecha.png, fuera de Git. No hubo instalacion, borrado de datos, permisos nuevos ni publicaciones de Comunidad. Permanecen pendientes recuperacion entre dispositivos e importacion nativa aislada.

## Seguridad y Respaldo

Las barreras de eliminacion ya estan activadas en produccion y las 36 Functions y reglas desplegadas fueron comprobadas en la fase anterior. No hay denuncias ni solicitudes de eliminacion en la consulta acotada del 3 de octubre; no se crearon casos reales para probar.

El respaldo gestionado completo del 3 de octubre sigue SUCCESSFUL, done=true y sin error. Metadata: 2316 documentos completados, 1226462 bytes. La estimacion previa de documentos no es el numero exportado. Un export no es una instantanea transaccional ni incluye Auth o todos los objetos de Storage.

Restauracion aislada ejecutada tras presentar el alcance y recibir la delegacion del propietario: nueva base qa-restore-20261003, mismo proyecto y region us-central1, tipo FIRESTORE_NATIVE y proteccion contra eliminacion activada. Preflight comprobo el export exacto SUCCESSFUL y que el destino y su release de reglas no existieran. Nueve comprobaciones locales rechazaron produccion, otro proyecto/respaldo, region/tipo distintos y proteccion desactivada.

Antes de importar se probaron diez contextos sinteticos de reglas, sin identidad real: get/list/create/update/delete con y sin autenticacion, todos DENY/SUCCESS. Se publicaron y releyeron reglas deny-all exclusivamente en cloud.firestore/qa-restore-20261003, verificando el contenido exacto y su hash. Se comprobo el destino vacio antes de la unica importacion. La documentacion oficial indica que los imports gestionados no disparan Cloud Functions; no se cambio ninguna funcion ni se conecto la app al destino de QA.

Importacion finalizada el 3 de octubre a las 21:14:21, America/Mexico_City: done=true, SUCCESSFUL, sin error, 2316 documentos completados. La suma de conteos agregados de las 20 colecciones raiz restauradas tambien es 2316. Los bytes completados de la importacion son 1277543, distintos del progressBytes del export; no se confundieron estas magnitudes. No se descargaron contenidos personales, UID, correo ni tokens al Mac ni ampliaron permisos IAM. La identidad, region, tipo, proteccion y updateTime de (default), y su release de reglas completo, permanecieron iguales al preflight de esta gestion. No hubo escrituras de documentos en produccion.

La copia privada permanece conservada con reglas de cliente denegadas; el acceso administrativo IAM existente sigue siendo posible. Su almacenamiento consume la cuota habitual, y la estimacion menor de US$1 no es un tope garantizado. No se borro la copia: su retirada definitiva requiere autorizacion separada con alcance actual. Evidencia privada fuera de Git: artifacts/validation/isolated-restore-qa-20261003.json. La prueba valida restauracion Firestore, no Auth, audios, indices compuestos ni importacion del respaldo local dentro de Android.

Storage: no se observaron bindings IAM allUsers/allAuthenticatedUsers. Acceso uniforme y bucketPolicyOnly estan desactivados, publicAccessPrevention es inherited; no afirmar que la ausencia de IAM publico demuestra que cada objeto sea privado. No se observaron lifecycle, retentionPolicy ni versioning configurados. Las reglas de cliente del prefijo de respaldos deniegan acceso; revisar tambien ACL/metadata antes de ampliar cualquier uso.

Proteccion contra borrado de la base (default): activada y verificada el 3 de octubre a las 19:46, America/Mexico_City. El preflight comprobo proyecto, base, region us-central1, tipo FIRESTORE_NATIVE y etag; la unica escritura de configuracion fue deleteProtectionState = DELETE_PROTECTION_ENABLED. Operacion done=true sin error; identidad de base y otros campos comprobados sin cambios. No se leyeron/escribieron documentos, modifico IAM, desplegaron reglas ni tocaron otras bases. Es reversible y evita eliminar la base completa; NO impide el borrado de documentos ni sustituye un respaldo. El helper paso 10 fixtures locales de alcance, etag, conflicto, no-op y deteccion de cambios inesperados; no usaron red ni credenciales reales.

ACL del respaldo exacto: consulta de solo metadata el 3 de octubre a las 19:46; 16 objetos, 1243230 bytes con archivos de metadata y una overall_export_metadata, cero objetos con ACL allUsers/allAuthenticatedUsers y cero tokens de descarga Firebase. No se descargaron contenidos ni guardaron nombres privados/ACL personales. Ese total de objetos de Storage no es el contador progressBytes del export (1226462); no son magnitudes identicas. La comprobacion no excluye el acceso administrativo autorizado por IAM. Evidencias privadas fuera de Git: artifacts/validation/firestore-delete-protection-1791078411824.json y backup-object-acl-readonly-1791078400383.json.

## App Check

Confirmacion directa de consola: app Android y app web Sin registrar. Firestore, Storage y Auth estan UNENFORCED. Los endpoints GET de configuracion pueden devolver valores predeterminados; una respuesta 200 no demuestra registro activo. No hay proveedor inicializado en la app actual.

Ruta compatible propuesta, NO instalada ni activada:

1. Web: proveedor reCAPTCHA Enterprise, dominios exactos, condiciones y cuota/costo revisados. No introducir reCAPTCHA Classic obsoleto.
2. Android: Play Integrity con certificado de firma de Play y proyecto vinculado. Registrar el proveedor no sustituye integrar el SDK.
3. El WebView usa Firebase JS: necesita un puente compatible con tokens nativos, inicializado antes de Auth/Firestore/Functions. Una integracion nueva modifica el binario; requiere otro candidato y QA, nunca reemplazar silenciosamente el AAB 42 aprobado.
4. Observar tokens validos/fallidos sin exponerlos. Mantener clientes antiguos operativos; enforcement es una decision posterior y especifica.

No se crearon claves, aceptaron condiciones, habilitaron APIs ni cambiaron COMMUNITY_ENFORCE_APP_CHECK o la exigencia de terminos.

## Retencion

No hay campos TTL configurados. Inventario por conteos del 3 de octubre: communityActivityEvents 53, communityActivityDeliveries 83, denuncias 0, solicitudes de eliminacion 0. No se leyo contenido personal ni se purgaron estas colecciones.

Propuesta para decision del propietario, NO plazo legal impuesto ni politica ya activa:

| Datos | Criterio propuesto | Barrera antes de aplicarlo |
| --- | --- | --- |
| Respaldos gestionados | 30 dias para copias operativas; conservar por separado una copia asociada a una incidencia abierta. | Restauracion probada, inventario por prefijo, autorizacion de borrado y actualizacion de informacion al usuario. No regla lifecycle global que alcance audios. |
| Denuncias | Pendientes hasta resolver; 180 dias desde cierre, salvo conservacion justificada y documentada. | Decision del moderador sobre finalidad/plazo; minimizar texto e identidad; no borrar un caso abierto por antiguedad. |
| Solicitudes de eliminacion | Pendientes hasta verificar y ejecutar; comprobante minimo sin UID/email tras cierre. | Procedimiento actual ya anonimiza cierre; decidir plazo del comprobante separado de datos de cuenta. |
| Outbox de actividad | Candidata a retirada 30 dias despues de deliveredAt, solo delivered=true. | Inventariar pendientes, pruebas de reintento y aprobacion acotada. Nunca TTL de un trabajo aun no entregado. |
| Ledgers de deduplicacion | No fijar TTL solo con createdAt. | Confirmar ventana efectiva de retries, controlar eventos antiguos/replay y probar que expirar un ledger no duplica contadores ni notificaciones. |

La documentacion indica ventana actual de 24 horas para Functions de segunda generacion, con salvedades para funciones antiguas. No inferir que esa ventana permite borrar todos los ledgers: replay administrativo y configuracion efectiva deben quedar controlados. Probar duplicados, expiracion y reintento antes de desplegar una politica. La limpieza historica de 1007 huerfanos no autoriza este borrado.

## Derechos y Calendario Editorial

Inventario JSON del catalogo activo: 269 fechas unicas, del 7 de abril al 31 de diciembre de 2026; 269 pasajes con RVR1960, 269 con NTV y 194 con TLA. Cuenta entradas no vacias del archivo realmente indicado en el indice; no confundir numero de pasajes con versiculos ni contar dos veces archivos alternativos de julio.

Las solicitudes existentes de RVR1960 y de orientacion Logos siguen sin respuesta sustantiva en la consulta acotada del 3 de octubre, incluidos spam/papelera. No se identifico una licencia escrita concedida en ese expediente. Comprar Logos, acceder a una API o enviar una solicitud no permite concluir redistribucion autorizada.

NTV: Tyndale publica permisos@tyndale.com como canal de solicitud. Tras la revision y aprobacion concreta del propietario, se envio el unico borrador existente el 3 de octubre a las 19:20:20, America/Mexico_City. Gmail confirma SENT y el cuerpo enviado coincide exactamente con el borrador aprobado; sin adjuntos ni copias. Solicita lecturas, recursos/offline, TTS y compartir imagen/PDF; informa el catalogo actual y el apoyo PayPal y pide instrucciones sobre los pasajes ya incluidos. No acepta costos ni contratos. La evidencia privada de envio se conserva fuera de Git; no equivale a acuse del titular, respuesta sustantiva ni licencia concedida. Revisar TLA por separado; no atribuirle una licencia RVR1960.

Novedad NTV: respuesta automatica recibida diez segundos despues del envio. Se leyo completa; Auto-Submitted=auto-generated, DKIM/DMARC pass en Gmail. Informa que Will Castro se jubilo y dirige los correos a pedidos-tyndale@tyndale.com. No es respuesta sustantiva sobre licencia ni un rebote. Se preparo UN borrador de canalizacion al nuevo buzon, en la conversacion existente, con la solicitud original intacta, sin duplicar su texto, sin copias ni adjuntos. Despues de presentar el destinatario, contenido y alcance y recibir la delegacion concreta del propietario, se envio ese mismo borrador una sola vez el 3 de octubre a las 21:02:52, America/Mexico_City. Gmail confirma SENT y cuerpo coincidente con el aprobado. No se aceptaron costos, contratos ni condiciones y no se infiere licencia concedida. Evidencia privada actualizada: artifacts/validation/ntv-channel-redirect-2026-10-03.json. RVR1960 y Logos: no nuevas respuestas en la busqueda acotada anterior, incluyendo spam/papelera; esa consulta no sustituye una revision futura.

Para cada traduccion: identificar titular/canal, solicitante, territorios, distribucion, limite de texto, atribucion, TTS, cache/offline y compartir. Los limites generales de citas no son una licencia universal de Biblia completa. Una alternativa editorial necesita aprobacion expresa y verificar la fuente concreta; no sustituir ni fabricar textos unilateralmente.

Cobertura comprobada: los 90 dias desde el 3 de octubre estan programados hasta el 31 de diciembre. No hay lecturas 2027 en el indice; falta fuente aprobada para continuar el calendario. Mantener el seguimiento existente de RVR1960: 12 de octubre si no hay respuesta sustantiva, sin insistencias duplicadas ni aceptar costos/contratos.

## Orden de Cierre

1. No promover 42 a produccion. Candidato corregido 43 verificado, publicado solo en prueba interna tras aprobacion e instalado oficialmente. Recuperacion, persistencia, moderacion, lectura, teclado, audio, meditaciones, lectura offline y cancelacion del respaldo aprobados por el propietario en 43. App Links en frio y fecha visual aprobados por la prueba instrumental autorizada. Completar por separado recuperacion entre dispositivos e importacion nativa aislada, sin perder datos personales ni transferir resultados de 42 al candidato nuevo.
2. Data Safety: matriz exacta aplicada tras delegacion concreta, nueva vista previa cotejada, guardada y enviada como UN cambio. Play confirma Cambios en la etapa de revision, con verificaciones rapidas pendientes; aun no acredita aprobacion ni ficha publica nueva. Ver data-safety-borrador-2026-10-03.md. Revisar por separado Contiene anuncios, sin atribuir publicidad a credenciales o contenido religioso.
3. Resolver derechos editoriales o alternativa aprobada. No afirmar ausencia de riesgos legales basandose en pruebas tecnicas.
4. Restauracion Firestore aislada aprobada y comprobada: 2316 documentos, reglas deny-all, produccion intacta y copia retenida. Quedan decidir retencion/retirada y preparar App Check compatible sin bloquear clientes existentes. Son pendientes distintos de la aprobacion de Play y de la importacion nativa de notas.
5. Revisar avisos/politica y aprobar especificamente hash, canal y porcentaje antes de promover a produccion.

La restauracion aislada y el envio de Data Safety ya son hechos acreditados, no propuestas. No implican nueva licencia, acuerdo aceptado, TTL activo, App Check activo ni promocion Android a produccion.

Verificacion de alcance: HEAD y origin/main permanecen en 28e36cb8e09b6eb35381c98b9d03fddb0aeb29c9. Los AAB 43 y 42 se conservan sin recompilacion. No hubo commit, push, deploy web/Functions ni promocion del binario a produccion. En la gestion anterior se activo deleteProtectionState de (default); en esta se creo la base de QA, se desplegaron SOLO sus reglas deny-all y se importo alli el respaldo. No afirmar ausencia global de deploy de reglas ni ocultar esas escrituras administrativas. marketing/ y las modificaciones de producto anteriores se conservan. Data Safety puede publicarse tras la aprobacion de Google porque la publicacion administrada existente esta desactivada; no se cambio ese ajuste.

## Fuentes Oficiales

- [Firestore: exportar e importar](https://firebase.google.com/docs/firestore/manage-data/export-import).
- [Firestore: bases con nombre](https://firebase.google.com/docs/firestore/manage-databases).
- [Functions: retries e idempotencia](https://firebase.google.com/docs/functions/retries).
- [App Check web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
- [App Check con Play Integrity](https://firebase.google.com/docs/app-check/android/play-integrity-provider).
- [Puente Firebase JS documentado por el proveedor](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/app-check/docs/firebase-js-sdk.md).
- [NTV: condiciones publicadas por Tyndale, pagina de derechos](https://files.tyndale.com/thpdata/firstchapters/978-1-4964-5572-7.pdf).
- [Registro de paquetes de Play](https://support.google.com/googleplay/android-developer/answer/16984799?hl=es-419).
