# Android 1.5.13 candidato final de la auditoria

Actualizado: 5 de octubre de 2026. Version 45 publicada exclusivamente en la prueba interna del propietario e instalada en la Lenovo mediante Google Play, sin desinstalar ni borrar datos. Integra la correccion visual de Comunidad detectada con 44 y conserva los ajustes de recuperacion, respaldos y privacidad descritos en los informes anteriores. Las comprobaciones fisicas de esta entrega se registran abajo por separado. Produccion permanece en 40; la web no se ha publicado.

Estado posterior: reemplazada en la prueba interna por [46 / 1.5.14](release-android-1.5.14-46.md), que corrige el enlace repetido detectado en la QA de 45. Los paquetes y resultados de 45 se conservan como historia; los outputs de compilacion ahora pertenecen a 46.

## Paquete exacto

- AAB: `artifacts/android-1.5.13-45-release/su-voz-1.5.13-45.aab`.
- SHA-256: `e3d619b87eacd65dec99e0b2d1b756584daa02361ee19adaf06fe0283b3997b2`.
- APK release probada: SHA-256 `9d33db92c3b6124673aa0799e997272fbbb56b6df532110d587d9f84b89c2e6d`.
- `app.suvoz`, versionCode 45, versionName 1.5.13, PWA 260, minSdk 24, targetSdk 36.
- Base de compilacion: `28e36cb8e09b6eb35381c98b9d03fddb0aeb29c9` mas las fuentes locales revisadas. No afirmar que el commit base contiene estos ajustes.
- Misma firma de subida y permisos que 43, sin URL remota de reemplazo y sin archivos privados en el paquete.

Los AAB 42, 43, los dos intermedios de 44 y el AAB interno exacto 44 permanecen intactos. Antes de construir 45 tambien se archivo la APK release original 44, con hash `4ccd55c8c66da6a34e64907e604535e43e014289111aa816fb64dbb7e3c4d8fe`. El directorio `android/app/build/outputs/` ahora contiene 45, no la 44 congelada.

## Correccion final

La cabecera de Comunidad separa texto y acciones en una columna; los controles envuelven dentro del ancho disponible. No cambia botones, acceso de moderador, cuentas ni contenido. La matriz de presentacion aislada paso 12/12 casos: 320, 390, 800 y 1440 px, moderador claro, moderador oscuro con nombre largo y titulo de Oracion, y rol normal claro. No hubo controles solapados, texto comprimido por los botones ni desbordamiento horizontal.

El CSS incorporado al AAB y a la APK coincide con las fuentes root/www: `478c9a7abc0e4c2f59b97cdee253b1fa8fa070c5d3246789f4eba19c1e13d17e`. La evidencia visual y geometrica esta en `artifacts/validation/community-header-ui-2026-10-05.json`. Las pruebas nativas de este candidato son nuevas, no una transferencia de las anteriores de 44.

## Validaciones del candidato

| Comprobacion | Resultado |
| --- | --- |
| Suite completa Auth, Firestore y Storage locales | 52/52, proyectos demo; sin escrituras en servicios productivos. |
| Dependencias npm, raiz y Functions | Cero vulnerabilidades reportadas por las dos consultas de audit del 5 de octubre; sin actualizar paquetes durante estas consultas. |
| Sincronizacion PWA y Android | Mecanismos existentes correctos; runtime 260. No se sincronizo iOS. |
| Bundle, APK y lint release | Compilacion offline con Java 21 correcta; cero errores de lint y 17 advertencias. Los avisos de Gradle, flatDir y SDK XML siguen visibles. |
| Auditoria del AAB | Bundletool y firma correctos; 146 recursos runtime cotejados byte a byte, sin permisos nuevos ni logs, marketing, Functions, keystores o pruebas empaquetados. |
| Alineacion nativa | Cuatro bibliotecas con segmentos LOAD de 16 KB y PAGE_ALIGNMENT_16K en el bundle. Es comprobacion estatica, no QA fisica en un dispositivo de paginas de 16 KB. |
| Respaldo nativo | Exportacion FileSystem/FileProvider y cancelacion; FileReader real de importacion; nota ficticia previa conservada, preferencias invalidas rechazadas, cancelacion sin escritura y persistencia tras recarga. |
| Navegacion y teclado | Cinco rutas, vertical/horizontal y gestos/tres botones; pestana correcta, barra estable, cero desbordamiento y campo visible sobre el IME real. |

