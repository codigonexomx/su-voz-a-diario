# Operacion y Publicacion Pendientes

Estado comprobado el 2 de octubre de 2026. Documento operativo, no certificacion juridica ni declaracion enviada a Google Play. No contiene identidades Firebase reales, tokens, contrasenas ni datos de usuarios.

## Limpieza Historica

Herramienta: functions/cleanupCommunityOrphans.js. Solo acepta un plan privado de modo read-only-plan, del proyecto confirmado, con hash SHA-256 exacto y conteos consistentes. No inventaria ni incorpora nuevos candidatos. Dry-run por defecto.

```sh
node functions/cleanupCommunityOrphans.js \
  --project=PROYECTO_CONFIRMADO \
  --plan=RUTA_PRIVADA_DEL_PLAN \
  --plan-sha256=HASH_CONFIRMADO \
  --report=RUTA_PRIVADA_NUEVA_JSONL \
  --firebase-cli-auth-module=RUTA_CONFIRMADA_DE_FIREBASE_TOOLS_LIB_AUTH_JS
```

Para apply se requiere aprobacion especifica del alcance, --apply, --confirm-project=PROYECTO_CONFIRMADO y --confirm-deletions=TOTAL_EXACTO. El export del mismo proyecto debe constar SUCCESSFUL y tener menos de 24 horas. Una ejecucion futura necesita respaldo vigente: no ampliar ni regenerar el plan anterior y reutilizar su aprobacion.

Cada transaccion lee el padre y los candidatos. Conserva unidades cuyo padre exista, cuyo updateTime o referencia hayan cambiado, o que hayan adquirido un privado no contemplado. Respuesta y privado se eliminan juntos. Las escrituras llevan precondicion updateTime. Lotes de 50 unidades, sin reintento automatico de un commit ambiguo. La bitacora privada se crea de forma exclusiva, se sincroniza antes de cada commit y no se sobrescribe.

Tras interrupcion: revisar bitacora y leer los mismos IDs. Una ausencia cuenta como ya retirado; un registro recreado/modificado se conserva. Nunca interpretar timeout como prueba de que el commit no ocurrio. El respaldo gestionado no es una papelera ni una instantanea transaccional; restauracion real sigue siendo una validacion separada. No importar el export en produccion para probar.

Esta herramienta NO borra publicaciones, cuentas, audio, notificaciones, ledgers ni outbox. El plan aplicado de 1007 documentos queda cerrado; conservar su evidencia privada. Sus IDs no deben publicarse en Git ni en informes publicos.

## Moderacion y Eliminacion de Cuenta

1. El propietario vincula su correo en su dispositivo habitual, elige personalmente la contrasena, verifica el mensaje y actualiza la verificacion en la app. No usar el UID anonimo de una sesion de pruebas ni solicitar contrasenas/codigos al usuario.
2. Ejecutar configureModerator.js en dry-run con proyecto/correo confirmados. Asignacion requiere cuenta habilitada y verificada; solicitar confirmacion concreta para fijar la unica identidad administrativa. Revisar pin y claim y renovar token. No divulgar UID/correo desde el panel publico.
3. Revisar Denuncias y Solicitudes de eliminacion desde el panel restringido. Para denuncias: documentar decision; ocultar/restaurar es reversible y no equivale a borrar legalmente todo el contenido.
4. Para eliminacion: comprobar referencia privada y titularidad de la solicitud autenticada o del correo verificado. Una sesion anonima se prueba desde su dispositivo, no mediante un nombre publico. No pedir documentos de identidad ni aceptar UIDs enviados como unica prueba.
5. Antes del borrado definitivo, confirmar alcance y respaldo. Inventariar Auth, perfil, publicaciones/respuestas y sus privados, peticiones/compromisos de oracion, reacciones, bloqueos, terminos, notificaciones y registros push, incluidos subdocumentos y audios de propiedad comprobada. Revisar referencias de ledgers/outbox y retenciones justificadas; no borrar la deduplicacion de otros usuarios.
6. Revocar acceso y retirar datos verificados mediante operaciones privadas acotadas. Verificar ausencias y explicar cualquier retencion justificada. Solo entonces marcar la solicitud como atendida y responder al titular. La cuenta no se elimina automaticamente al recibir la solicitud. No existe aun una herramienta integral probada para ejecutar este paso; no afirmar borrado automatico ni inmediato.
7. Notas, respaldos compartidos y meditaciones locales no son datos que el servidor pueda retirar del dispositivo del usuario. Explicar su eliminacion por separado.

