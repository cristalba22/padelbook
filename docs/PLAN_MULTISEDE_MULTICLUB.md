# Evolución de PadelBook: varias sedes y varios clubes

Estado al 7 de octubre de 2026: la base, rutas y primeros recorridos multiclub están implementados en `codex/multisite-foundation`. La migración todavía no se aplicó al piloto y la plataforma compartida no está habilitada. La API anterior conserva consultas globales; una guarda de arranque impide usarla con varias organizaciones en la misma base.

## Decisión de producto

PadelBook será **multiclub desde su arquitectura de producto**: una plataforma para varios clubes independientes; cada club puede tener una o más sedes. Una sede tiene dirección, canchas, horarios, precios y personal operativo propios. El propietario ve el conjunto de su organización. El jugador reserva en una sede identificada sin ambigüedad.

El foco comercial inicial son clubes de pádel chicos y medianos de Córdoba que hoy coordinan turnos por WhatsApp. La propuesta combina la agenda sencilla para jugadores con operación diaria para recepción y una vista consolidada para el dueño. Frente a un marketplace como ATC, la ventaja que se busca validar es **menos trabajo manual para el club y más control de su relación con los jugadores**: enlace directo a su sede, reservas fiables, cobros trazables y datos propios. No se prometerá que PadelBook supera a ATC hasta medir estos resultados en clubes reales.

Un directorio de clubes con búsqueda geográfica podría incorporarse después como canal optativo de descubrimiento. No condiciona la reserva directa ni es requisito para la primera versión multiclub. Tampoco se amplía ahora a otros deportes, tienda o funciones sociales generales: desplazarían el trabajo crítico de agenda, caja y soporte.

**Criterios del primer lanzamiento multiclub:** dos organizaciones independientes, con dos sedes en al menos una de ellas, deben poder configurar canchas y precios, recibir reservas y operar la caja sin cruzar datos; recepción solo accede a sus sedes; el dueño ve su consolidado; el jugador puede reservar en clubes distintos desde una cuenta. El flujo debe pasar pruebas de concurrencia, restauración y móvil. La seña online y su conciliación son un hito comercial posterior, señalado claramente como pendiente hasta que exista integración real.

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

Completar la superficie operativa por sede y eliminar la dependencia de rutas globales en la experiencia multiclub. Después, cerrar o adaptar las rutas antiguas, ensayar migración y restauración de una copia del piloto y ejecutar las pruebas de aislamiento con dos organizaciones en un entorno separado. Solo entonces habilitar una base compartida y migrar producción.

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

El comando exige una confirmación adicional para escribir en `MONGODB_DB_NAME`; este plan aún no autoriza ese paso. Tras migrar una copia, `db:migrate:tenant-indexes` revisa que todos los datos operativos tengan organización y sede válidas, crea y verifica los índices únicos por sede y recién después retira los índices únicos globales. Es idempotente; no se ejecutó en la base del piloto.

```powershell
npm run db:migrate:tenant-indexes -- --target-db padelbook_multisite_qa
npm run db:migrate:tenant-indexes -- --target-db padelbook_multisite_qa --confirm-db padelbook_multisite_qa --apply
```

La primera orden solo previsualiza. La segunda se usa **únicamente en la copia de prueba**, después del backup y la migración de documentos. La prueba automatizada verifica que dos sedes pueden reutilizar `courtId`, fecha y franja mientras una misma sede sigue rechazando duplicados de cancha, reserva, bloqueo y reclamo. No habilitar una segunda organización en producción por el solo hecho de cambiar índices: las rutas globales siguen activas.

## Etapa 2: primera barrera de seguridad

`connectDb()` rechaza ahora una base con más de una organización o sede antes de ejecutar las semillas y migraciones heredadas. También rechaza datos de sede sin organización o documentos asignados a otra sede. Esta barrera evita usar por accidente la API monoclub sobre una base compartida.

La API tiene un modo explícito `PADELBOOK_OPERATING_MODE=multiclub` para un entorno de prueba separado. En ese modo el arranque exige datos acotados y los nuevos índices únicos verificados, no ejecuta semillas ni migraciones antiguas y responde 404 en las rutas operativas globales; conserva autenticación de cuenta y rutas `/api/organizations` y `/api/venues`. El frontend lee el modo del healthcheck, no monta los proveedores monoclub y redirige la navegación antigua a `/clubes`. El piloto publicado conserva `legacy` por defecto. Esta barrera técnica no reemplaza el ensayo de migración y restauración con un backup real ni autoriza el despliegue.

