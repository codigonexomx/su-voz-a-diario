# Android 1.5.12 y ajustes de la auditoria

Actualizado: 5 de octubre de 2026. El paquete exacto 44 ya esta disponible en Google Play exclusivamente para la prueba interna del propietario. Produccion sigue en 40 / 1.5.8. La QA fisica de 44 comenzo en la Lenovo actualizada desde Play y tiene resultados parciales descritos abajo. Revelo un ajuste de cabecera, corregido despues e integrado en el [candidato separado 45](release-android-1.5.13-45.md), compilado y validado localmente pero aun no publicado. Este informe conserva las pruebas y entrega de 44; no certifica ausencia de todos los errores, QA fisica completa ni derechos editoriales concedidos.

## Paquete exacto

- Base HEAD y origin/main: `28e36cb8e09b6eb35381c98b9d03fddb0aeb29c9`, mas cambios locales anteriores de recuperacion y los ajustes de este informe. No atribuir todos los cambios a ese commit.
- Candidato: `artifacts/android-1.5.12-44-release/su-voz-1.5.12-44.aab`.
- SHA-256: `db7ebcc369fe3b84d3921ac5b6203d25e219d8639f35d5de318f2d654da3d617`.
- `app.suvoz`, versionCode 44, versionName 1.5.12, PWA 259, minSdk 24 y targetSdk 36.
- Misma firma de subida y mismos permisos que 43; sin URL remota de reemplazo en la configuracion nativa.
- AAB 43 intacto: `1e8d3ed45de42b34948c106ac0a8642929f00be6a4f755b58fecd5d11da99ae7`.
- AAB 42 intacto: `91d395748fd208e2cae68ae8d7decea43b76f3bae9dd9caad65b34023d93cd92`.

Los dos paquetes intermedios de desarrollo de 44 permanecen conservados, sin subir: `android-1.5.12-44` y `android-1.5.12-44-final`. No son el paquete indicado arriba. Sus hashes estan protegidos por el auditor y no se sobrescribieron. La entrega posterior del hash exacto indicado arriba fue autorizada para la prueba interna, no para produccion.

## Entrega oficial interna

Play confirma **Disponible para verificadores internos**, version 44 (1.5.12), un codigo de version y lanzamiento el **5 de octubre, 12:29 p.m.**, hora mostrada por consola. Se subio unicamente el AAB congelado indicado arriba; su hash y el de la APK release permanecen iguales. No se recompilo el AAB durante la entrega ni se promovio otro canal.

Lista seleccionada antes y despues de publicar: **Su Voz QA - propietario 2026-10-02**, un miembro. Las listas de 14 y 29 usuarios siguen sin seleccionar. La comprobacion posterior de Produccion muestra **40 (1.5.8)**. No se aceptaron nuevas condiciones.

Revision de Play: cero errores bloqueantes y una advertencia por simbolos nativos ausentes; el archivo ReTrace si esta adjunto. Todas las filas de dispositivos previamente compatibles mostraron cero dispositivos que dejarian de estar admitidos. Estimacion de descarga para instalacion nueva: 31.2 MB (+2.4 MB), 18 segundos (+2 segundos). La advertencia de simbolos no esta resuelta ni es evidencia de falla observada.

Notas publicadas, es-419:

> Mejoras en la importacion y exportacion de respaldos, conservando los datos locales y la configuracion de notificaciones del dispositivo. Tipografias y generacion de PDF con recursos locales. Los videos se abren en YouTube solo cuando lo eliges. Proteccion de nombres y avatares de Comunidad.

La transcripcion anterior omite tildes por el formato de este documento; el registro privado `delivery-play.json` conserva el texto exacto publicado. Captura: `/private/tmp/suvoz-play-interna-44-2026-10-05.png`. Enlace del propietario para actualizar desde Play, sin desinstalar ni borrar datos: https://play.google.com/apps/internaltest/4701700649729684709.

## Ajustes implementados

