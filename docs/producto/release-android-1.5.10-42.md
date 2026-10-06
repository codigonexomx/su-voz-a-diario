# Android 1.5.10 (42): Preparacion y Prueba Interna

Fecha: 3 de octubre de 2026. No es un cierre de produccion ni una certificacion de ausencia de errores.

## Paquete Exacto

- Fuente funcional base: c778836358b21c13137e96002bed66dace68adf3, con el cambio exclusivo de versionCode 41 -> 42 y versionName 1.5.9 -> 1.5.10 en android/app/build.gradle.
- AAB: artifacts/android-1.5.10-42/su-voz-1.5.10-42.aab, fuera de Git.
- SHA-256: `91d395748fd208e2cae68ae8d7decea43b76f3bae9dd9caad65b34023d93cd92`.
- Recursos PWA 257; no se incremento la PWA ni se cambio iOS.
- Package app.suvoz, minSdk 24, targetSdk 36, mismo certificado de subida y ningun permiso nuevo.
- El AAB anterior 41 conserva su SHA-256: `1f2331f7e72f888bff484be4a13b7b5f69379b29982720ae4112faa135d9ffd0`.

## Verificaciones

Compilacion bundleRelease y lintRelease correctas con Java 21. Bundletool valida el paquete; jarsigner verifica la firma. Los 124 recursos de ejecucion coinciden byte a byte con www. No se empaquetaron keystores, logs, marketing, Functions ni artefactos privados.

El bundle solicita PAGE_ALIGNMENT_16K y los segmentos LOAD de las cuatro bibliotecas nativas tienen alineacion de 16 KB. Es una comprobacion estatica, no una prueba de ejecucion en un dispositivo de paginas de 16 KB.

Suite completa en emuladores: 49/49. npm audit web y Functions: cero vulnerabilidades conocidas al consultar. Lint: cero errores y 19 advertencias de actualizaciones, recursos/iconos y splash; no se hicieron actualizaciones ni borrados de recursos indiscriminados para suprimirlas. Jarsigner conserva avisos del certificado autofirmado, timestamp ausente y orden JarInputStream ya presentes en el candidato anterior.

Google Play acepto el AAB y publico 42 (1.5.10) en pruebas internas a las 10:44, America/Mexico_City. Autorizacion concreta del propietario para este hash y canal. Disponible para verificadores internos; seleccion exclusiva de Su Voz QA - propietario 2026-10-02, un miembro. Las listas de 14 y 29 miembros permanecen sin seleccionar. No se aceptaron condiciones nuevas.

Advertencia de Play: biblioteca nativa sin simbolos de depuracion adjuntos. El paquete incluye el mapping Java/R8. La biblioteca precompilada arm64 inspeccionada no conserva tabla de simbolos; no se fabricaron simbolos ni se modifico el AAB aprobado. Investigar disponibilidad de simbolos del proveedor; no describir la advertencia como resuelta.

El propietario confirma actualizacion desde Play a 1.5.10 y arranque normal en la Lenovo. Consulta USB posterior: versionCode 42, versionName 1.5.10 e instalador com.android.vending. No hubo reinstalacion por USB, desinstalacion ni borrado de datos en esta comprobacion.

El 3 de octubre, el propietario confirmo expresamente las cuatro pruebas de ESTE candidato: lectura de hoy, escribir en Profundizar sin huecos, audio audible y conservacion de sus meditaciones anteriores. Es QA manual del propietario; no se inspecciono el contenido privado ni se atribuyen automaticamente a 42 otras pruebas anteriores de 41.

Incidencia posterior de QA: el propietario no encuentra Moderacion junto a Normas y Autores bloqueados. Se comprobo en modo solo lectura que su cuenta sigue habilitada/verificada, con claim moderator=true y pin coincidente. No se reasigno acceso. La Lenovo muestra una identidad sin correo vinculado y recuperar la cuenta termina con el aviso generico de operacion fallida, sin borrar el respaldo local.

La inicializacion no esperaba authStateReady antes de decidir iniciar una identidad anonima. El fallo se reprodujo en una prueba de regresion con restauracion demorada de una cuenta vinculada. Ademas, prepareAccountRecovery abortaba antes de validar credenciales si el registro push del dispositivo pertenecia a otra identidad. Los 403 recientes del callable y su comprobacion NOT_OWNER son compatibles con este bloqueo; no se capturo el cuerpo de la peticion real ni la persistencia privada de la tableta. No atribuir la incidencia a una contrasena incorrecta.

