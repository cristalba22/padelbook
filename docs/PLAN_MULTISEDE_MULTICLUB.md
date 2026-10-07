# Evolución de PadelBook: varias sedes y varios clubes

Estado: etapa 1 en desarrollo en `codex/multisite-foundation`. No modifica la instalación piloto ni habilita todavía el uso compartido de la base.

## Decisión de producto

Primero resolver **un propietario con varias sedes**. Después habilitar **varias organizaciones independientes** en la misma plataforma. Una organización administra una o más sedes; cada sede tiene dirección, canchas, horarios y personal operativo propios. El propietario puede consultar el conjunto y filtrar por sede. El jugador reserva en una sede identificada sin ambigüedad.

Se conserva React/Vite en Cloudflare, el Worker como proxy de `/api`, Express en Render y MongoDB Atlas. Cambiar de base de datos no es un requisito de esta evolución. La instalación piloto de un solo club sigue funcionando mientras se prepara y prueba la migración en un entorno separado.

## Punto de partida verificado

- `server/db.mjs`: los modelos `User`, `Court`, `Booking`, `Tournament`, `Setting`, `Activity`, `Expense`, `ScheduleBlock`, `Teacher`, `SlotClaim` y `PasswordReset` no tienen pertenencia a organización ni sede. `Court.courtId` es único global; `SlotClaim` impide doble ocupación por fecha, cancha y franja.
- `server/auth.mjs`: hay un rol global por usuario (`admin`, `receptionist`, `teacher`, `player`). La sesión comprueba identidad y CSRF, pero no autoriza acceso a una organización o sede.
- `server/index.mjs`: disponibilidad, reservas, bloqueos, cobros, torneos, profesores, ajustes, caja, personal y actividad consultan la base como si representara un solo club. También hay `Setting.findOne()` para el email de una reserva y un límite global de registros de actividad.
- `src/App.jsx` y `src/constants/routes.js`: existe un solo sitio público y un solo panel. No hay sede activa ni vista consolidada del propietario.
- `tests/api.integration.test.mjs`: prueba permisos y concurrencia dentro de una instancia; falta verificar aislamiento entre organizaciones y sedes.

## Modelo propuesto

| Entidad | Responsabilidad | Regla de pertenencia |
| --- | --- | --- |
| `Organization` | Propietario o club cliente; estado y configuración comercial | Identificador interno estable |
| `Venue` | Complejo físico, dirección, contacto, zona horaria y presencia pública | `organizationId` obligatorio |
| `Court` | Agenda, precios y duraciones de una cancha | `organizationId` y `venueId` obligatorios |
| `Membership` | Rol de un usuario dentro de una organización y, si corresponde, sede | `userId`, `organizationId`, `venueIds` permitidas; estado activo |
| `User` | Identidad, credenciales y recuperación de contraseña | Cuenta global; sin permisos de club implícitos |
| Datos operativos | Reservas, bloqueos, reclamos de franja, profesores, torneos, gastos, ajustes y actividad | `organizationId` obligatorio; `venueId` donde corresponda |

El rol de propietario/administrador permite ver todas las sedes de su organización. Recepción y profesores operan solo las sedes asignadas. Una cuenta de jugador puede reservar en diferentes organizaciones sin adquirir permisos administrativos. La autorización se resuelve en la API en cada solicitud; el selector visual no es un control de seguridad.

Para el primer alcance, las reservas, clases, canchas, bloqueos y gastos pertenecen a una sede. Los informes pueden sumar varias sedes de una organización, siempre desde consultas acotadas por `organizationId`. Torneos y profesores necesitan una decisión explícita por registro: sede concreta o alcance organizacional. Hasta que esa regla esté implementada y probada, permanecen ligados a una sede. Los ajustes se separan en organización y sede; no se reutiliza el documento global actual como configuración de todos los clubes.

## Cinco etapas y criterios de salida

### 0. Contrato y línea de base

1. Inventariar lecturas, escrituras, índices y rutas públicas/privadas de todos los módulos, incluidos correos, reportes, backups y auditoría.
2. Fijar identificadores, política de URL y reglas de rol. Propuesta inicial: sitio público por ruta `/club/:organizationSlug/:venueSlug` y API con contexto explícito de organización/sede. Los dominios propios quedan para una etapa posterior. Ningún `organizationId` enviado por el cliente concede acceso por sí solo.
3. Correr pruebas y compilación actuales; documentar sus resultados. Preparar base de prueba y backup verificado antes de tocar datos del piloto.

**Salida:** contrato de datos y rutas, inventario de consultas, pruebas de línea de base y procedimiento de restauración. No se despliega código multiclub.

### 1. Modelo y migración reversible del club actual

