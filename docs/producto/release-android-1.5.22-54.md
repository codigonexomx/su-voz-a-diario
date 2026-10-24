# Su Voz Hoy: web 269 y Android 1.5.22 (54)

Fecha: 24 de octubre de 2026, America/Mexico_City.
Base: `0a1ddf077d4ab0167bce1da2cb27ca5610bfb24d`, main sincronizada con origin/main tras fetch.

## Alcance autorizado

El propietario aprobo el diseno local y solicito commit, push, publicacion web y actualizacion completa de Google Play. La entrega se valida primero en su prueba interna exclusiva, sin desinstalar ni borrar datos de la Lenovo.

- Video introductorio visible despues de la portada, solo en las fechas programadas y sin autoplay antes de pulsarlo.
- Un solo acceso a Meditacion junto a Escuchar. Audio compacto con Pausar, Continuar y Detener, sin movimientos de los controles.
- Fuentes y traducciones con controles tactiles de 44 px, tipografias locales, jerarquia secundaria y contraste claro/oscuro.
- Narracion por versiculos, marca independiente de la seleccion de texto, pausa/continuacion y cancelacion protegidas ante respuestas tardias; el desplazamiento automatico se suspende al explorar el texto.
- Acceso compacto Capitulo X de Y / Ver en Biblia bajo la referencia. Abre el capitulo completo en la version elegida en Biblia y permite volver a la misma fecha y posicion del pasaje diario.
- Se retira el bloque pasivo de capitulos del final. No se borran registros de lectura, notas, meditaciones ni progreso.

No cambia Functions, reglas, IAM, privacidad, contenido de Comunidad, catalogos biblicos ni iOS nativo. No se incluyen marketing/ ni los dos documentos previos de investigacion/propuesta.

## Validacion previa

- 53/53 comprobaciones locales; 64/64 con Auth, Firestore y Storage en proyectos demo. Emuladores cerrados al terminar, sin acceso productivo.
- npm audit de raiz y Functions: cero vulnerabilidades.
- Web revisada en 320 y 390 px y escritorio, modos claro/oscuro, tres fuentes, persistencia, tres traducciones, seleccion de versiculos, apertura/cierre de Meditacion y enlace de ida/vuelta a Biblia.
- El propietario confirmo en Mac voz audible, seguimiento al ritmo de los versiculos y pausa/continuacion/detencion. La automatizacion del navegador completa la sintesis instantaneamente y no sustituye esa comprobacion audible.
- Java 21 y Gradle offline: bundleRelease, assembleRelease y lintRelease correctos. Cero errores de lint y 17 advertencias, como en la entrega anterior; no se agregan supresiones.
- Auditoria `node scripts/audit-android-44.mjs --candidate54`: bundletool y firma correctos, mismo certificado de subida, API 24+, target 36 y ningun permiso nuevo.
- Los 165 archivos publicos coinciden con www y no hay archivos privados en el AAB. Las cuatro bibliotecas nativas conservan alineacion 16 KB; no equivale a QA fisica en un dispositivo con paginas de 16 KB.
- Se verificaron los hashes de los paquetes congelados anteriores, incluido 53, sin cambios.

## Paquete congelado

`artifacts/android-1.5.22-54-release/su-voz-1.5.22-54.aab`

SHA-256: `77b1f988b4918881c8fbae953c6a7e9c6b7a9439484dc48313fc3f5c8a0481df`.

Evidencia local: audit-release.json, tests.json, signature-verification.log, bundle-validation.log, android-manifest.xml y lint-summary.json en la carpeta de esta entrega.

## Estado de publicacion previo a la carga

Play confirma produccion 53 (1.5.21) al 100%, publicada el 23 de octubre, y ningun cambio sin publicar. El canal interno conserva exclusivamente Su Voz QA - propietario 2026-10-02 (un miembro); las listas de 14 y 29 personas permanecen sin seleccionar.

ADB confirma Lenovo TB351FU con 53 (1.5.21) instalada por com.android.vending, firstInstallTime 2026-09-24 20:41:57 y lastUpdateTime 2026-10-23 16:28:01. Aun falta actualizar desde Play y validar fisicamente 54; no se considera validado el nuevo binario por las pruebas de la web.

El mecanismo web existente es GitHub Pages desde main, raiz. El remoto configurado es su-voz-a-diario/su-voz-a-diario; GitHub lo redirige a codigonexomx/su-voz-a-diario. No se cambia la configuracion local.

## Resultado del candidato 54

Commit `d486f02c7550ed488ca7cd06a6f44a674fbb82f7` subido a main. Product Validation y Pages correctos: ejecuciones 40130319965 y 40130319969. HTTP 200 y hashes identicos para index, sw, app, CSS y narrador publicados; PWA 269.

Play publico 54 solo en la prueba interna exclusiva el 24 de octubre a las 14:40. Cero errores, cero dispositivos perdidos, una advertencia por simbolos nativos no disponibles. El permiso temporal de archivos de ChatGPT se activo con autorizacion concreta y se desactivo tras la transferencia.

La Lenovo actualizo desde Play a 1.5.22, sin desinstalar ni borrar datos; firstInstallTime intacto. Arranque, texto diario y controles de audio observados: Pausar, Continuar y Detener, con marca avanzando del versiculo 1 al 3. El propietario confirmo audio claro y continuacion correcta. Tambien confirmo en el iPhone el nuevo orden, controles compactos y enlace de ida/vuelta a Biblia de la web 269.

La prueba fisica detecto que centrar el primer versiculo al abrir el capitulo completo podia activar el encabezado del capitulo anterior. No se promovio 54 a produccion. Se prepara 55 para abrir el capitulo en su titulo, sin alterar la navegacion a versiculos concretos ni los datos. No se ejecuto la prueba offline autorizada para 54.