`server/tenantAccess.mjs` ya puede resolver una organización y sede activas por sus slugs, comprobar membresías activas y construir filtros de consulta con los identificadores obtenidos del servidor. La prueba usa dos organizaciones y verifica que un administrador de A no reciba membresía en B. Estas funciones todavía no sustituyen la autorización ni los filtros de las rutas existentes; hasta completar ese trabajo el sistema continúa siendo monoclub.

El primer corte vertical se implementó bajo `/api/venues/:organizationSlug/:venueSlug`: datos públicos de sede, canchas, disponibilidad, profesores, torneos y ajustes; lectura administrativa de canchas y reservas; creación, cancelación y cambio de estado de reservas; registro manual de cobros y reversiones. También permite crear, editar y desactivar canchas, crear o eliminar bloqueos de agenda, editar ajustes, administrar perfiles de profesores, gestionar torneos e inscripciones, registrar egresos y consultar caja y actividad dentro de una sede. Bajo `/api/organizations/:organizationSlug` se listan las sedes activas para su administrador, se invita a personal de recepción, profesorado y otros administradores, se cambian o revocan sus permisos y se consultan caja consolidada y actividad de la organización. El cambio de dirección actualiza ajustes y sede en una transacción. Todas las consultas y escrituras de estas rutas llevan los IDs resueltos en el servidor. Las operaciones administrativas comprueban membresía y rol; una reserva, cancha, profesor o torneo de otra sede buscado por ID responde 404. La auditoría de estas operaciones se acota por organización y sede.

Las pruebas cubren dos organizaciones, dos sedes de un mismo propietario, un recepcionista limitado a una sede, un administrador con rol global deliberadamente distinto, revocación de membresía, intentos de escoger cancha o profesor de otro club, cobro repetido con la misma clave, cancelación y reactivación con sus franjas. También verifican que el recepcionista no pueda editar ajustes, profesores ni torneos; que no se puedan modificar recursos ajenos; que cambiar los ajustes de una sede no altere los de otra; y que reasignar o revocar personal cambie su acceso en la siguiente solicitud sin otorgar un rol global. Caja y auditoría se comprueban por sede y organización, incluidos egresos y la suma consolidada sin datos del segundo club. Dos jugadores que intentan reservar la misma franja producen una reserva y un conflicto. Una reserva y un bloqueo simultáneos compiten por los mismos reclamos de franja. Dos inscripciones simultáneas al último cupo de un torneo producen una inscripción y un conflicto. Un profesor solo puede bloquear su sede y no puede eliminar bloqueos del club.

**Límite actual:** las rutas operativas anteriores siguen usando el contrato monoclub. El alta de clubes es controlada por el operador mediante `club:provision`; no hay registro público de organizaciones ni facturación de suscripciones. Crear un perfil de profesor todavía no le concede acceso al sistema: el acceso se administra por membresía como personal, y falta vincular explícitamente ambos registros. Los informes cargan reservas y egresos completos en memoria; antes de escalar a muchos clubes necesitan agregaciones o límites explícitos y pruebas de volumen. Hay lógica de reservas y torneos duplicada temporalmente entre ambos contratos, que debe unificarse antes de dar por cerrada la etapa. El guardián de arranque mantiene bloqueada una base compartida para la API de producción hasta completar todas las operaciones y migrar el frontend.

## Etapa 3: primer recorrido de lectura

La cuenta autenticada puede consultar sus organizaciones y sedes permitidas mediante `/api/auth/organizations`. El frontend incorpora `/clubes`, `/clubes/:organizationSlug` para el propietario y `/clubes/:organizationSlug/:venueSlug` para ver los datos publicados de una sede. El panel del propietario usa exclusivamente caja, actividad y personal de su organización; la página de sede consulta canchas, ajustes y torneos de esa sede. Incluye estados de carga, error y acceso denegado, y distribuciones adaptables a móvil.

