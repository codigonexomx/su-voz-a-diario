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

## Propagacion y QA nativa completada

Hasta las 14:58, Play de la Lenovo todavia ofrecia Abrir para 54. Se refresco la ficha y se cerro/reabrio unicamente Play, sin borrar datos, cache ni cuentas. Se espero su propagacion: el propietario completo la actualizacion oficial y ADB confirmo versionCode 55 / versionName 1.5.23, com.android.vending, lastUpdateTime 2026-10-24 18:46:07 y firstInstallTime 2026-09-24 20:41:57, sin cambios. No se instalo APK local ni se desinstalo Su Voz.

- Lectura de hoy: texto y video visibles; controles compactos y disposicion aprobada.
- Ver en Biblia: 2 Pedro 1 abre bajo la barra fija con encabezado correcto en NBLA. Selector de capitulo 2 correcto; Volver regresa a la misma fecha y posicion del pasaje diario.
- Tres traducciones diarias y tres fuentes comprobadas. Se restauraron RVR60 e Inter, las preferencias previas; Inter se conserva tras arranque en frio.
- Audio: Pausar, Continuar y Detener observados con seguimiento de versiculos. El propietario confirmo voz clara y continuacion correcta en 55.
- El propietario confirmo Meditacion: teclado, etapas, ayuda ?, Aprender / Volver y Revisar / X. Tambien confirmo meditaciones anteriores conservadas y Comunidad / Oracion sin error. No se abrieron ni capturaron esos contenidos personales.
- Una sola prueba offline de 55, expresamente autorizada: Wi-Fi 1 -> 0, cierre exclusivo de Su Voz y arranque COLD de /hoy correcto, lectura visible sin conexion. Wi-Fi restaurado en finally; estado 1 y conexion confirmados sin registrar identificadores de red. No se tocaron datos moviles, cuentas, permisos ni notas. El auxiliar UIAutomator no expuso los rotulos solicitados; la comprobacion visual directa y la captura offline si confirmaron la carga.

Evidencias locales: physical-qa.json, native-chapter-aligned.png, native-offline.png y capturas de Play en la carpeta congelada de 55. No se leyeron logs privados de la aplicacion. No equivale a QA en todos los modelos Android ni en paginas de memoria de 16 KB.

## Envio de produccion

La revision automatica rechazo iniciar un borrador antes de terminar la QA. Se respeto el bloqueo y se reanudo unicamente despues de confirmar instalacion 55, pruebas fisicas y las comprobaciones personales del propietario.

Se promovio el mismo paquete 55 desde la prueba interna, sin recompilar ni volver a subir archivos. Produccion: track 4698001730505189813, release 30. Vista previa con un solo AAB, cero errores, cero dispositivos perdidos y una advertencia por simbolos nativos no disponibles. Lanzamiento completo 100%, mismos paises de destino, sin modificar declaraciones, permisos, listas, ficha o condiciones legales.

En Descripcion general de la publicacion se verifico exactamente un cambio: Produccion / 55 (1.5.23) / Iniciar lanzamiento completo. Se confirmo Enviar 1 cambio a revision. Play cambio a Cambios en la etapa de revision y ofrecio Quitar los cambios, con verificaciones rapidas en curso (hasta 14 minutos al enviar). No se duplico el envio. Publicacion administrada ya desactivada, sin modificar esa opcion: tras aprobarlo, Google podra publicarlo automaticamente.

Estado comprobado al enviar: solicitud aceptada por Play, pendiente de verificaciones y aprobacion de Google. No se afirma que 55 este aprobada o disponible publicamente; hasta completar ese proceso, la produccion publicada sigue siendo 53 (1.5.21). Evidencia: play-production-submitted.png. El AAB mantiene SHA-256 `817266d64ab1284ba4dc98e15d63b51313cee13262c62077dd74dd11eb177395`.

Sin cambios en Functions, reglas, IAM, privacidad, iOS, contenido de Comunidad o datos personales; documentos previos de investigacion, marketing y logs conservados sin incluir. Emuladores y compilaciones terminados, sin procesos de validacion pendientes.
