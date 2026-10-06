# Data Safety: Revision y Envio

Estado actualizado: tras la delegacion concreta del propietario, se edito y guardo la matriz exacta en Google Play y se envio UN cambio, Seguridad de los datos. La consola confirma Cambios en la etapa de revision, con verificaciones rapidas aun pendientes; no acredita aprobacion de Google ni publicacion de la ficha nueva. La correspondencia entre los datos del reproductor y las categorias de Play sigue siendo una inferencia tecnica explicita, no una certificacion del proveedor ni asesoramiento juridico. No se promovio un binario ni aceptaron acuerdos.

## Baseline Anterior Verificado el 3 de Octubre

En la consulta inicial se recorrieron los cinco pasos sin editar respuestas. Guardar y Guardar como borrador permanecian deshabilitados. El intento de exportacion CSV no devolvio un archivo verificable; las respuestas anteriores siguientes se acreditan por la interfaz, no por una exportacion supuesta. No describen la nueva matriz enviada.

- Recopila datos y cifrado en transito: Si.
- Mi app no permite que los usuarios creen una cuenta: seleccionado. Metodo para solicitar borrado: No.
- Seleccionados: Nombre, ID de usuario, Interacciones en la app, Otro contenido generado por usuarios y Dispositivo u otros IDs.
- Sin seleccionar: correo, ubicacion aproximada, creencias politicas y religiosas, historial de busqueda y Otras acciones.
- Vista previa: No se comparten datos con terceros; sin metodo para solicitar eliminacion.
- Finalidades vigentes: Nombre opcional / Funciones; UID / Funciones y Seguridad; Interacciones / Estadisticas; Contenido opcional / Funciones; IDs / Funciones y Estadisticas. Administracion de cuentas no consta para UID.

## Correcciones Acreditadas

| Campo | Respuesta propuesta | Motivo |
| --- | --- | --- |
| Recopila datos | Si | Auth, Comunidad, Analytics y FCM. |
| Cifrado en transito | Si | Conexiones HTTPS/TLS; no afirmar cifrado extremo a extremo. |
| Creacion de cuentas | Nombre de usuario y contrasena | Vinculacion opcional email/password; retirar la respuesta de que no admite cuentas. No declarar OAuth. |
| Solicitud de eliminacion | Si; https://suvoz.app/eliminar-cuenta.html | Ruta en Ajustes, pagina externa y procedimiento operativo activado. No prometer borrado instantaneo ni automatico a 90 dias. |
| Correo | Recopilado, opcional, no efimero; funciones, gestion de cuentas y seguridad | Vinculacion, verificacion y recuperacion. No enviar email/password a Analytics. |
| UID | Recopilado, obligatorio, no efimero; funciones, seguridad y gestion de cuentas | Identidad tecnica y titularidad. No es anonimizado de forma irreversible. |
| Nombre comunitario | Recopilado, opcional, no efimero; funciones | Nombre elegido por el usuario. |
| Ubicacion aproximada | Recopilada, obligatoria, no efimera; estadisticas | Geolocalizacion por IP de Analytics habilitada; no permiso GPS ni control general de exclusion. |
| Interacciones | Recopiladas, obligatorias, no efimeras; estadisticas y funciones | Eventos, progreso/metricas conectados y actividad. |
| Otras acciones | Recopiladas, opcionales, no efimeras; funciones y estadisticas | Reacciones y compromisos de oracion voluntarios. El formulario diferencia me gustas de Interacciones; no crear reacciones reales para QA. |
| Otro contenido de usuarios | Recopilado, opcional, no efimero; funciones y seguridad | Publicaciones, respuestas y reportes; no equivale a enviar todas las notas locales. |
| Creencias politicas y religiosas | Propuesta: recopiladas, opcionales, no efimeras; funciones y seguridad | Comunidad permite oraciones/testimonios religiosos voluntarios. No afirmar perfil politico ni uso publicitario de esos textos. |
| IDs de dispositivo/otros | Recopilados, obligatorios, no efimeros; funciones, estadisticas y comunicaciones del desarrollador | Identificadores de instalacion/notificaciones y medicion web; el token permite entregar recordatorios y avisos de la app, no publicidad propia. |

