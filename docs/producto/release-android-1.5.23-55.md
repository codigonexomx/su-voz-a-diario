# Su Voz Hoy: correccion final, web 270 y Android 1.5.23 (55)

Fecha: 24 de octubre de 2026, America/Mexico_City.
Base: `d486f02c7550ed488ca7cd06a6f44a674fbb82f7`.

## Alcance

Incluye el flujo diario aprobado y documentado en release-android-1.5.22-54.md. La QA nativa de 54 detecto un desfase entre el capitulo abierto y su encabezado: centrar el versiculo 1 permitia que el lector continuo activara el capitulo precedente. El acceso a un capitulo completo ahora navega sin destino de versiculo, aprovechando la alineacion existente del titulo bajo la barra fija. Las busquedas y enlaces a versiculos concretos no cambian.

54 permanece congelada y no se promueve a produccion. Play exige un codigo nuevo; se prepara 55 (1.5.23), PWA 270, sin cambios de dependencias, permisos, Functions, reglas, IAM, privacidad, iOS ni datos personales.

## Validaciones previas

- 64/64 comprobaciones aisladas con emuladores demo, cerrados al terminar.
- Regresion ejecuta openDailyBibleChapter y navigateToVerse reales: libro/capitulo correctos, destino de versiculo nulo y retorno a la misma fecha/posicion.
- Navegador local: titulo de 2 Pedro 1 a 183 px, barra fija hasta 167 px y encabezado 2 Pedro / Cap. 1; seleccionar capitulo 2 y volver conserva la lectura diaria.
- bundleRelease, assembleRelease y lintRelease correctos, compilacion offline con Java 21.

Auditoria candidate55 correcta: firma y certificado, API 24+, target 36, sin permisos nuevos, 165 archivos publicos identicos, sin privados; lint 0 errores / 17 advertencias y alineacion 16 KB de las cuatro bibliotecas (sin QA fisica 16 KB). Paquetes anteriores, incluido 54, sin cambios.

Paquete congelado: `artifacts/android-1.5.23-55-release/su-voz-1.5.23-55.aab`.
SHA-256: `817266d64ab1284ba4dc98e15d63b51313cee13262c62077dd74dd11eb177395`.

## Publicacion verificada

- Commit de codigo `55314f16f3d766b2c58fcf9cc4e224c0c133bac9`, push normal a main; HEAD y origin/main sincronizados.
- Product Validation 40131328923 y Pages 40131328623 completados correctamente. Web 270 publicada con HTTP 200 y hashes identicos de index, sw, app y narrador. Tambien se comprobo visualmente la alineacion de 2 Pedro 1 y el retorno al pasaje diario en produccion.
- Play publico 55 en prueba interna el 24 de octubre a las 14:49. Un unico paquete, API 24+, target 36, cero errores y cero dispositivos perdidos. Persiste la advertencia de simbolos nativos no disponibles, sin bloqueo de distribucion.
- Solo la lista Su Voz QA - propietario 2026-10-02 (un miembro) esta seleccionada; las listas de 14 y 29 siguen sin seleccionar.
- El permiso temporal de archivos se activo con aprobacion concreta para 55 y se desactivo despues de transferir el paquete. No se cambiaron otros permisos de la extension.

## Punto pendiente de QA nativa

Hasta las 14:58, Play de la Lenovo sigue ofreciendo Abrir para 54; ADB confirma 1.5.22 (54), origen com.android.vending. Se refresco la ficha y se cerro/reabrio unicamente Play, sin borrar datos, cache ni cuentas. No se instalo APK local ni se desinstalo Su Voz. La 55 esta disponible en Console pero todavia no se ofrece a este dispositivo.

No se considera validada fisicamente 55. Falta actualizar desde Play, comprobar el encabezado del capitulo y el retorno, regresion de lectura/audio/fuentes/Meditacion/navegacion, y conservacion de datos confirmada personalmente por el propietario. La prueba offline no se ha ejecutado; se solicito trasladar la unica prueba Wi-Fi autorizada de 54 a 55, pendiente de respuesta.

La revision automatica rechazo iniciar un borrador de promocion antes de terminar esa QA. Se respeto el bloqueo: no hay borrador nuevo de produccion, no se envio a revision y produccion permanece en 53 (1.5.21). Siguiente paso: instalar y validar 55; despues promover ese mismo paquete y enviar solo ese cambio a revision de Google. Un envio no equivale a aprobacion ni a disponibilidad publica.

Sin cambios en Functions, reglas, IAM, privacidad, iOS, contenido de Comunidad o datos personales; documentos previos de investigacion, marketing y logs conservados sin incluir. Emuladores y compilaciones terminados, sin procesos de validacion pendientes.
