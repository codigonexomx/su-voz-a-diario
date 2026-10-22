# Su Voz a Diario

Aplicación de lectura bíblica diaria, meditación privada y Comunidad. Web/PWA con JavaScript modular, Android/iOS con Capacitor y backend Firebase.

## Desarrollo

Usar Node.js 22 y Java 21 para las pruebas del emulador y Android.

```sh
npm ci
npm --prefix functions ci
npm run android:copy
python3 -m http.server 8765 --bind 127.0.0.1 --directory www
```

Abrir `http://localhost:8765/`. Servir solamente `www`, nunca la raíz del repositorio: puede contener configuración de firma y archivos operativos privados. La vista local todavía utiliza los servicios Firebase configurados; las pruebas automatizadas usan proyectos `demo-*` aislados y datos ficticios.

## Validación

```sh
npm test
npm run test:all:emulator
npm audit --audit-level=moderate
npm --prefix functions audit --audit-level=moderate
git diff --check
```

`test:all:emulator` requiere Firebase CLI. El workflow instala una versión fijada y ejecuta las mismas pruebas con Node 22/Java 21. El runner rechaza direcciones no locales cuando se solicita el emulador. Los resultados locales quedan en `artifacts/validation/tests.json`, ignorado por Git.

La validación de cobertura avisa si quedan menos de 120 días de catálogo y falla si falta una lectura de los próximos 30 días. El contenido de 2027 requiere revisión editorial; las pruebas no generan textos ni autorizan licencias.

## Recursos y Versiones

- Fuentes web: `index.html`, `sw.js`, `js`, `css`, `data` y páginas públicas.
- `www` es la copia distribuible. `npm run android:copy` la sincroniza mediante una lista explícita de archivos públicos.
- Versión PWA: `scripts/version.mjs`; actualizar con `npm run pwa:sync-version` y revisar el diff.
- Android: `android/app/build.gradle`. No reutilizar un AAB antiguo para publicar correcciones nuevas.
- iOS: `ios/App`. Un build de simulador sin firma no equivale a una release validada.

## Backend y Publicación

`firebase.json` define Functions, Firestore y Storage, no Hosting. `suvoz.app` se publica con GitHub Pages desde `main`, carpeta raíz (legacy); un push publica la web. No suponer que `firebase deploy` publica la web.

Las nuevas funciones de moderación necesitan publicarse antes de la interfaz que las utiliza. El acceso de moderador no se concede automáticamente. App Check y la exigencia estricta de términos permanecen desactivados hasta completar la configuración y una transición compatible con clientes nativos existentes.

Procedimiento, límites de recuperación y comprobaciones de release: [Estabilización y Operación](docs/producto/estabilizacion-2026-10-01.md).

## Aprender a meditar

El quinto botón se llama `Aprender` y abre `Aprender a meditar` en `#workshop`, con `Vivir la Palabra` como frase de acompañamiento. Las lecciones conservan rutas estables y `Retomar` recupera la última. Se retiran los accesos generales a Mi camino; `#stats` conserva el historial personal y sus revisiones por compatibilidad, sin borrar registros. `#meditations-history` conserva la biblioteca personal y vuelve a Aprender. La lectura diaria abierta desde una lección permite regresar a ella, sin crear otro cuaderno de meditación.

El avance y los ejercicios se guardan localmente en `su-voz-workshop-v1`, entran en el respaldo completo y no se envían a Analytics ni a Firebase. Contactar a un asesor prepara un correo para `appsuvoz@gmail.com`; nunca incorpora los ejercicios ni envía el mensaje automáticamente.

Los pasajes de Aprender se consultan en NBLA mediante el repositorio bíblico existente, solo al abrirlos. Se conservan en memoria durante la sesión, sin guardarlos en el respaldo ni crear una copia persistente de NBLA. Sin conexión, un pasaje no cargado muestra un reintento y conserva los ejercicios; nunca se sustituye silenciosamente por otra traducción. No se amplían los permisos ni el alcance del servicio bíblico existente.

El propietario confirmó el 22 de octubre de 2026 que cuenta con autorización para adaptar el material de Meditación Bíblica México en web y Android. Se conserva su reconocimiento y el de Lee Jeong Book; esta confirmación no equivale a nuevas licencias de traducciones bíblicas. Validación: `node scripts/validate-workshop.mjs`, `npm test` y la suite con emuladores. La QA física de cada paquete se registra por separado antes de promoverlo a producción. No se ha añadido ninguna suscripción ni cobro.
