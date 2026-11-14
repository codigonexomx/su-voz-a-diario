# Introducción a Apocalipsis: web 273 y Android 1.5.26 (58)

Fecha de preparación: 14 de noviembre de 2026, America/Mexico_City.
Base auditada: `2acd403647b898c019dd994fb0ce45714d2705ac`.

El propietario solicitó añadir [la introducción a Apocalipsis](https://youtu.be/DOIFL7tllR4) a la web/PWA y a la aplicación Android de Google Play durante cinco días, en el mismo lugar de las introducciones anteriores. El catálogo inicia Apocalipsis el 18 de noviembre de 2026; la tarjeta se muestra del **18 al 22 de noviembre, ambos inclusive**, antes del pasaje en Su Voz Hoy y en la lectura histórica.

Se reutiliza el diseño existente: portada local, botón «Ver introducción», reproductor youtube-nocookie activado por el usuario, aviso de conexión y enlace alternativo a YouTube. Se conservan las demás introducciones y el calendario de lecturas.

## Validación previa a publicación

- Pasaron 64/64 comprobaciones con emuladores locales. Las pruebas cubren las cinco fechas, sus límites, la portada local, la ausencia de reproductor remoto antes de pulsar, el video correcto, el modo sin conexión y la prevención de reproductores duplicados.
- En navegador local se observó la reproducción mediante youtube-nocookie, con duración indicada de 9:54. La tarjeta aparece el 22 de noviembre y desaparece el 23.
- Compilación Android de release y lint correctos. La auditoría candidate58 valida el bundle, su firma y el mismo certificado de subida; 167 recursos públicos coinciden con www, se excluyen archivos privados y no se añaden permisos. API mínima 24, target 36, cero errores lint y 16 advertencias. Alineación estática de 16 KB verificada; la prueba física de páginas de 16 KB sigue pendiente.
- Las auditorías npm de raíz y Functions reportan cero vulnerabilidades. Se fijan glob 14.0.2 y minimatch 11.0.1 y se actualiza fast-xml-parser 5.12.1 en el lock de Functions; las APIs utilizadas pasan pruebas específicas con Node 22. Las dependencias directas y Capacitor nativo no cambian. No se desplegó el backend.

Paquete auditado: `artifacts/android-1.5.26-58-release/su-voz-1.5.26-58.aab`.
SHA-256: `56b5dd148929533aba12639fb2b2f152d7feb523f045cb75c93287c969cf5f1e`.
Evidencia: `artifacts/android-1.5.26-58-release/audit-release.json`.

Estado: implementación, compilación y auditoría del candidato completadas. La publicación web y la entrega en Google Play siguen pendientes de verificación; no se presenta este candidato como publicado ni disponible al público. La QA física también está pendiente. La entrega se documentará por separado.