1. Agregar `Organization`, `Venue` y `Membership`; crear una organización y una sede para la instalación actual.
2. Migrar documentos existentes con un script versionado e idempotente: asignar organización y sede, comprobar conteos, referencias y muestras de reservas/cobros antes y después. No ejecutar una migración destructiva desde `connectDb()`.
3. Incorporar índices compuestos para pertenencia, búsquedas de agenda y unicidad de franjas. La unicidad de `SlotClaim` debe considerar al menos sede, cancha, fecha y franja. Crear y validar los nuevos índices antes de retirar los anteriores; no asumir que agregar un campo al esquema cambia índices ya existentes.
4. Mantener los identificadores actuales de canchas durante la transición. La reutilización de nombres o IDs por otra sede solo se habilita cuando consultas e índices ya estén acotados.

**Salida:** el club piloto queda representado como una organización con una sede; todos los documentos operativos tienen pertenencia válida; la migración se puede reejecutar sin duplicar datos.

### 2. Aislamiento obligatorio en la API

1. Resolver el contexto de organización/sede a partir de la ruta o dominio validado. Exigir membresía activa y sede autorizada en cada operación privada; las rutas públicas solo leen datos publicados de la sede solicitada.
2. Reemplazar consultas globales en disponibilidad, reservas, bloqueos, pagos, finanzas, profesores, torneos, ajustes, personal, actividad, emails y tareas de mantenimiento. Toda búsqueda por ID también comprueba pertenencia. Los errores no deben revelar si existe un recurso de otro club.
3. Mover el rol efectivo a `Membership`; no usar `User.role` como autorización multi-club. Las sesiones continúan identificando al usuario, pero el permiso se consulta del servidor para cada contexto. Los cambios de membresía revocan el acceso inmediatamente.
4. Asegurar que dos reservas en la **misma** sede y franja sigan en conflicto, y que sedes distintas puedan usar la misma fecha y hora. Mantener la transacción de reserva/bloqueo y la idempotencia de cobros.

**Salida:** pruebas de aislamiento entre dos organizaciones y dos sedes para lectura, escritura, acceso directo por ID, roles, reportes y concurrencia. No se habilita una segunda organización si falla un caso.

### 3. Experiencia multisedes para propietario, recepción y jugador

1. Mostrar sede activa, dirección y horarios en home, reserva, confirmaciones, mis turnos, torneos y comunicaciones. Un enlace compartido lleva a la sede correcta.
2. Dar al propietario un tablero consolidado y filtros por sede; agenda, reservas, caja, canchas, personal y ajustes deben dejar claro qué sede se está editando. Recepción ve solo sus sedes asignadas.
3. Cuidar navegación móvil, estados vacíos, permisos denegados y cambio de sede con operaciones en curso. Validar que cambiar de sede no conserve una selección de cancha u horario de la sede anterior.

**Salida:** prueba de punta a punta en móvil y PC con al menos dos sedes y diferentes configuraciones de canchas, precios y horarios. El piloto original sigue funcionando con una sola sede visible.

### 4. Segunda organización y operación SaaS

1. Incorporar alta controlada de otra organización y su administrador; probar aislamiento completo con datos realistas antes del autoservicio.
2. Agregar superadministración separada de la administración de clubes, con auditoría y soporte limitado. Definir aprovisionamiento, suspensión, exportación y baja de datos por organización.
3. Adaptar backups, restauración, métricas, alertas y soporte para identificar la organización afectada sin mezclar datos. Verificar una restauración de prueba.
4. Diseñar planes y cobro de la suscripción después de validar la operación con clubes reales. Dominios personalizados y marca blanca se incorporan solo si aportan valor comercial demostrado.

**Salida:** dos organizaciones pueden operar simultáneamente sin acceso cruzado, con procedimiento de soporte y recuperación probado. Solo entonces considerar apertura comercial a más clubes.

## Riesgos y control del cambio

- **Filtración entre clubes:** revisión de todas las consultas, pruebas negativas por endpoint y verificación de permisos en servidor. Un filtro añadido solo en React no cuenta.
- **Conflictos de agenda:** migrar `SlotClaim`, reservas y bloqueos como un conjunto; verificar índices reales en MongoDB, no solo la declaración de Mongoose.
- **Datos históricos:** hacer backup, migrar una copia, comparar conteos y totales de cobros, y documentar una vuelta a la versión previa. No borrar campos antiguos hasta cerrar la validación.
- **Corte del piloto:** desarrollo y QA en base/servicio separados; despliegue gradual primero con una organización y una sede. No activar autoservicio ni segunda organización durante la transición.
- **Trabajo transversal:** home, reservas, panel, profesor, torneos, comunidad, emails, reportes, scripts y documentación forman parte de la aceptación; no basta con cambiar el dashboard.

## Siguiente trabajo concreto

Empezar la etapa 1 en una rama `codex/` y un entorno de prueba: preparar el script de migración idempotente, los nuevos modelos y las verificaciones de conteos e índices. La instalación de producción se migra solo después de probar la restauración y pasar las pruebas de aislamiento de la etapa 2.

