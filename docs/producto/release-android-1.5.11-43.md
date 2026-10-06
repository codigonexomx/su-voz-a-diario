# Android 1.5.11 (43): Correccion de Sesion y Recuperacion

Fecha: 3 de octubre de 2026. Publicado exclusivamente en prueba interna del propietario; instalacion, recuperacion, persistencia y QA funcional basica confirmadas. No es cierre de la auditoria ni autorizacion para produccion.

## Incidencia y Alcance

En 1.5.10 (42), el propietario comunica identidad sin correo vinculado, ausencia de Moderacion y error generico al confirmar Recuperar cuenta. La cuenta autorizada sigue habilitada, verificada y con rol/pin de moderador coincidentes en la comprobacion de backend de solo lectura. No se reasigno acceso ni se solicitaron credenciales al propietario.

La inicializacion comprobaba currentUser antes de que Firebase Auth restaurase la sesion persistida. Un caso determinista reprodujo la llamada anonima prematura antes del cambio. Esperar authStateReady en App y en el cliente remoto de Biblia evita que esas rutas sustituyan una cuenta vinculada que aun se esta restaurando. Si la restauracion falla o excede el timeout de App, no se crea una identidad anonima para sustituirla.

El paso previo de recuperacion intentaba retirar el registro push del dispositivo. Ante una sesion distinta del propietario registrado, el servidor responde NOT_OWNER y el flujo abortaba antes de validar correo/contrasena. Los 403 recientes del callable son compatibles con ese caso; no se leyo el cuerpo del intento real ni la persistencia privada de la Lenovo. El servicio tiene invocacion publica correcta; no se modifica IAM para solventar este error.

Ahora se permite continuar SOLO ante functions/permission-denied con mensaje NOT_OWNER exacto. El registro ajeno permanece intacto y las escrituras push siguen pausadas hasta terminar el intento de acceso. La contrasena sigue siendo obligatoria; una incorrecta rechaza el acceso. Los otros errores siguen abortando. El servidor y sus reglas siguen comprobando ownership; no se otorga moderacion a una identidad nueva ni se fusionan contenidos de cuentas diferentes. Al recuperar una cuenta distinta que no pueda actualizar el registro push, se conserva el aviso de revisar notificaciones.

No se cambian Functions, reglas, permisos nativos, traducciones, politica de privacidad ni flujos de teclado/audio. No se borraron notas, cuentas ni contenido comunitario. iOS nativo no se sincronizo ni compilo. El incremento PWA 257 -> 258 y Android 42/1.5.10 -> 43/1.5.11 identifica esta correccion; los recursos web locales aun no estan publicados.

## Paquete Exacto

- Fuente base HEAD y origin/main: `28e36cb8e09b6eb35381c98b9d03fddb0aeb29c9`, mas cambios locales de recuperacion, pruebas y version. No afirmar que ese commit por si solo contiene la correccion.
- AAB: artifacts/android-1.5.11-43/su-voz-1.5.11-43.aab, fuera de Git.
- SHA-256: `1e8d3ed45de42b34948c106ac0a8642929f00be6a4f755b58fecd5d11da99ae7`.
- Package app.suvoz; versionCode 43, versionName 1.5.11; PWA 258.
- minSdk 24, targetSdk 36, mismo certificado de subida que 42, ningun permiso nuevo.
- AAB 42 preservado: `91d395748fd208e2cae68ae8d7decea43b76f3bae9dd9caad65b34023d93cd92`.

## Validacion Local

`npm run pwa:sync-version` y `npm run android:sync` ejecutados con los mecanismos existentes. Compilacion con Java 21: `./gradlew :app:bundleRelease :app:lintRelease`, correcta. No se instalo por USB ni se modifico el origen de distribucion de la Lenovo.

Suite completa posterior a TODOS los cambios de runtime: 49/49, proyecto demo-su-voz-stability y servicios locales Auth/Firestore/Storage. Logs fuera del repositorio. Incluye regresiones de restauracion demorada, cuenta vinculada/anonima, inicializacion concurrente de App, fallo de restauracion, consulta de Biblia durante restauracion, NOT_OWNER, credenciales incorrectas y errores diferentes. Las pruebas de reglas mantienen el rechazo de ownership ajeno; no se contacta Firebase productivo para estos fixtures.

Bundletool valida el AAB y su manifiesto; jarsigner confirma la firma. Los 124 recursos de ejecucion coinciden byte a byte con www. Los dos archivos de puente Cordova generados coinciden con los incluidos en 42. Se comprobaron explicitamente las correcciones dentro del paquete, PWA 258, origen nativo sin URL remota y ausencia de logs, artefactos, marketing, Functions, keystores y archivos de pruebas.

Lint: cero errores, 19 advertencias heredadas. Permanecen los avisos de Gradle/flatDir/SDK XML y de certificado autofirmado, timestamp y orden JarInputStream. No se ocultaron ni se actualizaron dependencias para silenciarlos.

El bundle solicita PAGE_ALIGNMENT_16K y las cuatro bibliotecas nativas conservan segmentos LOAD con alineacion de 16 KB. Es evidencia estatica, no prueba en un dispositivo de paginas de 16 KB. Sigue pendiente la disponibilidad de simbolos nativos del proveedor; no se fabricaron ni se afirma resuelta la advertencia de Play.

Evidencia generada local privada: artifacts/android-1.5.11-43/audit-release.json, firma/manifiesto/lint/config y artifacts/validation/tests.json. Recalculo SHA-256 separado confirma ambos paquetes.

## Entrega y QA Fisica

