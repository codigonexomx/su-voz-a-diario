# Auditoría de la barra inferior de Su Voz a Diario

Fecha: 23 de septiembre de 2026. Código local: `39a9ac7`, PWA 233. Alcance: navegación inferior, animación, viewport, teclado y preparación Android. No es una auditoría integral de todas las funciones de la aplicación.

**Dictamen: corregir los saltos reproducibles y completar pruebas Android antes de publicar una nueva versión.** Hay evidencia de dos problemas diferentes: movimiento vertical de toda la barra por desbordamiento horizontal, e interrupciones bruscas del indicador animado. No se modificó el comportamiento de la aplicación ni se publicó una versión durante esta revisión.

## Cómo funciona

La navegación es HTML/CSS compartido; no hay una barra nativa distinta para Play Store. Los cinco botones cambian rutas con `history.pushState`, `handleRoute` actualiza contenido y selección, y el indicador se desplaza mediante un resorte calculado en JavaScript con `requestAnimationFrame`.

La barra mide 60 px de alto, hasta 380 px de ancho, y se fija a 8 px más el margen inferior de seguridad. Cada botón se asocia a una familia de vistas: Hoy incluye lecturas; Biblia incluye lector, búsqueda, memoria y diccionario; Comunidad incluye hilos. Calendario y Estadísticas tienen su propia selección.

Al abrir el teclado se oculta mediante opacidad y se desactivan los clics. Al abrir selectores bíblicos se oculta mediante `visibility`. Profundización tiene reglas adicionales para ocultarla. El cierre de elementos transitorios y observadores de estado intentan recuperar su visibilidad al navegar.

En web se ejecuta dentro del navegador; una PWA instalada tiene otra superficie visible y caché propia. Android empaqueta `www` mediante Capacitor y ejecuta la interfaz en un WebView, con márgenes del sistema, teclado y botón Atrás nativos. La publicación en Play no elimina los problemas del código compartido.

## Evidencia y hallazgos

### 1. Alta: salto vertical confirmado en Safari y medido en navegador de escritorio

Reproducción: abrir Biblia y pasar a Calendario. En Safari apareció una barra de desplazamiento horizontal en Biblia; desapareció en Calendario, y la navegación inferior bajó. Se comprobó mediante capturas de la misma ventana, sin redimensionarla entre ambas secciones.

En el navegador integrado, con viewport 1366 × 900:

| Estado | Ancho útil del documento | Alto útil | Posición superior de navegación |
| --- | ---: | ---: | ---: |
| Biblia | 1351 px | 885 px | 817 px |
| Calendario | — | 900 px | 832 px |

La diferencia medida fue **15 px**. También se observó a 390 × 844 y 844 × 390. Los 15 px corresponden a la medición del navegador integrado, no a una medición DOM de Safari.

Los fondos `::before` y `::after` de `.bible-library-view` usan `50dvi` a ambos lados. A 1366 px su ancho calculado era 1366 px, aunque el documento disponía de 1351 px por la barra vertical. El extremo derecho calculado del fondo excedía el área útil aproximadamente 7.5 px; `scrollWidth` era 1359 px. Esto hace aparecer el scroll horizontal y reduce la altura disponible para elementos fijos. `.home-hero-stage` utiliza un patrón semejante y Hoy también presentó desbordamiento en las pruebas estrechas.

Referencias: `css/styles.css:345`, `css/styles.css:10733`, `css/styles.css:10746`, `css/styles.css:6193`.

Corrección propuesta: dimensionar los fondos con el ancho realmente disponible o contener su desbordamiento decorativo; centrar la barra respecto al área útil. Comprobar el scroll de lectura y los elementos sticky antes de aplicar un recorte global. Criterio: no debe aparecer scroll horizontal y la coordenada vertical de la barra debe permanecer constante entre secciones con el mismo viewport.

### 2. Alta: la animación puede cancelarse y saltar al destino

`updateGlassNavIndicator` cancela el resorte y coloca directamente el indicador cuando recibe `animate:false` o cuando el botón activo coincide con el anterior. Esas condiciones pueden llegar desde `resize`, `ResizeObserver`, cambios del viewport/teclado y `pointerdown`. El programador de actualizaciones conserva la última petición del cuadro, aunque sustituya una petición animada por otra sin animación.

La prueba determinista ejecutó los métodos reales extraídos de `js/app.js`, con geometría simulada de cinco botones. A los seis cuadros de una transición de Hoy a Estadísticas, una actualización sin animación desplazó el centro de 179.31 a 334 px: **154.69 px instantáneos**. Se reprodujo también con una actualización del mismo botón y con un segundo `pointerdown` durante el movimiento.