Correccion en fuentes locales: esperar la restauracion antes de la decision anonima, tambien en el cliente de Biblia remota; permitir que continue la validacion de credenciales solo ante el NOT_OWNER exacto sin borrar ni reasignar el registro ajeno. Los otros errores siguen abortando y las reglas/backend mantienen la comprobacion de propietario. El AAB 42 permanece intacto y NO contiene esta correccion. No promoverlo a produccion; preparar otro candidato y comprobar recuperacion, persistencia y moderacion fisicamente antes de considerar cerrado el fallo.

App Links comprobados por USB en caliente con intents implicitos VIEW/BROWSABLE: /hoy y /lectura?date=2026-10-01 devuelven Status ok y app.suvoz/.MainActivity. No se forzo detencion; no acredita apertura en frio ni verificacion visual de la fecha en 42.

Consulta posterior: produccion permanece 40 (1.5.8), activa en 178 paises/regiones. Vitals indica datos no disponibles; no significa cero fallas/ANR. El canal abierto figura sin versiones activas. Las recomendaciones de edge-to-edge mostradas corresponden a 40, no acreditan por si solas un fallo nuevo de 42.

El propietario autorizo pausar exclusivamente Alpha 14 (1.1.12). Su pagina muestra Este segmento esta en pausa, Inactivo y que los verificadores no reciben esta version. Se conservaron paquetes y listas. La descripcion general registra un unico cambio: Prueba cerrada - Alpha / Estado del segmento / Pausar segmento, enviado a la etapa de revision y sujeto a las verificaciones de Google. No afirmar aprobacion final de Google ni publicacion de produccion por este tramite; produccion 40 y prueba interna 42 no se modificaron. Evidencia visual local: /private/tmp/suvoz-play-alpha-pausada-2026-10-03.jpg y /private/tmp/suvoz-play-alpha-pausa-en-revision-2026-10-03.jpg.

## Backend y Web

Protecciones de eliminacion activadas con respaldo previo, permiso de agente de Storage autorizado, 36 Functions verificadas y reglas exactas. No se borraron cuentas. Ver eliminacion-cuenta-operacion.md.

HTTP posterior al despliegue: nueve archivos publicos con 200 y contenido exacto; PWA 257 y configuracion Analytics G-X95Y1G3BE0 sin cambios. No se creo contenido comunitario para probar ni se dejo debug permanente.

## Puertas Antes de Produccion

1. El paquete 42 queda retenido por la incidencia de sesion/recuperacion descrita arriba. Lectura, Profundizar/teclado, audio y notas conservadas aprobados por el propietario no sustituyen QA de un candidato corregido. Pendientes separados: offline, moderacion, selector Share del respaldo y App Links en frio/confirmacion visual. Recuperacion entre dispositivos y restauracion nativa del respaldo necesitan su propia prueba, sin credenciales compartidas ni importacion sobre notas personales sin consentimiento.
2. Data Safety completo, exacto y aprobado por el propietario, incluyendo WebView y terceros; el borrador local no fue enviado a Play. Revisar terminos de tratamiento de Analytics personalmente antes de aceptar cualquier acuerdo.
3. Licencias escritas por traduccion o una alternativa editorial expresamente aprobada. Una solicitud pendiente no concede licencia RVR1960.
4. Revisar informe previo al lanzamiento, avisos del candidato y estado de politica. Aprobar separadamente la promocion del mismo hash y porcentaje de lanzamiento en produccion.

Pendientes operativos de la auditoria que no quedan certificados por esta subida: App Check con proveedores compatibles, observacion previa y condiciones/cuota aprobadas; restauracion gestionada real en destino aislado; retencion de respaldos/reportes/ledgers antes de cualquier TTL; fuente editorial aprobada para 2027; pruebas fisicas adicionales. No activar enforcement contra clientes antiguos, borrar trazabilidad ni generar lecturas/licencias unilateralmente.

Seguimiento con resultados y decisiones pendientes: cierre-auditoria-2026-10-03.md. El SHA-256 del AAB fue recalculado el 3 de octubre y conserva el valor de Paquete Exacto; no se recompilo para estas comprobaciones.