| Hallazgo | Ajuste y evidencia |
| --- | --- |
| La restauracion validaba primero las notas y despues aplicaba preferencias sin una transaccion completa. | BackupService valida todo antes de confirmar; revierte notas, indices, avatar y preferencias si falla una escritura posterior. Regresiones de cuota, cancelacion, JSON corrupto, FileReader y preferencias invalidas. |
| Un respaldo podia trasladar el consentimiento y configuracion push de otro dispositivo. | No importa consentimiento ni identidad Auth. Si push ya esta activado, conserva tambien hora y dias registrados en este dispositivo. El avatar usa solo el UID actual, no una cuenta incluida en el archivo. Limite de archivo de 20 MB antes de leerlo. |
| ShareService escribe el respaldo en CACHE/backups, pero FileProvider solo admitia imagenes y PDF. | Se autoriza exclusivamente la subcarpeta `backups/`. No se abre toda la cache, almacenamiento externo o documentos privados. Exportacion real y permiso temporal de lectura comprobados en emulador. |
| Tipografias y jsPDF requerian conexiones externas de arranque. | Doce estilos originales alojados localmente, tres licencias OFL y jsPDF 4.2.1 con MIT. Manifiesto de procedencia, bytes y SHA-256; assets incluidos en precache obligatorio. |
| Un iframe YouTube se cargaba antes de que el usuario decidiera reproducirlo. | Sustituido por enlace explicito Abrir en YouTube, sin iframe, miniatura externa o preconnect. Conserva los cinco videos/fechas existentes; valida origen/ID y escapa texto. |
| El title del avatar insertaba nombres heredados sin escapar. | Nombre e icono tratados como texto; color SVG limitado a hexadecimal. Regresion con comillas, atributos y etiquetas, sin cambiar perfiles guardados ni el selector. No se afirma explotacion observada. |
| Faltaba integracion cliente compatible para App Check futuro. | Servicio web reCAPTCHA Enterprise y puente Android Play Integrity preparados y probados. Configuracion DESACTIVADA por defecto; ningun token debug, proveedor registrado o enforcement activado. |

Se preservan las correcciones anteriores de restauracion Auth y recuperacion NOT_OWNER exacto. No se modifican reglas, Functions, datos productivos, politica publicada, catalogo editorial ni iOS. No se leyeron ni importaron meditaciones personales. marketing/ y los logs existentes se conservan.

## Comprobaciones ejecutadas

Suite completa despues de todos los cambios de runtime: **52/52** comprobaciones, con Auth, Firestore y Storage locales en proyecto demo. Incluye reglas, ownership, moderacion, eliminacion, concurrencia, recuperacion, notas, Biblia, enlaces, teclado, navegacion, Analytics y nuevos servicios. Los rechazos PERMISSION_DENIED esperados son casos negativos, no fallas de produccion. No se reutilizan resultados historicos para acreditar 44.

`npm run android:sync` y Java 21 con `./gradlew :app:bundleRelease :app:assembleRelease :app:lintRelease --offline`: correctos. Bundletool valida el AAB; jarsigner verifica firma. Los 146 recursos runtime coinciden con www; no incluye logs, pruebas, marketing, Functions ni keystores. Lint: cero errores y 19 advertencias heredadas, principalmente versiones de dependencias/recursos. No se ocultaron ni se hicieron actualizaciones masivas para silenciarlas.

Las cuatro bibliotecas nativas tienen segmentos LOAD de 16 KB y el bundle solicita PAGE_ALIGNMENT_16K. El emulador utilizado tiene paginas de 4 KB: NO es prueba de dispositivo 16 KB. Continuan separados los simbolos nativos que debe facilitar el proveedor y los datos futuros de Vitals.

### Respaldo nativo

Prueba optativa de la APK release actual en AVD desechable `SuVoz_Audit44`, Android API 36, serial `emulator-5562`. Red externa bloqueada antes de instalar/inicializar; sin Lenovo ni proyecto Firebase real. Version instalada y fuentes runtime de la APK cotejadas. Solo fixtures ficticios.

Se comprobo FileSystem -> FileProvider -> chooser nativo -> cancelacion, importacion por el input real y FileReader del WebView, nota previa conservada, consentimiento push no importado, cancelacion sin confirmacion/escritura, preferencias invalidas rechazadas y persistencia tras recargar. La identidad se comprueba mediante un marcador sintetico, no una cuenta personal. La instrumentacion inyecta el resultado del selector; NO acredita eleccion manual en el selector de archivos de todos los fabricantes.

Los intentos iniciales de la instrumentacion fallaron: el toque ocurria durante scroll, el boton de ajustes cerraba una pantalla ya abierta tras recargar y la portada interceptaba un toque. Se corrigieron las esperas/estado de la prueba, no se eliminaron barreras del producto para forzarla. El fallo real de FileProvider si requirio el ajuste de runtime descrito arriba.

