# Aprender: web 267 y Android 1.5.20 (52)

Fecha: 22 de octubre de 2026, America/Mexico_City.
Base: `a33f63e49f71bf553c25544daf5e36447bad7e39`, main sincronizada con origin/main.

## Alcance y autorizacion

El propietario aprobo Aprender como quinto apartado, la implementacion completa y su publicacion. El 22 de octubre confirmo que ya tiene autorizacion para adaptar el material de Meditacion Biblica Mexico en web y Android. Esta es una confirmacion del propietario, no una inspeccion de un contrato ni una licencia adicional de traducciones biblicas. Se reconocen La Meditacion Biblica, Meditacion Biblica Mexico y Lee Jeong Book.

Ocho lecciones, Retomar, biblioteca de referencias, ejercicios privados y enlace a la meditacion diaria con regreso a la leccion exacta. Se retiran los accesos generales a Mi camino; su historial, revisiones, rutas antiguas y meditaciones se conservan. El contacto del asesor es appsuvoz@gmail.com, sin envio automatico ni inclusion de ejercicios.

Los pasajes NBLA usan el servicio biblico existente y memoria de sesion: no se incorpora una Biblia nueva al paquete ni una descarga persistente. Las consultas fallidas ofrecen reintento, sin sustituir traduccion ni borrar ejercicios. Los ejercicios y el avance son locales y forman parte del respaldo completo; no se envian a Analytics ni a Firebase.

No cambia backend, reglas, permisos, dependencias, contenido de Comunidad, politica de privacidad, iOS ni configuracion de Google Play. Quedan fuera marketing/ y los dos documentos previos de investigacion/propuesta.

## Validacion previa

- 50/50 comprobaciones locales, incluidas 4146 aserciones de Aprender, 252 variantes de leccion/pasaje/etapa y 80 grupos de referencias con 475 instancias de versiculo.
- 61/61 comprobaciones con Auth, Firestore y Storage aislados en proyectos demo. Emuladores cerrados al terminar; logs separados bajo artifacts/aprender-2026-10-22/emulators. Sin escrituras productivas.
- Las dos auditorias npm reportan cero vulnerabilidades.
- Compilacion Java 21, Gradle offline: bundleRelease, assembleRelease y lintRelease correctos. Cero errores de lint; 17 advertencias existentes, sin nuevos suppressions.
- Bundletool, firma y certificado de subida correctos; 164 recursos runtime coinciden con www. Ningun permiso nuevo ni archivo privado incluido.
- Cuatro bibliotecas nativas alineadas a 16 KB y PAGE_ALIGNMENT_16K. No equivale a QA fisica en un dispositivo de paginas de 16 KB.
- Los candidatos previos congelados, incluido 51, conservan sus hashes.

Paquete congelado: `artifacts/android-1.5.20-52-release/su-voz-1.5.20-52.aab`.
SHA-256: `69c1bf98eccb516fb2212382b623847c73520feeda75ef5d24aa4f685f7be347`.
Auditoria: `node scripts/audit-android-44.mjs --candidate52`, seleccionando Command Line Tools solo para el proceso.

## Entrega y comprobaciones posteriores

Web mediante GitHub Pages desde main, raiz. No corresponde desplegar Firebase Hosting ni Functions. La prueba interna conserva exclusivamente Su Voz QA - propietario 2026-10-02, un miembro; las listas de 14 y 29 personas no se seleccionan.

La entrega, CI, HTTP, consultas NBLA reales y QA del nuevo binario se registraran al verificarse. No se declara el nuevo paquete validado fisicamente por las pruebas de versiones anteriores ni se promueve a produccion antes de esa validacion. No se abren ni capturan meditaciones, oraciones o ejercicios personales.
