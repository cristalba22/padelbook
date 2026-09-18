# Plan de mejora: del demo al primer club piloto

## 1. Base operativa compartida — implementada en esta rama

- Perfil persistido en API con validación; los cambios no se anuncian como guardados si el servidor falla.
- Torneos, inscripciones y profesores conectados a la API. El listado público de torneos excluye contactos de inscriptos.
- Reservas y bloqueos coordinados por franjas únicas de 30 minutos mediante transacciones MongoDB. Cancelar libera las franjas; reactivar exige que sigan libres.
- Caja de torneos integrada al resumen financiero cuando el club marca un cobro. Los pagos siguen siendo **manuales**.
- Cobros y reversiones de reservas protegidos con una clave de idempotencia por operación. Si una respuesta se pierde, reintentar la misma acción no agrega otro movimiento.
- Fechas de caja calculadas en horario de Argentina. La vista móvil de reservas reduce horas pasadas y ofrece acceso directo al resumen.
- Dependencias actualizadas y pruebas unitarias y de integración añadidas.

**Verificación:** `npm test`, `npm run build`, `npm audit --audit-level=high`. La integración usa un replica set temporal de MongoDB y comprueba permisos, perfil, reserva, bloqueo, carrera entre ambos, torneos, privacidad y caja.
GitHub Actions ejecuta esas comprobaciones en cada PR y cambio de `main`.

## 2. Puesta en marcha de un club piloto — requiere infraestructura y datos del club

1. Crear una base MongoDB Atlas exclusiva para el piloto, con backups y credenciales de mínimo privilegio.
2. Desplegar la API Express en un servicio persistente con HTTPS. Configurar `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `PADELBOOK_DEMO_SEED=false` y las credenciales iniciales del administrador.
3. Configurar `VITE_API_URL` en Vercel hacia la API, reconstruir el frontend y verificar que `/api/health` responda 200. Una instalación configurada con API no debe caer a modo demo ante una falla del servidor.
4. Cargar nombre, dirección y WhatsApp reales del club, sus precios y profesores. La agenda de reservas todavía tiene tres canchas y horario 09:00–22:00 definidos en código; validar que el piloto opere exactamente con esa configuración.
5. Hacer una prueba de aceptación con dos dispositivos y cuentas distintas: reserva de 1, 1:30, 2 y 2:30 horas; bloqueo simultáneo; cancelación; reactivación; seña y saldo; inscripción y cobro de torneo; cierre de caja.
   Para cobros y reversiones, repetir la misma solicitud con la misma clave de idempotencia y comprobar que aparece un único movimiento.
6. Definir política escrita de señas, cancelaciones y reembolsos; preparar procedimiento de soporte, restauración de backup y monitoreo de errores.

**Criterio de salida:** ninguna operación del piloto depende de `localStorage`, las dos cuentas ven la misma agenda y caja, y el club puede resolver un conflicto o caída de la API sin perder datos.

## 3. Producto para muchos clubes — siguiente versión

- Modelar `clubId` en todas las entidades, permisos por club, invitación de staff y alta de clubes; probar aislamiento entre clubes.
- Mover canchas, horarios, feriados, precios por cancha y disponibilidad de profesores a configuración persistida.
- Incorporar pasarela de pagos con webhooks e idempotencia, comprobantes, conciliación y reembolsos. Hasta entonces, presentar los cobros como registros manuales.
- Convertir el catálogo en un módulo administrable o mantenerlo como consulta sin precios ni stock prometidos.
- Añadir observabilidad, migraciones versionadas, pruebas completas por rol y revisiones periódicas de accesibilidad y rendimiento móvil.

La URL pública actual continúa siendo la demo. No se debe presentarla como instalación productiva del piloto hasta completar la etapa 2.