El emulador desechable SuVoz_Audit44 se reutilizo exclusivamente para probar la APK 45; el nombre del AVD no identifica la version instalada. El runner verifica versionCode/versionName, bytes runtime y ausencia de rutas de red antes de instalar/inicializar. Las pruebas usan datos ficticios y no tocan la Lenovo. El selector de importacion recibe un resultado inyectado por instrumentacion: no equivale a elegir manualmente un archivo en todos los fabricantes. El consentimiento de notificaciones y la identidad sintetica se conservan; no se prueban credenciales personales en el emulador.

Evidencia privada fuera de Git: `artifacts/android-1.5.13-45-release/`, con suite congelada, auditoria, manifiesto, firma, lint, capturas y resultados nativos en ambas orientaciones. Los nombres `backup44.json` de la prueba conservan el identificador historico del fixture; su contenido registra versionCode 45 y el entorno incluye los hashes exactos de APK/AAB.

## Publicacion y decisiones externas

Tras la autorizacion del propietario se subio el AAB exacto indicado arriba, sin recompilar, y se publico 45 (1.5.13) exclusivamente en la prueba interna. Play confirma Disponible para verificadores internos, release 6 del canal 4701700649729684709. Se conservo seleccionada solo la lista de QA del propietario de un miembro; las listas de 14 y 29 personas permanecieron sin seleccionar. La revision presento cero errores bloqueantes y la advertencia existente de simbolos nativos, con ReTrace adjunto y cero dispositivos compatibles perdidos. No se aceptaron acuerdos nuevos ni se promovio a produccion.

La Lenovo se actualizo desde su boton Actualizar de Google Play. ADB confirma versionCode 45, versionName 1.5.13, installerPackageName com.android.vending y lastUpdateTime 5 de octubre a las 18:11:57, hora del dispositivo. firstInstallTime conserva el 24 de septiembre. No se uso instalacion lateral ni se borro almacenamiento.

### Pruebas fisicas de 45

| Comprobacion | Resultado |
| --- | --- |
| /hoy en frio | Status ok, COLD, MainActivity; 5 DE OCTUBRE y 1 Samuel 20:12-29 visibles. |
| /lectura?date=2026-10-01 en frio | Status ok, COLD, MainActivity; 1 DE OCTUBRE y 1 Samuel 17:50-18:5 visibles. |
| Mismo enlace repetido tras navegar | FAIL: /hoy recibido de nuevo mientras la app esta en Calendario no cambia de ruta. Una prueba del handler real reproduce el fallo de deduplicacion permanente. Requiere candidato distinto; no modificar el AAB 45 congelado. |
| Lectura offline | Lectura de hoy cargada previamente y visible tras cerrar/reabrir en frio con Wi-Fi apagado. Sin rutas de interfaces fisicas IPv4/IPv6; las rutas virtuales dummy0 de Android no se consideran conexion. Wi-Fi restablecido y habilitado al finalizar. |
| Comunidad | Cabecera y sus cuatro controles separados, sin el solapamiento de 44; Moderacion disponible. |
| Moderacion | Pendientes, Revisadas y Solicitudes de cuenta abren sin error y muestran listas vacias. Sin decisiones ni cambios de contenido. |
| Cuenta | Correo verificado y acceso de moderador conservados tras actualizar y los arranques en frio. Sin introducir credenciales ni recuperar identidad de nuevo. |
| Profundizar | Campo vacio enfocado con teclado Gboard real, visible sobre el teclado y sin hueco negro; posicion restaurada al cerrarlo. Sin escribir o guardar una meditacion. |
| Respaldo | Selector nativo muestra un archivo; cancelado con Back, sin seleccionar destino ni enviar, leer o importar el respaldo. |
| Biblia y calendario | Genesis 1 RV1909 carga; calendario de octubre con el dia 5 y su pasaje correctos. Preferencia diaria TLA conservada. |
| Audio | Estado Escuchando lectura observado y prueba detenida; audibilidad de 45 pendiente de la confirmacion solicitada al propietario. |
| Meditaciones previas | No se leyeron ni editaron. Conservacion visual pendiente de la confirmacion solicitada al propietario; la QA de 43 no la sustituye. |
| Errores de la sesion | 132 lineas del proceso actual examinadas dentro del limite de 3000: cero FATAL EXCEPTION/Fatal signal y cero errores JS criticos coincidentes con el filtro. No es una garantia global ni datos de Vitals. |