Inventario actual: cero solicitudes y cero denuncias. No crear solicitudes reales ni contenido de Comunidad para QA. Pruebas de moderacion y titularidad con fixtures/emuladores.

## Revision de Seguridad de los Datos

Declaracion leida, no modificada: se recopilan datos, cifrado en transito, no creacion de cuentas, sin metodo de eliminacion y sin correo. Ya constan nombre opcional, UID, interacciones, contenido opcional de usuarios e IDs de dispositivo; no datos compartidos, segun la declaracion del propietario.

Cambios propuestos antes de publicar el candidato con recuperacion de cuenta:

| Campo | Propuesta basada en el codigo actual | Verificacion antes de enviar |
| --- | --- | --- |
| Creacion de cuentas | Nombre de usuario y contrasena; el nombre de usuario puede ser email. Retirar la respuesta de que no permite cuentas. | Probar vinculacion y recuperacion en Android 41. |
| Eliminacion | Metodo dentro de Ajustes y enlace externo https://suvoz.app/eliminar-cuenta.html. | Moderador operativo y procedimiento privado, no solo pagina publicada. |
| Email | Recopilado, opcional, no efimero; gestion de cuentas y funciones de recuperacion. | Ningun envio del email a Analytics; revisar otras finalidades reales. |
| UID | Mantener recopilacion; funcionamiento, seguridad y gestion de cuenta. | No declarar identidad anonima como dato completamente anonimizado. |
| Contenido de usuarios | Mantener opcional; funcionamiento y revisar seguridad por denuncias/moderacion. | Los reportes contienen texto/comentarios privados; no son notas locales. |
| Interacciones e IDs | Mantener segun Firebase/Analytics/FCM y configuracion efectiva. | No afirmar que falta Analytics porque no existe SDK Analytics nativo: el WebView tambien transmite datos. |
| Audio, creencias religiosas y otras categorias sensibles | Revision especifica, sin activar ni descartar a ciegas. | Separar sintesis local de una subida real de audio y el contenido libre de Comunidad de un perfil religioso. No afirmar conformidad juridica solo por revisar codigo. |
| Datos compartidos | Confirmar que proveedores tratan datos por cuenta del responsable y que configuraciones efectivas cumplen la excepcion aplicable. | No decidir no compartidos solo porque no haya anuncios. |

No declarar auditoria independiente, cifrado extremo a extremo ni borrado automatico a 90 dias: no fueron acreditados. Revisar el formulario completo antes de guardar/enviar; la responsabilidad de exactitud corresponde al propietario. No aceptar condiciones nuevas por el.

