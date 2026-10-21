# Biblia: lector editorial y ayudas de estudio

Fecha: 20 de octubre de 2026. QA actualizada el 21 de octubre de 2026, America/Mexico_City.

## Alcance

Implementacion sobre `e34cefc3226a561658bf7a35d6830b5d73356fa1`. Hasta el cierre de QA no se hizo commit, push, publicacion web productiva ni publicacion Android en produccion de este cambio. El 21 de octubre se publico la vista previa HTTPS de un dia autorizada para QA en iPhone, detallada mas adelante; conserva 263. Tras superar esa QA se preparo PWA 264 y Android 1.5.17 (49). Con aprobaciones expresas posteriores se publico 49 solo en la prueba interna exclusiva y se desplego unicamente la funcion corregida togglePrayerCommitment. Tras la confirmacion fisica final, el propietario autorizo completar commit, push, publicacion web y promocion a produccion del mismo AAB; seguimiento en docs/producto/release-android-1.5.17-49.md.

Se preservaron el paquete congelado Android 48, su informe y marketing. La primera etapa solo sincronizo los assets publicos de `www`, sin compilar. En la continuacion autorizada del 21 de octubre se corrigio puntualmente `functions/communityPrayer.js` y se ampliaron sus pruebas; se sincronizo y compilo el candidato Android 49. No se modificaron reglas, dependencias, permisos, datos biblicos, formatos de respaldo ni iOS. El despliegue puntual del backend no actualizo las otras 35 funciones.

## Cambios

- Texto corrido con numeros de versiculo discretos y referencias incrustadas. Los encabezados existentes delimitan bloques; no se inventan parrafos ni subdivisiones editoriales que la fuente no proporciona.
- Opcion persistente de texto corrido o por versiculos. Salmos, Proverbios, Cantares y Lamentaciones conservan una linea por versiculo como presentacion prudente; no se reconstruyen estrofas ni sangrias poeticas ausentes en los datos.
- Navegacion de libro, capitulo y version compacta; biblioteca de libros y capitulos mas limpia. Se mantienen busqueda y las tres fuentes locales existentes.
- Una sola barra de audio, notas y ajustes. Sus controles conservan el foco al actualizarse. Se mantiene el motor de voz existente y sus tokens de cancelacion, con seguimiento opcional de la posicion por palabra.
- Notas al pie sin recorte, con texto escapado, cierre accesible y referencia del pasaje. Se unifica la presentacion antigua de notas remotas sin interpretar su contenido como HTML.
- Panel de estudio lateral cuando cabe en escritorio y panel inferior acotado al viewport en movil. Las barras del lector son opacas incluso en modo enfoque.
- Ir al pasaje desde una referencia permite volver al libro, version y ancla original, conservando un regreso anterior a busqueda o notas.
- Tocar texto o el numero del versiculo abre de nuevo las acciones de anotacion del versiculo. El doble clic o la seleccion nativa de palabras no se interceptan para abrir el panel; permiten elegir el punto de inicio de la voz y copiar mediante el navegador. Identificadores, texto para comparar notas y claves de almacenamiento siguen intactos.
- Cambios de tamano, espaciado, presentacion y fuente conservan el ancla; una escritura fallida de preferencias no sustituye silenciosamente el ajuste anterior.

## Verificacion

`npm test`: 46/46 comprobaciones correctas tras sincronizar `www`. Incluye el nuevo validador `scripts/validate-bible-reader-presentation.mjs` y las regresiones existentes de audio continuo, busqueda, anotaciones, respaldo, teclado de Meditacion y navegacion.

El nuevo validador recorre los 31.102 versiculos de RV1909: texto exacto e identificadores preservados, sin limites de parrafo fabricados. Comprueba encabezados de fuente, notas escapadas, numeracion accesible, preferencias antiguas, error de cuota, anclas, intencion de seleccion, navegacion de referencias y limites del panel. Una prueba con motor de voz controlado recorre inicio, pausa, reanudacion, avance, finalizacion y detencion, junto con el resaltado activo y el foco de la barra unica.

Pruebas visuales y funcionales en Chrome local: escritorio, 768x1024, 393x852 y 320x740; sin desbordamiento horizontal observado. Tema claro/oscuro, las tres fuentes, modo por versiculos, paneles de notas/referencias, Escape, seleccion explicita y recarga de una nota/resaltado ficticios del origen local. No se leyeron meditaciones privadas del propietario ni se modifico contenido de Comunidad. Cambio real de RV1909/NBLA/NVI/Biblia Libre, nota de NBLA, Salmos 23, referencia completa con regreso y busqueda Juan 3:16 con retorno comprobados.

