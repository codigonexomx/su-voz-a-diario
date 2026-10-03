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

El propietario confirma actualizacion desde Play a 1.5.10 y arranque normal en la Lenovo. No equivale a aprobar aun el recorrido funcional completo del nuevo paquete. Las pruebas previas de 41 no se atribuyen automaticamente a 42.

Consulta posterior: produccion permanece 40 (1.5.8), activa en 178 paises/regiones. Vitals indica datos no disponibles; no significa cero fallas/ANR. El canal abierto figura sin versiones activas. Las recomendaciones de edge-to-edge mostradas corresponden a 40, no acreditan por si solas un fallo nuevo de 42.

El propietario autorizo pausar exclusivamente Alpha 14 (1.1.12). Su pagina muestra Este segmento esta en pausa, Inactivo y que los verificadores no reciben esta version. Se conservaron paquetes y listas. La descripcion general registra un unico cambio: Prueba cerrada - Alpha / Estado del segmento / Pausar segmento, enviado a la etapa de revision y sujeto a las verificaciones de Google. No afirmar aprobacion final de Google ni publicacion de produccion por este tramite; produccion 40 y prueba interna 42 no se modificaron. Evidencia visual local: /private/tmp/suvoz-play-alpha-pausada-2026-10-03.jpg y /private/tmp/suvoz-play-alpha-pausa-en-revision-2026-10-03.jpg.

## Backend y Web

Protecciones de eliminacion activadas con respaldo previo, permiso de agente de Storage autorizado, 36 Functions verificadas y reglas exactas. No se borraron cuentas. Ver eliminacion-cuenta-operacion.md.

HTTP posterior al despliegue: nueve archivos publicos con 200 y contenido exacto; PWA 257 y configuracion Analytics G-X95Y1G3BE0 sin cambios. No se creo contenido comunitario para probar ni se dejo debug permanente.

## Puertas Antes de Produccion

1. QA del paquete 42: lectura, Profundizar/teclado, audio, notas conservadas, offline y moderacion; registrar resultados reales. Recuperacion entre dispositivos y restauracion nativa del respaldo necesitan su propia prueba, sin credenciales compartidas ni importacion sobre notas personales sin consentimiento.
2. Data Safety completo, exacto y aprobado por el propietario, incluyendo WebView y terceros; el borrador local no fue enviado a Play. Revisar terminos de tratamiento de Analytics personalmente antes de aceptar cualquier acuerdo.
3. Licencias escritas por traduccion o una alternativa editorial expresamente aprobada. Una solicitud pendiente no concede licencia RVR1960.
4. Revisar informe previo al lanzamiento, avisos del candidato y estado de politica. Aprobar separadamente la promocion del mismo hash y porcentaje de lanzamiento en produccion.

Pendientes operativos de la auditoria que no quedan certificados por esta subida: App Check con proveedores compatibles, observacion previa y condiciones/cuota aprobadas; restauracion gestionada real en destino aislado; retencion de respaldos/reportes/ledgers antes de cualquier TTL; fuente editorial aprobada para 2027; pruebas fisicas adicionales. No activar enforcement contra clientes antiguos, borrar trazabilidad ni generar lecturas/licencias unilateralmente.