El recorrido público de cada sede ahora incluye `/clubes/:organizationSlug/:venueSlug/reservar` y `/mis-turnos`. La agenda consulta disponibilidad y bloqueos solo de la fecha y sede elegidas; el jugador elige cancha y duración permitida, ve el precio estimado y solicita el turno con pago en el club. La API calcula el importe definitivo, exige membresía activa y protege las franjas con reclamos únicos en una transacción. Una cuenta autenticada puede incorporarse como jugadora a la organización al reservar; las membresías de personal siguen sujetas a sus sedes asignadas. Mis turnos consulta y cancela únicamente las reservas propias de esa sede. El frontend no reutiliza el estado ni las rutas de reservas monoclub.

Recepción y administración tienen `/clubes/:organizationSlug/:venueSlug/recepcion/reservas` para ver la agenda de un día, filtrar turnos, confirmar o cancelar y registrar dinero recibido. Los cobros usan una clave de idempotencia que se conserva al reintentar el mismo formulario. La carga manual de turnos usa la disponibilidad y el alta de reservas de esa sede para los pedidos que llegan por WhatsApp o teléfono. Un ingreso iniciado en estas rutas mantiene la URL de la sede después de autenticarse.

El administrador dispone de `/clubes/:organizationSlug/:venueSlug/configuracion` para editar los datos públicos, horarios y precios de las canchas de esa sede. El nombre público se sincroniza con la ficha de la sede. Los cambios de horario o estado no cancelan reservas existentes; recepción debe revisar la agenda antes de cerrar una cancha. La API aplica permisos y pertenencia de la sede en cada escritura.

El propietario dispone de `/clubes/:organizationSlug/equipo` para invitar por email a recepción, profesorado o a otro administrador, asignar sedes y revocar accesos. El enlace lleva un token aleatorio de un solo uso, guardado en la base solo como hash y entregado en el fragmento de la URL; vence a las 72 horas. La persona ingresa o se registra con el email invitado antes de aceptarlo. La aceptación se realiza en una transacción, comprueba de nuevo la organización y las sedes activas y permite convertir una membresía de jugador en una de personal. El administrador no recibe ni establece contraseñas. La API rechaza el alta directa anterior con 410. Las invitaciones pendientes pueden cancelarse desde el panel y el acceso aceptado puede desactivarse; los cambios de membresía surten efecto en la siguiente solicitud.

Para dar de alta un club nuevo, el operador valida al propietario fuera de la aplicación y le pide registrar su cuenta. Con `PADELBOOK_OPERATING_MODE=multiclub`, `MONGODB_URI` y `MONGODB_DB_NAME` del entorno de prueba, ejecuta primero `npm run club:provision -- --organization-slug club-ejemplo --organization-name "Club Ejemplo" --venue-slug sede-principal --venue-name "Sede Principal" --owner-email propietario@ejemplo.com --dry-run`. Tras revisar el destino, repite el comando sin `--dry-run` y con `--confirm club-ejemplo`. El alta transaccional crea organización, primera sede, ajustes y membresía administrativa; no crea canchas ni abre reservas hasta que el propietario configure la sede. El comando rechaza un slug repetido, una cuenta inexistente o una confirmación distinta. No ejecutarlo en el piloto publicado mientras siga en modo monoclub.

La caja de cada sede está disponible en `/clubes/:organizationSlug/:venueSlug/caja`. Muestra cobros, saldos y egresos acotados a esa sede y permite registrar gastos; el tablero del propietario conserva la suma de su organización. Ambas vistas identifican los importes como registros manuales, sin afirmar conciliación bancaria.

Profesorado tiene una pantalla administrativa por sede para publicar perfiles, cambiar estado y precio. El administrador puede vincular un perfil con una cuenta que ya tenga una membresía de profesor activa en esa sede. Un índice único por sede impide asociar la misma cuenta a dos perfiles deportivos de la misma sede. El profesor vinculado ve solo sus clases y sus bloqueos del día en `/mis-clases`; la API vuelve a comprobar su membresía y el estado del perfil en cada consulta y bloqueo. La creación de la cuenta continúa en Equipo y no modifica contraseñas existentes. Torneos tiene página pública por sede con inscripción, estado de la inscripción y una página administrativa para publicar eventos, cambiar estado y resolver inscripciones y pagos registrados manualmente. Al iniciar sesión desde una página de sede, el usuario permanece en esa página.

