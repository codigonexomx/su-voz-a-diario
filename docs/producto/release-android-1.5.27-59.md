# RVR1960 y Strong: Android 1.5.27 (59)

Preparación del 16 de noviembre de 2026, America/Mexico_City. Base web publicada: `4f3d4229408a161201b0408738a5995367ac3a5a`, PWA 278. El propietario solicitó actualizar Android y publicarlo en Google Play.

## Cambio para el lector

La sección Biblia incorpora RVR1960 y RVR1960 + Strong. Un toque en el número abre el lema hebreo o griego, la transliteración y la definición en español. El diccionario admite búsqueda y navegación entre entradas relacionadas. Los 66 libros y las 14,197 entradas quedan incluidos en Android para consulta local sin conexión. Las referencias y notas bíblicas permanecen disponibles sin citas duplicadas.

Los números mantienen las posiciones literales de la fuente; no se afirma equivalencia léxica certificada palabra por palabra. Las entradas sin posición trasladable se consultan mediante ＋. Véase [fuentes y cobertura](../biblia/strong.md).

## Paquete y validación

- Versión 59 / 1.5.27; aplicación `app.suvoz`, PWA 278, API mínima 24 y destino 36.
- `bundleRelease`, `assembleRelease` y `lintRelease` correctos con Java 21. Lint: cero errores y 16 advertencias existentes.
- 67/67 comprobaciones aprobadas con emuladores locales Firestore/Auth/Storage; producción Firebase no intervenida y emuladores apagados.
- Auditor candidate59: bundle válido, firma correcta y mismo certificado de subida que 58. Sin permisos nuevos. Los 244 recursos públicos coinciden con `www`; archivos privados excluidos.
- Los 66 mapas Strong y los diccionarios (8,674 entradas hebreas/arameas y 5,523 griegas) coinciden con sus manifiestos y con la fuente local.
- Alineación estática de 16 KB comprobada. No se realizó instalación ni QA física de este candidato en el dispositivo del propietario.

AAB congelado: `artifacts/android-1.5.27-59-release/su-voz-1.5.27-59.aab`.
SHA-256: `cafdf8e14023c6c008a4ce65832f7bc4229ef0de8adfda444147e9ba35c48626`.
Auditoría: `artifacts/android-1.5.27-59-release/audit-release.json`.

## Entrega en Google Play

Play Console confirmó 58 (1.5.26) como versión previa de producción al 100 %, sin cambios no publicados. La entrega 59 se prepara para el mismo canal y países existentes, por solicitud expresa del propietario. No se modifican listas de pruebas, precios, permisos, declaraciones de privacidad ni configuración de cuentas.

El estado observado del envío y la captura de Play Console se registran en `artifacts/android-1.5.27-59-release/delivery.json`; crear el paquete o subirlo no equivale por sí solo a que Google haya aprobado y distribuido la actualización.

Notas de versión es-419:

> Añadimos Reina-Valera 1960 y la opción RVR1960 + Strong. Toca un número Strong para consultar el término hebreo o griego, su transliteración y definición en español. Incluye búsqueda en los diccionarios, palabras relacionadas y consulta sin conexión. Conservamos las referencias bíblicas y corregimos las citas duplicadas.
