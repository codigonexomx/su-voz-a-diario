# Su Voz Android 1.5.35 (67) — referencias bíblicas completas

Preparado el 26 de noviembre de 2026. Web/PWA 287. Paquete `app.suvoz`.

## Cambios

- Las referencias muestran todo el rango citado y permiten desplazar el texto dentro del panel, con encabezado, cierre y navegación accesibles.
- Apocalipsis 4:7 → Ezequiel 1:5–10 muestra los seis versículos; admite rangos extensos y referencias entre capítulos o libros.
- NTV y TLA respetan la numeración real y conservan completos los grupos de versículos de la traducción, sin repetirlos.
- Desplazar la referencia conserva la ubicación del pasaje de origen.

## Validación

- 61/61 comprobaciones locales de regresión aprobadas (`node scripts/run-tests.mjs`, sin emuladores).
- Prueba de interfaz en Chromium aislado: 390×844, 320×568, 844×390, 800×1280 y 1440×900; desplazamiento táctil/rueda, regreso, cierre y cuatro ediciones.
- Rangos de 1, 6, 8, 9 y 176 versículos, además de cambios de capítulo/libro y versos agrupados.
- AAB validado con bundletool y firma comprobada con jarsigner; certificado de carga idéntico al de la versión 66.
- Los 256 archivos públicos empaquetados coinciden con `www`; Android excluye los archivos web ocultos mediante su configuración existente.
- Android Lint: 0 errores y 16 advertencias de recursos, iconos y configuración. No se realizaron nuevas pruebas en dispositivos físicos para esta entrega.

## Entrega

Archivo local: `artifacts/android-1.5.35-67-release/su-voz-1.5.35-67.aab`.

Tamaño: 36 436 451 bytes. Android mínimo 24 y objetivo 36.

SHA-256: `78d0d4b4f0739a6dfdc1c449b132d974117ce9a70ab65e51a7d53c6d262c90bd`.

La carpeta de entrega conserva la auditoría, el checksum y los resultados de pruebas. El AAB se mantiene fuera de Git. Está listo para cargar a Google Play; esta entrega no incluye su carga ni publicación en Play Console.

## Texto propuesto para Google Play

Mejoramos las referencias bíblicas: ahora puedes leer y desplazar todos los versículos del pasaje citado sin salir de la lectura. También ajustamos la navegación del panel y la presentación de versículos agrupados en NTV y TLA.
