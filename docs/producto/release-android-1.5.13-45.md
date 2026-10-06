# Android 1.5.13 candidato final de la auditoria

Actualizado: 5 de octubre de 2026. Candidato 45 compilado y validado localmente. Integra la correccion visual de Comunidad detectada en la Lenovo con 44 y conserva los ajustes de recuperacion, respaldos y privacidad descritos en los informes anteriores. No se ha subido a Play, instalado en la Lenovo ni publicado en la web. La ultima consulta de Play acredita interna 44 y produccion 40; no atribuir a 45 las pruebas fisicas de esas versiones.

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

El candidato esta listo para solicitar la entrega interna del hash indicado arriba, exclusivamente al propietario. La nueva entrega requiere aprobacion concreta; no se sustituye el AAB 44 ya distribuido ni se acepta un contrato para completar el proceso. Una vez distribuido oficialmente, comprobar la cabecera de Comunidad sin desinstalar ni borrar datos y acreditar la actualizacion de 45 por separado.

El push a main publica automaticamente la web mediante GitHub Pages. No se ha realizado; requiere una entrega controlada y verificacion posterior de PWA 260, recursos obligatorios, recuperacion/Analytics y teclado iPhone. La subida de un AAB a Play no publica las fuentes ni actualiza la PWA.

Data Safety y pausa de Alpha ya estaban publicados en Play. La matriz conserva cobertura de produccion 40 y no se reduce por los cambios de un candidato interno. App Check sigue OFF: la integracion preparada no es proteccion activa. Registro de proveedores, condiciones/cuota y observacion previa a enforcement siguen siendo una gestion independiente, sin bloquear clientes antiguos.

No existe licencia escrita acreditada para el alcance real de RVR1960, NTV o TLA. SBU pide evaluacion, Tyndale remite a API.BIBLE y Logos a su area de permisos. Los tres borradores preparados siguen sujetos a revision y aprobacion concreta; no se enviaron en esta preparacion ni se aceptaron costos o condiciones. No promover el candidato a produccion dando por concedidos esos derechos.

Permanecen separados: condiciones de tratamiento Analytics que debe revisar el propietario, declaracion Contiene anuncios aplicable a todas las versiones distribuidas, decisiones de retencion antes de TTL/purgas, fuente editorial de 2027 y QA real entre dispositivos, de importacion manual y de otros fabricantes. El detalle operativo e historico se conserva en [el seguimiento de la auditoria](cierre-auditoria-2026-10-03.md) y [el informe de 44](release-android-1.5.12-44.md). Estos pendientes no son defectos nuevos que justifiquen modificar el candidato sin evidencia.

## Alcance conservado

Sin cambios en Functions, reglas, IAM, datos productivos, privacy.html ni fuentes iOS. Sin deploy, envio de correos, nuevos acuerdos o promociones a produccion. marketing/ permanece fuera de la entrega. La suite local regenero el archivo ignorado `firestore-debug.log`; no se puede afirmar que su hash siga intacto. `functions/firestore-debug.log` conserva el hash previo. Ambos quedan fuera del commit y de los paquetes. No se corrigieron ni borraron manualmente esos logs.

Las fuentes revisadas quedaron guardadas localmente en `d418587b4fcdcfd4e5123ab6ad92e5141cb479f4`, sin push. El control del diff completo senalo espacios finales existentes en los originales de las tres licencias OFL y la distribucion jsPDF. Se conservan sus bytes y hashes: `.gitattributes` permite solamente esos espacios en los ocho archivos exactos root/www, sin excluir los demas controles ni archivos propios. Este ajuste de metadata y el registro no cambian el AAB/APK congelados.

Comandos reproducibles: `node scripts/audit-android-44.mjs --candidate45`, `node scripts/test-native-backup44.mjs --candidate45`, y el mismo runner con `--navigation`, opcionalmente `--landscape`. Las opciones explicitas evitan sobrescribir los directorios y pruebas congelados de 44.
