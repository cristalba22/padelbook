# Arquitectura y estado del producto

## Alcance de las páginas

| Experiencia | Rutas | Estado |
| --- | --- | --- |
| Sitio del club | `/`, `/booking`, `/torneos`, `/comunidad` | Demo navegable |
| Jugador | `/mis-turnos`, `/cuenta`, `/player` | Demo navegable |
| Profesor | `/profe` | Demo navegable |
| Club | `/admin`, `/admin/calendar`, `/admin/bookings`, `/admin/finance`, `/admin/teachers`, `/admin/tournaments`, `/admin/config` | Demo navegable |

Las rutas antiguas `/reservar` y `/panel-profe` redirigen a sus equivalentes actuales. Ninguna de las páginas anteriores debe eliminarse al evolucionar el producto.

## Flujo de datos actual

El frontend React/Vite usa los proveedores de `src/main.jsx` para sesión, reservas, precios, ajustes y bloqueos. Si `/api/health` responde correctamente, autenticación y reservas usan Express/MongoDB. La disponibilidad pública consulta `/api/availability`; la API calcula el precio y valida el turno. Las reservas activas ocupan franjas únicas de 30 minutos en MongoDB para rechazar reservas simultáneas del mismo horario. Los identificadores heredados de cancha se normalizan al iniciar la API.

Si la API no está disponible, el frontend usa cuentas y datos de demostración guardados en `localStorage`. El despliegue actual de Vercel publica el frontend; **la demo en Vercel no es una operación multiusuario real**. El modo demo se indica en la interfaz.

## Límites antes de venderlo a clubes

1. **Tenencia por club:** usuarios, canchas, reservas, torneos, ajustes y finanzas aún carecen de `clubId`. La API actual representa un solo club.
2. **Bloqueos compartidos:** la agenda de bloqueos de cancha/profesor todavía se guarda en el navegador. Debe persistirse en servidor y validarse al crear reservas.
3. **Pagos:** se registra el estado del pago; no hay cobro ni conciliación automática. Los textos de la interfaz hablan de coordinación, no de dinero cobrado.
4. **Alta segura de clubes:** una base nueva exige `ADMIN_EMAIL` y `ADMIN_PASSWORD`; los perfiles de prueba solo se insertan con `PADELBOOK_DEMO_SEED=true`. Aún falta un flujo de alta autoservicio.
5. **Operación:** faltan deploy y observabilidad del backend, backups, migraciones controladas y pruebas de integración con MongoDB.
6. **Datos comerciales:** tienda, algunos textos y contenido inicial son de muestra. El panel de configuración debe gobernar el catálogo y los datos públicos del club.

La prioridad para pilotos en clubes chicos es cerrar los puntos 1, 2 y 4, conectar el backend real y probar el circuito de reserva, bloqueo, cancelación y cobro con usuarios en distintos dispositivos. Torneos, comunidad, jugador y profesor siguen siendo partes del producto, con despliegue gradual según uso del club.