La obligatoriedad se considera por tipo, no solo por una funcion: desactivar notificaciones no suprime necesariamente todos los identificadores de medicion. FCM no demuestra por si solo que exista un SDK Analytics nativo; la instrumentacion Analytics actual es web dentro del WebView. Se propone tambien Comunicaciones del desarrollador para los IDs de notificaciones: sendDailyNotification entrega el recordatorio a tokens activados y notifyPostOwnerInApp entrega avisos de nuevas respuestas al UID propietario. Revisar la misma finalidad adicional para el UID usado como destinatario. No se encontraron en estas rutas notificaciones promocionales de otros productos.

Busqueda: la interfaz actual resuelve palabras en RV1909 local; los terminos no se incluyen en el evento de busqueda de la biblioteca personal. La callable legacy searchRemoteBible existe, pero el proveedor productivo rechaza busqueda textual y no es la ruta activa de palabras de la interfaz. No declarar historial remoto solo por el nombre de una callable, ni activar esa ruta sin nueva revision. Los mensajes locales de consola no equivalen a telemetria remota.

No declarar recopilacion de voz solo por RECORD_AUDIO o sintesis TTS: el flujo activo inspeccionado no invoca la subida legacy de grabaciones. No declarar pagos, GPS, contactos, fotos, documentos privados ni diagnosticos por mera presencia de permisos o librerias. Confirmar cualquier categoria adicional contra el comportamiento efectivo de todas las versiones distribuidas.

## Tratamiento de Terceros Revisado

No conservar No se comparten datos. El reproductor YouTube se carga al dibujar lecturas con introduccion, antes de pulsar play; tambien existen Google Fonts/cdnjs. YouTube confirma datos basicos en la carga y datos adicionales al reproducir. Google documenta para YouTube identificadores, vistas/interacciones y ubicacion derivada, entre otras fuentes, del IP. No se atribuyen a Su Voz GPS, busquedas de YouTube, comentarios en YouTube ni contenido subido a YouTube: esas funciones no son las del reproductor inspeccionado.

El contenido publicado expresamente por el usuario y los proveedores que procesan exclusivamente por cuenta del desarrollador tienen excepciones especificas, no automaticas para cualquier iframe/CDN. No aplicar la excepcion de accion iniciada por el usuario a un reproductor precargado sin comprobar el aviso/consentimiento.

Analytics se verifico nuevamente el 3 de octubre en la cuenta de la propiedad correcta: las cuatro opciones de compartir datos siguen desmarcadas. La pagina de cuenta sigue indicando que no se han aceptado los Terminos del Tratamiento de Datos, y el pais no esta seleccionado. No se acepto ningun acuerdo ni se cambio configuracion. La decision corresponde al propietario tras revisar alcance territorial y contractual; la aceptacion afecta la cuenta, no solo esta propiedad. No inferir automaticamente una obligacion RGPD en Mexico ni usar este estado como prueba de que todo Analytics se comparte para publicidad.

## Matriz de Terceros y Cierre del Formulario

