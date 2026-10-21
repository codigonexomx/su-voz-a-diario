# Android 1.5.18: Calendario, Comunidad y oración

Fecha: 21 de octubre de 2026, America/Mexico_City.
Base de la interfaz: `c7dab9f0a9a8859fac8bd4f9c0f80069d29c513f`.
Backend separado: `63138e6156de7511ce5dc7faf685f0657d9bd73f`.

## Alcance

Publicación conjunta del Calendario renovado y Comunidad con seguimiento de peticiones, bandeja interna y avisos genéricos de oración. La implementación, investigación y pruebas se describen en `calendario-lecturas-2026-10-21.md` y `comunidad-oracion-premium-2026-10-21.md`.

Android pasa de 49 / 1.5.17 a 50 / 1.5.18. PWA pasa de 264 a 265; las referencias sincronizadas de la landing cambian únicamente de versión de caché. No se modifican dependencias, permisos, privacy.html, reglas, iOS ni licencias. No se cambian los formatos de meditaciones o respaldos. `marketing/` queda fuera de esta entrega.

## Backend publicado

Dos índices nuevos READY, con los diez existentes preservados. Se crearon `notifyNewPrayerRequest`, `notifyPrayerSupport`, `notifyPrayerAnswered`, `listMyPrayerRequests` y `cleanupDeletedPrayerActivity`; se actualizaron `deliverCommunityBadgeUpdates`, `sendDailyNotification` y `sendTestNotification`. Verificación: ocho cambios previstos, 33 funciones sin cambios, total 41 ACTIVE, Node.js 22.

Se usó una configuración temporal equivalente con rutas absolutas y exclusión adicional de logs. El primer intento se detuvo por una ruta relativa fuera del directorio temporal y otro por la confirmación de reintentos; ninguno publicó funciones. El intento final con `--force` aceptó solo la política de reintentos idempotentes de los disparadores nuevos. No se borraron funciones ni datos y no se alteraron reglas o roles.

No se crearon peticiones, acompañamientos o testimonios en producción para probar. La consulta administrativa de registros push se limitó al propietario: un registro Android habilitado correspondiente a la Lenovo. Los tokens no se registraron en evidencias.

## Candidato congelado

- AAB: `artifacts/android-1.5.18-50-release/su-voz-1.5.18-50.aab`.
- SHA-256: `c3510d8f1afca864ac46b5423499283613dff44d1f477dc73e1a9574650de283`.
- app.suvoz, 50 / 1.5.18, PWA 265, minSdk 24, targetSdk 36.
- Compilación offline Java 21: `bundleRelease assembleRelease lintRelease`, correcta.
- Bundletool valida el paquete; firma y certificado de subida coinciden con los anteriores.
- 157 assets runtime coinciden con `www`; sin archivos privados ni nuevos permisos.
- Cuatro bibliotecas con segmentos de 16 KB y PAGE_ALIGNMENT_16K. Comprobación estática, no QA física de un dispositivo de páginas de 16 KB.
- Lint: cero errores, 19 advertencias. Capacitor 8.5.1 conserva la corrección de GHSA-rvm3-566m-v7fv.
- Auditoría: `node scripts/audit-android-44.mjs --candidate50`; evidencia `artifacts/android-1.5.18-50-release/audit-release.json`.

El paquete 49 conserva SHA-256 `60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4`; no se sobrescribió. No se instaló una APK local encima de la aplicación de Play.

## Verificación y límites actuales

Suite completa anterior al congelado: 59/59, repetida dos veces; ambos `npm audit --audit-level=moderate` sin vulnerabilidades. La nueva ejecución final también terminó 59/59, en puertos aislados porque Docker ocupa 8080; no se detuvo ni modificó Docker. Los emuladores de esta ejecución se cerraron correctamente al terminar.

Inspección de Play: interna 49 disponible y solo la lista Su Voz QA - propietario 2026-10-02 seleccionada, un miembro. Las listas de 14 y 29 personas permanecen desmarcadas. Se solicitó aprobación concreta para cargar únicamente el AAB 50 con el hash anterior, sin promoverlo antes de la QA. El estado de publicación se actualizará después de comprobarlo, no a partir del resultado del compilador.

La Lenovo conectada conserva 49 instalada desde Play y el permiso de notificaciones ya concedido. Falta instalar 50 desde la prueba oficial y comprobar Calendario, Comunidad, listas personales, bandeja, recepción y apertura del aviso controlado. La QA de 49 y las pruebas responsive no se transfieren como QA nativa de 50. Tampoco se acredita todavía la prueba física de estos cambios en iPhone.

La web se publica desde main en GitHub Pages, no mediante Firebase Hosting. El backend ya está disponible antes del push de la interfaz. La publicación y las verificaciones HTTP/CI posteriores se añadirán a este documento cuando hayan terminado.

No se promete ausencia absoluta de fallos ni más descargas por el rediseño. Preparar lecturas de 2027, licencias editoriales y certificación VoiceOver/TalkBack siguen siendo asuntos separados, no se declaran cerrados por esta entrega.
