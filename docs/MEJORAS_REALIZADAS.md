# Mejoras realizadas

## Navegación
- Se centralizaron rutas para evitar errores entre `/booking`, `/reservar`, `/profe` y `/panel-profe`.
- Se agregaron redirecciones de compatibilidad para rutas antiguas.
- El login redirige según rol: admin, profesor o jugador.

## Reservas
- La pantalla de reservas ahora guarda en el contexto global `useBooking`.
- Las reservas persisten en `localStorage`.
- Se guarda usuario, fecha, hora, cancha, precio, método de pago y estado.
- Se permite cancelar y marcar como pagado desde el dashboard.

## Precios
- Se eliminó la lógica duplicada de precios.
- Los precios se administran desde un único helper y se sincronizan con `PricingContext`.
- Se mantiene migración desde claves antiguas de `localStorage`.

## Dashboard jugador
- Se mejoró la funcionalidad sin cambiar la identidad visual.
- Ahora muestra métricas, próximos turnos, pagos pendientes, acciones rápidas y siguiente reserva.

## Configuración
- Se agregó `.env.example` con variables públicas de Vite.
- Se documentó la arquitectura y el criterio de organización del proyecto.