| Servicio / ruta | Hecho acreditado | Clasificacion propuesta |
| --- | --- | --- |
| Firebase Auth, Firestore y Functions | Procesan cuenta, identidad y funciones comunitarias; el payload Analytics propio excluye credenciales y textos. | Recopilados; excepcion de proveedor de servicios para su procesamiento por cuenta del desarrollador. No marcar correo, nombre o UID compartidos por el mero uso de Firebase. |
| Analytics web | Medicion, identificadores tecnicos y geografia aproximada por IP; cuatro opciones de compartir, Signals y enlaces Ads desactivados. | Recopilados para estadisticas; la propuesta no atribuye publicidad propia ni transferencia de notas/email. La union de tipos compartidos se declara por YouTube, no por asumir que Analytics comparte para anuncios. |
| FCM Android/web | Identificadores de instalacion y tokens asociados a identidad tecnica; recordatorios y avisos de Comunidad acreditados. | Recopilados para funciones y comunicaciones del desarrollador, bajo excepcion de proveedor de servicios. No suponer BigQuery activo ni Analytics nativo incluido. IDs obligatorios por la medicion general aunque las notificaciones sean opcionales. |
| YouTube integrado | Iframe normal precargado, sin privacidad mejorada. Identificadores, interacciones y geografia por IP descritos por Google para su servicio. | Propuesta conservadora: recopilar y compartir IDs, interacciones y ubicacion aproximada. Funciones, estadisticas, seguridad, personalizacion y publicidad, segun datos y matriz siguiente. Incluye usos condicionados por la configuracion del espectador; no equivale a tener AdMob ni anuncios propios. |
| Google Fonts | IP, URL solicitada, agente de usuario y Referer; no cookies, perfiles ni publicidad dirigida segun su FAQ. | Funciones y seguridad; no inferir GPS, correo, publicidad o geolocalizacion por el mero IP. No anade categorias a las ya presentes por otros servicios. |
| cdnjs / Cloudflare | Solicitud de jsPDF y registros de trafico/seguridad descritos por el proveedor. | Funciones y seguridad; no atribuir publicidad de la web comercial al CDN ni nuevas categorias sin evidencia. |
| YouVersion por backend | GET con referencia y clave del proyecto, sin reenviar UID, correo, notas, cabeceras o IP del dispositivo. | No declarar una transferencia de esos datos personales al API. El acceso tecnico no demuestra licencia editorial. |
| PayPal externo y respaldo compartido | Apertura del navegador externo o del selector del sistema por accion expresa. No procesa tarjetas Su Voz. | Distinguir web abierta y accion iniciada por el usuario. No declarar pagos ni subida automatica de todas las notas privadas. |

Esta clasificacion se traduce en la matriz exacta siguiente para revision. Los usos publicitarios y de personalizacion de identificadores/actividad/ubicacion son del reproductor normal, documentados por Google y condicionados por las preferencias del espectador. No se extrapolan al correo, nombre, UID Firebase, notas, creencias ni contenido comunitario. No se declara Diagnosticos solo porque una cookie contribuya a resolver problemas.

La declaracion abarca produccion y pruebas abiertas/cerradas activas. Consulta del 3 de octubre: produccion 40 activa y prueba abierta sin versiones activas. Alpha 14 figuraba activo antes de la pausa autorizada; ahora su pagina lo muestra pausado/inactivo y el unico cambio de pausa esta enviado a la etapa de revision de Google. Verificar el resultado final antes de excluirlo del alcance. No extrapolar la excepcion de pruebas internas a todo el producto.

## Precisiones de la Revision Posterior

La pagina oficial de Firebase distingue sus servicios, que generalmente procesan por cuenta del cliente, de Google Analytics, sujeto a terminos separados. La excepcion de proveedor debe acreditarse por ruta/configuracion; no trasladarla automaticamente a YouTube ni usar la falta de una casilla aceptada como prueba de venta de datos. No se aceptaron acuerdos.

YouTube documenta datos basicos al cargar y datos adicionales al reproducir. Los cinco enlaces configurados usan youtube.com/embed, no el modo de privacidad mejorada. La documentacion de ese modo limita personalizacion de vistas/anuncios, pero no promete cero transmision. Desactivar autoplay tampoco elimina la solicitud inicial. No inventar los IDs, finalidades o plazos que no se hayan acreditado para el reproductor actual.

Google Fonts confirma IP, URL, agente de usuario y Referer; indica que no establece/registra cookies ni utiliza esos datos para perfiles o publicidad dirigida. La finalidad de seguridad esta documentada; recibir IP no acredita por si solo inferencia de ubicacion. Cloudflare describe datos de trafico y seguridad, pero su politica general no determina cada campo del recurso cdnjs concreto. No extrapolar publicidad de la web comercial al CDN.

Actualizacion del 5 de octubre: fuentes y jsPDF locales con licencias y video mediante enlace explicito estan implementados en 44, PWA 259, disponible exclusivamente en prueba interna del propietario. Se comprobaron assets, PDF real, precache y ausencia de iframe/miniaturas/preconnect externos. La apertura del destino YouTube y la QA fisica del nuevo paquete siguen separadas. No se reemplazo el AAB 43 ni se promovio 44 a produccion. No permite omitir las rutas de produccion 40 mientras siga distribuyendose. Detalle en [Android 1.5.12 y ajustes de la auditoria](release-android-1.5.12-44.md).

