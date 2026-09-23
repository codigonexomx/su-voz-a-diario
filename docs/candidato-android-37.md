# Candidato local Android 37 — Su Voz a Diario

Versión: **1.5.5 (37)**. Recursos web: **234**. Fecha: 23/09/2026. Estado: candidato local para pruebas; no distribuido ni subido a Play.

## Cambios

- Los fondos a todo lo ancho usan el ancho útil del documento, excluyendo el espacio de las barras de desplazamiento. El recorte horizontal de elementos decorativos no crea un contenedor adicional de scroll.
- El indicador conserva su posición y velocidad al cambiar de destino. Las mediciones, las pulsaciones repetidas y el efecto de presión no interrumpen el movimiento. Se eliminó la colocación diferida que competía con la animación.
- El resorte se calcula con una solución amortiguada independiente de la frecuencia de cuadros, conserva movimiento reducido y mantiene el indicador dentro de la barra.
- Los márgenes usan las variables de Capacitor con respaldo en `env()`. En WebViews antiguos Capacitor puede reservar el margen mediante padding nativo; se debe medir la separación física para evitar contarlo dos veces.
- El teclado usa orientación del dispositivo cuando está disponible y señales de pantalla táctil/native/viewport. Redimensionar una ventana de escritorio con un campo enfocado ya no basta para declarar abierto el teclado; el zoom tampoco se interpreta como teclado.
- La navegación comunica la sección actual con `aria-current`, y sus botones quedan `inert` mientras el teclado la oculta.
- Recursos sincronizados con `www` y Android. Incremento de `versionCode` 36 → 37, `versionName` 1.5.4 → 1.5.5 y PWA 233 → 234.

## Pruebas web

`npm run test:bottom-nav` pasa e incluye los casos anteriores y los nuevos casos de animación/teclado. Se comprueban pulsación rápida, mismo botón, reversión de dirección, resize durante el movimiento, movimiento reducido y trayectoria a 20, 30, 60 y 120 Hz.

La página de QA `scripts/nav-browser-check.html` recorre las cinco secciones usando la aplicación real. No se incluye en el paquete Android.

| Entorno | Resultado | Borde superior constante de la barra |
| --- | --- | ---: |
| Safari real en macOS, viewport del iframe de 848 px de alto | Cinco secciones, sin desbordamiento, alineación final <1 px | 780 px |
| Navegador integrado, 1366 × 900 | Cinco secciones, sin desbordamiento | 832 px |
| Navegador integrado, 390 × 844 | Cinco secciones, sin desbordamiento | 776 px |
| Navegador integrado, 320 × 568 | Cinco secciones, sin desbordamiento | 500 px |
| Navegador integrado, 844 × 390 | Cinco secciones, sin desbordamiento | 322 px |

## Paquetes

Carpeta: `artifacts/android-1.5.5-37/` (excluida de Git).

- `su-voz-1.5.5-37.aab`: candidato firmado para subir cuando se apruebe.
- `su-voz-1.5.5-37.apk`: APK release generado por Gradle.
- `candidate-37-universal.apk`: APK generado con bundletool desde el AAB candidato; usado en las pruebas de instalación.
- `baseline-existing.aab` y `baseline-36-universal.apk`: copia conservada del AAB local 36 y APK derivado, con la barra anterior. No se afirma que ese archivo sea byte por byte el que distribuye Google Play.
- `manifest.json`: tamaños y SHA-256 de los paquetes.

SHA-256 del AAB candidato:

```text
69f9b4e019756a4828860eb130252a253bdcdd8b7cb7d5361de459f92f8f3989
```

Compilación release exitosa; validación con bundletool exitosa; firma APK verificada; AAB firmado verificado con jarsigner. Se compararon los bytes de HTML, CSS, aplicación y administrador del teclado dentro del AAB contra los archivos fuente. Las herramientas de QA están excluidas del paquete.

## Android

Pruebas sobre un emulador aislado Android 16/API 36, imagen oficial Google APIs ARM64, perfil Pixel 7, WebView 133.0.6943.137. La ruta de insets CSS de WebViews más recientes requiere una comprobación adicional en un dispositivo con esa versión; aquí se comprobó el padding nativo de Capacitor. No se usan datos de un teléfono personal.

