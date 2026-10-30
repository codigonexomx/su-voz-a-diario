# Reemplazo de la introducción de Oseas

El propietario entregó «Oseas__Fidelidad_y_traición.mp4» para sustituir la introducción que mencionaba una iglesia. Su Voz a Diario es un espacio abierto para todos; el nuevo material y su descripción no deben atribuirlo a una congregación.

Nuevo video: https://youtu.be/wyEJ9jynm0M. Se reemplazan el enlace y la portada local anterior; permanecen las fechas del 1 al 4 de noviembre de 2026, el reproductor voluntario, la lectura bíblica y las demás introducciones.

La PWA sube a 272 para renovar la caché. Android se prepara como 1.5.25 (57), con los mismos permisos y dependencias. El paquete 56 permanece congelado. Los resultados de publicación web, verificación audiovisual y distribución Android se registran en los artefactos de entrega; preparar o compilar un paquete no equivale a publicarlo.

## Validación completada

- Video nuevo publicado en Suvozadiario App el 30 de octubre: `wyEJ9jynm0M`, duración 7:44. La transcripción local completa no menciona a la iglesia. El archivo y las evidencias se conservan en Almacenamiento.
- 64/64 comprobaciones con Auth, Firestore y Storage demo locales. Auditorías npm de raíz y Functions: cero vulnerabilidades; `git diff --check` correcto.
- La copia local muestra Oseas 1:1-9 y el enlace y reproductor configurados con el ID nuevo. Las conexiones Firebase/Analytics se bloquearon por CSP durante esa prueba. No se registraron lecturas ni se modificaron notas. La reproducción incrustada pública y la distribución de Android se verifican por separado.
- `bundleRelease assembleRelease lintRelease` correctos. Auditoría candidate57: firma válida y mismo certificado, API 24+, target 36, 166 recursos públicos idénticos, sin permisos nuevos, sin privados, 0 errores lint / 16 advertencias. Alineación estática de 16 KB, sin certificar dispositivos físicos de 16 KB.
- Paquete congelado `artifacts/android-1.5.25-57-release/su-voz-1.5.25-57.aab`; SHA-256 `b59bb3d79c9de0868c69b045ed08ef48dee26a3dfd8d790f772c8b786018dded`. Las versiones anteriores permanecen intactas. Se utiliza LLVM instalado con Android para la auditoría; no se acepta ni modifica la licencia de Xcode.
