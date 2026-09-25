# Retiro completo de Strong

La instrucción posterior del usuario reemplaza la conservación de recursos internos descrita en el informe de estudio anterior.

Se retiraron los diccionarios hebreo/griego, el mapa parcial RV1909 (4.199.563 bytes de datos por distribución), recursos de investigación de resources/strong, estado y métodos de diccionario, búsqueda, rutas, eventos de pulsación prolongada, panel HTML y estilos exclusivos. El texto con notas al pie ahora usa directamente escapeBibleHtml, conservando inserciones y notas finales. Se conservaron las etiquetas HTML <strong>, que representan negritas y no pertenecen a la concordancia.

PWA 253: su activación elimina las cachés antiguas de Su Voz mediante el mecanismo existente. Recursos copiados a www, Android e iOS. También se retiraron los archivos individuales de Strong de los intermediarios de compilaciones anteriores. Los paquetes APK/AAB históricos no se modificaron; aún no se ha compilado ni publicado un nuevo paquete.

Validación: 10 suites existentes aprobadas; nueva test:bible-without-strong verifica ausencia en las cuatro distribuciones y preservación del texto, escape HTML y notas al pie. Sintaxis y git diff --check correctos. No se hizo commit ni push en esta tarea.