La prueba local en navegador usó dos organizaciones con el mismo identificador de cancha. Una reserva de 90 minutos en Club Córdoba quedó registrada por $30.000; Club Sierras no registró ningún turno ocupado para esa fecha y cancha. En otra base local de prueba, el ingreso desde la página de torneos conservó la ruta, se publicó un torneo de $12.000 por jugador, se inscribió una cuenta y se creó un perfil de profesor de $30.000 en la sede. Son verificaciones de desarrollo, no un ensayo de despliegue ni de volumen.

**Pendiente antes de activar multiclub en producción:** ensayar la ventana de cambio de infraestructura y versión con reversión; verificar un dominio remitente en Resend y validar invitaciones reales a destinatarios distintos del propietario; completar el alta controlada con un segundo club real. El recorrido móvil de dueño y recepción ya se comprobó sobre una copia aislada del piloto; falta validarlo con cuentas y operación reales en staging. La seña online y la conciliación de pagos no están implementadas. Ningún cambio de esta rama debe desplegarse sobre el piloto actual hasta completar esa transición.

La secuencia operativa y el límite de la reversión después de admitir nuevas reservas están detallados en [`CAMBIO_MULTICLUB.md`](CAMBIO_MULTICLUB.md). La API ofrece `PADELBOOK_MAINTENANCE_MODE=true` para pausar escrituras durante la copia y el cambio; `/api/health` informa `writable:false` y las escrituras reciben 503 con `Retry-After`.

## Ensayo de restauración y migración

El 7 de octubre de 2026 se agregó `npm run db:rehearse:multiclub` y una prueba integral con MongoDB aislado. La prueba crea un respaldo cifrado de un club de ensayo, lo verifica, lo restaura en otra base y migra documentos e índices. Compara cada campo original de cada documento (incluidos importes y pagos registrados), los conteos, las membresías y los índices. Comprueba que el origen no cambia y que una base de destino ocupada se rechaza.

