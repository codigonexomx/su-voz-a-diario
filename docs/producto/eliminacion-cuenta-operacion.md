# Eliminacion de Cuenta: Operacion Privada

Estado: implementacion y pruebas locales, no autorizacion de borrado de una persona ni certificacion juridica. No ejecutar sobre la cuenta del moderador. No usar la limpieza de 1007 huerfanos como autorizacion para borrar cuentas.

## Activacion Separada

Antes de operar deben publicarse las Functions que usan accountDeletionAccess y las reglas de Firestore/Storage. Storage necesita consultar Firestore; conceder el rol oficial roles/firebaserules.firestoreServiceAgent a su agente de servicio solo con aprobacion concreta, sin otros roles/personas. [Referencia Firebase](https://firebase.google.com/docs/storage/security/rules-conditions#enhance_with_firestore).

Verificar compilacion/despliegue y compatibilidad de clientes anteriores. Solo despues registrar privadamente communityConfiguration/accountDeletion con version account-deletion-v1, enabled true, firestoreGuard true, storageGuard true y callTimeoutSeconds 60. No usar ese marcador para simular un despliegue que no ocurrio. El CLI no activa el soporte ni cambia IAM. Mientras falte, rechaza toda congelacion/ejecucion.

La barrera accountDeletionGuards/UID no es publica. Bloquea callables y escrituras de Firestore/Storage aunque el cliente conserve un ID token anterior; revocar refresh tokens por si solo no equivale a invalidar todas las solicitudes ya admitidas. Las callables quedan acotadas a 60 segundos y el operador espera al menos 120 segundos desde la barrera. Metricas/actividad comprueban el bloqueo dentro de la transaccion; los envios excluyen cuentas bloqueadas. Un mensaje ya entregado a FCM no puede retirarse. [Sesiones Firebase](https://firebase.google.com/docs/auth/admin/manage-sessions).

## Tramite por Solicitud

1. Comprobar la solicitud autenticada pending, UID/hash y titularidad; reautenticacion reciente se exige a cuentas vinculadas. No aceptar un UID/correo sin comprobacion. Informar al titular del alcance y las retenciones aplicables.
2. Usar inventoryAccountDeletion.js para crear inventario privado; revisar conflictos, colecciones/subdocumentos nuevos, audio sin propiedad comprobada y referencias de otros usuarios. Denuncias, cascadas pendientes y ledgers sin completar detienen el ejecutor: requieren decision documentada, no una opcion de forzar.
3. Confirmar especificamente congelar esa cuenta, con proyecto, inventario y hash exactos. Ejecutar primero freeze en dry-run; apply bloquea acceso, deshabilita Auth y revoca refresh tokens, pero no borra datos. Si falla, no quitar la barrera automaticamente. Durante el tramite no modificar roles ni operar otra herramienta sobre la misma cuenta.
4. Esperar al menos 120 segundos. Preparar un plan nuevo tras la pausa, con export Firestore completo del mismo proyecto, SUCCESSFUL, en private-backups y de menos de 24 horas. Un export gestionado no es una instantanea transaccional ni una papelera. Si existen audios, el operador debe respaldar cada generacion concreta en el mismo bucket privado antes de aprobar su retirada; el ejecutor no acepta un export de Firestore como respaldo de Storage.
5. Revisar el plan exacto y confirmar por separado el borrado: documentos, redacciones de outbox y versiones de Storage. No incorporar candidatos nuevos a una aprobacion anterior. Si una publicacion propia incluye respuestas/reacciones ajenas asociadas, explicar e incluir ese alcance expresamente; no borrar sus perfiles ni otros contenidos.
6. Ejecutar dry-run y despues apply con hash y conteos exactos. Crear una bitacora privada nueva, exclusiva y sincronizada antes de cada operacion. No se imprime UID, correo, textos, tokens ni nombres personales de archivos en la consola.
7. Verificar ausencias, contadores y Auth; solo entonces la solicitud pasa a completed, sin UID/correo en su documento. Informar al titular. El panel no promete un borrado inmediato al solicitarlo.

## Comandos Acotados

Todos los archivos de entrada/salida pertenecen a artifacts/validation, fuera de Git, con permisos 0600. Sustituir placeholders solo despues de verificar el caso; no publicar valores reales.

```sh
node functions/executeAccountDeletion.js --freeze \
  --project=PROYECTO --confirm-project=PROYECTO \
  --inventory=RUTA_PRIVADA_JSON --inventory-sha256=HASH_EXACTO \
  --firebase-cli-auth-module=MODULO_FIREBASE_CLI_CONFIRMADO
```

Para congelar, anadir --apply y --report=RUTA_PRIVADA_NUEVA_JSONL solo con aprobacion especifica. No reutilizar la bitacora anterior.

```sh
node functions/executeAccountDeletion.js --prepare \
  --project=PROYECTO --confirm-project=PROYECTO \
  --request=REFERENCIA_PRIVADA_COMPLETA \
  --backup-operation=OPERACION_FIRESTORE_VERIFICADA \
  --out=RUTA_PRIVADA_NUEVA_JSON \
  --firebase-cli-auth-module=MODULO_FIREBASE_CLI_CONFIRMADO

node functions/executeAccountDeletion.js --execute \
  --project=PROYECTO --confirm-project=PROYECTO \
  --plan=RUTA_PRIVADA_JSON --plan-sha256=HASH_EXACTO \
  --firebase-cli-auth-module=MODULO_FIREBASE_CLI_CONFIRMADO
```

Para audio, prepare requiere --storage-backup-manifest=RUTA_PRIVADA_JSON. Es un array de copias con source (name, generation, metageneration, size y md5Hash/crc32c disponibles) y backup (name, generation, metageneration). La copia pertenece al mismo bucket, bajo private-backups/account-audio/REFERENCIA/, no accesible por reglas publicas; su metadata contiene accountDeletionReference, sourceGeneration y sourceNameSha256. No conserva ownerUid/uid en la metadata de la copia. Verificar la generacion original al copiar; no descargar audio en la Mac para este tramite. El ejecutor comprueba las metadata, tamanos, checksums y generaciones de original/copia antes del plan y antes de completar el borrado. Sin copia comprobada se detiene. Estos respaldos retenidos no se declaran eliminados.

Para borrar, anadir --apply, --confirm-records=DOCUMENTOS_MAS_REDACCIONES, --confirm-storage-versions=VERSIONES_EXACTAS y --report=RUTA_PRIVADA_NUEVA_JSONL, despues de aprobar ese alcance. La ejecucion rechaza un respaldo fallido/vencido, moderador, solicitud modificada, archivos nuevos y registros cambiados. No hay --force, bypass de revisiones ni UID arbitrario como entrada.

## Interrupciones y Retenciones

Lotes de hasta 40 unidades, manteniendo parejas privadas/publicas juntas. Precondiciones de version con nanosegundos. Los contadores se descuentan en la misma transaccion que elimina el registro y no se repiten si ya esta ausente. Otro destinatario del outbox se conserva. Un cursor personal se retira solo de un ledger completado; la deduplicacion no se borra. Audio: metadata de propiedad y precondiciones de generation/metageneration en el objeto concreto.

Ante resultado ambiguo de Firestore/Storage: revisar bitacora y estado; reanudar solo el mismo plan aprobado mientras respaldo y precondiciones sigan vigentes. Cambios, candidatos nuevos o respaldo vencido detienen el proceso; no sustituir unilateralmente el hash fijado en la barrera. No restaurar sobre produccion para ensayar.

Si Auth borro la cuenta pero se perdio su respuesta o falto completar la solicitud, --finalize --apply con el mismo plan/hash y una bitacora nueva solo cierra metadata. Exige la barrera previamente vinculada al plan y authDeletionStarted, comprueba Auth ausente, vuelve a inventariar Firestore/Storage y rechaza datos remanentes. No borra contenido, no congela otra cuenta ni acepta una Auth existente como eliminada. No necesita un nuevo backup para esta finalizacion no destructiva.

La barrera privada conserva la referencia y estado minimo para evitar replays de una identidad retirada; no conserva email/textos/tokens. Su retencion y la de respaldos/bitacoras requieren una politica operativa explicita. No afirmar eliminacion absoluta de toda trazabilidad ni activar TTL sin revisar ventanas de replay. Notas, copias exportadas en dispositivos y datos gestionados por Analytics/proveedores tienen tratamiento separado; no se afirma que este ejecutor los elimine.

Pruebas: suite completa local con cuentas, textos, tokens falsos y archivos ficticios; freeze, tokens anteriores, reglas reales, trabajos retrasados, reanudacion sin doble descuento y finalizacion tras respuesta Auth perdida. El export de las pruebas es ficticio; la restauracion gestionada real sigue siendo una prueba separada. Ninguna cuenta productiva se utilizo para estas pruebas.
