# Android 1.5.14: correccion de enlaces repetidos

Fecha: 5 de octubre de 2026, America/Mexico_City. Candidato separado de 45; no reemplaza sus paquetes congelados ni convierte las pruebas anteriores en QA de 46. Publicado en la prueba interna del propietario e instalado desde Google Play en la Lenovo. Tras completar esa QA y recibir la autorizacion expresa del propietario, el mismo paquete 46 se envio a revision para produccion. No se acredita todavia su disponibilidad publica; 40 / 1.5.8 es la ultima version productiva confirmada.

## Entrega a Produccion

Push no forzado correcto de los tres commits pendientes: d418587, 2be6e10 y 7d534fb. HEAD y origin/main coinciden en `7d534fb3d7449045dc6232f98f897a81d0e78a86`. GitHub notifico el traslado del repositorio a codigonexomx/su-voz-a-diario y acepto el push mediante la redireccion existente; no se cambio la configuracion local del remoto. marketing/ permanece fuera de la entrega.

[Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37397025573) y [Pages build and deployment](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37397025135) terminaron correctamente para ese commit. CI ejecuto la suite completa con Java 21, ambos npm audit y la comprobacion de archivos sin cambios. Este resultado no borra los intentos locales fallidos documentados abajo ni demuestra su causa.

La web publica https://suvoz.app sirve PWA 261. Comprobacion HTTP 200 y coincidencia byte a byte de index.html, sw.js, js/app.js, css/styles.css, css/fonts-local.css, BackupService.js, AnalyticsService.js, jsPDF local y privacy.html. measurementId G-X95Y1G3BE0 e import de Firebase Analytics presentes en index.html. Lectura de hoy, entrada/salida de Profundizar y calendario comprobados en navegador, sin escribir notas ni crear contenido. No se registraron errores en el log disponible de esa sesion; no equivale a certificacion de todos los dispositivos ni de recepcion en Analytics.

Google Play acepto un unico cambio a revision: Produccion, 46 (1.5.14), Iniciar lanzamiento completo, 100% en los paises ya seleccionados. Se promovio el AAB existente desde la prueba interna, sin nueva subida ni recompilacion. Cero errores bloqueantes y cero dispositivos antes compatibles perdidos; sigue el aviso por simbolos de depuracion nativos. La consola muestra Cambios en la etapa de revision con verificaciones rapidas en curso. La publicacion administrada existente sigue desactivada: una aprobacion puede publicar la version sin otra accion, pero este envio NO demuestra aprobacion ni disponibilidad publica. No se aceptaron acuerdos nuevos ni se modificaron Data Safety, listas internas, Functions, reglas, IAM o iOS.

La autorizacion de publicar no concede derechos sobre traducciones biblicas. Licencias escritas, decisiones de App Check, retencion, condiciones/avisos y fuente editorial 2027 siguen abiertas por separado. No se declara cerrada toda la auditoria.

## Paquete Exacto

- AAB: `artifacts/android-1.5.14-46-release/su-voz-1.5.14-46.aab`.
- SHA-256: `21b76ddc793316dec2bce201dcc755a0e46f339d0bb8bf65dccadd1c3d28ebf6`.
- APK: `app-release.apk`, SHA-256 `cbde57c4451020f3abeaa081ca307b6806ce3a44b48d60ba48739aea697929a4`.
- `app.suvoz`, versionCode 46, versionName 1.5.14, PWA 261, minSdk 24, targetSdk 36.
- Base: `2be6e10c9218de721f86683bb72859abba245b56` mas las fuentes locales de esta correccion. El commit base no contiene por si solo 46.

## Correccion Acotada

En la Lenovo con 45, abrir /hoy en frio funciona, pero volver a recibir el mismo enlace despues de navegar a Calendario deja la pantalla en Calendario. La deduplicacion conservaba indefinidamente el ultimo enlace sin comprobar la ruta actual.

