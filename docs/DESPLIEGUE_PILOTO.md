# Puesta en marcha del primer club

Esta guía prepara **una instalación para un solo club**. La URL pública actual sigue siendo una demo hasta conectar API y base de datos. Los cobros son registros manuales; elegir «seña» o «pago total» crea una reserva con saldo pendiente y no realiza un cargo online.

## Datos que necesitamos del club

- Nombre, dirección, WhatsApp, Instagram y persona responsable de la agenda.
- Confirmación de que tiene tres canchas y atiende reservas entre 09:00 y 22:00. Hoy esos límites están definidos en `src/data/bookingConfig.js`.
- Precios de día, noche, fin de semana, clases y torneos; profesores activos.
- Política escrita de señas, cancelación, devolución y cierre de caja.

## Infraestructura

1. Crear una base de datos exclusiva para el club en un MongoDB con soporte de transacciones. Configurar un usuario de aplicación con privilegios limitados y backups verificables.
2. Desplegar la API como servicio Node 24 persistente con HTTPS. El repositorio incluye `Dockerfile.api`; el comando de arranque es `npm run start:api` si el proveedor no usa contenedores.
3. Configurar variables privadas **solo en el servicio de API**:

   | Variable | Valor requerido |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | URI privada de la base del club |
   | `JWT_SECRET` | Clave aleatoria privada de al menos 32 caracteres |
   | `CLIENT_ORIGIN` | URL exacta HTTPS del frontend, sin barra final |
   | `PADELBOOK_DEMO_SEED` | `false` |
   | `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Administrador inicial; contraseña de al menos 12 caracteres |

   No poner `MONGODB_URI`, `JWT_SECRET` ni `ADMIN_PASSWORD` en variables `VITE_`, GitHub, capturas o mensajes. La API rechaza arranques de producción con semilla demo, origen HTTP o clave JWT débil. El administrador inicial se crea únicamente si la base no tiene usuarios.

4. Verificar `GET https://<api>/api/health`: debe responder `200` con `ok: true` y `database: "connected"`.
5. Configurar `VITE_API_URL=https://<api>/api` en **Production** de Vercel y generar un despliegue nuevo. Esta URL se incorpora durante el build. Con la API configurada, la app no opera como demo si la API falla.
6. Entrar con el administrador inicial, cambiar textos y precios en Configuración, crear profesores y revisar la web pública. No cargar datos de prueba en la base del piloto.
7. En **Equipo**, crear un acceso individual para cada recepcionista. El dueño puede desactivar la cuenta y renovar la contraseña. Recepción puede cargar turnos de mostrador o WhatsApp, operar la agenda y registrar cobros; no puede cambiar precios, ver finanzas generales ni administrar al equipo.

## Prueba de aceptación antes de invitar jugadores

Usar dos dispositivos o ventanas privadas con un administrador y dos jugadores distintos. Registrar el resultado y la fecha de cada caso.

- Reservar 1 h, 1:30 h, 2 h y 2:30 h. Comprobar que otro jugador ve el horario ocupado al actualizar o volver a enfocar la app.
- Intentar reservar el mismo horario desde dos cuentas: exactamente una solicitud debe tener éxito. Repetir con un bloqueo del administrador.
- Cancelar una reserva futura y reutilizar el horario. Rechazar reactivación si otro turno ya lo ocupó.
- Registrar una seña y el saldo restante; repetir la misma solicitud con igual clave de idempotencia y comprobar un solo cobro. Revertir el último cobro y revisar caja.
- Cortar la API mientras se usa el frontend: debe indicar indisponibilidad o fallar la operación sin crear una reserva local. Restaurar la API y reintentar.
- Verificar acceso por roles, inscripción a torneo y que jugadores no puedan abrir la caja ni ver reservas ajenas.
- Verificar que recepción cree una reserva a nombre de un jugador, registre un cobro y no acceda a Ajustes, Finanzas ni Equipo. Desactivar su cuenta y comprobar que la sesión abierta deja de funcionar.
- Restaurar un backup de prueba en una base separada y comprobar que agenda, usuarios y caja siguen legibles.

## Operación del piloto

- Designar quién recibe avisos de fallas y quién puede registrar/revertir pagos.
- Vigilar `/api/health`, errores del servicio y espacio/estado de la base de datos.
- Revisar diariamente reservas pendientes, pagos registrados y cierre de caja.
- Medir semanalmente reservas `online` y `reception`, cancelaciones y cobros pendientes. El porcentaje de autogestión es reservas online / total de reservas creadas. El sistema todavía no mide intentos de reserva abandonados ni envía confirmaciones por email; no usar esas métricas ni prometer esos avisos en el piloto.
- Conservar la URL demo separada del piloto hasta completar esta prueba. Para más clubes se necesita aislamiento por `clubId` antes de compartir una misma API o base de datos.

## Vuelta atrás

Si un despliegue de frontend falla, restaurar el despliegue anterior en Vercel. Si falla la API, detener nuevas reservas, volver a la imagen/versión anterior y comprobar `/api/health` antes de reabrir. Restaurar datos solo desde un backup verificado y luego reconciliar las reservas y cobros del intervalo afectado; nunca importar la demo local al piloto.