Los hashes finales de AAB y APK siguen coincidiendo con los congelados. Evidencia privada en `artifacts/android-1.5.13-45-release/delivery-play.json` y `lenovo-qa/`; el `handoff.json` anterior conserva el estado historico de preparacion, previo a esta subida. La prueba offline inicial se detuvo al contar rutas virtuales dummy0 como externas; se restablecio Wi-Fi antes de aclarar su origen y ejecutar la prueba corregida. No se cuenta ese primer intento como aprobado.

El push a main publica automaticamente la web mediante GitHub Pages. No se ha realizado; requiere una entrega controlada y verificacion posterior de PWA 260, recursos obligatorios, recuperacion/Analytics y teclado iPhone. La subida de un AAB a Play no publica las fuentes ni actualiza la PWA.

Data Safety y pausa de Alpha ya estaban publicados en Play. La matriz conserva cobertura de produccion 40 y no se reduce por los cambios de un candidato interno. App Check sigue OFF: la integracion preparada no es proteccion activa. Registro de proveedores, condiciones/cuota y observacion previa a enforcement siguen siendo una gestion independiente, sin bloquear clientes antiguos.

No existe licencia escrita acreditada para el alcance real de RVR1960, NTV o TLA. SBU pide evaluacion, Tyndale remite a API.BIBLE y Logos a su area de permisos. Los tres borradores preparados siguen sujetos a revision y aprobacion concreta; no se enviaron en esta preparacion ni se aceptaron costos o condiciones. No promover el candidato a produccion dando por concedidos esos derechos.

Permanecen separados: condiciones de tratamiento Analytics que debe revisar el propietario, declaracion Contiene anuncios aplicable a todas las versiones distribuidas, decisiones de retencion antes de TTL/purgas, fuente editorial de 2027 y QA real entre dispositivos, de importacion manual y de otros fabricantes. El detalle operativo e historico se conserva en [el seguimiento de la auditoria](cierre-auditoria-2026-10-03.md) y [el informe de 44](release-android-1.5.12-44.md). Estos pendientes no son defectos nuevos que justifiquen modificar el candidato sin evidencia.

## Alcance conservado

Sin cambios en Functions, reglas, IAM, documentos productivos, privacy.html ni fuentes iOS durante esta entrega; el uso normal de la app puede generar su telemetria habitual. Sin deploy web/Firebase, envio de correos, nuevos acuerdos o promociones a produccion. marketing/ permanece fuera de la entrega. La suite local anterior regenero el archivo ignorado `firestore-debug.log`; no se puede afirmar que su hash siga intacto. `functions/firestore-debug.log` conserva el hash previo. Ambos quedan fuera del commit y de los paquetes. No se corrigieron ni borraron manualmente esos logs.

Las fuentes revisadas quedaron guardadas localmente en `d418587b4fcdcfd4e5123ab6ad92e5141cb479f4`, sin push. El control del diff completo senalo espacios finales existentes en los originales de las tres licencias OFL y la distribucion jsPDF. Se conservan sus bytes y hashes: `.gitattributes` permite solamente esos espacios en los ocho archivos exactos root/www, sin excluir los demas controles ni archivos propios. Este ajuste de metadata y el registro no cambian el AAB/APK congelados.

Comandos reproducibles: `node scripts/audit-android-44.mjs --candidate45`, `node scripts/test-native-backup44.mjs --candidate45`, y el mismo runner con `--navigation`, opcionalmente `--landscape`. Las opciones explicitas evitan sobrescribir los directorios y pruebas congelados de 44.
