# Corrección funcional

## Cambios principales

- Se incorporó un `ScheduleProvider` global para que los bloqueos del admin y del profesor impacten en toda la aplicación sin depender de recargar la página.
- La pantalla de reservas consulta el mismo estado global de agenda que usa el panel admin.
- Los bloqueos de clases 09–12 ahora dejan de aparecer como turnos disponibles para el usuario.
- El panel del profesor ahora es funcional: lee reservas reales de clases, muestra disponibilidad y permite bloquear/liberar clases.
- Se agregó pantalla de cuenta/perfil para jugador, con registro, login y edición básica de datos.
- El login dejó de depender únicamente de detectar palabras en el email. Ahora existen usuarios guardados en localStorage.

## Flujos validados

1. Admin bloquea horario en Calendario.
2. Usuario entra a Reservar.
3. El horario aparece bloqueado y no puede reservarse.
4. Usuario reserva un turno libre.
5. Ese turno queda protegido para otros usuarios.
6. Profesor ve las clases reservadas del día.
7. Profesor puede bloquear su disponibilidad de clases.
8. El usuario puede crear cuenta y gestionar su perfil.