Esto confirma el defecto lógico compartido. No es una medición de 155 px en Safari ni prueba que todos los saltos reportados tengan esta causa.

Referencias: `js/app.js:1608`, `js/app.js:1699`, `js/app.js:1716`, `js/app.js:1730`, `js/app.js:1499`.

Corrección propuesta: conservar posición y velocidad durante cambios de destino; no cancelar una animación por una medición sin cambio geométrico; separar el efecto de presión de la colocación del indicador; controlar y cancelar también las colocaciones diferidas.

### 3. Media: movimiento sensible a cuadros lentos

El integrador del resorte acepta pasos de hasta 50 ms. En simulación del mismo trayecto de 288 px:

| Frecuencia simulada | Mayor avance en un cuadro |
| --- | ---: |
| 120 Hz | 12.13 px |
| 60 Hz | 25.12 px |
| 30 Hz | 64 px |
| 20 Hz | 144 px |

Todas las simulaciones llegaron al destino sin sobrepasarlo. Los avances mayores son esperables al tener menos cuadros, pero la diferencia del integrador hace especialmente brusco el caso lento. No se midieron los FPS reales de Safari ni de un teléfono. El blur y la carga de las vistas son candidatos para perfilar, no causas demostradas.

Corrección propuesta: integración con subpasos acotados o una animación basada en tiempo que pueda redirigirse desde el estado actual. Conservar `prefers-reduced-motion`, que ya tiene soporte.

### 4. Alta para validar Android: márgenes de seguridad no conectados

El proyecto usa Capacitor Android 8.5.0, `targetSdkVersion 36`, `viewport-fit=cover` y `EdgeToEdge.enable(this)`. El plugin `SystemBars` instalado inyecta `--safe-area-inset-top/right/bottom/left`. El CSS de la app define sus márgenes con `env(safe-area-inset-*)`, sin consumir esas variables de Capacitor.

La falta de conexión es verificable en código; la superposición con gestos o botones del sistema todavía **no está demostrada en un dispositivo**. Dependerá también del WebView y sus valores `env`. Revisar una cadena compatible como `var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))` y evitar sumar el mismo margen dos veces.

Referencias: `css/styles.css:22`, `capacitor.config.json`, `android/variables.gradle`, `android/app/src/main/java/app/suvoz/MainActivity.java`, `node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java:251`.

Play Console muestra para la versión 36 advertencias de borde a borde y de APIs/parámetros obsoletos. Esas advertencias refuerzan la necesidad de probar, pero por sí mismas no demuestran un fallo visible de la barra ni identifican la dependencia responsable.

### 5. Media: casos de teclado no cubiertos por las pruebas existentes

Dos casos simulados con el administrador real:

- Viewport inicial 390 × 844, campo enfocado, reducción a 390 × 350 con ajuste del viewport de diseño: interpreta que cambió a horizontal, crea una referencia de altura 350 y devuelve teclado cerrado. El caso depende del modo de ajuste del WebView y de que no haya señal de VirtualKeyboard.
- Escritorio 1366 × 900, campo enfocado, redimensionado a altura 650 sin teclado virtual: devuelve teclado abierto. Esto puede ocultar la barra en una computadora.

La orientación se deduce de ancho/alto visibles, que pueden cambiar por el propio teclado. Referencia: `js/KeyboardViewportManager.js:35` y `measure`.

Corrección propuesta: separar orientación física/de diseño de altura visual y combinar las señales disponibles; probar redimensionado de escritorio con foco, rotación con teclado abierto y cierre del teclado en Android.

### 6. Media: versiones y paquete candidato sin validar

La raíz usa PWA 233; la copia Android contiene referencias a 230 en `js/app.js` e `index.html`. El CSS comparado es idéntico y el único cambio de `app.js` comparado es la versión enviada a analítica: esto **no demuestra que Android tenga otra animación**. Sí muestra que raíz y copia empaquetable no están completamente sincronizadas.

Play Console confirma producción **36 (1.5.4)**, lanzada el 12 de septiembre, al 100%. El proyecto local aún tiene `versionCode 36`; un nuevo paquete destinado a actualizar esa versión debe usar un código superior y comprobar los recursos que realmente incluye. No se inspeccionó el contenido del AAB que está publicado.

La pista interna muestra 1 (1.0) y la cerrada alpha 14 (1.1.12). No validan los cambios actuales de navegación. La página de informe previo al lanzamiento muestra la indicación de subir artefactos para generarlo; no se encontraron resultados que permitan aprobar esta versión.

### 7. Media: accesibilidad del estado de navegación

