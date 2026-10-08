# Cambio controlado a multiclub

Este procedimiento es para el primer cambio de la base del piloto. La rama multiclub permanece en borrador hasta completar un ensayo en un entorno de staging con una API y una base distintas de producción. El respaldo cifrado y las credenciales no se incorporan al repositorio.

## Condiciones previas

1. Elegir una ventana de mantenimiento anunciada al club y una persona responsable de decidir continuar o volver atrás.
2. Registrar el commit de la API y del Worker actuales, sus variables de entorno, la base y el dominio publicados. Tener disponible un despliegue de staging del commit multiclub y una base vacía de staging.
3. Confirmar que el correo de invitaciones sale de un remitente verificado y que el propietario puede ingresar. Crear el segundo club de ensayo con `club:provision` solo en staging.
4. Ejecutar `npm test`, `npm run build`, la auditoría de dependencias y el workflow manual de respaldo sobre el commit que se quiere publicar. Verificar el informe de restauración, API, navegador y retorno de modo.
5. Definir cuánto tiempo puede durar la pausa, cómo avisar a los usuarios y cómo registrar cualquier reserva recibida por teléfono durante ella.

## Ensayo de staging

1. Activar `PADELBOOK_MAINTENANCE_MODE=true` en la API de staging. Confirmar `GET /api/health` con `writable:false`, lecturas disponibles y escrituras rechazadas con 503 y `Retry-After`.
2. Restaurar el respaldo cifrado en una base nueva. Migrar documentos e índices y comparar cantidades, campos originales, pagos e índices. No migrar la base de producción en el lugar.
3. Iniciar la API multiclub de staging contra la copia migrada. Probar ingreso, canchas, agenda, reserva, conflicto simultáneo, recepción, caja e invitaciones de dos organizaciones. Confirmar que un administrador no accede al otro club.
4. Repetir el recorrido en móvil y con conexión lenta. Registrar tiempos de arranque de la API y de la primera agenda, incluido el arranque en frío de Render si se conserva el plan actual.
5. Probar el retorno de staging a la versión anterior apuntando a otra copia restaurada del respaldo. Confirmar salud, canchas y reservas originales. La prueba automatizada de modo anterior → multiclub → anterior es una comprobación adicional de arranque, no reemplaza este ensayo con dos despliegues reales.

## Ventana de producción

1. Activar mantenimiento en la API anterior. Verificar que no acepta nuevas reservas, bloqueos, cobros ni cambios de cuenta. Esperar a que terminen las solicitudes que ya estaban en curso.
2. Crear y verificar un respaldo cifrado final. Registrar hora, versión, conteos e identificador del artefacto. Conservar la API y la base anteriores sin escrituras.
3. Restaurar ese respaldo en una base **nueva**, migrar allí y ejecutar las comprobaciones. Si cualquier verificación falla, volver a abrir la API anterior y cancelar el cambio.
4. Publicar API y Worker multiclub apuntando a la base nueva, todavía con mantenimiento activado. Comprobar salud, rutas, autenticación, aislamiento y lectura de la agenda. El Worker y la API deben cambiar juntos para evitar contratos incompatibles.
5. Abrir escrituras solo cuando el responsable acepte el resultado. Registrar la hora de apertura y vigilar errores 5xx, reservas rechazadas, latencia y correos durante las primeras horas.

## Decisión de reversión

Antes de abrir escrituras en multiclub, la reversión consiste en volver a las versiones anteriores de API y Worker y a la base original, que se mantuvo sin cambios. Comprobar salud y lectura de la reserva anterior antes de abrirla de nuevo.

Después de abrir escrituras, la base nueva puede contener reservas y pagos que la base anterior desconoce. **No volver a la base anterior sin conciliar esas operaciones.** Primero pausar escrituras, exportar y verificar los cambios posteriores al punto de cambio y decidir con el club cómo aplicarlos o comunicarlos. Si esa conciliación no está preparada, mantener el sistema multiclub en mantenimiento y resolver el incidente antes de reabrir cualquier versión.

El piloto publicado sigue usando el modo de un solo club. Este documento prepara una operación futura; no autoriza por sí solo el cambio de producción.