## Fuentes Oficiales

- [Formulario, tipos, finalidades, alcance y excepciones](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es).
- [Eliminacion de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es).
- [Divulgacion de SDK Firebase Android](https://firebase.google.com/docs/android/play-data-disclosure): comprobar solo SDK realmente incluidos y tambien la instrumentacion del WebView.
- [Funciones de procesamiento y privacidad de Firebase](https://firebase.google.com/support/privacy).
- [YouTube, manejo de datos del reproductor](https://developers.google.com/youtube/terms/developer-policies), III.E.4.i.
- [YouTube: modo de privacidad mejorada y requisitos del reproductor](https://support.google.com/youtube/answer/171780?hl=en).
- [Cloudflare, tratamiento de registros de usuarios finales](https://www.cloudflare.com/privacypolicy/): no asumir que todos los datos de la politica se recogen por el recurso cdnjs concreto.
- [Google Fonts, privacidad de solicitudes](https://fonts.google.com/faq#privacy).
- [Opciones de compartir datos de Analytics](https://support.google.com/analytics/answer/1011397?hl=es).
- [Recopilacion y uso de datos de Analytics](https://support.google.com/analytics/answer/11593727?hl=es).

## Respuestas Exactas Aplicadas y Enviadas

Recopilacion: Si. Cifrado en transito: Si. Creacion de cuentas: solo Nombre de usuario y contrasena; retirar Mi app no permite crear una cuenta y no marcar OAuth. Eliminacion de cuenta y datos: Si, URL https://suvoz.app/eliminar-cuenta.html; no marcar borrado automatico en 90 dias. Sin insignia de auditoria independiente ni verificacion de pagos.

F = Funciones de la app; E = Estadisticas; S = Prevencion de fraudes, seguridad y cumplimiento; C = Comunicaciones del desarrollador; A = Administracion de cuentas; P = Personalizacion; M = Publicidad o marketing.

| Tipo exacto de Play | Recopilado | Compartido | Efimero | Eleccion | Finalidades recopilacion | Finalidades comparticion |
| --- | --- | --- | --- | --- | --- | --- |
| Nombre | Si | No | No | Opcional | F | No aplica |
| Direccion de correo electronico | Si | No | No | Opcional | F, S, A | No aplica |
| ID de usuario | Si | No | No | Obligatorio | F, S, A, C | No aplica |
| Creencias politicas y religiosas | Si | No | No | Opcional | F, S | No aplica |
| Ubicacion aproximada | Si | Si | No | Obligatorio | F, E, S, P, M | F, E, S, P, M |
| Interacciones en la app | Si | Si | No | Obligatorio | F, E, S, P, M | F, E, S, P, M |
| Otro contenido generado por usuarios | Si | No | No | Opcional | F, S | No aplica |
| Otras acciones | Si | No | No | Opcional | F, E | No aplica |
| Dispositivo u otros IDs | Si | Si | No | Obligatorio | F, E, S, C, P, M | F, E, S, P, M |

El UID se usa como destinatario de avisos y para autenticar/administrar cuentas y ownership. Nombre y contenido publicos se comunican por decision expresa del usuario de publicar, con expectativa razonable de que se mostraran en Comunidad; se aplica esa excepcion especifica de Play, no anonimato irreversible. Denuncias y solicitudes permanecen restringidas. Los contenidos voluntarios pueden revelar creencias religiosas; no se afirma perfil politico ni segmentacion publicitaria religiosa.

La ubicacion aproximada compartida y las finalidades M/P son una correspondencia conservadora de los usos documentados por Google con el reproductor normal precargado. Es inferencia tecnica, no prueba de que cada solicitud transmita todos los campos ni de que todos los espectadores reciban anuncios. No inferir recopilacion GPS. Los datos tecnicos precargados no se declaran opcionales solo porque pulsar play lo sea; tampoco se declaran efimeros cuando pueden asociarse a identificadores/actividad retenidos.

Sin seleccionar: ubicacion precisa, telefono/domicilio/otras categorias personales, financiera, salud/fitness, mensajes privados, fotos/videos del usuario, grabaciones de voz, archivos/documentos, calendario, contactos, historial de busqueda en la app, historial de navegacion web, fallos/diagnosticos/rendimiento. Esta lista describe las rutas actuales inspeccionadas, no permisos futuros. Una politica general de Google que menciona GPS, videos subidos o busquedas no acredita esas funciones en Su Voz.

Vista previa esperada: compartidos Ubicacion, Actividad en apps e IDs; recopilados tambien Informacion personal; mecanismo para solicitar eliminacion y cifrado en transito. La redaccion visible la genera Play y debe cotejarse antes del envio.

Paso adicional antes de produccion: revisar la declaracion separada Contiene anuncios. El reproductor normal puede mostrar publicidad segun YouTube; no equiparar la ausencia de AdMob a ausencia garantizada de anuncios integrados. No cambiar esa declaracion ni aceptar condiciones sin presentar el alcance exacto al propietario.

Fuentes adicionales utilizadas para esta inferencia: [Cookies de Google y YouTube: funciones, seguridad, analiticas, publicidad y personalizacion](https://policies.google.com/technologies/cookies?hl=es), [Datos de YouTube y usos segun preferencias; pagina dirigida al EEE, no supuesto de residencia del propietario](https://business.safety.google/privacy/google-services/youtube/) y [Politica general de privacidad de Google](https://policies.google.com/privacy?hl=es). La politica especifica del reproductor confirma la transferencia aun antes de play; las categorias exactas anteriores son la propuesta que debe validar el propietario.

Se cotejo la nueva vista previa expandida contra los nueve tipos y sus finalidades antes de guardar. La consola confirmo Se guardo el cambio y mostro solamente Seguridad de los datos en Cambios que aun no se enviaron a revision. Se confirmo Enviar 1 cambio a revision; el resultado es Cambios en la etapa de revision con verificaciones automatizadas pendientes. Publicacion administrada permanece desactivada: el cambio de ficha puede publicarse tras la aprobacion; esto no promueve Android 43 a produccion. No se incluyeron otras modificaciones, aceptaron acuerdos ni cambiaron los terminos de tratamiento de Analytics.

Precision del paso de cuentas: al declarar Nombre de usuario y contrasena se proporciono la URL para borrar cuenta y datos asociados. La pregunta OPCIONAL sobre borrar una parte o la totalidad de los datos SIN borrar la cuenta quedo sin respuesta; es una pregunta distinta. El procedimiento publicado no promete esa alternativa ni borrado automatico en 90 dias. La vista previa acredita Borra la cuenta de la app con la URL correcta, no una eliminacion independiente inventada.

Evidencia local fuera de Git: /private/tmp/suvoz-data-safety-etapa-revision-2026-10-03.png muestra el estado de revision; /private/tmp/suvoz-data-safety-enviada-revision-2026-10-03.png muestra la fila unica Seguridad de los datos. El intento de captura fullPage devolvio una imagen blanca y no se usa como prueba; se conservaron capturas normales verificadas. La aprobacion de esta matriz no concede licencias editoriales ni autoriza promocion del binario a produccion. La declaracion separada Contiene anuncios sigue pendiente de revision especifica.

## Resultado confirmado el 4 de octubre

Play, detalles del envio 47: un cambio Seguridad de los datos, estado PUBLICADO el 3 de octubre a las 9:40 p.m. (hora mostrada por consola), enviado a las 9:16 p.m. Captura verificada: /private/tmp/suvoz-data-safety-publicada-2026-10-04.png. Ya no esta pendiente de revision. No publico un binario Android ni acredita derechos editoriales.

Play, detalles del envio 46: un cambio Pausar segmento Alpha, PUBLICADO el 3 de octubre a las 11:26 a.m., enviado 11:01 a.m. La pausa no borro listas ni paquetes. Captura: /private/tmp/suvoz-alpha-pausa-publicada-2026-10-04.png. La matriz mantiene la cobertura de produccion 40; no se cambia a No compartimos por una version distribuida solo en prueba interna. No se aceptaron condiciones ni modificaron avisos/terminos de Analytics en esta comprobacion de solo lectura.