El handler ahora ignora una entrega repetida solamente si la ruta destino sigue abierta y no necesita restablecer una lectura historica a hoy. No cambia el parser de enlaces, las cuentas, las notas, los permisos ni el backend. Las entregas duplicadas del arranque siguen sin duplicar render ni Analytics.

La prueba ejecuta el handler real extraido mediante AST: fallo antes de corregirlo y pasa despues. Incluye reapertura de /hoy tras navegar, cambio de lectura historica a hoy, enlace fechado repetido, entregas concurrentes y rechazo de dominio ajeno.

## Validaciones Nuevas

Compilacion offline con Java 21: bundleRelease, assembleRelease, lintRelease y assembleReleaseAndroidTest correctos. Auditoria 46: firma y certificado de subida correctos, bundletool valido, 146 recursos runtime root/www/AAB coincidentes, sin archivos privados ni permisos nuevos. Cero errores de lint y 17 advertencias; no se afirma ausencia de avisos. Cuatro bibliotecas alineadas a 16 KB y bundle PAGE_ALIGNMENT_16K, comprobacion estatica, no QA fisica de 16 KB.

Suite final nueva: 52/52 con Java 25 y proyecto primario demo-su-voz-stability, incluidas Auth, reglas de Storage y concurrencia. No se cambiaron Functions, reglas ni aserciones para obtener ese resultado. Se preservan tambien los intentos previos: dos ejecuciones Java 21 con 51/52 y transaccion cerrada en una prueba concurrente; una ejecucion diagnostica con otro proyecto primario y 50/52, sin cargar correctamente las fixtures de Auth/Storage del proyecto esperado. La ejecucion final restablece el proyecto primario original. La causa exacta del fallo concurrente no esta demostrada; no atribuirla con certeza a Java ni a produccion. Firebase documenta diferencias de transacciones del emulador respecto a produccion en [su documentacion oficial](https://firebase.google.com/docs/emulator-suite/connect_firestore#how_the_cloud_firestore_emulator_differs_from_production), lo que no demuestra la causa de esta incidencia.

Los emuladores se ejecutaron con configuracion temporal fuera del repositorio y proyectos demo, sin escrituras productivas. Los hashes de ambos firestore-debug.log permanecen iguales al baseline de esta correccion; no revierte la regeneracion del log raiz registrada durante la fase anterior. AAB/APK 45 y paquetes anteriores intactos. Evidencia privada, excluida de Git, en `artifacts/android-1.5.14-46-release/`.

Nueva prueba nativa de respaldo 46 en AVD desechable, sin red externa antes de instalar/iniciar: FileSystem/FileProvider y cancelacion de exportacion correctos; FileReader real de importacion, nota ficticia e identidad previas conservadas, consentimiento de notificaciones conservado, preferencias invalidas rechazadas sin escritura, cancelacion sin escritura y persistencia tras recarga. El resultado del selector se inyecta por instrumentacion: no equivale a una importacion manual en todos los fabricantes. Solo datos ficticios, sin tocar la Lenovo. Evidencia en `native-backup-qa/`; el nombre historico backup44 del fixture no identifica la version instalada, que es 46.

Matriz nativa nueva de navegacion 46: vertical y horizontal, gestos y tres botones, cinco rutas por modo con pestana correcta, barra visible y cero desbordamiento. Campo de busqueda visible sobre el IME real y posicion restaurada al cerrarlo. Capturas y mediciones en `native-navigation-qa/`; comprobacion visual de muestras vertical y horizontal correcta. Emulador cerrado al terminar.

## Pruebas Fisicas de 46

Google Play completo la actualizacion el 5 de octubre a las 18:41:33, hora del dispositivo. ADB confirma 46 / 1.5.14 e instalador com.android.vending; firstInstallTime conserva el 24 de septiembre. El primer intento de Play fallo con status 1010 al obtener metadata; habia espacio suficiente y la version siguio en 45. Tras cerrar el aviso y renovar la misma ficha, un unico reintento completo la actualizacion. No esta demostrada la causa exacta del primer fallo. Sin desinstalacion, instalacion lateral, limpieza de datos, cambio de cuenta o permisos.

| Comprobacion | Resultado nuevo |
| --- | --- |
| /hoy en frio | MainActivity, COLD, Status ok; 5 DE OCTUBRE y 1 Samuel 20:12-29 visibles. |
| /hoy repetido tras Calendario | PASS: regresa a la lectura de hoy. Fallo de 45 resuelto en este recorrido. |
| /lectura?date=2026-10-01 en frio | MainActivity, COLD, Status ok; 1 DE OCTUBRE y 1 Samuel 17:50-18:5 visibles. |
| Enlace fechado repetido tras Calendario | PASS: vuelve al dia 1 y su pasaje, sin quedarse en Calendario. |
| Comunidad | Cabecera y cuatro controles separados, sin solapamiento; Moderacion disponible. |
| Moderacion | Pendientes, Revisadas y Solicitudes de cuenta abren sin error, listas vacias; sin decisiones o cambios de contenido. |
| Cuenta | Correo verificado conservado en Ajustes tras actualizar y varios arranques en frio. Sin introducir credenciales. |
| Profundizar | Campo vacio enfocado con Gboard real, visible sobre el IME y sin hueco negro; posicion restaurada al cerrar teclado. Sin escribir ni guardar texto. |
| Respaldo | Selector nativo con un archivo; cancelado con Back sin destino, envio, lectura ni importacion. |
| Audio | Escuchando lectura observado y prueba detenida; propietario confirma voz clara en 46. |
| Meditaciones previas | Propietario confirma conservacion en 46; no se leyeron ni editaron sus textos. |
| Lectura offline | PASS nuevo de 46 tras aprobacion concreta: Wi-Fi deshabilitado, cero rutas externas predeterminadas IPv4/IPv6, arranque COLD y lectura de hoy previamente cargada visible. Wi-Fi restablecido y conectado inmediatamente; sin tocar datos moviles, cuentas o notas. Rutas virtuales dummy0 excluidas del conteo de conexion fisica. |
| Errores de la ultima sesion | 456 lineas del proceso actual dentro del limite de 3000; cero coincidencias del filtro de errores JS criticos/FATAL. No es garantia global ni resultado de Vitals. |

Wi-Fi permanece habilitado y conectado. La Lenovo queda en la lectura de hoy, audio detenido. Evidencia privada en `delivery-play.json` y `lenovo-qa/`, con version, capturas y hashes; sin incorporar respaldos personales a Git.

## Registro Previo de Prueba Interna

Play confirma 46 (1.5.14) Disponible para verificadores internos, release 7, canal 4701700649729684709, 5 de octubre a las 18:39. Se conserva seleccionada solo la lista Su Voz QA - propietario 2026-10-02, de un miembro; listas de 14 y 29 sin seleccionar. Se subio el AAB exacto sin recompilar, sin acuerdos nuevos y sin promocion a produccion. Cero errores bloqueantes y cero dispositivos antes compatibles perdidos; queda la advertencia existente por simbolos nativos no disponibles, con ReTrace adjunto.

Durante la entrega interna no se habia hecho push ni publicado la web. La entrega posterior autorizada y verificada se describe al principio de este informe. No se desplegaron Functions, reglas ni Firebase, ni se sincronizo iOS. App Check sigue OFF.

No existe licencia escrita acreditada para el alcance real de RVR1960, NTV o TLA. Los borradores de canalizacion siguen sujetos a aprobacion concreta; no se enviaron ni se aceptaron costos, contratos o condiciones durante esta entrega. No promover dando por concedidos esos derechos. Condiciones de Analytics, declaracion de anuncios, retencion y fuente editorial 2027 permanecen como decisiones separadas, descritas en [el seguimiento de auditoria](cierre-auditoria-2026-10-03.md). No se declara cerrada toda la auditoria.