Evidencia privada fuera de Git: `artifacts/android-1.5.12-44-release/native-backup-qa/`, con resultado, captura, hashes y entorno. `audit-release.json` conserva la auditoria local ANTERIOR a la subida; sus campos uploadedToPlay=false no describen la entrega posterior, registrada por separado en `delivery-play.json`. La suite congelada es `artifacts/android-1.5.12-44-release/tests.json`. Scripts reproducibles: `validate-local-backup.mjs`, `validate-app-check.mjs`, `validate-private-assets.mjs`, `test-native-backup44.mjs` y `audit-android-44.mjs`.

### Navegacion y teclado nativos

El 5 de octubre se comprobaron cinco rutas en vertical y horizontal, con gestos y con tres botones: pestana activa correcta, barra estable, cero desbordamiento horizontal y espacio fisico respecto a los controles Android. El campo de busqueda recibe un toque nativo real despues de llevarlo a la vista; conserva el foco y queda completamente visible sobre el IME real. La navegacion inferior queda inert mientras el teclado esta abierto y se recupera al cerrarlo.

La primera instrumentacion enfocaba por JavaScript antes de asegurar que el toque alcanzara el campo visible en horizontal; su captura no acreditaba visibilidad del input. Se reforzo solo la prueba y se volvio a ejecutar en ambas orientaciones, con resultado correcto. Se compilo exclusivamente el APK de AndroidTest; el AAB publicado y la APK release no cambiaron. No hubo correccion adicional del runtime para conseguir este resultado.

Evidencia: `native-navigation-qa/portrait/` y `native-navigation-qa/landscape/`, con resultados, capturas y entorno, bajo el directorio del paquete. Prueba en API 36 aislada y offline, no todos los fabricantes ni Comunidad online. El emulador quedo cerrado; no se uso la Lenovo.

### Interfaz y PDF

Navegador local aislado: lectura, navegacion y Profundizar en escritorio y 390 x 844; sin desbordamiento horizontal. Enlace de video visible y ningun iframe. Fuentes locales y PDF real de cuatro paginas con texto ficticio; primera pagina renderizada/inspeccionada sin solapamientos. No se pulsaron videos, pagos ni publicaciones reales.

Servidor de QA utilizado en `http://127.0.0.1:8766`, solo www y CSP que bloquea conexiones externas; quedo cerrado al terminar. El error esperado de registro SW por importScripts Firebase remoto bloqueado en este entorno NO acredita fallo del SW publicado. Esta vista no sustituye pruebas online de Comunidad, Analytics ni la actualizacion real de PWA.

### Comprobacion fisica desde Play

El propietario reconecto la Lenovo TB351FU y actualizo desde Play. ADB confirma 1.5.12 (44), instalador com.android.vending, Android 16 / API 36 y paginas de 4096 bytes. Sin reinstalacion por ADB, borrado de datos ni cambio de permisos o ajustes de bloqueo.

| Recorrido de 44 | Resultado fisico |
| --- | --- |
| Enlace /hoy en frio | Intent implicito, Status ok, LaunchState COLD y MainActivity. Pantalla 5 DE OCTUBRE / 1 Samuel 20:12-29, coincidente con el catalogo. |
| Audio | Control Escuchando lectura visible; el propietario confirma voz claramente audible. Se detuvo y reaparecio Escuchar lectura, sin cambiar volumen. |
| Enlace con fecha en frio | Intent implicito de /lectura?date=2026-10-01, Status ok, LaunchState COLD y MainActivity. Pantalla 1 DE OCTUBRE / 1 Samuel 17:50-18:5, coincidente con el catalogo. |
| Biblia | Genesis 1 / RV1909 cargo despues del estado transitorio Cargando capitulo. |
| Busqueda y teclado | IME real, campo visible y sin hueco negro; barra inferior restablecida al cerrarlo. Sin escribir texto. No sustituye la prueba de Profundizar. |
| Calendario | Octubre de 2026, dia 5 seleccionado y pestana activa correcta despues de la transicion. |
| Comunidad y Moderacion | Carga online completa, boton de moderador visible. Pendientes, Revisadas y Solicitudes de cuenta abrieron sin error; sin actuar sobre casos, cuentas o contenido. |
| Profundizar | Campo vacio de hoy enfocado con toque nativo; IME real, campo visible y sin hueco negro. Disposicion recuperada al cerrar el teclado, sin escribir ni borrar texto. |
| Exportacion de respaldo | Selector Android visible con un archivo; cancelado con Atras sin elegir destino ni enviar, leer o copiar su contenido al Mac. |
| Offline y meditaciones anteriores | Pendientes de esta version; no se transfieren las confirmaciones anteriores de 43. |

