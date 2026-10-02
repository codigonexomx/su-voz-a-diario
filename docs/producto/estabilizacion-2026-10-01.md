# Estabilizacion y Operacion de Su Voz a Diario

Fecha local: 1 de octubre de 2026. Estado: backend publicado; candidato web y Android verificados, publicacion web pendiente.

## Baseline y Alcance

HEAD inicial: `2e4a136b163d8c6b7e282ffa61c332580d35f78d`, main sincronizada con origin/main. No habia cambios tracked. `marketing/` era untracked y no se modifico.

PWA: 255 -> 256 para invalidar el cache anterior y alinear Analytics. Android: candidato 1.5.9 (41), sin subir a Google Play; AAB 1.5.8 (40) preservado. iOS conserva su version/build. Se actualizo privacy.html para la vinculacion opcional y los reportes privados, sin trackers. Se publicaron las Functions y reglas de Firestore/Storage, con respaldo previo. No se asignaron permisos reales de moderador ni se ejecutaron limpiezas historicas.

## Hallazgos de la Auditoria

| Hallazgo | Tratamiento local | Limite o paso pendiente |
| --- | --- | --- |
| F1 Offline | Fallback consulta cache dinamico y precache estatico; dos modulos faltantes incluidos como obligatorios. | Modo avion en dispositivo con instalacion previa. Una primera visita sin red no puede instalar recursos remotos. |
| F2 Reacciones duplicadas | ID canonico por publicacion/usuario, esquema cerrado, timestamp servidor, autor y padre validos; reglas publicadas. | Inventario no encontro IDs no canonicos; 888 reacciones quedaron sin padre por borrados anteriores. No se borraron. |
| F3 Denunciar y bloquear | Backend publicado: callables privados, reportes deduplicados, bloqueo por autor incluso anonimo, terminos explicitos, cola restringida y ocultacion reversible. | Correo del unico moderador confirmado; falta que el propietario lo vincule y verifique. Clientes anteriores no aplican el filtro nuevo. |
| F4 Respaldo roto | Ambos botones invocan exportAllData; descarga web y archivo/Share nativo; cancelacion sin falso exito. | Descarga real en Chrome y Share en dispositivo pendientes. Exportacion/restauracion del contenido verificadas automaticamente. |
| F5 Avance involuntario | Un precargado por direccion, renovado por gesto; maximo automatico de ocho capitulos; anclaje al insertar. | Los botones manuales pueden ampliar la ventana intencionalmente. |
| F6 Huerfanos | Trabajo durable captura propietario/audio antes de borrar padre; lotes de respuestas/privados/reacciones/notificaciones; reanudacion tras fallo. | Sin migraciones historicas ni borrados reales. Audio de URL no confiable se omite para no borrar otro recurso. |
| F7 Anonimato y actividad | Identidad resuelta en backend privado; autor excluido del fan-out y de sus propias notificaciones. | Bloqueo no devuelve UID de autores anonimos. |
| F8 Reintentos y carreras | Ledger transaccional por evento, cursor atomico paginado, outbox de badge y metrica compartida por ambos triggers; continuidad de racha legacy. | FCM no garantiza exactamente una entrega: badge absoluto/tag reduce efectos repetidos. |
| F9 Corrupcion/cuota | Indice reconstruido desde registros; rollback parcial; borrador pendiente en memoria; error visible/reintento; respaldo incluye pendientes. | Cerrar proceso puede perder un borrador no persistido. Exportar antes y liberar espacio. |
| F10 Identidad y respaldo | Vinculacion opcional email/password conserva UID, verificacion, recuperacion explicita y solicitud privada de eliminacion; sin credenciales en respaldos. Auth habilitado conservando acceso anonimo, proteccion de enumeracion y minimo de ocho caracteres. | El propietario debe vincular/verificar su propia cuenta. Recuperar otra identidad no fusiona cuentas ni sincroniza notas; la eliminacion requiere tramitacion operativa. |
| F11 Dependencias | Locks actualizados sin audit fix --force; overrides acotados; Capacitor iOS alineado con core/Android. | Revisar futuras actualizaciones con CI/builds. Audit no garantiza inmunidad futura. |
| F12 Version Analytics | Landing/app/service worker y copias publicas comparten PWA 256; sync incluye landing. | Verificar configuracion/eventos despues de publicar. |

## Otras Correcciones y Limites

Notificaciones: marcar leidas persiste antes de mutar estado; cliente no crea notificaciones ni escribe metricas de servidor. Listener legacy sigue desactivado; no se reactivo una segunda via de push.

Audio grabado legacy: API modular de Storage y metadata ownerUid; borrado compatible con metadata uid anterior. No se activo una funcionalidad nueva de grabacion.

Android: WRITE_EXTERNAL_STORAGE limitado a API 28, coherente con guardado legacy; READ mantiene limite 32. RECORD_AUDIO conservado para la ruta existente. iOS incorpora descripcion de microfono. Permisos efectivos requieren prueba fisica.

Coste: limites por UID para publicaciones/respuestas/oracion/denuncias/bloqueo/Biblia; fan-out paginado a 100 y maxInstances 10 en callables nuevos y triggers con reintentos. Sigue siendo O(numero de usuarios) por publicacion y las identidades anonimas pueden recrearse. No afirmar proteccion completa contra abuso sin App Check y observacion de consumo. App Check web no tiene proveedor configurado; no se activo enforcement que bloquearia a clientes existentes.