El ejecutor `NavAuditInstrumentation` es optativo mediante `-PnavQa`, exige `ro.kernel.qemu=1` y registra resultados en el directorio externo `nav-qa` de la app de prueba. Recorre secciones y verifica coordenadas, desbordamiento, selección, visibilidad, separación física de los controles del sistema y apertura/cierre del teclado. Activa temporalmente los modos nativos por gestos/tres botones y restaura la configuración al terminar.

La prueba de actualización siembra un marcador y un tamaño de lectura en 36, permite que WebView persista los cambios, reinicia 36 para verificarlos y después instala 37 con reemplazo. Esta prueba cubre conservación de esos datos locales; no es una auditoría de migración de todos los datos ni sustituye una actualización firmada y distribuida por Google Play.

Resultados Android: **aprobados en el emulador descrito**.

| Caso | Gestos | Tres botones |
| --- | --- | --- |
| Actualización local 36 → 37, conservación de marcador y tamaño de lectura | Pasa | Pasa |
| Instalación limpia del APK derivado del AAB | Pasa | Pasa |
| Cinco secciones, borde constante y sin desbordamiento | Pasa | Pasa |
| Separación física de los controles de Android | Pasa | Pasa |
| Teclado real: apertura, navegación inactiva y recuperación al cerrar | Pasa | Pasa |
| Repetición en horizontal | Pasa | Pasa |

Las capturas y los JSON de resultados están en `artifacts/android-1.5.5-37/qa-upgrade`, `qa-clean` y `qa-landscape-final`. Los archivos `upgrade37-run.log`, `clean37-run.log` y `landscape37-run.log` registran el resultado del ejecutor. La versión local 36 corresponde a **versionCode 36 / versionName 1.5.4**, que es la base encontrada para la actualización solicitada.

En vertical, la reserva nativa inferior fue de 63 px con gestos y 126 px con tres botones; el borde de la cápsula mantuvo además aproximadamente 8 CSS px libres. En horizontal se respetó la reserva lateral del sistema. La geometría permaneció constante al cambiar de sección dentro de cada modo.

Durante la preparación del test se corrigieron dos limitaciones del ejecutor: el emulador activaba escritura con lápiz y Android recreaba la actividad al cambiar la configuración. El ejecutor desactiva temporalmente la escritura con lápiz, vuelve a obtener el WebView tras la recreación y espera a que termine la pantalla de inicio antes de las capturas. Esos ajustes son exclusivos del APK de pruebas. Al alternar el modo en caliente algunas capturas mostraban la reserva de tres botones sin sus iconos. Se repitió con un arranque desde cero, ya configurado en tres botones: los iconos aparecen con contraste correcto y el recorrido/teclado pasan. Evidencia: `qa-cold-threebutton/cold-threebutton37-threebutton-home.png` y `cold-threebutton37-run.log`. El argumento `onlyMode=threebutton` permite reproducir esta comprobación.

## Reproducción

```sh
npm run test:bottom-nav
python3 -m http.server 8765 --bind 127.0.0.1
# Abrir /scripts/nav-browser-check.html en Safari.
npm run pwa:sync-version
npm run android:sync
cd android
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home ./gradlew bundleRelease assembleRelease
JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-21.jdk/Contents/Home ./gradlew -PnavQa assembleReleaseAndroidTest
```

La prueba de instrumentación se instala aparte del candidato y se invoca con `app.suvoz.test/app.suvoz.NavAuditInstrumentation`. Fases: `seed36`, `verify36`, `upgrade37` y una fase libre para instalación limpia. El argumento `orientation=landscape` permite repetir en horizontal. Los resultados exitosos indican `SuVoz Android navigation QA: PASS`; revisar siempre el contenido del resultado, pues `adb` no propaga automáticamente el fallo del test como código de salida.

Antes de publicar: completar las pruebas adicionales del usuario y comprobar el candidato en teléfonos reales representativos. La prueba mediante Play y su informe previo al lanzamiento siguen pendientes porque no se ha distribuido este candidato.