El navegador de prueba emitio finalizaciones de Web Speech casi inmediatas. Los registros temporales permitieron verificar la secuencia y se retiraron; la causa de esa rapidez no esta demostrada. Posteriormente el propietario confirmo que el capitulo se escucha y que detener responde, pero detecto que se pronunciaban referencias incrustadas. Tambien aprobo conservar la presentacion simplificada; no se restauraron fondos ni se cambio la paleta en la correccion posterior. La confirmacion fisica previa de 48 no se transfiere a estos assets nuevos.

### Correccion de Referencias en Audio

El proveedor remoto incorpora notas/referencias dentro de `verse.text` mediante marcadores `[[REF:f:...]]` y `[[REF:c:...]]`. El lector de voz recibia esos marcadores sin retirarlos. Ahora se eliminan exclusivamente al preparar los versiculos para voz, antes de normalizar espacios y puntuacion. No se modifica la respuesta del proveedor, el texto mostrado, sus referencias consultables ni las anotaciones guardadas. Los versiculos sin texto biblico tras retirar marcadores no se envian a voz, y el titulo se anuncia una sola vez en el primer versiculo reproducible.

Regresiones con notas/referencias consecutivas, incrustadas entre palabras o antes de puntuacion: el texto entregado a Web Speech y al plugin nativo contiene solo el pasaje y el anuncio inicial del capitulo. Se preservan repeticiones, numeros, corchetes y referencias que formen parte literal del texto biblico; no se aplica una eliminacion general de citas. Pausa, reanudacion, avance y detencion siguen comprobados. El 21 de octubre el propietario confirmo que NBLA se escucha sin notas ni referencias en Chrome de la Lenovo y en la PWA de prueba del iPhone; esto no acredita todavia el motor de un candidato Android nativo nuevo.

### Seleccion y Continuidad de Voz

Tras el reporte del propietario, se restauro el panel al tocar el cuerpo del versiculo, no solamente su numero. Un intervalo corto permite el doble clic nativo sin bloquearlo. El panel conserva resaltado, copia, imagen, nota y meditacion, y agrega Escuchar desde aqui. Las anotaciones siguen siendo de versiculo completo, con el formato existente; no se introduce un contrato nuevo de anotaciones por rango de caracteres.

El punto tocado o el inicio de una seleccion nativa se resuelve con las APIs de caret del navegador, se ajusta al inicio de la palabra y excluye botones de referencia. La seleccion nativa cambia la accion de audio a Desde aqui; no modifica el texto biblico ni activa escritura. Si el navegador no proporciona un caret valido, se usa el inicio del versiculo. La barra usa el capitulo visible, por lo que un audio pausado de otro capitulo no sustituye silenciosamente el pasaje actual. Volver al audio permanece como accion explicita y separada.

Web Speech informa el avance mediante eventos boundary; el plugin nativo instalado mediante onRangeStart. Al pausar se conserva esa posicion y se reanuda desde la palabra disponible. Callbacks obsoletos no alteran una reproduccion posterior y los listeners nativos se retiran al cancelar/finalizar; no se cambian permisos ni se reemplaza el motor. Si el motor no proporciona posiciones, el fallback conservador repite el versiculo actual, no el capitulo completo. La precision por palabra requiere comprobacion fisica en cada motor.

El panel de seleccion de Biblia no fuerza desplazamientos al abrirse. La actualizacion posterior a una anotacion conserva el capitulo visible y el ancla, y el panel queda centrado y sin desbordamiento en pantallas pequenas. Comprobacion directa en Chrome: tocar texto en Genesis 2 abre el panel; Escuchar desde aqui cierra el panel y conserva Genesis 2 y exactamente la misma posicion de scroll. El doble clic mantiene la seleccion nativa y habilita Desde aqui.

La prueba C10 de Community UI Integration antes rechazaba cualquier aparicion de readingKey en todo app.js, aunque fuera estado local de Biblia. Se sustituyo esa busqueda global por la ejecucion del metodo real addCommunityPost con un callable simulado y una lista exacta de campos permitidos. Comprueba que readingKey y dailyQuestion no se transmiten aun cuando esten en la entrada; no se modifico codigo productivo de Comunidad ni se hizo ninguna publicacion real.

### Conservacion de Lugar y Tipografia

