# Indicador líquido — segunda propuesta, PWA 237

Se sustituye el óvalo estirado de PWA 235 por un cuerpo compacto de hasta 54 px de ancho, con esquinas redondeadas, y dos gotas de distinto tamaño. La velocidad de la animación controla el estrechamiento del cuerpo y la separación de las gotas. Al frenar, las gotas se acercan y se fusionan de nuevo. La barra y los iconos conservan sus dimensiones y posiciones.

## Investigación y elección

- [Codrops: Creative Gooey Effects](https://tympanus.net/codrops/2015/03/10/creative-gooey-effects/): combinación de desenfoque y contraste del canal alfa para unir formas próximas y producir cuellos líquidos. La referencia recomienda limitar el área filtrada.
- [MDN: feGaussianBlur](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/feGaussianBlur) y [filtros SVG](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_filters): primitivas empleadas en la máscara.

Implementación propia: una máscara SVG opaca une el cuerpo y las gotas; el color translúcido y el reflejo se aplican después. El filtro está acotado a 140 × 64 unidades y nunca procesa texto, iconos ni la barra completa. No añade librerías. Es una interpretación gráfica de agua, no refracción física.

Se conserva el resorte anterior, incluida su continuidad al invertir el recorrido. Las gotas siguen la velocidad real, no saltan al nuevo sentido solicitado. Sus centros y radios se limitan para conservar margen respecto a ambos extremos. En reposo desaparecen las gotas secundarias y no quedan cuadros de animación pendientes. Movimiento reducido coloca directamente la forma compacta sin descomposición.

## Verificación

- `npm run test:bottom-nav`: pasan los casos anteriores de teclado/navegación, pulsaciones rápidas, mismo botón, reversión, resize, movimiento reducido y 20–120 Hz.
- Nuevos casos: separación efectiva de gotas, límites de cada círculo, tamaño compacto en reposo y reunión completa.
- Navegador integrado: recorrido de cinco secciones, indicador y gotas contenidos, cero desbordamiento y borde inferior estable; comprobación adicional a 320 × 568.
- Safari macOS: inspección visual de una muestra detenida durante el recorrido y cinco secciones con resultado aprobado; borde inferior constante en 840 px sobre un viewport de 848 px.
- La página local `scripts/nav-browser-check.html` incluye una muestra detenida a 120 ms para inspeccionar la silueta; hay que recargarla después para volver al recorrido normal. Ese control no forma parte de la aplicación distribuida.

Recursos web sincronizados con `www` y Android. Este efecto nuevo aún no se ha comprobado en un dispositivo Android ni empaquetado en otro AAB. El candidato AAB 37 anterior sigue correspondiendo a PWA 234; su hash no cambia. Esta propuesta está preparada para incorporarse al repositorio; no se ha distribuido un paquete Android con el efecto nuevo.

Vista previa: `http://127.0.0.1:8765/index.html`.

## Paleta unificada

Las cinco secciones usan ahora el dorado de Comunidad: selección clara `#A66F24`, selección oscura `#D59A42` e indicador líquido `#BF984F`. El reflejo de la barra y el foco de teclado también usan dorado.
