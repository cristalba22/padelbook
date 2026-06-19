# Arquitectura del frontend

## Objetivo
PadelBook es un frontend React/Vite para reservas de canchas de pádel, clases, torneos, comunidad y paneles de administración/profesor.

## Estructura principal

- `src/constants`: rutas y constantes compartidas.
- `src/data`: datos frontend del producto, canchas, horarios y opciones de pago.
- `src/hooks`: estado global de autenticación y reservas.
- `src/context`: configuración compartida, como precios del club.
- `src/utils`: helpers reutilizables para storage y pricing.
- `src/components`: componentes visuales reutilizables.
- `src/pages`: pantallas completas por ruta.

## Estado actual
El proyecto funciona como frontend frontend con persistencia en `localStorage`. Está preparado para conectar API real y Mercado Pago sin rearmar la interfaz.

## Decisiones aplicadas

- Rutas centralizadas en `src/constants/routes.js`.
- Persistencia segura en `src/utils/storage.js`.
- Precios unificados en `src/utils/pricing.js` y `PricingContext`.
- Reservas centralizadas en `useBooking`.
- Login frontend persistente en `useAuth`.
- Compatibilidad con rutas viejas: `/reservar` y `/panel-profe` redirigen a las rutas actuales.
