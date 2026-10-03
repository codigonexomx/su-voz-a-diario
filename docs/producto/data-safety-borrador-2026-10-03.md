# Data Safety: Borrador de Revision

Estado: propuesta local incompleta, NO guardada ni enviada en Google Play. No es una declaracion definitiva ni asesoramiento juridico. Revisar el formulario completo y aprobar expresamente su envio.

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
| Otro contenido de usuarios | Recopilado, opcional, no efimero; funciones y seguridad | Publicaciones, respuestas y reportes; no equivale a enviar todas las notas locales. |
| Creencias politicas y religiosas | Propuesta: recopiladas, opcionales, no efimeras; funciones y seguridad | Comunidad permite oraciones/testimonios religiosos voluntarios. No afirmar perfil politico ni uso publicitario de esos textos. |
| IDs de dispositivo/otros | Recopilados, obligatorios, no efimeros; funciones y estadisticas | Identificadores de instalacion/notificaciones y medicion web; revisar finalidades adicionales exactas. |

No declarar recopilacion de voz solo por RECORD_AUDIO o sintesis TTS: el flujo activo inspeccionado no invoca la subida legacy de grabaciones. No declarar pagos, GPS, contactos, fotos, documentos privados ni diagnosticos por mera presencia de permisos o librerias. Confirmar cualquier categoria adicional contra el comportamiento efectivo de todas las versiones distribuidas.

## Punto que Impide el Envio Final

No conservar indiscriminadamente No se comparten datos. El reproductor YouTube se carga al dibujar lecturas con introduccion, antes de pulsar play; tambien existen Google Fonts/cdnjs. YouTube confirma intercambio de datos basicos al cargar su reproductor. Revisar tipos, finalidades y excepciones exactas antes de marcar cada dato como compartido/no compartido. Una captura de red puntual no demuestra por si sola todos los usos o la retencion del proveedor.

El contenido publicado expresamente por el usuario y los proveedores que procesan exclusivamente por cuenta del desarrollador tienen excepciones especificas, no automaticas para cualquier iframe/CDN. Revisar su aplicabilidad y los terminos de tratamiento de Analytics que aparecian pendientes en la revision del 2 de octubre; no se verifico nuevamente ese estado el dia 3 ni se aceptaron acuerdos por el propietario. No aplicar la excepcion de accion iniciada por el usuario a un reproductor precargado sin comprobar el aviso/consentimiento.

La declaracion abarca produccion y pruebas abiertas/cerradas activas. Consulta del 3 de octubre: produccion 40 activa y prueba abierta sin versiones activas. Alpha 14 figuraba activo antes de la pausa autorizada; ahora su pagina lo muestra pausado/inactivo y el unico cambio de pausa esta enviado a la etapa de revision de Google. Verificar el resultado final antes de excluirlo del alcance. No extrapolar la excepcion de pruebas internas a todo el producto.

## Fuentes Oficiales

- [Formulario, tipos, finalidades, alcance y excepciones](https://support.google.com/googleplay/android-developer/answer/10787469?hl=es).
- [Eliminacion de cuentas](https://support.google.com/googleplay/android-developer/answer/13327111?hl=es).
- [Divulgacion de SDK Firebase Android](https://firebase.google.com/docs/android/play-data-disclosure): comprobar solo SDK realmente incluidos y tambien la instrumentacion del WebView.
- [YouTube, manejo de datos del reproductor](https://developers.google.com/youtube/terms/developer-policies), III.E.4.i.
- [Cloudflare, tratamiento de registros de usuarios finales](https://www.cloudflare.com/privacypolicy/): no asumir que todos los datos de la politica se recogen por el recurso cdnjs concreto.

Antes de enviar: resolver el tratamiento de terceros, revisar cada opcion del formulario y la vista previa, confirmar alcance por canal y pedir aprobacion de las respuestas finales. No usar este borrador para aparentar que Play ya esta actualizado.
