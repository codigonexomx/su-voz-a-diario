# Android 1.5.15: parche de seguridad y Profundizar

Fecha: 8 de octubre de 2026, America/Mexico_City. Entrega independiente de 46, con autorizacion del propietario para commit, push y actualizacion de Play. Baseline publico: 46 / 1.5.14; las referencias a produccion 40 en informes anteriores son historicas. 47 / 1.5.15 esta publicada en interna exclusiva, instalada desde Play en la Lenovo y enviada como unico cambio productivo. Play confirma Cambios en la etapa de revision con verificaciones rapidas en curso, no aprobacion ni disponibilidad publica de 47.

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
- Preparacion de release comprometida y subida: `305286ecf807527b8e4e2cecd7a9523d5242f3b4`. No hubo recompilacion despues de congelar y cargar el paquete.

Compilacion offline con Java 21: bundleRelease, assembleRelease, lintRelease y assembleReleaseAndroidTest correctos. Firma verificada y mismo certificado de subida; bundletool 1.18.3 valido. Los 146 assets runtime coinciden byte a byte con www y no incluyen archivos privados. Sin permisos nuevos. Cuatro bibliotecas con alineacion estatica a 16 KB y PAGE_ALIGNMENT_16K; no equivale a prueba fisica en dispositivo de 16 KB. Cero errores de lint, 17 advertencias existentes. Los paquetes congelados 42-46 y ambos firestore-debug.log conservan sus hashes; marketing/ permanece fuera de Git.

## Pruebas

Node 22.23.3 y Java 21, emuladores demo de Auth, Firestore y Storage fuera del repositorio: suite final 53/53. Una repeticion intermedia termino 52/53 con INVALID_ARGUMENT: Transaction is invalid or closed en el doble toggle concurrente de oracion; el resultado completo se conserva en `tests-attempt-2-failed.json`. La primera ejecucion de seguridad y la repeticion aislada posterior pasaron 53/53. No se cambiaron ni omitieron aserciones; causa exacta del fallo intermitente no demostrada. Tampoco se afirma que un fallo del emulador demuestre un fallo productivo.

Ambos npm audit finales reportan cero vulnerabilidades, incluida la copia exacta de Functions desplegada. [Product Validation del parche](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37859181733) y [GitHub Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37859180804) terminaron correctamente para 6244ae6. Tambien correctos [Product Validation de 305286e](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37860556745) y [Pages de 305286e](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/37860555965).

Profundizar: pruebas aisladas Chromium y WebKit aprobadas en cuatro tamanos cada una, con datos ficticios, conservacion de foco, respuestas y cursor, composicion IME y movimiento reducido. El viewport de teclado se simulo en los tres tamanos moviles, no en escritorio. La primera prueba WebKit fallo porque el fixture sustituia innerText multilinea sin mover la seleccion, dejandola invalida: se corrigio exclusivamente el simulador para colocar el cursor con el texto, manteniendo todas las aserciones. Ambas repeticiones finales pasan; no se cambio codigo runtime ni se reconstruyo 47 por este ajuste. No se presenta como prueba del teclado fisico de iPhone.

Respaldo nativo de 47 en AVD desechable SuVoz_Audit44, sin red antes de instalar: FileProvider, cancelacion de exportacion, FileReader real, importacion de fixture, preferencias invalidas rechazadas sin escritura, nota ficticia/identidad/consentimiento preservados y persistencia tras recarga. El resultado del selector de importacion fue inyectado por instrumentacion; no equivale a importacion manual en cualquier fabricante. No se importaron respaldos ni leyeron notas en la Lenovo.

Navegacion nativa nueva de 47: vertical y horizontal, gestos y tres botones, cinco rutas por modo, barra visible, tab correcto, cero desbordamiento; busqueda visible sobre el IME real y posicion restaurada al cerrarlo. Muestras visuales verticales/horizontales revisadas. Evidencia privada excluida de Git en native-backup-qa/ y native-navigation-qa/ del directorio del candidato.

## Lenovo: QA Fisica Nueva de 47

Instalador e iniciador com.android.vending, versionCode 47 / 1.5.15, actualizada el 8 de octubre a las 17:46:25; fecha de primera instalacion preservada (24 de septiembre, 20:41:57). No se instalo APK local, desinstalo, borro datos ni cambiaron permisos. Cuenta verificada y acceso de Moderacion conservados.