## Etapa 0: inventario inicial y línea de base

El 7 de octubre de 2026, antes de los cambios de código, `npm test` completó **20/20 pruebas** y `npm run build` terminó correctamente. Estas pruebas verifican el producto actual de un club; no prueban todavía aislamiento multiclub.

| Superficie actual | Contexto y autorización requeridos | Consulta o escritura que debe cambiar | Prueba mínima |
| --- | --- | --- | --- |
| `/api/auth/*`, `/api/admin/staff` | Identidad global; membresía activa para operar personal de la organización | Personal se lista hoy por `User.role`; alta y edición asignan un rol global | Un administrador de A no ve ni modifica personal de B; revocar membresía corta acceso |
| `/api/courts`, `/api/admin/courts`, `/api/availability` | Sede pública solicitada; dueño o recepción con permiso para administración | Canchas y reservas se consultan sin sede; `courtId` es único global | Dos sedes muestran canchas, horarios y precios propios; una cancha de B no aparece en A |
| `/api/blocks/*`, `/api/bookings/*` | Sede validada y permiso según jugador, recepción o dueño | Reservas, bloqueos y reclamos de franja se filtran hoy por fecha/cancha; mutaciones por ID no verifican club | ID de otra organización devuelve acceso denegado sin filtrar datos; carrera reserva/bloqueo conserva un único ganador |
| `/api/bookings/:id/payments*`, `/api/finance/summary`, `/api/expenses` | Membresía operativa y sede; consolidado solo para dueño de la misma organización | Caja suma reservas y torneos de toda la base; cobros y gastos se buscan por ID o sin filtro | No es posible cobrar, revertir ni incluir en informes movimientos ajenos; suma por sede coincide con consolidado |
| `/api/teachers`, `/api/admin/teachers` | Sede del profesor y membresía de gestión | Profesores se listan globalmente; clases y disponibilidad se cruzan por `teacherId` sin sede | Un profesor no aparece ni bloquea turnos de otra sede sin asignación explícita |
| `/api/tournaments*` | Sede del torneo; membresía para administración; jugador autenticado para inscripción | Listados e inscripciones se consultan por ID global | Torneos, inscriptos y cobros no cruzan clubes; inscripción por ID ajeno falla |
| `/api/settings`, emails de reserva | Organización y sede concreta | `Setting.findOne()` y `findOneAndUpdate({})` toman el primer documento global | Cambiar nombre/contacto de B no cambia A; email usa la identidad de la sede reservada |
| `/api/activity`, `addActivity`, arranque y scripts | Organización/sede en eventos; operación administrativa separada para migraciones | Actividad se lista y recorta globalmente; el arranque ejecuta migraciones y semillas globales | Un club no ve auditoría de otro; tareas de mantenimiento no mutan datos ajenos |

Decisiones iniciales para implementar sin ambigüedad: (a) URL pública canónica `/club/:organizationSlug/:venueSlug`, conservando las rutas actuales como entrada de la sede piloto durante la transición; (b) cada perfil de profesor queda asignado a una sede en esta primera versión; (c) cada torneo queda asignado a una sede. La posibilidad de compartir profesores o torneos entre sedes requiere reglas de agenda y cobro propias y se evaluará después de validar el flujo principal.

## Etapa 1: trabajo iniciado y uso seguro de la migración

`server/db.mjs` define los nuevos modelos y campos de pertenencia como opcionales durante la transición. `scripts/migrate-legacy-club-lib.mjs` hace un inventario previo, rechaza bases con otras organizaciones o sedes, asigna pertenencia a documentos heredados, crea membresías e índices, y verifica conteos. El script es idempotente para poder reanudarse si se interrumpe; volver al estado previo exige restaurar el backup. **La API actual todavía escribe y consulta sin contexto de organización/sede:** no ejecutar esta migración sobre la base en vivo hasta completar la etapa 2 y preparar una ventana de cambio.

En una copia aislada de la base, primero previsualizar sin escribir:

```powershell
npm run db:migrate:multisite -- --target-db padelbook_multisite_qa --organization-slug club-cordoba --organization-name "Club Córdoba" --venue-slug sede-centro --venue-name "Sede Centro"
```

Después de revisar el inventario y el backup, aplicar sobre esa misma copia:

```powershell
npm run db:migrate:multisite -- --target-db padelbook_multisite_qa --confirm-db padelbook_multisite_qa --apply --organization-slug club-cordoba --organization-name "Club Córdoba" --venue-slug sede-centro --venue-name "Sede Centro"
```

El comando exige una confirmación adicional para escribir en `MONGODB_DB_NAME`; este plan aún no autoriza ese paso. Los índices globales heredados de cancha y franja se conservan, por lo que todavía no se pueden operar dos sedes independientes con el mismo identificador de cancha. Cambiarlos corresponde a la etapa 2, junto con filtros y permisos completos.