La auditoria posterior encontro una carrera al guardar antes del siguiente frame del encabezado: podia persistirse el capitulo anterior con el versiculo del capitulo visible. Ahora libro, capitulo, versiculo y desplazamiento se toman de la misma entrada visible. Se normalizan posiciones no finitas y numeros de versiculo fraccionarios. Guardar devuelve el resultado real del almacenamiento y una migracion fallida por cuota conserva el estado antiguo de sesion para reintentarlo.

La restauracion de reapertura es cancelable y comprueba la identidad del render, ruta, libro, capitulo y version en cada frame y temporizador. Salir, cambiar capitulo o version cancela los callbacks anteriores. Un temporizador obsoleto no puede liberar el bloqueo de guardado de una restauracion mas reciente.

Las anclas de cambios tipograficos incluyen libro y capitulo, no dependen del encabezado actualizado despues del reflujo. Se alinean antes del observador de scroll y al terminar de cargar las fuentes locales. Un gesto de desplazamiento posterior cancela la correccion tardia. Se encontro ademas una regla heredada `transition: all 0.15s` en los versiculos: animaba tamano y altura despues de restaurar el ancla. El lector limita esa transicion a color, fondo y sombra del resaltado.

Comprobacion directa en Chrome tras el ajuste final: Genesis 4:17 se mantuvo en top 172.078125/172.328125/172.125 px al cambiar fuente, presentacion y tamano; despues de recargar siguio en Genesis 4:17, top 172.125 px. No se modifico texto ni anotaciones para esta comprobacion. Las APIs de caret y Range ahora toleran rangos invalidados por un cambio de capitulo o version sin romper las acciones del versiculo.

Pruebas adicionales del metodo real: encabezado desactualizado, migracion con cuota agotada, numeros no finitos, salida durante el primer/segundo frame, dos restauraciones superpuestas, callbacks despues de navegar, fuente cargada despues del primer dibujo, gesto del usuario antes de finalizar la fuente, registro nativo de voz pendiente al detener y motor sin eventos por palabra. No se usa un reintento completo de toggle para ocultar errores de transacciones.

## Incidencia de la Suite Completa

Tres ejecuciones completas con emuladores locales demo de Auth, Firestore y Storage terminaron 55/56. No se omitieron ni modificaron aserciones para obtener un resultado favorable:

1. `functions/communityPrayerConcurrency.test.js`, caso C1, error `3 INVALID_ARGUMENT: Transaction is invalid or closed.`
2. `functions/stabilization.test.js`, consulta de `communityActivity.js:55`, mismo error; la prueba de concurrencia de oracion paso en ese intento.
3. `functions/communityPrayerConcurrency.test.js`, caso C1, mismo error; estabilizacion paso.

Resultados completos conservados en `artifacts/bible-reader-2026-10-20/emulator-attempt-1.json`, `emulator-attempt-2.json` y `emulator-attempt-3.json`. El fallo ya figuraba en la QA anterior de 48. En ese punto su causa exacta seguia sin resolver y no era correcto presentar la suite como aprobada ni asumir que era inocuo en produccion. La correccion posterior autorizada y sus resultados se documentan mas abajo; se preservan los fallos originales como evidencia.

La cuarta ejecucion reprodujo C1 (55/56), usando Firestore emulator 1.20.4; informe `artifacts/bible-reader-2026-10-20/emulator-attempt-4.json`. El log muestra `Transaction lock timeout` seguido de `Transaction is invalid or closed`. El SDK instalado reconoce como reintentable INVALID_ARGUMENT solo cuando el mensaje incluye `transaction has expired`; el emulador devuelve un mensaje distinto. Esto explica por que ese error no se reintenta automaticamente, pero no demuestra por si solo la causa inicial del bloqueo.

