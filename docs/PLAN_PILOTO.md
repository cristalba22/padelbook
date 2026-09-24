# Plan del primer club piloto

La instalación conectada de PadelBook está preparada para **un club**. El club de Córdoba comenzará una prueba piloto; la aceptación operativa debe completarse con su equipo y sus datos antes de invitar jugadores. La web pública es [padelbook.crisalbavideografo.workers.dev](https://padelbook.crisalbavideografo.workers.dev).

## Ya implementado

- Reserva de cancha con duraciones permitidas de 60, 90, 120 y 150 minutos, según la configuración de cada cancha. Disponibilidad y precio se validan en la API.
- Franjas únicas de 30 minutos reclamadas mediante transacciones MongoDB para evitar reservas y bloqueos simultáneos sobre el mismo horario.
- Panel para dueño y recepción. El dueño crea, edita y desactiva canchas y ajusta horarios, intervalos, duraciones y precios sin modificar código.
- Registro manual de señas, saldos y reversiones con clave de idempotencia por operación. **No se cobra online.**
- Sesión en cookie protegida, roles comprobados en la API, CSRF, validación de entradas y rate limits.
- Recuperación de contraseña y correos de reserva con Resend cuando el remitente está configurado. El envío de reservas es asíncrono sin cola de reintentos.
- Workflow de backup cifrado y prueba automatizada de restauración sobre MongoDB temporal. Chequeo periódico de disponibilidad.

## Antes de abrir la agenda del club

1. Confirmar nombre, dirección, contacto, reglas de cancelación y quién operará recepción. Configurar las canchas, sus horarios, duraciones y precios reales en **Ajustes**.
2. Crear accesos individuales para el dueño y recepcionistas. Desactivar cualquier cuenta de prueba y verificar permisos por rol.
3. Verificar en Atlas el usuario de base, restricciones de red y backups. Restaurar **un backup real del piloto** en una base separada y documentar fecha, duración, reservas y cobros recuperados.
4. Confirmar remitente de email y probar creación, modificación y cancelación de una reserva desde cuentas de prueba. Registrar si el correo llega o falla.
5. Definir por escrito cómo se reciben, registran y devuelven señas. La interfaz no debe presentarse como pasarela de pago.

## Prueba de aceptación con el club

| Caso | Resultado esperado |
| --- | --- |
| Dos jugadores solicitan el mismo horario | Solo una reserva se guarda. La otra recibe conflicto y puede elegir otro turno. |
| Recepción bloquea la cancha a la vez que reserva un jugador | Solo una operación ocupa esas franjas. |
| Turnos de 1, 1:30, 2 y 2:30 h | Se ofrecen solo las duraciones permitidas; el precio y el final respetan el horario de cierre. |
| Reserva, seña, saldo, cancelación y reversión | Agenda y caja muestran estados coherentes; reintentar el mismo cobro no lo duplica. |
| API caída o conexión móvil lenta | No se confirma localmente una operación que el servidor no guardó; se muestra el error y se puede reintentar. |
| Dueño, recepción, profesor y jugador | Cada perfil ve y modifica solo lo permitido. |
| Restauración | Los usuarios, turnos y movimientos del backup real quedan legibles en una base aislada. |

Registrar fecha, dispositivos, cuentas de prueba y resultado de cada caso en una copia privada de esta lista. No publicar nombres ni teléfonos de jugadores en el repositorio.

## Medición durante el piloto

- Reservas creadas por jugadores y por recepción; conflictos y cancelaciones.
- Tiempo que recepción tarda en confirmar una reserva y registrar el cobro.
- Errores de API, fallos de correo y momentos sin servicio.
- Problemas reportados por jugadores y encargados, con prioridad y resolución.

## Límites de esta versión

La API y la base representan un único club; para compartir infraestructura entre clubes falta aislamiento obligatorio por `clubId`. También faltan Mercado Pago con webhooks, alta autoservicio de clubes, recordatorios automáticos, una cola de emails con reintentos y migraciones versionadas. La prueba con el primer club servirá para priorizar estas mejoras con evidencia de uso.