`updateNavUI` actualiza la clase visual `active`, sin establecer `aria-current` en la navegación. La ocultación por teclado usa opacidad y `pointer-events`, que por sí solos no retiran controles del recorrido de foco. Requiere prueba con teclado/lector de pantalla y una política coherente de foco. No se realizó una evaluación completa de accesibilidad.

## Pruebas realizadas y límites

| Prueba | Resultado y alcance |
| --- | --- |
| `npm run test:bottom-nav` | Pasa. Cuatro casos de teclado y comprobaciones de texto del código; no verifica animación, CSS ni Android. |
| `node scripts/audit-bottom-nav.mjs` | Ejecutado. Reproduce las interrupciones y los dos casos límite de teclado anteriores. Simulación, no navegador. |
| Safari real en macOS | Carga, navegación Hoy → Estadísticas → Biblia → Calendario; capturas confirman aparición/desaparición del scroll horizontal y cambio de altura de la barra. |
| Navegador integrado, 1366 × 900 | Destino Estadísticas alineado; medición del salto de 15 px Biblia → Calendario. |
| Navegador integrado, 390 × 844 | Hoy, Biblia y Calendario: indicador alineado al terminar; salto de 15 px entre Biblia y Calendario. |
| Navegador integrado, 320 × 568 | Hoy, Biblia, Calendario y Comunidad accesibles; desbordamiento horizontal en Hoy/Biblia y no en Calendario/Comunidad. |
| Navegador integrado, 844 × 390 | Biblia, Calendario y Estadísticas: cambio de altura reproducido, indicador alineado al terminar. |
| Selector de libro/capítulo | La barra se oculta al abrir y reaparece al cerrar; comprobado en viewport 320 × 568. |
| Atrás del navegador | Calendario → lector bíblico restaura selección Biblia y barra visible. No sustituye Atrás nativo Android. |
| Android físico | No ejecutada: `adb devices -l` no muestra dispositivos. |
| Emulador Android | No ejecutada: `emulator -list-avds` no devuelve AVD configurado. |
| Instalación desde Play | No ejecutada; tampoco se subió ningún artefacto. |

En las mediciones finales conservadas, el error entre centro del indicador y centro del botón fue de hasta 0.6 px; la posición final funciona mejor que las transiciones. Los tamaños móviles simulan dimensiones, no Safari iOS, teclado táctil, gestos ni WebView Android. Un lote de pruebas se interrumpió por timeout; solo se registran arriba las comprobaciones con resultados recuperados explícitamente.

## Orden recomendado antes de publicar

1. Corregir el desbordamiento de fondos y comprobar en Safari que el borde inferior no cambia al recorrer las cinco secciones.
2. Corregir cancelaciones de la animación y agregar pruebas de pulsación rápida, mismo botón, cambio de dirección y resize durante el movimiento.
3. Resolver la integración de márgenes Android y los casos de teclado. Repetir los casos actuales que pasan.
4. Sincronizar recursos, incrementar `versionCode`, generar un candidato y registrar versión/hash del paquete. Probar instalación limpia y actualización desde 36.
5. Probar Android con gestos y con tres botones; retrato/paisaje; teclado abierto/cerrado; selector bíblico; Atrás nativo; entrada/salida de Profundiza; pausa/reanudación; texto ampliado; tema claro/oscuro y dispositivo de rendimiento moderado. Incluir Android 15/16 por borde a borde y al menos una versión anterior soportada.
6. Distribuir el mismo AAB por una pista de prueba de Play y revisar el informe previo al lanzamiento disponible. La navegación debe probarse también manualmente: un informe automático sin errores no garantiza que la animación sea fluida.

Criterios de aceptación: sin scroll horizontal involuntario; barra en posición constante; indicador sin teletransportarse ni quedar entre botones; selección acorde a la vista; márgenes que eviten los controles nativos; barra recuperada al cerrar teclado/selectores; Atrás correcto; instalación y actualización verificadas con el paquete candidato.

## Fuentes

- Código local y comparación de recursos Android indicados arriba.
- [Play Console: pruebas y versiones de Su Voz](https://play.google.com/console/u/0/developers/5466794951356714708/app/4974496459300724158/test-and-release), consultado en sesión autorizada, solo lectura.
- [Play Console: informe previo al lanzamiento](https://play.google.com/console/u/0/developers/5466794951356714708/app/4974496459300724158/pre-launch-report/overview), consultado el 23/09/2026.
- [Android: contenido de borde a borde](https://developer.android.com/develop/ui/views/layout/edge-to-edge).
- [Google Play: configurar pruebas internas/cerradas](https://support.google.com/googleplay/android-developer/answer/9845334?hl=es).
- [Google Play: usar el informe previo al lanzamiento](https://support.google.com/googleplay/android-developer/answer/9842757?hl=es).
