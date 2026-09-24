# Despliegue del primer club

Esta guía describe la instalación actual: frontend y proxy `/api` en Cloudflare Workers, API Express en Render y MongoDB Atlas. Se usa una **API y una base para un solo club**. La URL histórica de Vercel es una demo separada y no debe recibir reservas reales.

## Preparación

1. Definir quién administra Cloudflare, Render, Atlas, GitHub y el remitente de Resend. Activar MFA en esas cuentas.
2. Crear una base exclusiva en Atlas con usuario de aplicación de mínimo privilegio, acceso de red limitado y backups activos. Las transacciones de reservas requieren un replica set.
3. Configurar Render con `NODE_ENV=production`, `MONGODB_URI`, `MONGODB_DB_NAME`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PUBLIC_APP_ORIGIN`, `API_PROXY_SECRET` y `PADELBOOK_DEMO_SEED=false`. El arranque es `npm run start:api`. Para una base vacía, configurar además `ADMIN_NAME`, `ADMIN_EMAIL` y `ADMIN_PASSWORD` iniciales; cambiar luego esa contraseña.
4. Configurar `RESEND_API_KEY` y `PASSWORD_RESET_FROM` con un remitente verificado si se usarán recuperación de contraseña y correos de reserva. Sin ambos, no prometer entrega por email.
5. Configurar en Cloudflare `API_ORIGIN` con el origen HTTPS de Render y `API_PROXY_SECRET` como secreto. El valor debe coincidir con Render. El navegador consume `/api` desde el mismo origen del frontend; la URL interna de Render no se incorpora al JavaScript.
6. Construir y publicar con `npm run deploy:cloudflare`. Verificar `https://padelbook.crisalbavideografo.workers.dev/api/health` y que indique conexión a la base. Confirmar que la API directa no acepte operaciones sin el secreto de proxy.

Los secretos nunca van en variables `VITE_`, capturas, mensajes ni commits. Usar `.env.example` solo como lista de variables, sin copiar sus valores de ejemplo al despliegue.

## Configuración del club

Entrar con el administrador, cargar identidad y contactos reales del club en **Ajustes**, configurar cada cancha y sus horarios, intervalos, duraciones y precios. Crear accesos personales de recepción desde **Equipo**; probar que recepción puede operar agenda y cobros sin acceder a finanzas generales ni a la configuración.

## Aceptación

Seguir los casos de [Plan del piloto](PLAN_PILOTO.md) con dos jugadores y recepción en dispositivos distintos. Probar email de reserva y recuperación, backup real y restauración en una base aislada. Conservar el resultado en un registro privado del piloto.

## Operación y vuelta atrás

- Revisar diariamente reservas pendientes, cobros registrados, fallas de email, healthcheck y el resultado del workflow de backup.
- Si la API cae, suspender nuevas reservas hasta recuperar la conexión; la interfaz no debe confirmar cambios locales.
- Ante un despliegue fallido, volver a una versión anterior de frontend o API y verificar `/api/health` antes de reabrir. Restaurar datos únicamente desde un backup verificado y reconciliar los turnos y cobros posteriores al respaldo.
- Los pagos continúan siendo **registros manuales**. Elegir «seña» o «pago total» no ejecuta un cargo online.
