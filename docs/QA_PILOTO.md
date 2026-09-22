# QA operativo para el primer club

## Pruebas automatizadas

- Dos jugadores intentan reservar exactamente la misma cancha y horario: una operación gana y la otra recibe conflicto `409`.
- Recepción bloquea una cancha mientras un jugador reserva un turno superpuesto: solo una operación se confirma.
- Horarios, duraciones y tarifas configurados por cancha se validan también en la API.
- Alta, confirmación y cancelación disparan el correo operativo correspondiente.
- Backup cifrado, lectura, restauración a una base limpia y recreación de índices.

## Prueba móvil

Antes del piloto se revisan Home, Reservar, Mis turnos, acceso y panel de recepción en 360×800 y 390×844. Criterios: sin scroll horizontal, controles táctiles utilizables, textos sin superposición y reserva completa con teclado móvil.

## Red lenta

La prueba manual usa perfil móvil con latencia y ancho de banda limitados. La pantalla debe conservar el estado de carga, impedir dobles envíos y mostrar un error recuperable si vence la solicitud. Nunca se da por confirmada una reserva hasta recibir respuesta de la API.

## Evidencia del piloto

Registrar fecha, versión desplegada, dispositivo, navegador, resultado y captura o request ID del error. Los incidentes de doble reserva, cobros inconsistentes o pérdida de datos bloquean el piloto hasta corregirse.
