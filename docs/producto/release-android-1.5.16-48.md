# Android 1.5.16: lectura, Meditacion y tipografia

Fecha: 20 de octubre de 2026, America/Mexico_City. Candidato destinado exclusivamente a la prueba interna del propietario; no autorizado para produccion en esta entrega.

## Alcance y Base

Base web: `e34cefc3226a561658bf7a35d6830b5d73356fa1`, publicada y comprobada como PWA 263. El propietario confirmo que funciona correctamente en su iPhone. Esa confirmacion no acredita QA del binario Android 48.

Incluye el acceso unico Meditacion, comandos de lectura uniformes y tres fuentes locales (Merriweather, Cormorant Garamond e Inter) visibles debajo del selector de versiones. Conserva preferencias, compatibilidad de respaldos y las correcciones de medicion de esa base.

Preparacion nativa: versionCode 47 a 48 y versionName 1.5.15 a 1.5.16 en android/app/build.gradle; auditor existente ampliado con --candidate48. No se modificaron dependencias, permisos, Functions, reglas, App Check, iOS, Data Safety ni la version PWA 263. La preparacion nativa aun no tiene commit ni push propios.

## Paquete Congelado

- AAB: `artifacts/android-1.5.16-48-release/su-voz-1.5.16-48.aab`.
- SHA-256: `bc273fcf5265da1e24b1e0a466771f5b195601a0330c647384f9836062905daf`.
- APK local de QA: `artifacts/android-1.5.16-48-release/app-release.apk`.
- SHA-256 APK: `b91710d6ccb51879aafbad9357efa87b676689511c1273187b1a58d1da34c361`.
- app.suvoz, 48 / 1.5.16, PWA 263, minSdk 24, targetSdk 36.

Java 21, Gradle: bundleRelease, assembleRelease y lintRelease correctos. El primer intento offline fallo por dependencias ausentes en cache; se descargaron las versiones ya fijadas desde los repositorios configurados y el segundo build termino correctamente. No se aceptaron acuerdos nuevos ni se cambiaron versiones para completar la compilacion.

Bundletool 1.18.3 valida el AAB; la descarga de la herramienta coincide con el SHA-256 publicado en la release oficial de Google (`a099cfa1543f55593bc2ed16a70a7c67fe54b1747bb7301f37fdfd6d91028e29`). Firma verificada y mismo certificado de subida que la linea anterior. Los 148 assets runtime coinciden byte a byte con www; no se empaquetan archivos privados. Paquetes congelados 42-47 preservados por el auditor.

Cuatro bibliotecas con segmentos alineados a 16 KB y PAGE_ALIGNMENT_16K; comprobacion estatica, no prueba fisica en dispositivo de 16 KB. Lint: cero errores y 19 advertencias. Frente a 47, aparecen avisos de versiones mas recientes de AppCompat y AndroidX Core; el aviso existente sobre Gradle informa otra version disponible. No se actualizaron librerias ni se ocultaron avisos.

## Pruebas y Limites

Suite nueva en emuladores locales demo de Auth, Firestore y Storage: primer intento 54/55, con Transaction is invalid or closed en communityPrayerConcurrency.test.js; resultado conservado en tests-attempt-1-failed.json. Repeticion completa posterior: 55/55 sin modificar ni omitir pruebas, conservada en tests-attempt-2-passed.json y tests.json. Coincide con la intermitencia documentada previamente; su causa exacta no esta demostrada.

La comprobacion web anterior con Firebase real cargo Reflexiones y Oracion, y cambio RV1909, NBLA, NVI y Biblia Libre. No se transfiere esa evidencia como prueba fisica del AAB nuevo.

QA fisica de 48 confirmada expresamente por el propietario en la Lenovo: lectura y cambio de Biblias correctos; las tres fuentes cambian el texto; el teclado y contenido de Meditacion se acomodan al cambiar de seccion sin huecos ni saltos molestos; audio audible, Comunidad accesible y meditaciones anteriores conservadas. Son comprobaciones manuales del propietario, no observaciones directas del agente; no se leyo ni copio contenido de sus meditaciones. No se solicito editar, guardar ni publicar contenido para estas pruebas. En la ultima comprobacion, el propietario confirmo que la fuente elegida se conserva al cerrar y reabrir, que la misma lectura previamente cargada abre en modo avion y que restablecio internet al terminar. Queda cerrada esta validacion funcional de 48 en la Lenovo; no acredita dispositivos no probados ni resuelve los limites tecnicos y editoriales documentados.

## Estado de Play y Lenovo

Baseline Lenovo TB351FU: 47 / 1.5.15 instalada por com.android.vending; primera instalacion del 24 de septiembre y ultima actualizacion del 8 de octubre. Tras la publicacion interna, el propietario confirmo que actualizo a 1.5.16 y abre normalmente. La comprobacion USB de dumpsys package confirma versionCode 48, versionName 1.5.16, installerPackageName e initiatingPackageName com.android.vending; ultima actualizacion 2026-10-20 18:39:02 y primera instalacion conservada 2026-09-24 20:41:57. No se instalo APK local, desinstalo, borro datos ni cambiaron permisos o ajustes de red. Estos metadatos no demuestran por si solos la integridad de las meditaciones privadas.

Play confirma la interna activa 48 (1.5.16), disponible para verificadores internos, y solo la lista Su Voz QA - propietario 2026-10-02, un miembro. Listas de 14 y 29 personas desmarcadas, sin cambios.

Release interna 9 publicada el 20 de octubre. Se cargo una sola vez el AAB congelado 48, sin recompilar; 47 quedo fuera de esa release. Play no mostro errores bloqueantes ni perdida de dispositivos compatibles. La unica advertencia indica que el paquete contiene codigo nativo sin simbolos de depuracion subidos; no se oculto ni se considero resuelta.

El propietario aprobo expresamente el permiso temporal de URLs de archivo de ChatGPT en Chrome. La comprobacion de la interfaz encontro el interruptor desactivado en el perfil Ricardo; se activo unicamente ese permiso para la carga autorizada y se desactivo inmediatamente despues de la transferencia. La interfaz confirmo el estado final desactivado; no se cambiaron otros permisos.

Estado confirmado en Play: Prueba interna, Activo, Version mas reciente 48 (1.5.16), Disponible para verificadores internos, un codigo de version. Enlace de actualizacion del propietario: https://play.google.com/apps/internaltest/4701700649729684709. Instalacion, apertura y comprobaciones funcionales descritas arriba confirmadas para 48, incluidas persistencia de fuente al reabrir y lectura offline. No se transfieren resultados de versiones anteriores. Produccion no se modifico; esta confirmacion de QA no constituye autorizacion de promocion a produccion.

No se consideran concedidas licencias editoriales ni cerrada toda la auditoria por esta preparacion tecnica.
