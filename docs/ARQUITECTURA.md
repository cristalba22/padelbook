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

El frontend React/Vite usa los proveedores de `src/main.jsx` para sesión, reservas, precios, ajustes, torneos, profesores y bloqueos. Con `VITE_API_URL` configurada, el sistema exige la API Express/MongoDB y nunca guarda operaciones fallidas como cambios locales. La disponibilidad pública consulta `/api/availability`; la API calcula el precio y valida el turno. Reservas y bloqueos toman franjas únicas de 30 minutos en la colección `SlotClaim`, dentro de transacciones MongoDB. Los identificadores heredados de cancha se normalizan al iniciar la API.

Sin `VITE_API_URL` ni API accesible, el frontend usa cuentas y datos de demostración guardados en `localStorage`. Los despliegues actuales de Vercel y Cloudflare publican el frontend; **ninguna de esas demos es una operación multiusuario real**. El modo demo se indica en la interfaz. MongoDB debe ser un replica set para soportar transacciones; MongoDB Atlas cumple este requisito. `MONGODB_DB_NAME` permite aislar la base del primer club.

## Límites antes de venderlo a clubes

1. **Tenencia por club:** usuarios, canchas, reservas, torneos, ajustes y finanzas aún carecen de `clubId`. La API actual representa un solo club.
2. **Pagos:** reservas y torneos tienen registro manual de cobros, pero no hay cobro ni conciliación automática. Los cobros y reversiones de reservas exigen una clave UUID de idempotencia por operación para evitar duplicados por reintento. Los textos de la interfaz hablan de coordinación, no de dinero cobrado.
4. **Alta segura de clubes:** una base nueva exige `ADMIN_EMAIL` y `ADMIN_PASSWORD`; los perfiles de prueba solo se insertan con `PADELBOOK_DEMO_SEED=true`. Aún falta un flujo de alta autoservicio.
5. **Operación:** faltan deploy y observabilidad del backend, backups y migraciones versionadas. La suite ya incluye integración con MongoDB temporal, pero falta prueba del despliegue real.
6. **Datos comerciales:** tienda, algunos textos y contenido inicial son de muestra. El panel de configuración debe gobernar el catálogo y los datos públicos del club.

La prioridad para un piloto de un solo club es conectar el backend real y probar el circuito de reserva, bloqueo, cancelación y cobro con usuarios en distintos dispositivos. Antes de vender una única instancia a varios clubes hay que incorporar `clubId`, permisos por club y aislamiento de datos. Torneos, comunidad, jugador y profesor siguen siendo partes del producto.
