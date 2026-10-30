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

## Entrega y comprobación del propietario

- Web/PWA 272 publicada desde el commit `3617b1b020484f419135b56a7dfc6a7b94713a1b`: workflows Pages 41097709938 y Product Validation 41097710665 correctos. Índice, service worker, constantes y portada públicos coinciden por SHA-256 con los archivos locales.
- El reproductor público cargó el video nuevo de 7:44, indicó audio y avanzó a 0:08. Se pausó sin modificar el estado de lectura.
- El video anterior `f2h5FYVawSU` se cambió a privado; YouTube Studio confirmó que todos los cambios se guardaron. Se conserva recuperable.
- Android 1.5.25 (57) disponible en prueba interna, release 18. El propietario confirmó actualización desde Google Play en Lenovo, imagen y audio del nuevo video y regreso a la lectura. Esta comprobación cubre ese recorrido.
- Se promovió el mismo AAB 57 a producción, release 32, con lanzamiento al 100 % y países existentes; sin pérdida de dispositivos admitidos. El cambio está guardado, pero Google Play devuelve la confirmación de envío al estado pendiente sin registrar un envío ni mostrar un error. Se pidió al propietario pulsar el envío manualmente. No se considera publicado ni enviado hasta verificarlo.
- El estado operativo y las capturas se conservan en `artifacts/android-1.5.25-57-release/delivery.json` y en el proyecto externo «Su Voz a Diario - Oseas - Reemplazo 2026-10-30».
