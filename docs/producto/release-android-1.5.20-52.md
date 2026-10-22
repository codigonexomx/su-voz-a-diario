# Aprender: web 267 y Android 1.5.20 (52)

Fecha: 22 de octubre de 2026, America/Mexico_City.
Base: `a33f63e49f71bf553c25544daf5e36447bad7e39`, main sincronizada con origin/main.

## Alcance y autorizacion

El propietario aprobo Aprender como quinto apartado, la implementacion completa y su publicacion. El 22 de octubre confirmo que ya tiene autorizacion para adaptar el material de Meditacion Biblica Mexico en web y Android. Esta es una confirmacion del propietario, no una inspeccion de un contrato ni una licencia adicional de traducciones biblicas. Se reconocen La Meditacion Biblica, Meditacion Biblica Mexico y Lee Jeong Book.

Ocho lecciones, Retomar, biblioteca de referencias, ejercicios privados y enlace a la meditacion diaria con regreso a la leccion exacta. Se retiran los accesos generales a Mi camino; su historial, revisiones, rutas antiguas y meditaciones se conservan. El contacto del asesor es appsuvoz@gmail.com, sin envio automatico ni inclusion de ejercicios.

Los pasajes NBLA usan el servicio biblico existente y memoria de sesion: no se incorpora una Biblia nueva al paquete ni una descarga persistente. Las consultas fallidas ofrecen reintento, sin sustituir traduccion ni borrar ejercicios. Los ejercicios y el avance son locales y forman parte del respaldo completo; no se envian a Analytics ni a Firebase.

No cambia el codigo backend, reglas, permisos, dependencias, contenido de Comunidad, politica de privacidad, iOS ni declaraciones de Google Play. El redespliegue operativo autorizado de una funcion se detalla mas abajo. Quedan fuera marketing/ y los dos documentos previos de investigacion/propuesta.

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

## Web publicada

Commit de codigo: `7a42cfcd2b855aede865b474e0e84986357772be`. Push normal a main correcto, sin force; HEAD y origin/main coinciden. El remoto antiguo redirige al repositorio codigonexomx/su-voz-a-diario; no se cambio su configuracion local.

[Pages](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39866442470) y [Product Validation](https://github.com/codigonexomx/su-voz-a-diario/actions/runs/39866443762) finalizaron correctamente. Trece recursos publicos devuelven HTTP 200 y coinciden por SHA-256 con la entrega. Evidencia: artifacts/android-1.5.20-52-release/production-http.json.

En https://suvoz.app/?analytics_test=1#workshop se verificaron la nueva navegacion, una consulta NBLA real, el destino appsuvoz@gmail.com y el circuito Meditar hoy / Volver a Aprender, que regreso a la leccion exacta. Sin envio de correo, marcas de lectura, publicaciones ni lectura de ejercicios privados. Captura de la portada publica: production-aprender.png. La URL ordinaria de uso no necesita analytics_test.

## Servicio biblico restablecido

Antes del push se reprodujo HTTP 500 en getRemoteBibleChapter tanto en la vista local como en la web 266 ya publicada. Tambien devolvia HTML 500 a una peticion sin autenticar, antes de los registros de ejecucion. Cloud Functions y Cloud Run figuraban activos; facturacion habilitada e identidades habilitadas. No se atribuye el fallo a una causa raiz no demostrada.

El propietario autorizo expresamente redesplegar solo getRemoteBibleChapter con el codigo actual. Comando: firebase deploy --only functions:getRemoteBibleChapter --project su-voz-a-diario-v2-f3a87 --non-interactive. Finalizo correctamente, sin desplegar otras funciones, reglas o Hosting ni modificar IAM.

Despues, una peticion sin autenticar recibio HTTP 401 / AUTH_REQUIRED, como corresponde. Las ocho lecciones cargaron su pasaje NBLA real, con 1, 7, 5, 5, 13, 3, 6 y 7 versiculos respectivamente. No se leyeron ni capturaron ejercicios. Evidencia de resultados, sin textos biblicos o personales: live-lessons.json.

## Prueba interna y pendiente fisico

Play acepto un unico AAB 52, API 24+, target 36 y ReTrace adjunto, sin errores bloqueantes ni perdida de dispositivos compatibles. Persiste una advertencia sobre simbolos nativos de dependencias no suministrados. No se aceptaron nuevas condiciones ni se ampliaron permisos de extension para cargarlo.

La release interna 13, 52 (1.5.20), figura disponible para verificadores el 22 de octubre a las 16:31. Solo esta seleccionada la lista Su Voz QA - propietario 2026-10-02, un miembro; las listas de 14 y 29 personas siguen sin seleccionar. Evidencia: play-internal-52.png. No se promovio 52 a produccion.

La Lenovo conectada sigue en 51 / 1.5.19 de com.android.vending; firstInstallTime permanece 2026-09-24 20:41:57. Play muestra la ficha Beta interna y el enlace confirma que la cuenta es verificadora, pero aun ofrece Abrir, no Actualizar. Se refresco la ficha y se cerro/reabrio Play Store, sin borrar cache ni datos; no se instalo APK local, desinstalo Su Voz, cambio de cuenta, permisos o conectividad. Wi-Fi activo y modo avion desactivado.

La QA nativa de 52 y su promocion productiva siguen pendientes de la actualizacion desde Play. Las pruebas de versiones anteriores no sustituyen esta comprobacion. El propietario fue informado y se solicito confirmar cuando aparezca la actualizacion. Los archivos y el AAB congelado permanecen intactos.