Hallazgo visual de 44: en Comunidad, los botones de identidad, normas, autores bloqueados y moderacion comprimen y solapan el subtitulo en la disposicion probada de la Lenovo. Las acciones funcionan. La causa se reprodujo con el contenedor y CSS reales a 800 px, equivalente a la pantalla de 1200 px con densidad 240: el texto quedaba reducido a unos 45 px de ancho.

Correccion posterior en `css/styles.css` y su espejo www: una columna de grid separa texto y acciones; los controles envuelven dentro del ancho disponible. Matriz local **12/12**: 320, 390, 800 y 1440 px, moderador claro, moderador oscuro con titulo de Oracion/nombre largo, y rol normal claro. Texto y controles separados 12 px, sin controles solapados o fuera de la cabecera ni desbordamiento horizontal. Regresiones de Comunidad, audio, navegacion y Profundizar correctas. Solo datos ficticios, fuentes locales y CSP sin conexiones externas.

Evidencia: `artifacts/validation/community-header-ui-2026-10-05.json` y `/private/tmp/suvoz-community-header-local-390.png`. Fixture reproducible con `node scripts/test-community-header-ui.mjs`; calcula geometria mediante `test-community-header-layout.js` y muestra el resultado en pantalla. El servidor de QA se cierra al terminar la comprobacion.

El SHA-256 del CSS local y www es `478c9a7abc0e4c2f59b97cdee253b1fa8fa070c5d3246789f4eba19c1e13d17e`. Este ajuste NO esta en el AAB/APK congelados de 44 ni en la Lenovo. Posteriormente se preparo 45 con PWA 260, hash y suite 52/52 propios, sin recompilar 44. La coincidencia de los 146 assets descrita arriba corresponde al momento de construir 44; las fuentes CSS actuales difieren de ese paquete por la correccion incorporada a 45.

El intento optativo de abrir/cancelar el selector de importacion no produjo una identificacion de actividad concluyente. No se selecciono archivo ni se importo sobre notas personales, y el intento no se cuenta como una importacion fisica aprobada. El fallo de bufer de una captura del enlace fechado se corrigio solo en la herramienta del Mac; la captura completa posterior acredita el resultado, sin cambio de la app.

El dominio suvoz.app figura verificado y la apertura de enlaces permitida. La seleccion por usuario aparece deshabilitada en metadata, aunque los intents implicitos probados abrieron correctamente Su Voz. No se cambio esa preferencia ni se oculta la discrepancia. Los scans acotados del proceso al iniciar y despues de estos recorridos no encontraron patrones de error JS critico o FATAL EXCEPTION; no demuestran ausencia global de errores. El ultimo abarca las ultimas 2000 lineas del proceso, sin conservar ni mostrar logs crudos.

Registro separado: `artifacts/android-1.5.12-44-release/physical-qa-2026-10-05.json`. `delivery-play.json` conserva el estado de entrega anterior a esta prueba. La pantalla dormida produjo capturas negras; el propietario desbloqueo personalmente y esas capturas no se cuentan como fallas de renderizado ni como pruebas aprobadas. Los resultados de 43 siguen separados. No se atribuye QA fisica completa a iPhone, segunda cuenta/dispositivo, accesibilidad o paginas 16 KB.

## Estado externo comprobado

Consulta de solo lectura de Play el 4 de octubre:

- Envio 47, un cambio Seguridad de los datos: **Publicado**, 3 de octubre 9:40 p.m., hora mostrada por consola; envio 9:16 p.m. No publica un binario Android.
- Envio 46, un cambio Estado del segmento / Pausar Alpha: **Publicado**, 3 de octubre 11:26 a.m.; envio 11:01 a.m. No borra listas ni paquetes.
- El 5 de octubre se comprobo nuevamente produccion 40 / 1.5.8, sin cambios. La entrega interna se actualizo exclusivamente a 44 / 1.5.12, como consta arriba; no hubo promocion a produccion.

Capturas: `/private/tmp/suvoz-data-safety-publicada-2026-10-04.png` y `/private/tmp/suvoz-alpha-pausa-publicada-2026-10-04.png`. La matriz publicada sigue cubriendo la version productiva con reproductor integrado; NO se reduce por un cambio distribuido solo en prueba interna.

Busqueda Gmail acotada al expediente el 5 de octubre, incluidos spam/papelera: nuevas respuestas sustantivas, leidas completas. SBU confirma responsable y solicita evaluar el formulario de agosto; la regla general es solicitar como organizacion, con posible excepcion individual, y las condiciones dependen del uso/distribucion, seguridad y estrategia financiera. Tyndale no ofrece permiso directo para el alcance propuesto y canaliza NTV a API.BIBLE. Logos canaliza a su area de permisos, sin conceder licencia ni confirmar costos/API.