Mantenimiento: runner unico, pruebas adversariales y workflow CI; sintaxis de todo el JavaScript fuente. No se reescribio app.js ni el CSS general para limitar regresiones.

## Moderador Unico

Responsable declarado: propietario de Su Voz. La interfaz publica no muestra su nombre ni correo. Se exige custom claim `moderator: true` Y UID fijado en `communityConfiguration/moderation`. Ninguna identidad se asigno en este trabajo.

```sh
node functions/configureModerator.js --project=PROYECTO_CONFIRMADO --expected-email=CORREO_CONFIRMADO
```

Dry-run por defecto. Rechaza cuenta deshabilitada, correo diferente/no verificado y reemplazo de otro moderador sin confirmacion especifica. `--apply` cambia acceso de seguridad: usar solo despues de verificar identidad y autorizar asignacion. No guardar UID/correo reales en Git. Renovar el token antes de comprobar el panel.

Puede usar ADC o la sesion existente de Firebase CLI mediante --firebase-cli-auth-module=RUTA_LOCAL_CONFIRMADA_A_FIREBASE_TOOLS_LIB_AUTH_JS. No imprime ni guarda credenciales. El dry-run real comprobo que la cuenta del correo confirmado todavia no existe, por lo que no hubo asignacion. La app inicia con Firebase Anonymous Auth. No inferir identidad administrativa del feed ni otorgar permisos a una identidad anonima arbitraria.

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

- Suite integrada: 40 comprobaciones con reglas/concurrencia y Auth en emulador; ultima ejecucion completa 40/40.
- Casos nuevos: duplicados, timestamps, acceso privado, moderador unico, bloqueo anonimo, limites/terminos/App Check, fan-out concurrente/reintentos, 520 respuestas en cascada, trabajo interrumpido, respaldo/restore con cuota y borradores, offline y lector continuo.
- Android Debug/unit tests/lint y build de simulador iOS sin firma: correctos; no son certificacion en dispositivo/tienda. Lint de la app: cero errores y 19 advertencias de versiones/iconos/recursos heredados; Gradle tambien avisa de flatDir, deprecaciones y formatos SDK XML. No se ocultaron mediante nuevos suppressions.
- npm audit raiz/Functions: cero vulnerabilidades reportadas durante el trabajo.
- QA local: lectura diaria, abrir/cerrar Profundizar, Salmos 66/NVI, cambio de version y recarga con capitulo estable; sin overflow horizontal a 390 px. Denunciar abre y cancelar cierra sin enviar; no se prueban los callables nuevos contra produccion antes de publicarlos. Respaldo llega al aviso; navegador integrado no permite certificar descarga completa.
- git diff --check correcto. Backend probado sin tokens reales de push.
- Workflow CI preparado, no ejecutado en GitHub porque no se hizo push.

## Produccion e Inventario

Respaldo Firestore en el bucket del mismo proyecto: export gestionado completo SUCCESSFUL, 3196 documentos; referencia de operacion privada en artifacts/validation/production-backup-operation.json. Un export no es una instantanea transaccional de escrituras concurrentes; no demuestra restauracion real. Referencia: https://firebase.google.com/docs/firestore/manage-data/export-import

Inventario de solo lectura: 243 posts, 71 replies, 1981 reacciones, 612 userActivity y 19 registros push. Huerfanos: 49 replies, 21 documentos communityPostPrivate y 888 reacciones; cero privados de reply huerfanos y cero IDs no canonicos de reaccion. Dos posts superan 90 dias, sujetos a la retencion diaria preexistente. No se ejecutaron migraciones ni borrados historicos; autorizacion especifica solicitada.

Backend: 36 Functions ACTIVE, runtime nodejs22, sin eliminar nombres anteriores. Despliegue con filtro explicito por nombre; --force solo confirmo failurePolicy/reintentos idempotentes. Firestore y Storage compilados y publicados. Firebase CLI aviso de una version mas nueva de firebase-functions; npm audit no reporta vulnerabilidades en la instalada.

## Pendientes que No Deben Ocultarse

- El propietario debe vincular/verificar su correo; luego dry-run y asignacion del moderador unico.
- Publicacion web y QA/Analytics post-produccion. Backend y Auth ya publicados.
- Catalogo editorial aprobado para 2027; guard de cobertura ya avisa/bloquea faltantes cercanos.
- Autorizar la limpieza historica inventariada; definir retencion de reportes/ledgers/outbox antes de borrar trazabilidad. Los ledgers evitan replays duplicados y no se eliminan a ciegas.
- App Check y pruebas fisicas Android/iOS: permisos, modo avion, descarga/Share y actualizacion sin perdida.
- Licencias escritas/condiciones por traduccion. Atribucion o acceso API no concede derechos. Revisados los hilos de seguimiento a Logos y a SBU/ABS enviados el 1 de octubre: no contienen respuesta al momento de consulta. No se duplicaron solicitudes enviadas hace pocas horas ni se aceptaron contratos.

## Artefacto Android Preservado

`artifacts/android-1.5.8-40/su-voz-1.5.8-40.aab`

SHA-256: `238b4ea901225db3e192bf59c5d2282dade27bf0c35daec070d4966f3859354a`.

Contiene PWA 254 y no es candidato para publicar esta estabilizacion.