Referencias: [Seguridad de los datos](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es), [eliminacion de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es), [divulgacion Firebase Android](https://firebase.google.com/docs/android/play-data-disclosure). El inventario propio del WebView prevalece sobre asumir que todos los SDK nativos listados por Firebase estan instalados.

## Prueba Android y Publicacion

Candidato: artifacts/android-1.5.9-41/su-voz-1.5.9-41.aab; SHA-256 1f2331f7e72f888bff484be4a13b7b5f69379b29982720ae4112faa135d9ffd0. Produccion consultada: 1.5.8 (40), 100% desde el 25 de septiembre. No confundir AAB construido, borrador subido y version publicada.

Subida autorizada y completada: mismo AAB aceptado como 41 (1.5.9), guardado como borrador interno. Explorador de Play: artefacto 4860236552466626415, estado Borrador. No se avanzo a lanzamiento ni se cambiaron verificadores o produccion. El AAB conserva su hash; no se recompilo ni se aceptaron condiciones nuevas.

Play permite descargar una APK universal firmada desde el borrador. Copia privada local: artifacts/android-1.5.9-41/su-voz-1.5.9-41-play-universal.apk; SHA-256 29a10f1ac816795d1f57abae72cc9ecfe3bec9de0c069ca544c459c431e67b5e. app.suvoz 41/1.5.9, PWA 256 y firma v2/v3/SourceStamp verificadas. Certificado de Play coincide con la instalacion existente. El propietario autorizo despues la actualizacion sin desinstalar; comprobar el resultado real antes de certificar QA. No omitir Play Protect ni aceptar envios automaticos permanentes para avanzar.

Actualizacion de la Lenovo completada mediante adb install -r: Success, version posterior 41/1.5.9. AppId, directorio de datos, inodes CE/DE y fecha de primera instalacion conservados. No se concedieron permisos de notificaciones/microfono. Play Protect solicito analizar esta app; el propietario aprobo el envio unico y completo el aviso personalmente. No se certifica aun el recorrido ni el contenido de cada meditacion: QA manual solicitada, y pruebas de Share/offline siguen pendientes. No atribuir la instalacion local a una publicacion de Play.

### Incidencia de Origen y Recuperacion

El propietario informo que al abrir aparece Descarga esta app desde Google Play y que Play advierte que la instalacion no procede de la tienda. Diagnostico de paquete: installerPackageName=null, initiatingPackageName=com.android.shell. La firma compatible no basta para la comprobacion del instalador anadida por Play; se debio comprobar esta proteccion antes del sideload. No atribuirlo a un fallo JavaScript ni certificar arranque correcto.

No se desinstalo, no se borro almacenamiento, no se falsifico el instalador y no se desactivo proteccion. El propietario autorizo por separado publicar el mismo AAB 41 solo en pruebas internas para su cuenta. Se creo Su Voz QA - propietario 2026-10-02, con un correo y como unica lista seleccionada. Listas anteriores de 14 y 29 miembros conservadas sin seleccionar; no se alteraron otros canales.

Resultado: Play muestra Disponible para verificadores internos, 41 (1.5.9), el 2 de octubre a las 15:34 locales. Conserva proteccion automatica; advertencias no bloqueantes sobre 20 dispositivos respecto a la antigua version interna 1 y ausencia de simbolos nativos. No se reconstruyo el AAB. Produccion verificada despues: 40 (1.5.8). La ficha del programa confirma que la cuenta del propietario ya es verificador; no fue necesario aceptar condiciones nuevas.

Enlace oficial de acceso: https://play.google.com/apps/internaltest/4701700649729684709. Abrirlo en la tableta con la cuenta aprobada y obtener la app desde Play, sin salir del programa ni seguir la instruccion para desinstalar la version de prueba. En esta tableta Play permitio sustituir 41 por su distribucion oficial 41. No generalizar esta posibilidad: si otro dispositivo exige codigo superior, pedir autorizacion antes de preparar otro AAB. La activacion interna puede tardar en propagarse y no equivale por si sola a reparacion del dispositivo.

Recuperacion confirmada: el propietario obtuvo la app desde Play y reporto que abre normalmente, sin la portada de descarga. Consulta de paquete a las 15:40:16 locales: 41/1.5.9, installerPackageName=com.android.vending e initiatingPackageName=com.android.vending; appId, inodes CE/DE y firstInstallTime conservados. No hizo falta desinstalar, limpiar datos, crear version 42 ni desactivar proteccion. Logs del proceso actual desde la instalacion oficial: cero coincidencias de errores JS criticos y fatales nativos; es una revision acotada, no certificado de ausencia historica de fallos. Dominio verified, preferencia de usuario aun Disabled; no modificada. Recorrido, audio audible, meditaciones, respaldo/Share y modo avion solicitados al propietario para QA; no afirmar resultados aun no recibidos.

Evidencia local: /tmp/suvoz-play-1.5.9-41-interna-disponible-2026-10-02.jpg y /tmp/suvoz-play-qa-solo-propietario-2026-10-02.jpg. Referencia del mecanismo: [comprobacion del instalador](https://support.google.com/googleplay/android-developer/answer/15621622?hl=es). No instalar nuevamente la APK protegida por USB para repetir el mismo fallo.

La instalacion Play utiliza certificado distinto de la APK local. Conservar instalacion y datos; no resolver INSTALL_FAILED_UPDATE_INCOMPATIBLE mediante desinstalacion, clear data, nuevo package o downgrade. Subir el mismo AAB a borrador interno solo con autorizacion especifica. Comprobar codigo, firma y recursos de APKs descargados para auditoria del paquete; la firma no prueba que sean aptos para ejecutarse instalados por USB. Para QA de una version protegida utilizar el canal interno y obtenerla realmente desde Play. Publicar a verificadores o a produccion son autorizaciones distintas de subir un borrador.

Recorrido de aceptacion fisica, sin contenido real de Comunidad:

1. Antes: comprobar version, conservar una meditacion propia existente y exportar un respaldo privado. No inspeccionar ni difundir su texto.
2. Actualizar con firma compatible, sin desinstalar. Comprobar version 41/PWA 256, meditaciones, preferencias y sesion conservadas. No exportar credenciales.
3. Lectura diaria, Profundizar, Biblia/lector continuo, calendario, biblioteca, teclado, atras y segundo plano. Iniciar/pausar/detener voz; verificacion auditiva corresponde al dispositivo, no a un log de SDK.
4. Respaldo de Ajustes y de Mis meditaciones: archivo real y flujo Share; cancelar sin mensaje falso de exito. Importar solo en almacenamiento de prueba separado, nunca sobre notas reales para ensayar.
5. Tras cargar contenido necesario, modo avion: reinicio, lectura precargada y recursos locales disponibles; contenido remoto no cargado debe fallar de manera explicita. Restaurar conectividad al terminar.
6. App Links en frio/caliente con /hoy y /lectura, sin modificar preferencias sin aprobacion. En la tableta consultada el dominio esta verificado, pero la apertura esta deshabilitada por preferencia del usuario.
7. Permisos de notificaciones/microfono solo con aprobacion; no grabar/subir voz real para probar. No enviar FCM global. Prueba dirigida de notificacion requiere destinatario de prueba confirmado y registrar estado antes/despues.
8. Antes de produccion: moderacion operativa, Data Safety revisada, hash del mismo AAB, QA registrado, derechos editoriales revisados y confirmacion especifica del canal/alcance. No atribuir a esta auditoria una licencia concedida.

Avisos de Play para 40: comprobar edge-to-edge y APIs obsoletas en QA; MainActivity ya llama EdgeToEdge.enable. Segmento alpha antiguo activo: evaluar su pausa por separado, sin cambiar su alcance unilateralmente. Ausencia de metricas de fallos/ANR en consola no significa cero incidentes.

## App Check y Retencion

App Check sigue sin proveedores ni enforcement. La consola marca reCAPTCHA Classic obsoleto; no introducir ese proveedor para evitar preparar Fraud Defense. Antes de crear clave/registrar: confirmar proyecto, dominio, condiciones, cuota y presupuesto, con aprobacion del propietario. Para Android: certificado de firma de Play y vinculo Play Integrity del mismo proyecto; integrar SDK/puente compatible con el Firebase web de la app, no asumir que basta registrar app.suvoz.

Inicializar antes de Auth/Firestore/Functions, comprobar tokens sin exponerlos y observar solicitudes validas/fallidas en todos los clientes. Clientes antiguos sin proveedor no deben quedar bloqueados. No habilitar COMMUNITY_ENFORCE_APP_CHECK, COMMUNITY_REQUIRE_TERMS ni enforcement global por esta comprobacion. [Proveedor web](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider), [Play Integrity](https://firebase.google.com/docs/app-check/android/play-integrity-provider), [precios y cuota](https://cloud.google.com/security/products/recaptcha).

Reportes, deduplicacion y outbox: no se definio ni activo TTL. Primero fijar finalidad/plazo, revisar tareas pendientes y ventana de replay de los triggers desplegados, y probar reintentos posteriores al vencimiento. Un borrado basado solo en antiguedad puede duplicar contadores o perder una entrega pendiente. Definir ademas acceso y vencimiento de backups con datos personales. Ninguna limpieza historica aprobada autoriza purgar esta trazabilidad.

## Dependencias Externas

- Moderacion: vinculacion/verificacion personal; despues asignacion concreta de seguridad.
- Editorial: fuente aprobada para 2027; no hay enero en el catalogo. Importar y validar sin inventar textos ni fechas.
- Derechos: esperar respuesta sustantiva segun el expediente existente. Acuse, compra de Logos y acceso API no conceden licencia de redistribucion.
- Restauracion gestionada: prueba aislada pendiente, sin sobrescribir produccion ni transferir datos a otro proyecto sin confirmar destino/acceso.
- iPhone: emparejado/disponible en el Mac, pero QA fisica no completada. Build de simulador no sustituye dispositivo, permisos, audio ni Share.

Estos limites impiden declarar toda la auditoria cerrada aun cuando las correcciones F1-F12 ya esten implementadas y publicadas en web/backend.
