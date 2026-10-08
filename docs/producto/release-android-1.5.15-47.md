# Android 1.5.15: parche de seguridad y Profundizar

Fecha: 8 de octubre de 2026, America/Mexico_City. Candidato independiente de 46, con autorizacion del propietario para commit, push y actualizacion de Play. La consulta de Play de esta entrega confirma 46 / 1.5.14 activa en produccion; las referencias a produccion 40 en informes anteriores son historicas. La preparacion local de 47 no demuestra publicacion ni QA fisica.

## Alcance

El commit `6244ae61766a6a2f71958eee88a585dda61afd38` actualiza Capacitor Android, Core e iOS a 8.5.1 y fija el minimo de CLI en 8.5.1; el CLI instalado permanece en 8.5.2. Atiende [GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv). El proveedor requiere reconstruir y redistribuir el binario, no solamente actualizar la web. No hay evidencia de compromiso; no se afirma que este parche borre cualquier riesgo.

Functions cambia exclusivamente su lockfile: proxy-addr 2.0.8 y @fastify/busboy 3.2.2, para [GHSA-jqcg-44mw-7w3h](https://github.com/advisories/GHSA-jqcg-44mw-7w3h) y [GHSA-gxm5-99cw-xjw9](https://github.com/advisories/GHSA-gxm5-99cw-xjw9). No se cambiaron versiones mayores, logica del backend, reglas, IAM ni configuracion de App Check.

47 contiene tambien la mejora de Profundizar de `081c089892e714ac7f70860531dd980f206d524c`: conservacion de foco y posicion del cursor entre pasos, respuestas independientes y transicion compatible con movimiento reducido. PWA permanece en 262; no se incremento para esta entrega nativa. No se construyo ni distribuyo una version iOS.

## Paquete Exacto

- AAB: `artifacts/android-1.5.15-47-release/su-voz-1.5.15-47.aab`.
- SHA-256: `19289639a22578336cc5572dccbc334c5dea793fdb4e02de33e888a50320e286`.
- APK de QA: `app-release.apk`, SHA-256 `4ef44a9855839f73d88ee07209d836d5bb4fc4d36e8f869405757a3fac08f411`.
- app.suvoz, versionCode 47, versionName 1.5.15, PWA 262, minSdk 24, targetSdk 36.
- Base compilada: 6244ae6 mas el cambio local de version de este candidato. El commit base por si solo no contiene versionCode 47.

Compilacion offline con Java 21: bundleRelease, assembleRelease, lintRelease y assembleReleaseAndroidTest correctos. Firma verificada y mismo certificado de subida; bundletool 1.18.3 valido. Los 146 assets runtime coinciden byte a byte con www y no incluyen archivos privados. Sin permisos nuevos. Cuatro bibliotecas con alineacion estatica a 16 KB y PAGE_ALIGNMENT_16K; no equivale a prueba fisica en dispositivo de 16 KB. Cero errores de lint, 17 advertencias existentes. Los paquetes congelados 42-46 y ambos firestore-debug.log conservan sus hashes; marketing/ permanece fuera de Git.

## Pruebas

Node 22.23.3 y Java 21, emuladores demo de Auth, Firestore y Storage fuera del repositorio: suite final 53/53. Una repeticion intermedia termino 52/53 con INVALID_ARGUMENT: Transaction is invalid or closed en el doble toggle concurrente de oracion; el resultado completo se conserva en `tests-attempt-2-failed.json`. La primera ejecucion de seguridad y la repeticion aislada posterior pasaron 53/53. No se cambiaron ni omitieron aserciones; causa exacta del fallo intermitente no demostrada. Tampoco se afirma que un fallo del emulador demuestre un fallo productivo.

Ambos npm audit finales reportan cero vulnerabilidades, incluida la copia exacta de Functions desplegada. [Product Validation del parche](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37859181733) y [GitHub Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37859180804) terminaron correctamente para 6244ae6.

Profundizar: prueba Chromium aislada aprobada en cuatro tamanos, con datos ficticios, conservacion de foco, respuestas y cursor, composicion IME, movimiento reducido y viewport simulado. No se presenta como prueba del teclado fisico de iPhone.

Respaldo nativo de 47 en AVD desechable SuVoz_Audit44, sin red antes de instalar: FileProvider, cancelacion de exportacion, FileReader real, importacion de fixture, preferencias invalidas rechazadas sin escritura, nota ficticia/identidad/consentimiento preservados y persistencia tras recarga. El resultado del selector de importacion fue inyectado por instrumentacion; no equivale a importacion manual en cualquier fabricante. No se importaron respaldos ni leyeron notas en la Lenovo.

Navegacion nativa nueva de 47: vertical y horizontal, gestos y tres botones, cinco rutas por modo, barra visible, tab correcto, cero desbordamiento; busqueda visible sobre el IME real y posicion restaurada al cerrarlo. Muestras visuales verticales/horizontales revisadas. Evidencia privada excluida de Git en native-backup-qa/ y native-navigation-qa/ del directorio del candidato.

## Backend y Web Publicos

Se desplegaron solo las 36 Functions existentes de su-voz-a-diario-v2-f3a87 usando Firebase CLI 15.14.0, filtros explicitos functions:nombre y --non-interactive. Fuente preparada con git archive de 6244ae6, sin logs ni archivos no comprometidos. Deploy complete, las mismas 36 funciones ACTIVE, todas con nuevo hash de fuente. Comparacion posterior sin cambios de runtime, region, entryPoint, variables, triggers, limites, identidad de servicio o ingreso. No se desplegaron reglas ni se alteraron permisos. Callable de moderacion sin credenciales devuelve HTTP 401 / AUTH_REQUIRED, sin consultar denuncias ni crear contenido.

HTTP 200 y coincidencia byte a byte de index.html, sw.js, js/app.js, MeditationDocument.js, deepening-shell.css y privacy.html con las fuentes locales. PWA 262, measurementId G-X95Y1G3BE0 e import de Firebase Analytics presentes. No demuestra recepcion de eventos en DebugView ni prueba todos los dispositivos.

## Estado de Play

47 aun no esta acreditada como publicada ni instalada fisicamente. Lista interna comprobada: solo Su Voz QA - propietario 2026-10-02, un miembro; listas de 14 y 29 desmarcadas, sin modificaciones. La extension de Chrome bloqueo la carga por falta de permiso de URLs de archivo; se solicito una activacion temporal al propietario, sin recurrir a rutas alternativas para eludir ese control. No se aceptaron acuerdos nuevos ni se cambiaron declaraciones de Data Safety.

No se consideran concedidas licencias RVR1960, TLA o NTV. Las gestiones editoriales, condiciones/avisos, App Check operativo, retencion y calendario editorial 2027 permanecen separadas de esta entrega tecnica. No se declara cerrada toda la auditoria.
