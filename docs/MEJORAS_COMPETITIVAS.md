# Mejoras funcionales aplicadas

## Torneos
- Inscripción real desde la página pública de torneos.
- Validación de sesión antes de inscribirse.
- Control de cupos para evitar sobreinscripción.
- Detección de inscripción duplicada por usuario/email.
- Estado de inscripción: pendiente, confirmado o cancelado.
- Soporte para compañero/a de pareja.
- Las inscripciones quedan visibles en el perfil del jugador.
- El admin puede confirmar, cancelar, marcar pago y contactar por WhatsApp.
- Los cupos del torneo se actualizan automáticamente según inscripciones activas.

## Administración
- Panel de torneos con pendientes destacados.
- Edición rápida de fecha, hora, cupos, precio, categoría y estado.
- Cálculo de caja por inscriptos activos.
- Eliminación de torneos.

## Perfil de usuario
- El perfil ahora muestra reservas y torneos asociados a la cuenta.
- Las inscripciones reflejan el estado asignado por administración.

## Estabilidad
- Se mantuvo el diseño existente.
- Build de producción verificado con npm run build.