El 8 de octubre de 2026 se ejecutó el [workflow 37777433928](https://github.com/cristalba22/padelbook/actions/runs/37777433928) con un backup real del piloto. El backup cifrado se creó y verificó; la restauración y migración corrieron exclusivamente en MongoDB temporal del runner, con `MONGODB_URI` vacío en ese paso. El informe `padelbook-multiclub-drill-37777433928` confirmó 11 colecciones, 14 documentos (entre ellos 2 usuarios, 3 canchas y 1 reserva), 2 membresías, 7 índices creados y 5 índices globales retirados en la copia. `restoredCountsVerified` y `verified` fueron `true`. El informe omite datos personales. Este ensayo valida integridad y estructura de la copia, pero no ejecuta la API ni la web sobre esa copia real.

El [workflow 37778706614](https://github.com/cristalba22/padelbook/actions/runs/37778706614), también del 8 de octubre, extendió el ensayo: inició la API multiclub contra la copia real migrada en la MongoDB temporal. Salud, sede, cancha, configuración y disponibilidad respondieron; una cuenta sintética reservó la cancha real, un intento duplicado obtuvo conflicto, el mismo horario se reservó en una segunda organización sintética y su administrador recibió 403 al consultar reservas del piloto. El reporte confirmó `apiSmokeVerified`, `realCourtBookable`, `sameVenueConflictRejected`, `crossOrganizationSlotReused` y `crossOrganizationAdminDenied`. Todas las reservas de esta comprobación existieron únicamente en el runner. La web aún no se ejecutó sobre esa copia real; el navegador se probó contra una base sintética separada.

El [workflow 37791006388](https://github.com/cristalba22/padelbook/actions/runs/37791006388) completó además el recorrido web en Chromium a 390 × 844 px contra esa copia real: ingreso con cuenta sintética, selección de los dos clubes, sede piloto, agenda y cancha restaurada. `browserSmokeVerified` fue `true`. Esta prueba no cubre todas las operaciones de recepción y propietario en el navegador; sus permisos y reservas sí se probaron por API. Después se agregó al mismo ensayo una reversión de datos en otra base temporal: restaurar el backup anterior, comparar documentos e índices y comprobar que el esquema multiclub no aparece en la copia revertida. Esto ensaya la integridad del dato, pero todavía falta practicar el cambio de versión e infraestructura con una ventana de mantenimiento y un punto de retorno claro.

El [workflow 37791339175](https://github.com/cristalba22/padelbook/actions/runs/37791339175) repitió el ensayo completo con reversión: `verified`, `apiSmokeVerified`, `browserSmokeVerified` y `rollbackCopyVerified` fueron `true`; la copia revertida conservó las 11 colecciones y 14 documentos originales. Las tres bases del ensayo vivieron solo durante el job.

El [workflow 37797649032](https://github.com/cristalba22/padelbook/actions/runs/37797649032) añadió la pantalla de invitación al recorrido móvil sobre la copia del piloto. Inició sesión con una cuenta sintética, previsualizó y aceptó un token de un solo uso, y volvió a «Mis clubes». `browserInvitationVerified` fue `true`; restauración, API y reversión también siguieron pasando. La entrega real de un correo se verificó con un servidor de correo falso en la prueba de API, no con un remitente de producción.

El ensayo también arranca procesos de API independientes en secuencia: modo anterior sobre la copia revertida, multiclub sobre la copia migrada y de nuevo modo anterior sobre la revertida. Exige salud conectada y lectura pública en cada arranque. Esto detecta fallos de configuración y de arranque en ambos modos; usa la misma versión de código y bases temporales, por lo que todavía no sustituye un ensayo de despliegue entre dos versiones ni la ventana de cambio real.

El [workflow 37798144415](https://github.com/cristalba22/padelbook/actions/runs/37798144415) ejecutó esa secuencia con el backup real del piloto: `legacyBootVerified`, `multiclubBootVerified` y `legacyReturnVerified` fueron `true`, junto con la prueba móvil de invitación y la reversión de datos.

El 8 de octubre se amplió el ensayo de navegador sobre la copia migrada: una cuenta sintética aceptó la invitación de recepción, confirmó una reserva del piloto y recibió denegación al intentar abrir la recepción del segundo club; la API comprobó que la confirmación persistió únicamente en el piloto. Otra cuenta sintética de propietario vio solo su club, abrió el resumen consolidado y Equipo, y no pudo abrir el panel de la otra organización. La prueba detectó que una actividad heredada sin `createdAt` derribaba el tablero; la vista ahora muestra «Sin fecha» y continúa operativa. La ejecución local a 390 × 844 px pasó completa. La prueba no escribe en Atlas.

El [workflow 37842733860](https://github.com/cristalba22/padelbook/actions/runs/37842733860) repitió esa versión contra un backup nuevo del piloto: 11 colecciones y 14 documentos conservados. El informe separado confirmó `browserReceptionVerified`, `browserOwnerVerified`, `browserCrossOrganizationDenied`, `rollbackCopyVerified` y los tres arranques de modo (`legacyBootVerified`, `multiclubBootVerified`, `legacyReturnVerified`), todos en `true`. El respaldo cifrado y la copia restaurada permanecieron fuera del repositorio y del sitio publicado.

El 8 de octubre se probó la entrega de correos de diagnóstico con la configuración de Resend del servicio publicado, sin generar invitaciones ni modificar cuentas. El mensaje dirigido al email propietario desde `onboarding@resend.dev` llegó a Gmail y Resend lo marcó como entregado. Un intento desde ese remitente al segundo destinatario fue rechazado con HTTP 403: el remitente de prueba solo permite enviar al propietario de la cuenta. Con autorización puntual del dueño, se envió **un único correo de diagnóstico** al segundo destinatario desde `padelbook@cercaliceo.com.ar`, un dominio ya verificado para otro proyecto; Resend lo marcó como entregado. No se modificaron DNS ni la aplicación Cerca Liceo. Esa autorización no habilita el uso permanente de su dominio para PadelBook. Antes de prometer recuperación, confirmaciones o invitaciones por email a jugadores y empleados, verificar un dominio propio de PadelBook y ensayar el flujo real de invitación en staging con destinatarios externos. No se guardó ninguna clave del proveedor en el repositorio.

El recorrido funcional de dos clubes se hizo con otra MongoDB temporal de datos sintéticos: Club Córdoba con sedes Centro y Norte, y Club Sierras con Villa Allende. Un jugador reservó el mismo horario de 90 minutos para el 9 de octubre en Centro ($36.000) y Villa Allende ($45.000); cada reserva apareció solo en los turnos de su sede. Recepción Centro vio una única sede y el turno pendiente de $36.000. El propietario de Córdoba vio sus dos sedes y solo ese saldo; la propietaria de Sierras vio solo Villa Allende y $45.000, y la URL del panel de Córdoba le negó el acceso. La ficha de sede se inspeccionó a 390 × 844 px. No hubo escritura en Atlas ni en el piloto publicado.

El 8 de octubre se repitió el ensayo local creando **Club Sierras mediante el comando real de alta controlada** (`dryRun` seguido de confirmación), sobre una MongoDB temporal donde Club Córdoba ya existía. Se configuró una cancha de prueba tras el alta. La API mostró a cada propietario solo su club y devolvió 404 al consultar el panel ajeno. Un jugador reservó el mismo turno de 90 minutos del 15 de octubre a las 19:00 en ambos clubes: $36.000 en Córdoba y $45.000 en Sierras; las disponibilidades quedaron separadas y un segundo intento para el mismo turno dentro de Córdoba devolvió 409. Las páginas de ambas sedes cargaron en Chromium a 390 × 844 px. Esta prueba verifica el procedimiento de alta y el aislamiento local; **Club Sierras aún no existe en un staging persistente** ni se hizo el alta de un segundo club real.

Para repetir el recorrido local, ejecutar `npm run qa:two-clubs` en una terminal y `VITE_API_URL=http://127.0.0.1:4000/api npm run dev -- --host 127.0.0.1` en otra; en PowerShell se define `$env:VITE_API_URL` antes de `npm run dev`. Abrir `/clubes`. Las cuentas de prueba son `dueno-cordoba@qa.invalid`, `duena-sierras@qa.invalid` y `jugador@qa.invalid`, con la contraseña local `PadelQa2026!`. El primer comando crea y destruye una MongoDB temporal; al detenerlo desaparecen todos los datos de ensayo. Nunca usar este comando como servidor de producción.

Para repetir el ensayo con un respaldo real, preparar `MONGODB_URI` y `BACKUP_ENCRYPTION_KEY` en el entorno de operación sin incorporarlos al repositorio. Verificar el archivo sin conexión a MongoDB:

```powershell
npm run db:backup -- --verify-only C:\ruta\al\backup.pbk
```

Con acceso a un servidor de prueba, o a una base de ensayo nueva en el mismo clúster, ejecutar:

```powershell
npm run db:rehearse:multiclub -- --input C:\ruta\al\backup.pbk --target-db padelbook_multiclub_qa --confirm-db padelbook_multiclub_qa --organization-slug club-cordoba --organization-name "Club Córdoba" --venue-slug sede-centro --venue-name "Sede Centro"
```

El comando solo acepta un nombre `padelbook_*_qa`, distinto del origen y de `MONGODB_DB_NAME`; exige confirmación exacta y una base de destino sin colecciones. El destino contiene una copia de los datos personales del respaldo: restringir el acceso y eliminarla siguiendo el procedimiento de retención del operador. Si una verificación falla, el comando se detiene y conserva la base de ensayo para investigar; no toca el origen. Registrar el informe JSON y revisar los conteos e índices antes de programar cualquier migración real. El ensayo no sustituye la prueba de la API y el frontend sobre la copia ni la ventana de cambio del piloto.

Para el backup del piloto alojado en GitHub Actions, ejecutar manualmente el workflow `MongoDB encrypted backup` sobre la rama de este PR. Tras crear y guardar el backup cifrado, el job restaura una copia **solo en la MongoDB temporal del runner**, ejecuta la migración, prueba API y navegador, restaura otra copia con el esquema anterior y publica un informe JSON separado. El paso de ensayo borra `MONGODB_URI` de su entorno para que no pueda conectarse a Atlas; usa la clave solo para descifrar en memoria. El informe no contiene documentos, nombres de usuarios, emails ni credenciales. No descargar ni distribuir el backup cifrado para este ensayo.