El propietario aprobo expresamente continuar los tres pasos propuestos: publicar 43 solo en su prueba interna, actualizar desde Play y comprobar recuperacion/persistencia. Se recalculo el SHA-256 antes de la carga y despues de publicar; coincide con Paquete Exacto. No se recompilo ni sustituyo el AAB aprobado.

Google Play acepto el archivo su-voz-1.5.11-43.aab y publico 43 (1.5.11) en el segmento interno 4701700649729684709, release 4. La pagina confirma Disponible para verificadores internos y un codigo de version, con ultima actualizacion del 3 de octubre a las 18:49, America/Mexico_City. Solo la lista Su Voz QA - propietario 2026-10-02, un miembro, continua seleccionada; las listas de 14 y 29 miembros siguen sin seleccionar. Produccion fue consultada despues y permanece 40 (1.5.8), activa en 178 paises/regiones. No se promovio a produccion ni se aceptaron condiciones nuevas.

La revision previa presento una unica advertencia por ausencia de simbolos nativos, sin errores bloqueantes. Play conserva el mapping ReTrace y no registra dispositivos anteriormente admitidos que dejen de estarlo en esta version. No describir estos resultados como QA fisica ni como ausencia de fallas/ANR.

Notas publicadas en es-419: Correccion del inicio de sesion y de la recuperacion de cuenta. Prueba interna del acceso a Moderacion y la conservacion de la sesion. Evidencia visual local: /private/tmp/suvoz-play-interna-43-2026-10-03.jpg. El audit-release.json conserva el estado previo a la subida; el registro posterior separado es delivery-play.json.

El propietario confirma que actualizo desde el enlace interno a 1.5.11 y abre normalmente. Consulta USB posterior, solo metadata de paquete: versionCode 43, versionName 1.5.11, installerPackageName e initiatingPackageName com.android.vending. No se instalo por USB ni se leyo la persistencia privada. Este arranque no acredita por si solo la integridad de cada meditacion ni la recuperacion de la cuenta.

El propietario completo personalmente Recuperar cuenta y confirma Cuenta recuperada y aparece Moderacion. Despues confirma que Pendientes, Revisadas y Solicitudes de cuenta abren sin error y que el correo verificado y Moderacion se conservan tras cerrar desde recientes y volver a abrir. Es validacion real de esos flujos en 43; no se compartieron credenciales ni se leyo contenido privado. No certifica una prueba de arranque frio instrumental ni recuperacion en otro dispositivo. No instalar APK por USB: la firma compatible no sustituye el origen de Play.

El propietario confirma ademas lectura de hoy, enfoque del campo de Profundizar sin huecos, audio audible y meditaciones anteriores conservadas en 1.5.11. En una comprobacion posterior confirma lectura previamente cargada al cerrar/reabrir en modo avion, conexion restablecida y selector de respaldo abierto/cancelado sin envio ni importacion. Estos resultados son declaraciones de QA fisica del propietario para 43, no lectura de sus notas ni telemetria instrumental.

1. Version 1.5.11 (43) e instalador Play confirmados por USB; arranque normal y meditaciones conservadas confirmados por el propietario, sin leerlas ni compartirlas.
2. Recuperacion de cuenta, correo verificado, aparicion de Moderacion y apertura de las tres pestanas aprobadas por el propietario. No se crean denuncias ni se borra contenido para probar.
3. Cierre desde recientes y reapertura aprobados por el propietario: la cuenta y Moderacion se conservan. Esta confirmacion fisica es distinta de la prueba determinista y no se presenta como un force-stop/COLD instrumental.
4. Lectura, Profundizar/teclado, audio, lectura previamente cargada offline y cancelacion del selector de respaldo aprobados por el propietario en 43. Conexion restablecida. No se transfieren los resultados historicos de 42.
5. App Links en frio aprobados por ADB autorizado en la Lenovo con 43 instalada desde Play: ambos intentos `am start -W` indican Status ok, LaunchState COLD y app.suvoz/.MainActivity. /hoy inicio en 934 ms y mostro 3 DE OCTUBRE / 1 Samuel 19:1-17; /lectura?date=2026-10-01 inicio en 578 ms y mostro 1 DE OCTUBRE / 1 Samuel 17:50-18:5. Las fechas y referencias coinciden con el catalogo. Se detuvo solo Su Voz entre intentos, sin instalar, borrar datos ni cambiar permisos. La pantalla negra inicial correspondia al dispositivo dormido/Dozing, no a un fallo de render acreditado; tras el desbloqueo personal del propietario y despertar la pantalla se verificaron las lecturas. Capturas publicas fuera de Git: /private/tmp/suvoz-43-cold-hoy-despierta.png y /private/tmp/suvoz-43-cold-lectura-fecha.png.
6. Pendientes separados: recuperacion entre dispositivos e importacion nativa con datos ficticios en almacenamiento aislado. No importar sobre notas personales para producir un resultado de QA.

Actualizacion del 4 de octubre: Data Safety y pausa Alpha ya figuran publicados; restauracion Firestore aislada de 2316 documentos completada. El candidato local 44 agrega la carpeta FileProvider que faltaba para exportar respaldos y la importacion completa validada en emulador, ademas de los ajustes descritos en [su informe](release-android-1.5.12-44.md). La cancelacion declarada por el propietario en 43 no sustituye esa comprobacion nativa ni acredita importacion. Este AAB 43 permanece intacto y su QA fisica es historica; no se transfiere a 44. Derechos, App Check operativo, retencion y calendario 2027 siguen separados. No promover a produccion mientras persistan las puertas aplicables.
