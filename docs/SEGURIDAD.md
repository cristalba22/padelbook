# Seguridad de PadelBook

## Alcance

Este documento describe los controles incluidos en el código y los controles que deben activarse en la infraestructura. Ninguna aplicación conectada a Internet es invulnerable. El objetivo es reducir superficie de ataque, limitar el impacto de una cuenta comprometida y poder detectar e investigar incidentes.

## Controles implementados

### Sesiones y acceso

- Sesión firmada con JWT, emisor y audiencia verificados, duración predeterminada de 8 horas y máximo de 12 horas.
- Cookie `HttpOnly`, `Secure` en producción, `SameSite=Strict` y limitada a `/api`.
- El token de sesión no se guarda en `localStorage` ni se entrega al JavaScript en producción.
- Token CSRF independiente y comparación en tiempo constante para cada operación que modifica datos.
- Revocación inmediata de todas las sesiones de un empleado al cambiar su contraseña, activarlo o desactivarlo.
- Cerrar sesión invalida en la API las sesiones anteriores de esa cuenta, incluso si alguien conservó una copia de la cookie. También cierra las sesiones de otros dispositivos de esa cuenta.
- Roles verificados en la API para dueño, recepción, profesor y jugador.
- Contraseñas de 12 a 72 caracteres y bcrypt con costo 12. Los hashes antiguos se actualizan al iniciar sesión.

### API y datos

- Validación de entradas con Zod, límites de cantidad y tamaño máximo de JSON de 32 KB.
- Rate limit global, límites más estrictos para login y registro y mensajes que no revelan si existe una cuenta.
- La API productiva solo acepta tráfico que atraviesa el proxy de Cloudflare y presenta el secreto interno correcto.
- CORS restringido al origen HTTPS exacto del frontend.
- Precios calculados en el servidor; el cliente no decide importes.
- Índices únicos, transacciones y reclamos por franja para evitar dobles reservas concurrentes.
- Respuestas de error productivas sin stack trace ni detalles internos.
- Identificador por solicitud y auditoría con usuario, rol e IP seudonimizada. Se conservan los últimos 5.000 eventos.
- La aplicación exige MongoDB Atlas por TLS en producción.

### Navegador y entrega

- Content Security Policy que bloquea scripts ajenos, ejecución inline de scripts, objetos y framing.
- HSTS, protección contra MIME sniffing y clickjacking, política de permisos y aislamiento de origen.
- HTML y respuestas de API marcados `no-store`.
- Los builds productivos del dominio del club fallan de forma segura si la API no responde. El modo local requiere `VITE_DEMO_MODE=true`; los subdominios de preview `*.vercel.app` se consideran demos sin datos reales.
- Dependabot para npm, GitHub Actions y Docker.
- CI ejecuta pruebas, build, auditoría de dependencias, validación de Wrangler y revisión de dependencias de cada PR.
- CodeQL analiza JavaScript y TypeScript en pushes, PR y semanalmente.
- Un workflow periódico comprueba la web pública, la API y la conexión a MongoDB. Su ejecución fallida queda registrada en GitHub Actions; las notificaciones de fallas dependen de la configuración de la cuenta de GitHub.

## Controles obligatorios antes del piloto

1. Generar secretos independientes con un generador criptográfico. Nunca reutilizar claves ni enviarlas por WhatsApp.
2. Guardar `API_PROXY_SECRET` como secreto de Cloudflare y como variable privada del backend. Guardar `JWT_SECRET` solo en el backend.
3. Usar `PADELBOOK_DEMO_SEED=false`; crear cuentas reales y cambiar cualquier contraseña temporal antes de entregar acceso.
4. En Atlas, crear un usuario exclusivo para esta base con permisos mínimos, restringir red y activar backups.
5. Activar protección de Cloudflare para bots, rate limiting y alertas de picos de 401, 403, 429 y 5xx.
6. Configurar logs y alertas del backend sin cuerpos de solicitudes, cookies, contraseñas ni secretos.
7. Probar la restauración de Atlas y la revocación de un recepcionista.
8. Proteger la cuenta de GitHub, Cloudflare, Atlas y el proveedor de API con MFA.

## Riesgos que todavía requieren trabajo

- La aplicación todavía no ofrece MFA propio para dueños y recepción.
- El registro de jugadores todavía no verifica el email. La recuperación de contraseña usa un token aleatorio almacenado únicamente como hash, vence a los 20 minutos, funciona una sola vez y revoca las sesiones anteriores. La entrega requiere configurar Resend y un remitente verificado.
- La auditoría vive en la misma base y conserva una cantidad limitada; para evidencia duradera debe exportarse a un sistema de logs con retención e integridad controladas.
- Un despliegue compartido por varios clubes requiere `clubId` obligatorio en cada documento, índice y consulta. La versión actual debe operar con una base y API separadas por club.
- Los pagos siguen siendo registros manuales. Una pasarela real requiere webhooks firmados, idempotencia y conciliación.
- Un pentest independiente sigue siendo necesario antes de almacenar pagos reales o desplegar varios clubes en una misma plataforma.
- El chequeo periódico puede retrasarse por la cola de GitHub Actions y no reemplaza alertas de baja latencia ni monitoreo de errores por solicitud.

## Respuesta a incidentes

1. Suspender la cuenta afectada desde el panel; esto revoca su sesión.
2. Rotar `JWT_SECRET` para invalidar todas las sesiones si hay sospecha de robo general de sesiones.
3. Rotar `API_PROXY_SECRET` primero en backend y Cloudflare dentro de una ventana coordinada.
4. Preservar logs y eventos de actividad, registrar la hora y el identificador de las solicitudes afectadas.
5. Cambiar credenciales de Atlas si pudieron quedar expuestas y revisar accesos e índices.
6. Restaurar desde un backup validado si hubo alteración de datos y comunicar el incidente a las personas afectadas según corresponda.