Se contrasto con el emulador oficial 1.21.0, aislado en `/private/tmp/su-voz-emulator-qa-cache`, sin cambiar la instalacion global, dependencias del proyecto ni produccion. SHA-256 verificado: `c3d3680a89d946a90a027365ea14c26c6472a162bcf37f099bbb1ebd66d25e8e`, coincidente con el [manifest oficial de Firebase Tools 15.24.0](https://github.com/firebase/firebase-tools/blob/v15.24.0/src/emulator/downloadableEmulatorInfo.json). El mismo C1 volvio a fallar (55/56); resultado `artifacts/bible-reader-2026-10-20/emulator-1.21.0.json`. No se atribuye el problema exclusivamente a la version antigua ni se debilita la prueba de concurrencia. Los emuladores se cerraron tras cada ejecucion.

El 21 de octubre se contrasto la lectura secuencial original con un adaptador de diagnostico que agrupa las dos lecturas mediante `transaction.getAll`, siempre ejecutando la logica real y exclusivamente contra un emulador demo local. Las tres parejas de cada variante finalizaron correctamente, con contador y compromisos en cero. No hubo evidencia para justificar cambiar el backend por esa hipotesis. La prueba original completa `functions/communityPrayerConcurrency.test.js` tambien paso sus 12 casos al ejecutarse aislada en el emulador 1.21.0. Estos resultados no sustituyen ni convierten en aprobadas las ejecuciones completas fallidas; la causa de la diferencia sigue abierta.

Tambien paso la secuencia original de identidad, aislamiento de fixtures mediante DELETE del proyecto demo y prueba original de oracion (12/12), usando el mismo orden y proyecto de CLI que la suite. Informe: `artifacts/bible-reader-2026-10-21/prayer-suite-boundary.json`. No se demostro que la limpieza entre suites o agrupar lecturas causen/resuelvan el fallo. Firebase [documenta diferencias de transacciones y liberacion tardia de locks en el emulador](https://firebase.google.com/docs/emulator-suite/connect_firestore#transactions); esa limitacion no demuestra por si sola la causa de este caso ni permite dar por comprobada produccion. No se agregaron sleeps, reintentos completos de toggle ni omisiones de aserciones. La ultima ejecucion estandar vuelve a pasar 46/46: `artifacts/bible-reader-2026-10-21/standard-final.json`.

`npm audit --audit-level=moderate` y `npm --prefix functions audit --audit-level=moderate`: ambos informaron cero vulnerabilidades durante esta revision. No se cambiaron dependencias.

### Correccion Posterior de Concurrencia

Tras la peticion expresa de resolver el fallo se reprodujo de nuevo con la secuencia integrada de Auth, reglas, estabilizacion, identidad y oracion. La traza del SDK mostro dos lecturas iniciales concurrentes de la peticion, la lectura posterior del compromiso y un commit bloqueado. El commit devolvio ABORTED por lock timeout; la otra lectura termino intentando reutilizar una transaccion cerrada. Evidencia original, sin alterar aserciones: `artifacts/bible-reader-2026-10-21/prayer-prefix-before.json` y `prayer-transaction-before.log`.

Se contrasto una lectura conjunta en ese mismo contexto y paso. La correccion real sustituye exclusivamente los dos `transaction.get` secuenciales de `togglePrayerCommitmentLogic` por `transaction.getAll(requestRef, commitmentRef)`, antes de cualquier escritura. Mantiene la transaccion, las validaciones, los documentos privados, el esquema y la respuesta publica. No se agrega un reintento externo del toggle, no se ignoran errores y no se serializan las dos operaciones de la prueba.

Las 25 pruebas unitarias pasan; una regresion comprueba las dos referencias exactas en una sola lectura y otra que un fallo de lectura se propaga sin escrituras ni repeticion de la operacion. Se conservaron los 12 casos originales del emulador y se agregaron dos: seis parejas concurrentes sucesivas del mismo usuario y una pareja concurrente combinada con otro usuario. Los 14 casos verifican tanto el contador como los compromisos privados.

Con el codigo real corregido, sin adaptador de diagnostico, la suite completa paso 56/56 en Firestore emulator 1.21.0 y 56/56 en el habitual 1.20.4. La segunda ejecucion incluye ya PWA 264 y los assets sincronizados para el candidato 49. Informes: `artifacts/bible-reader-2026-10-21/emulator-getall-1.21.0.json` y `emulator-getall-1.20.4.json`. Las advertencias de multiples proyectos demo se conservaron; no se cambio la configuracion para ocultarlas. Ambos emuladores se cerraron al finalizar.

Posteriormente se desplego solo togglePrayerCommitment con aprobacion expresa. Quedo ACTIVE; su hash cambio y los de las otras 35 funciones permanecen iguales, sin cambios en los ajustes de runtime informados. Una peticion sin autenticar devolvio 401 / UNAUTHENTICATED, sin crear contenido. No se desplegaron reglas ni Hosting y se excluyeron los logs de la carga mediante una configuracion temporal. Evidencia y comando en `docs/producto/release-android-1.5.17-49.md` y `artifacts/bible-reader-2026-10-21/function-deploy-verification.json`.

## QA Fisica y Offline del 21 de Octubre

### Chrome en Mac

Se completo la comprobacion antes detenida por el bloqueo del Mac. En una pestana temporal del lector, con la cache normal habilitada y Network de DevTools en Offline, la recarga mostro Genesis 1 con sus 31 versiculos y permitio avanzar a Genesis 2 con texto real. No se cambio el Wi-Fi ni la red del sistema. Al terminar se restauro No throttling y el estado previo Disable cache activado; se cerraron DevTools y la pestana temporal. No acredita una primera instalacion sin cache ni disponibilidad offline de Biblias remotas.

### Chrome en Lenovo por USB

Con autorizacion especifica se creo exclusivamente `reverse tcp:8775 tcp:8775` y se abrio la web local en Chrome. El primer intento de NBLA mostro Firebase todavia no disponible; una recarga del navegador permitio cargar NBLA correctamente. No se ha demostrado la causa de ese fallo inicial ni se hizo un cambio de configuracion para ocultarlo.

Se comprobo RV1909 y NBLA, avance a Genesis 2, panel de acciones al tocar el numero de versiculo y cierre sin guardar anotaciones. La seleccion de una palabra tambien mostro la interfaz nativa Touch to Search de Chrome; no se modificaron esos ajustes del navegador. La reproduccion desde Entonces en Genesis 1:6 marco el versiculo correcto y se detuvo. El propietario confirmo voz clara sin pronunciar notas ni referencias.

Las tres fuentes cambiaron visualmente. Se eligio Inter en Genesis 2 y se recargo a mitad del capitulo: libro, capitulo, version y posicion visible se conservaron. Evidencia en `artifacts/bible-reader-2026-10-21/lenovo-position-before.png` y `lenovo-position-after.png`, junto con capturas de seleccion, audio y acciones del versiculo en ese directorio.

Al terminar se cerro solo la pestana creada para QA y se retiro exclusivamente la redireccion 8775. La lista volvio a las tres redirecciones preexistentes, sin alterarlas: 8081 a 8082, 8082 a 8082 y 3000 a 3000. En ese momento la app instalada seguia en 1.5.16 (48), de `com.android.vending`; esa comprobacion no instalo, desinstalo ni borro nada, ni abrio meditaciones privadas. La prueba de Chrome es de la web en Android, no del plugin de voz ni del binario nativo nuevo. La actualizacion posterior desde Play y la QA nativa de 49 se describen mas adelante.

### Vista Previa HTTPS e iPhone

Se preparo una copia temporal de `www` en `/private/tmp/su-voz-reader-qa-20261021/public`, sin archivos privados, logs, credenciales ni paquetes Android. Solo en esa copia se ajustaron el titulo y manifiesto para distinguir Su Voz QA, con inicio `/?analytics_test=1#bible-reading`, alcance propio y modo standalone. No se modifico el manifiesto productivo. El origen separado no accede a las notas guardadas en suvoz.app.

Publicacion autorizada:

```text
firebase --config /private/tmp/su-voz-reader-qa-20261021/firebase.json \
  --project su-voz-a-diario-v2-f3a87 \
  hosting:channel:deploy bible-reader-qa-20261021 \
  --expires 1d --no-authorized-domains --json
```

URL: https://su-voz-a-diario-v2-f3a87--bible-reader-qa-20261021-siuz5hdp.web.app/?analytics_test=1#bible

Caducidad informada por Firebase: `2026-10-22T11:28:47.993655496Z`, 22 de octubre a las 05:28:47 de America/Mexico_City. No se sincronizaron dominios de Auth ni se desplegaron produccion, Functions o reglas. HTTP 200, HTTPS y cabeceras noindex/nofollow/noarchive, no-store y nosniff comprobados. Los hashes SHA-256 de app.js, ambos modulos nuevos, CSS del lector y sw.js servidos coinciden con `www`. El parametro analytics_test excluye la sesion de medicion Analytics.

El propietario instalo y abrio el icono separado Su Voz QA en el iPhone. Confirmo cambio RV1909/NBLA y panel de versiculo en Genesis 2 sin saltos; seleccion de palabra, audio Desde aqui, pausa, reanudacion y detencion sin notas/referencias ni regreso a Genesis 1; las tres fuentes, cambio de formato y conservacion de Inter y del lugar tras cerrar/reabrir la PWA. Tambien confirmo la reapertura de Genesis 2 en RV1909 sin conexion, con modo avion y Wi-Fi apagado, y el restablecimiento posterior de sus conexiones. No se usaron ni modificaron sus meditaciones habituales.

### Binario Android 49 de Google Play

Con la autorizacion especifica posterior se publico 1.5.17 (49), PWA 264, solo en la prueba interna de un miembro. Despues de la propagacion, se actualizo la Lenovo desde Play, sin APK local ni desinstalacion. Dumpsys confirmo 49 / 1.5.17, com.android.vending y firstInstallTime original conservado.

En el binario nativo se comprobaron RV1909 y NBLA, Genesis 2, seleccion de soplo en 2:7, Desde aqui, estados de reproduccion/pausa/reanudacion/detencion, panel del versiculo sin guardar, tres fuentes y ambas presentaciones. Se restablecio Inter y texto corrido. Al cerrar y reabrir, entrar de nuevo en Biblia recupero Genesis 2 y la misma posicion visible con Inter. El 21 de octubre el propietario confirmo en 49 el audio desde la palabra elegida sin numeros de notas ni referencias, y la conservacion de sus meditaciones anteriores. No se sustituye esa evidencia con las pruebas de Chrome o iPhone y el agente no abrio ni leyo notas privadas.

Una sola prueba offline autorizada apago exclusivamente Wi-Fi, confirmo ausencia de red predeterminada y reabrio Genesis 2 RV1909 en el lugar conservado. Wi-Fi se restablecio inmediatamente y se confirmo activo con red. No se tocaron datos moviles, cuentas, permisos ni meditaciones. Capturas y resultado en artifacts/android-1.5.17-49-release/lenovo-qa; detalle en docs/producto/release-android-1.5.17-49.md. No se observaron errores criticos en la inspeccion acotada del proceso actual de Su Voz.

## Limites y Siguiente Validacion

Con las dos confirmaciones finales del propietario queda completada la QA fisica planificada de 49 en la Lenovo: sonido sin notas/referencias, meditaciones conservadas, seleccion, fuentes, reapertura, ubicacion y lectura offline. La correccion de concurrencia tiene dos suites completas correctas y despliegue puntual autorizado. No se han leido notas privadas ni transferido aprobaciones de otra version para cerrar la QA. Este resultado no acredita ausencia absoluta de fallos ni equivale a cerrar otros expedientes de la auditoria, como licencias. Las Biblias remotas no se presentan como descargadas para uso offline. La publicacion productiva posterior fue autorizada como un paso separado; su resultado debe verificarse en GitHub Pages y Play, sin confundir envio a revision con distribucion publica.

La vista local se sirve en `http://127.0.0.1:8775/?analytics_test=1#bible-reading`; no es una URL accesible desde el iPhone. El parametro de prueba excluye la medicion Analytics de esa sesion. No se modifico la configuracion de Analytics.

AAB 48 preservado: `artifacts/android-1.5.16-48-release/su-voz-1.5.16-48.aab`, SHA-256 `bc273fcf5265da1e24b1e0a466771f5b195601a0330c647384f9836062905daf`. Se construyo un paquete nuevo y separado 49, con el hash auditado `60abb349569a45fe50b41209e87ef9860d572cea5e8273b7caf507c1d2c093f4`, y se publico inicialmente solo en la prueba interna exclusiva del propietario. Tras la autorizacion final se promovio ese mismo paquete como unico cambio de produccion enviado a revision, sin recompilarlo. Aun no se acredita aprobacion ni disponibilidad publica de 49.

## Entrega Publica Posterior

El 21 de octubre se crearon y subieron los commits 3840a02 (concurrencia y pruebas) y 99f49d6 (lector editorial y preparacion Android 49), sin incluir marketing. GitHub Pages publico PWA 264 en https://suvoz.app y Product Validation confirmo 56/56 en GitHub, ambos npm audit correctos y copia nativa sin cambios tracked. HTTP y hashes de los archivos principales coinciden con las fuentes. La comprobacion de navegador productivo con analytics_test=1 paso lectura diaria, Biblia y cambio BL/NBLA, Comunidad sin modificar contenido, Calendario y regreso al lector, sin errores observados. No se volvieron a desplegar Functions o reglas ni se cambiaron permisos o iOS.

Play recibio exclusivamente Produccion / 49 (1.5.17) / Iniciar lanzamiento completo, 100% y paises actuales sin cambio. Su resumen confirma Cambios en la etapa de revision con verificaciones rapidas en curso; no se confunde ese estado con aprobacion ni distribucion publica. Sin errores bloqueantes o dispositivos compatibles perdidos; se mantiene la advertencia existente por simbolos nativos. Detalle, enlaces y evidencia en docs/producto/release-android-1.5.17-49.md. Las gestiones de licencias y demas pendientes operativos siguen separadas.
