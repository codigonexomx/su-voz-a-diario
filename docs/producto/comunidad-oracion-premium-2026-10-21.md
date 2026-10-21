# Comunidad y oración: renovación y circuito de actividad

Fecha: 21 de octubre de 2026.
Base: `c7dab9f0a9a8859fac8bd4f9c0f80069d29c513f`.
Estado inicial: implementación local. Las secciones de QA local conservan la evidencia anterior a publicar; el avance de publicación figura al final y en `release-android-1.5.18-50.md`. El trabajo previo de Calendario se conserva.

## Investigación y criterio

Se consultó documentación oficial de los productos; no se afirma haber instalado o probado las aplicaciones competidoras.

- [YouVersion: compartir una oración](https://help.youversion.com/l/en/article/bdgy3q6m3k-share-a-prayer-with-friends-on-android) vincula peticiones compartidas y acompañamiento. Su modelo de compartir con amigos no se confunde con el feed público de Su Voz.
- [YouVersion: avisos de oración](https://help.youversion.com/l/en/article/xyob6b5jjq-prayer-notification-android) distingue actividad y recordatorios. [Oración en iOS](https://help.youversion.com/l/en/article/fj48sysun2-prayer-ios) documenta actualizaciones y peticiones respondidas.
- [Echo](https://www.echoprayer.com/echo-plus) documenta acompañamiento, seguimiento y avisos. [Grupos y feeds](https://www.echoprayer.com/support-articles/what-is-the-difference-between-groups-and-feeds) distingue compartir con un grupo y seguir un espacio de peticiones.
- [Firebase: tipos de mensaje](https://firebase.google.com/docs/cloud-messaging/customize-messages/set-message-type) y [recepción web](https://firebase.google.com/docs/cloud-messaging/web/receive-messages) distinguen mensajes de datos de las notificaciones mostradas automáticamente en segundo plano. No deben presentarse dos alertas por combinar ambas vías.
- [Firebase: reintentos de funciones](https://firebase.google.com/docs/functions/retries) exige considerar reejecuciones. La deduplicación se hace en transacciones, no suponiendo que un disparador se ejecutará una sola vez.

Decisión para Su Voz: conservar reflexiones, lectura del día, pregunta, respuestas, favoritos, audio, anonimato y moderación; añadir continuidad a las peticiones mediante seguimiento, actividad interna y destino directo. No se añadieron rankings, contadores ficticios, publicaciones automáticas ni incentivos para compartir información personal.

## Diagnóstico confirmado

1. Los disparadores de actividad existentes atendían publicaciones, respuestas y reacciones, pero no la creación de peticiones, acompañamientos o peticiones respondidas.
2. `listenNotifications()` salía con un `return` antes de iniciar la suscripción. La bandeja interna estaba desactivada.
3. No existía una ruta específica para abrir una petición desde un aviso; el destino genérico abría las reflexiones.
4. «Mis peticiones» filtraba las primeras 20 peticiones públicas cargadas. No era una consulta de todas las propias.
5. Oración dependía innecesariamente de la carga de reflexiones, reacciones y respuestas.
6. El emisor incluía `notification` para web y el worker también mostraba la alerta. Se corrigió esa doble vía para registros identificados como web.
7. La conversación consultaba todas las respuestas y luego filtraba por publicación en el cliente. Ahora consulta únicamente el `postId` abierto y propaga errores de carga, sin presentar falsamente una conversación vacía.

## Experiencia implementada

- Navegación principal Reflexiones / Oración, actualización explícita y aviso de novedades sin reemplazar silenciosamente la lectura.
- Peticiones, Mis peticiones, Orando y Testimonios. Las listas personales usan una función autenticada con paginación de 20 registros y cursor validado para esa identidad.
- «Estoy orando» conserva el acompañamiento existente; no crea otra colección de seguidores. «Orando» consulta esos compromisos privados y solo devuelve los documentos públicos de las peticiones.
- Estados de carga, vacío y error distintos, reintento, foco conservado y cancelación de renders obsoletos.
- Consulta de propiedad y compromisos en lotes de 50, también cuando el usuario haya acumulado varias páginas.
- Bandeja de actividad con 40 avisos recientes, estado leído, contador, reintento, cierre por Escape y navegación al destino. «Marcar recientes como leídas» no promete marcar todo el historial.
- Si el usuario cambia de identidad, se desconecta la suscripción anterior, se limpia su contenido y se descartan respuestas tardías. Los fallos de escritura no producen una confirmación falsa de lectura.
- Botones y menús coherentes, iconos Lucide locales, tarjetas de publicaciones de 8 px, formularios y secciones sin tarjetas anidadas, temas claro y oscuro, controles adaptados a móvil/tableta/escritorio.
- Conversación interna con el mismo lenguaje visual. Permanecen respuestas anónimas, límites, denuncia, bloqueo, acciones del propietario y controles de moderación.

## Avisos de oración

| Acción | Destinatario | Contenido del aviso |
| --- | --- | --- |
| Nueva petición activa | Identidades de Comunidad existentes en `userActivity`, excepto el autor y las excluidas por bloqueo/eliminación | «Nueva petición de oración», texto genérico |
| Nuevo acompañamiento | Autor de la petición, excepto autoacompañamiento | «Te acompañan en oración», sin identificar a quien acompaña |
| Petición marcada respondida | Quienes conservan su acompañamiento | «Una petición tiene una actualización», texto genérico |

La actividad interna no solicita permiso de notificaciones. El envío push sigue usando exclusivamente registros existentes con `notificationsEnabled === true`; no se activa esa preferencia, no se solicita permiso automáticamente y no se registra ningún dispositivo de prueba real.

Los mensajes no incluyen el texto de la oración, nombre del autor ni identidad de quien acompaña. El destino usa `#community?section=prayer&prayer=ID`, valida el identificador y vuelve a verificar visibilidad. Las peticiones inexistentes u ocultas muestran un estado no disponible, sin revelar identidades.

Se reutilizan `communityActivityEvents` y `communityActivityDeliveries`: registro transaccional por tipo, petición y destinatario; en acompañamientos también por participante. Quitar y volver a acompañar no genera avisos repetidos al autor para la misma persona/petición. No se migra ni notifica el catálogo antiguo al desplegar: los disparadores actúan sobre eventos nuevos.

La cola y los contadores son idempotentes. FCM es un servicio externo: una interrupción después de enviar y antes de confirmar la entrega puede producir un reintento; no se promete entrega exactamente una vez. El tag compartido agrupa alertas visibles y el worker usa `renotify: false`. Se verifica otra vez el destino, bloqueos del autor y acompañamiento vigente de las actualizaciones antes del envío. El bloqueo original de quien acompaña se comprueba al encolar el aviso de acompañamiento; ese UID no se copia a la cola de entrega.

Para web identificada, el emisor manda datos y el worker es responsable de mostrar la alerta. Android y registros de plataforma no identificada conservan el payload de notificación compatible con el comportamiento previo. Esta compatibilidad no se presenta como una garantía contra duplicados en registros web antiguos sin plataforma.

Al eliminar una petición, un disparador con reintento limpia sus avisos y compromisos en lotes de hasta 400. El inventario administrativo de eliminación de cuentas y su verificación final reconocen también `notifications.prayerId`. No se ejecutó ninguna eliminación en producción.

## Archivos y publicación necesaria

Módulo de interfaz: `js/community/CommunityExperience.js`. Estilos: `css/community.css`. Bandeja: `js/notifications.js`. Integración: `js/app.js`, exportación `writeBatch` en `index.html`, iconos locales y recursos offline en `sw.js`. Copia pública `www` sincronizada; candidato web 265 compartido con Calendario, aún no publicado.

Backend: `functions/communityPrayerActivity.js` e integración en `functions/index.js`.

Nuevas funciones que deben publicarse, previa revisión:

- `notifyNewPrayerRequest`
- `notifyPrayerSupport`
- `notifyPrayerAnswered`
- `listMyPrayerRequests`
- `cleanupDeletedPrayerActivity`

Debe actualizarse `deliverCommunityBadgeUpdates` para transportar el contexto de oración y usar su nueva comprobación. Para aplicar la corrección compartida de presentación web también al recordatorio y a la prueba del propietario, deben actualizarse `sendDailyNotification` y `sendTestNotification`. No es necesario desplegar las demás funciones.

Índices nuevos: `communityPrayerPrivate(ownerUid ASC, createdAt DESC)` y `communityPrayerCommitments(ownerUid ASC, createdAt DESC)`. Deben estar listos antes de publicar la interfaz. El índice de respuestas por publicación ya está declarado. No se cambiaron Firestore Rules, Storage Rules, roles IAM, secretos, autenticación nativa ni permisos del dispositivo.

Orden: revisar y separar el commit de Comunidad del trabajo de Calendario, publicar índices y funciones acotadas, verificar disponibilidad, publicar la web mediante el mecanismo habitual del repositorio y comprobar iPhone. Después generar un candidato Android nuevo para prueba interna de la Lenovo antes de producción. No usar un despliegue indiscriminado de todas las funciones.

Hasta publicar el backend, la vista local con Firebase productivo puede mostrar un error controlado en Mis peticiones y Orando: la nueva función todavía no existe allí. No se presenta ese estado como una lista vacía ni como validación productiva.

## Verificación

- `scripts/validate-community-experience.mjs`: ejecuta el código real de bandeja, acciones y envío mediante dobles de DOM/SDK. Cubre escape, aislamiento entre identidades, lectura fallida/tardía, paginación, cursor, lotes de 121 peticiones, rollback, doble toque, cancelación, consulta de respuestas, destinos web/nativos, presentación del worker y separación de payload web/nativo. Cero envíos FCM reales.
- `functions/communityPrayerActivityEmulator.test.js`: transacciones reales en Firestore emulado, más de 100 destinatarios, ejecución concurrente y repetida, exclusión propia, privacidad, bloqueos, cuentas congeladas, acompañamiento, actualizaciones, cancelación de seguimiento, destino oculto/eliminado, limpieza de más de 400 avisos y consulta paginada de más de 20 peticiones propias.
- Suite estándar: 48/48. Suite completa Auth/Firestore/Storage: 59/59. El informe final se guarda en `artifacts/validation/tests.json`.
- Suite completa repetida después de los ajustes finales: 59/59. `npm audit --audit-level=moderate` en raíz y Functions: cero vulnerabilidades, sin instalar ni actualizar paquetes.
- Navegador real: proyecto `demo-su-voz-community-ui`, Auth/Firestore/Functions emulados, datos explícitamente ficticios y cero documentos `pushTokens`. Se comprobaron Mis peticiones, Estoy orando, Orando, avisos de petición/acompañamiento/respondida, marcar leído y apertura del testimonio desde la bandeja. También formulario sin envío, favoritos y conversación.
- Inspección responsive en Chrome: 320, 390, 768 px y escritorio, tema claro/oscuro, sin desbordamiento horizontal en los controles comprobados. No equivale a una prueba física nueva de iPhone o Lenovo, ni a una certificación VoiceOver/TalkBack.
- Evidencias locales: `artifacts/validation/community-activity-mobile-2026-10-21.png`, `artifacts/validation/community-desktop-2026-10-21.png`, `artifacts/validation/community-prayer-mobile-2026-10-21.png`.
- La vista temporal del emulador no instala el service worker para no guardar una configuración ficticia como PWA. Su error de registro deliberadamente bloqueado no se atribuye a producción; la integración del worker se prueba por separado.
- Al terminar se cerraron la pestaña ficticia y sus emuladores. Permanece la vista local habitual en <http://127.0.0.1:8776/?analytics_test=1#community>, con las limitaciones de backend no desplegado descritas arriba. HEAD y `origin/main` permanecen en la base indicada; `git diff --check` limpio.

## Límites pendientes de publicación

No se probó la entrega de una notificación del sistema en un dispositivo real en esta fase. Antes de dar por cerrado ese punto: prueba controlada al propietario con permisos existentes, apertura en frío y en segundo plano, destino correcto y ausencia de duplicados, sin difundir una petición de prueba al feed productivo.

No se prometen más descargas por el rediseño; debe medirse uso real y retención después de publicarlo. No se cambiaron licencias bíblicas ni se presenta una solicitud de licencia como permiso concedido.

El AAB 1.5.17 (49) sigue intacto: SHA-256 `60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4`. No se recompiló, no se modificó Android/iOS y no se consultó ni cambió Google Play. `marketing/` permanece ajeno a esta entrega.

## Publicación del backend

El propietario autorizó terminar las comprobaciones y los pasos necesarios. El commit `63138e6156de7511ce5dc7faf685f0657d9bd73f` contiene únicamente el backend, sus pruebas y los dos índices. Los índices se publicaron preservando los diez existentes y se verificaron READY antes de publicar la interfaz.

Se publicaron exclusivamente las cinco funciones nuevas y las tres actualizaciones enumeradas arriba. Firebase confirma 41 funciones ACTIVE: ocho con cambios previstos y 33 sin cambios en los metadatos comparados. No se eliminaron funciones ni se modificaron reglas, IAM, secretos o cuentas. La configuración temporal excluye `**/*.log`. La opción `--force` fue necesaria para aceptar la política de reintentos ya probada de los cuatro disparadores nuevos; no se usó para borrar funciones ni para Git.

Evidencia administrativa, sin tokens: `artifacts/community-2026-10-21-release/function-verification.json` e `indexes-after.json`. La cuenta verificada del propietario conserva un único registro push habilitado, identificado como la Lenovo. Esa comprobación de registro todavía no acredita recepción física del aviso ni apertura desde el sistema.