- /hoy abre Su Voz desde detenida y muestra 8 DE OCTUBRE / 1 Samuel 22:6-23.
- /lectura?date=2026-10-01 inicia en frio con Status ok, MainActivity y 1 DE OCTUBRE / 1 Samuel 17:50-18:5. Ambos enlaces se reabren despues de navegar a Calendario y muestran la fecha y pasaje correctos, incluido el enlace identico repetido.
- Profundizar: campo confirmado vacio, foco y Gboard reales conservados al cambiar de Como es Dios a Ensenanza, Oracion y de vuelta al primer paso. Campo visible por encima del teclado, sin hueco negro; no se escribieron respuestas ni se leyeron notas. Persistencia de textos y cursor probada con fixtures aislados, no sobre meditaciones personales.
- Audio iniciado y detenido; el propietario confirma voz clara y meditaciones anteriores conservadas en 47.
- Pendientes y Revisadas muestran lista sin denuncias; Solicitudes de cuenta sin solicitudes pendientes. Las tres abren sin error, sin modificar registros.
- Biblia abre Genesis 1. Ajustes y selector nativo de respaldo abren; selector Lenovo com.zui.resolver cancelado con regreso a Su Voz, sin destinatario, envio ni importacion.
- Inspeccion acotada del proceso: cero coincidencias de excepcion fatal, errores JS no capturados o net::ERR en los ultimos 1500 registros consultados. No equivale a ausencia de todos los errores ni a Android Vitals.

Offline de 47 comprobado en el AVD aislado sin red. La repeticion fisica en Lenovo esta solicitada y aun no acreditada: no se cambio su Wi-Fi sin la aprobacion concreta correspondiente. No se trasladan resultados offline fisicos de 46 a 47. Capturas publicas de lectura/campo vacio en physical-qa/, excluidas de Git. Dos inspecciones iniciales excedieron el buffer local de la herramienta; se repitieron con limite suficiente, sin cambio en la aplicacion.

## Backend y Web Publicos

Se desplegaron solo las 36 Functions existentes de su-voz-a-diario-v2-f3a87 usando Firebase CLI 15.14.0, filtros explicitos functions:nombre y --non-interactive. Fuente preparada con git archive de 6244ae6, sin logs ni archivos no comprometidos. Deploy complete, las mismas 36 funciones ACTIVE, todas con nuevo hash de fuente. Comparacion posterior sin cambios de runtime, region, entryPoint, variables, triggers, limites, identidad de servicio o ingreso. No se desplegaron reglas ni se alteraron permisos. Callable de moderacion sin credenciales devuelve HTTP 401 / AUTH_REQUIRED, sin consultar denuncias ni crear contenido.

HTTP 200 y coincidencia byte a byte de index.html, sw.js, js/app.js, MeditationDocument.js, deepening-shell.css y privacy.html con las fuentes locales. PWA 262, measurementId G-X95Y1G3BE0 e import de Firebase Analytics presentes. No demuestra recepcion de eventos en DebugView ni prueba todos los dispositivos.

## Estado de Play

Interna: release 8, 47 (1.5.15), Disponible para verificadores internos el 8 de octubre a las 17:42. Lista comprobada tras publicar: solo Su Voz QA - propietario 2026-10-02, un miembro; listas de 14 y 29 desmarcadas, sin modificaciones. La carga utilizo el permiso temporal de URLs de archivo aprobado y activado personalmente por el propietario; confirmo su desactivacion al terminar. No se aceptaron acuerdos nuevos ni se cambiaron declaraciones de Data Safety.

Produccion: promocion del mismo paquete 47 a release 25, anterior 46 excluida; 100% y todos los paises de destino actuales, sin modificar el alcance. Validacion de Play sin errores bloqueantes, cero dispositivos previamente compatibles perdidos y una advertencia por simbolos nativos ausentes de bibliotecas del proveedor. Archivo ReTrace adjunto. No se fabricaron simbolos de bibliotecas ya despojadas de ellos.

Se confirmo Enviar 1 cambio a revision exclusivamente para Produccion / 47 (1.5.15) / Iniciar lanzamiento completo. [Resumen de publicacion](https://play.google.com/console/u/0/developers/5466794951356714708/app/4974496459300724158/publishing) confirma Cambios en la etapa de revision; verificaciones rapidas en curso y cambios pendientes de pasar a revision al completarlas. Publicacion administrada sigue desactivada, sin cambiarla: la distribucion publica depende de la aprobacion de Google. No se acredita aprobacion ni disponibilidad publica de 47. El auditor local no consulta Play; sus campos de distribucion predeterminados no sustituyen esta evidencia separada.

No se consideran concedidas licencias RVR1960, TLA o NTV. Las gestiones editoriales, condiciones/avisos, App Check operativo, retencion y calendario editorial 2027 permanecen separadas de esta entrega tecnica. No se declara cerrada toda la auditoria.
