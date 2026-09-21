# Arquitectura y estado del producto

## Alcance de las páginas

| Experiencia | Rutas | Estado |
| --- | --- | --- |
| Sitio del club | `/`, `/booking`, `/torneos`, `/comunidad` | Producción piloto |
| Jugador | `/mis-turnos`, `/cuenta`, `/player` | Producción piloto |
| Profesor | `/profe` | Producción piloto |
| Club | `/admin`, `/admin/calendar`, `/admin/bookings`, `/admin/finance`, `/admin/teachers`, `/admin/tournaments`, `/admin/config`, `/admin/staff` | Producción piloto |

Las rutas antiguas `/reservar` y `/panel-profe` redirigen a sus equivalentes actuales. Ninguna de las páginas anteriores debe eliminarse al evolucionar el producto.

## Flujo de datos actual

El frontend React/Vite usa los proveedores de `src/main.jsx` para sesión, reservas, precios, ajustes, torneos, profesores y bloqueos. Con `VITE_API_URL` configurada, el sistema exige la API Express/MongoDB y nunca guarda operaciones fallidas como cambios locales. La disponibilidad pública consulta `/api/availability`; la API calcula el precio y valida el turno. Reservas y bloqueos toman franjas únicas de 30 minutos en la colección `SlotClaim`, dentro de transacciones MongoDB. Los identificadores heredados de cancha se normalizan al iniciar la API.

La instalación piloto de Cloudflare usa `/api` en el mismo origen y lo reenvía a la API de Render mediante un secreto privado. La API persiste en MongoDB Atlas y el modo demo está desactivado. El despliegue histórico de Vercel continúa siendo una demo y no debe usarse para operaciones reales. MongoDB debe ser un replica set para soportar transacciones; MongoDB Atlas cumple este requisito. `MONGODB_DB_NAME` aísla la base del primer club.

## Límites antes de venderlo a clubes

1. **Tenencia por club:** usuarios, canchas, reservas, torneos, ajustes y finanzas aún carecen de `clubId`. La API actual representa un solo club.
2. **Pagos:** reservas y torneos tienen registro manual de cobros, pero no hay cobro ni conciliación automática. Los cobros y reversiones de reservas exigen una clave UUID de idempotencia por operación para evitar duplicados por reintento. Los textos de la interfaz hablan de coordinación, no de dinero cobrado.
3. **Alta segura de clubes:** una base nueva exige `ADMIN_EMAIL` y `ADMIN_PASSWORD`; los perfiles de prueba solo se insertan con `PADELBOOK_DEMO_SEED=true`. Aún falta un flujo de alta autoservicio.
4. **Operación:** el backend está desplegado y se verificaron salud, configuración, profesores, torneos, disponibilidad y login del administrador. Faltan alertas, backups con restauración probada y migraciones versionadas.
5. **Datos comerciales:** tienda, algunos textos y contenido inicial son de muestra. El panel de configuración debe gobernar el catálogo y los datos públicos del club.

La prioridad inmediata es probar el circuito de reserva, bloqueo, cancelación y cobro con usuarios en distintos dispositivos y datos descartables del club piloto. Antes de vender una única instancia a varios clubes hay que incorporar `clubId`, permisos por club y aislamiento de datos. Torneos, comunidad, jugador y profesor siguen siendo partes del producto.
