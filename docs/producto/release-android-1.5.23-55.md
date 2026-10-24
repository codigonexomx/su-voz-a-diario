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

Commit/push, CI/Pages, carga interna, QA fisica y envio de produccion: en curso. Se registraran solo resultados comprobados.