Se verifico el catalogo publico indicado por Tyndale: NTV figura como Standard License en API.BIBLE, con un canal oficial de soporte. Esa disponibilidad no confirma offline/TTS/imagen/PDF ni autoriza el texto ya incluido. La pagina indicada por Logos trata medios propios, no una licencia general RVR1960. No se reproduce correspondencia privada en este documento.

Se prepararon tres borradores separados, comprobando antes que no existieran duplicados. Solicitan las condiciones concretas, no adjuntan formularios antiguos ni aceptan costos/contratos. El de SBU pregunta por una solicitud actualizada o copia corregida antes de reutilizar el formulario con datos incorrectos, y por TLA por separado. Los envios requieren revision y aprobacion concreta; no se consideran enviados por estar guardados como borradores. Ninguna respuesta concede licencia.

## Puertas que siguen abiertas

| Pendiente | Condicion concreta de cierre |
| --- | --- |
| QA fisica de 44 y produccion | Actualizacion oficial desde Play y recorridos parciales acreditados arriba. Completar los flujos pendientes sin importar sobre datos personales. Produccion requiere aprobacion separada y puertas de contenido resueltas. |
| Cabecera de Comunidad | Fuentes corregidas y matriz local 12/12. Integrar y validar en otro candidato con hash propio; no esta en la 44 distribuida. |
| Publicacion web | Revisar/commit/push controlados de los cambios y validar version 259 servida, actualizacion SW, Auth/Analytics y teclado iPhone tras publicacion. No se hizo deploy. |
| App Check operativo | Registro de proveedores exactos, clave web, vinculo/certificado Play, revision de condiciones/cuota y observacion de tokens. Enforcement separado, sin bloquear clientes antiguos. Configuracion OFF no equivale a proteccion activa. |
| RVR1960, NTV y TLA | Autorizacion escrita para el alcance real o alternativa editorial aprobada y verificada. Nuevas respuestas y borradores descritos arriba; seguir sus requisitos, no insistir como si no hubieran contestado. Comprar Logos/usar API/recibir una canalizacion no concede redistribucion. |
| Avisos y condiciones | Revisar Contiene anuncios para las versiones efectivamente distribuidas y los terminos de tratamiento Analytics pendientes; no aceptarlos en nombre del propietario. Actualizar informacion de terceros al publicar el cambio de comportamiento, conservando cobertura de versiones antiguas. |
| Retencion | Aprobar plazos/finalidades y alcances separados antes de cualquier TTL, lifecycle o purga. No usar la autorizacion de los 1007 huerfanos para borrar otros datos. La restauracion Firestore aislada de 2316 documentos ya fue comprobada y se conserva. |
| Calendario 2027 | Entregar/aprobar fuente editorial con derechos y validar entradas. No se fabricaron nuevas lecturas. |
| QA adicional | Recuperacion real entre dispositivos, selector manual/importacion nativa en fabricantes e iPhone, pagina 16 KB y operacion/push segun alcance. Los fixtures y pruebas parciales no sustituyen esos resultados. |

No hubo commit, push, deploy web/Firebase, aceptacion de contratos, cambio de IAM ni borrado en esta entrega. Si hubo subida y publicacion interna del AAB exacto 44, autorizada. HEAD y origin/main siguen iguales; `git diff --check` correcto. Las fuentes conservan cambios locales pendientes de entrega controlada; la subida a Play no los publica en Git ni en la web. No afirmar cierre global de la auditoria mientras estas puertas permanezcan abiertas.

## Referencias tecnicas

- [Capacitor Share y carpetas de FileProvider](https://capacitorjs.com/docs/apis/share).
- [jsPDF 4.2.1](https://github.com/parallax/jsPDF/releases/tag/v4.2.1).
- [App Check con reCAPTCHA Enterprise](https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider).
- [Puente App Check Firebase JS del proveedor](https://github.com/capawesome-team/capacitor-firebase/blob/main/packages/app-check/docs/firebase-js-sdk.md). Es una dependencia de Capawesome, no un SDK Capacitor avalado por Google.
- [Catalogo NTV de API.BIBLE](https://api.bible/bibles?search=NTV), consultado el 5 de octubre.
- [Permisos de medios Logos](https://www.logos.com/copyright-permissions), sin extrapolarlos a textos de terceros.
