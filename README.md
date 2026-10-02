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
