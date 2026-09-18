# Cloudflare + MonsterAPI + MongoDB Atlas

## Estado real

- Frontend demo publicado en `https://padelbook-clubes-demo.crisalbavideografo.workers.dev` como Worker con archivos estáticos y fallback para rutas de React. `wrangler.jsonc` y `npm run deploy:cloudflare` reproducen el despliegue.
- API Express preparada como imagen Docker en `Dockerfile.api`. GitHub Actions construye la imagen en cada PR; todavía no hay una instancia pública de API.
- La base MongoDB Atlas y la cuenta de MonsterAPI están pendientes. Ninguna reserva de la URL demo se comparte entre navegadores.

## Arquitectura del primer club

```text
Navegador ──HTTPS──> Cloudflare (frontend React)
    │
    └──────HTTPS──> MonsterAPI (contenedor Node/Express)
                         │
                         └──TLS──> MongoDB Atlas (base exclusiva del club)
```

MongoDB Atlas es adecuada para el modelo actual: `SlotClaim` usa índices únicos y transacciones para impedir turnos superpuestos. El cluster debe admitir transacciones. Esta arquitectura aísla **un club por base y despliegue**. Antes de compartir una sola API entre clubes, hay que implementar `clubId` en todas las colecciones, consultas, índices y permisos; el código actual no ofrece ese aislamiento.

## Preparar las cuentas

1. Crear un proyecto y un cluster de MongoDB Atlas. Crear una base exclusiva para el club, por ejemplo `padelbook_club_piloto`, un usuario de aplicación con privilegios mínimos y una política de backups. No usar datos demo.
2. Crear una cuenta de MonsterAPI y comprobar en su panel que sigue disponible el despliegue de **custom Docker image**, el tipo de instancia, el costo y las opciones de secretos. Su documentación publicada muestra instancias GPU para ese servicio; confirmar el costo antes de mantener un contenedor de reservas encendido.
3. Publicar la imagen `Dockerfile.api` en un registro de contenedores al que MonsterAPI pueda acceder. GitHub Actions solo la construye y valida; no la publica ni guarda credenciales del registro.
4. En el despliegue del contenedor, exponer el puerto `4000` y configurar variables privadas:

   | Variable | Contenido |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `PORT` | `4000` |
   | `MONGODB_URI` | Cadena privada de Atlas con TLS |
   | `MONGODB_DB_NAME` | Nombre exclusivo de la base, solo letras, números, `_` y `-` |
   | `JWT_SECRET` | Valor aleatorio privado de 32 caracteres o más |
   | `CLIENT_ORIGIN` | Origen HTTPS exacto del frontend Cloudflare, sin barra final |
   | `PADELBOOK_DEMO_SEED` | `false` |
   | `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Dueño inicial, clave de 12 caracteres o más |

   No incorporar estos valores en `VITE_`, GitHub, el registro Docker ni documentación pública. La API debe responder `200` en `/api/health` con `database: "connected"`. La imagen incluye un `HEALTHCHECK` sobre ese endpoint.

5. Con la URL HTTPS definitiva de la API, configurar `VITE_API_URL=https://<api>/api` **durante el build** del frontend y ejecutar `npm run deploy:cloudflare`. Si la API configurada falla, el frontend no debe guardar reservas como demo local.
6. Probar desde dos dispositivos: login del dueño, acceso de recepción, reserva concurrente, bloqueo, cuatro duraciones, cancelación, cobro manual y caja. Seguir `docs/DESPLIEGUE_PILOTO.md` antes de invitar jugadores.

## Advertencias de producto

- MonsterAPI permite imágenes Docker propias según su documentación, pero está orientada a cargas de IA; no asumir que será el alojamiento más económico para una API Node ligera. La decisión final requiere el costo y el SLA de la cuenta real.
- Cloudflare aloja actualmente **solo el frontend**. El Worker estático no ejecuta Express ni se conecta a Atlas.
- Las opciones “seña” y “pago total” siguen siendo coordinación y registro manual. Falta pasarela de pagos con webhook y conciliación. Falta correo transaccional.
- No publicar como SaaS para múltiples clubes hasta completar aislamiento por club, monitoreo, backups restaurados en prueba y soporte operativo.
