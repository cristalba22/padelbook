import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Building2, CalendarDays, MapPin, RefreshCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { argentinaDateISO } from "../utils/bookingDomain.js";
import { ROUTES } from "../constants/routes.js";
import "./organizations.css";
import "./venueBooking.css";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const segment = (value) => encodeURIComponent(String(value || ""));

function StatePanel({ title, detail, retry }) {
  return <section className="org-state" role={retry ? "alert" : "status"}>
    <h1>{title}</h1><p>{detail}</p>
    {retry && <button type="button" onClick={retry}><RefreshCw size={16} /> Reintentar</button>}
  </section>;
}

export function Organizations() {
  const { user } = useAuth();
  const { organizations, loading, error, refresh } = useOrganizations();
  if (!user) return <StatePanel title="Ingresá para ver tus clubes" detail="Tu cuenta muestra las organizaciones y sedes a las que tenés acceso." />;
  if (loading) return <StatePanel title="Consultando tus clubes" detail="Estamos verificando tus permisos." />;
  if (error) return <StatePanel title="No pudimos cargar tus clubes" detail={error} retry={refresh} />;
  return <main className="org-page">
    <header className="org-heading"><span className="org-eyebrow">Tu espacio de trabajo</span><h1>Mis clubes</h1>
      <p>Elegí la organización en la que querés trabajar.</p></header>
    {organizations.length ? <div className="org-list">{organizations.map((organization) => {
      const destination = organization.role === "admin" ? `${ROUTES.CLUBS}/${segment(organization.slug)}`
        : organization.venues[0] ? `${ROUTES.CLUBS}/${segment(organization.slug)}/${segment(organization.venues[0].slug)}` : ROUTES.CLUBS;
      return <Link className="org-list-card" to={destination} key={organization.slug}>
        <span className="org-list-card__icon"><Building2 size={24} /></span><span className="org-list-card__copy"><strong>{organization.name}</strong>
          <small>{organization.venues.length} {organization.venues.length === 1 ? "sede" : "sedes"} · {organization.role === "admin" ? "Administración" : organization.role === "receptionist" ? "Recepción" : organization.role === "teacher" ? "Profesorado" : "Jugador"}</small></span>
        <ArrowRight size={20} aria-hidden="true" /></Link>;
    })}</div> : <StatePanel title="No tenés clubes asignados" detail="Cuando un club te agregue, aparecerá acá." />}
  </main>;
}

export function OrganizationDashboard() {
  const { organizationSlug } = useParams();
  const { organizations, loading: portfolioLoading, error: portfolioError } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug && item.role === "admin");
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!organization) return;
    let active = true;
    const controller = new AbortController();
    setState({ loading: true, error: "", data: null });
    const root = `/organizations/${segment(organizationSlug)}/admin`;
    Promise.all([
      apiRequest(`${root}/finance/summary`, { signal: controller.signal }),
      apiRequest(`${root}/activity`, { signal: controller.signal }),
      apiRequest(`${root}/staff`, { signal: controller.signal }),
    ]).then(([finance, activity, staff]) => {
      if (active) setState({ loading: false, error: "", data: { finance, activity: activity.activity, staff: staff.staff } });
    }).catch((error) => {
      if (active) setState({ loading: false, error: error.message || "No pudimos consultar el panel.", data: null });
    });
    return () => { active = false; controller.abort(); };
  }, [organizationSlug, organization?.slug, retry]);

  if (portfolioLoading) return <StatePanel title="Verificando acceso" detail="Estamos consultando tus organizaciones." />;
  if (portfolioError) return <StatePanel title="No pudimos verificar el acceso" detail={portfolioError} />;
  if (!organization) return <StatePanel title="No tenés acceso a este panel" detail="Revisá tus clubes disponibles desde tu cuenta." />;
  if (state.loading) return <StatePanel title="Cargando el panel" detail={`Consultando las sedes de ${organization.name}.`} />;
  if (state.error) return <StatePanel title="No pudimos cargar el panel" detail={state.error} retry={() => setRetry((value) => value + 1)} />;

  const { summary, venues } = state.data.finance;
  const monthly = summary.byPeriod.month;
  return <main className="org-page org-dashboard">
    <header className="org-heading org-heading--dashboard"><div><Link className="org-back" to={ROUTES.CLUBS}><ArrowLeft size={16} /> Mis clubes</Link>
      <span className="org-eyebrow">Panel del propietario</span><h1>{organization.name}</h1>
      <p>{venues.length} {venues.length === 1 ? "sede" : "sedes"} · Caja y operación consolidadas</p></div>
      <button className="org-refresh" type="button" onClick={() => setRetry((value) => value + 1)}><RefreshCw size={16} /> Actualizar</button>
    </header>

    <section aria-labelledby="org-finance-title" className="org-section">
      <div className="org-section__heading"><div><span className="org-eyebrow">Caja</span><h2 id="org-finance-title">Resumen de este mes</h2></div><small>Montos registrados manualmente</small></div>
      <div className="org-metrics">
        <article className="org-metric org-metric--primary"><span>Ingresos registrados</span><strong>{money(monthly.income)}</strong><small>En todas las sedes</small></article>
        <article className="org-metric"><span>Egresos</span><strong>{money(monthly.expenses)}</strong><small>Gastos registrados</small></article>
        <article className="org-metric"><span>Comisiones estimadas</span><strong>{money(monthly.commissions)}</strong><small>Según la configuración de cada sede</small></article>
        <article className="org-metric"><span>Neto estimado</span><strong>{money(monthly.net)}</strong><small>Ingresos menos egresos y comisiones</small></article>
      </div>
      <p className="org-finance-note">Pendiente de cobro en reservas activas: <strong>{money(summary.totals.pending)}</strong>. Los importes reflejan registros del club; no representan cobros conciliados con una pasarela.</p>
    </section>

    <section aria-labelledby="org-venues-title" className="org-section">
      <div className="org-section__heading"><div><span className="org-eyebrow">Operación</span><h2 id="org-venues-title">Sedes</h2></div><small>Elegí una sede para ver sus datos</small></div>
      <div className="org-venue-grid">{venues.map((venue) => <Link className="org-venue-card" key={venue.id}
        to={`${ROUTES.CLUBS}/${segment(organizationSlug)}/${segment(venue.slug)}`}>
        <span className="org-venue-card__top"><span className="org-venue-card__index">{String(venues.indexOf(venue) + 1).padStart(2, "0")}</span><ArrowRight size={18} /></span>
        <strong>{venue.name}</strong><span className="org-venue-card__status">{venue.active ? "Activa" : "Inactiva"}</span>
        <span className="org-venue-card__figures"><span><small>Ingresos del mes</small><b>{money(venue.summary.byPeriod.month.income)}</b></span>
          <span><small>Pendiente</small><b>{money(venue.summary.totals.pending)}</b></span></span>
      </Link>)}</div>
    </section>

    <div className="org-bottom-grid">
      <section className="org-section" aria-labelledby="org-activity-title"><div className="org-section__heading"><div><span className="org-eyebrow">Registro</span><h2 id="org-activity-title">Actividad reciente</h2></div></div>
        {state.data.activity.length ? <ol className="org-activity">{state.data.activity.slice(0, 6).map((item) => <li key={item.id}>
          <span className="org-activity__dot" aria-hidden="true" /><div><strong>{item.title}</strong><small>{item.detail || item.actor}</small></div>
          <time dateTime={item.createdAt}>{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short" }).format(new Date(item.createdAt))}</time></li>)}</ol>
          : <p className="org-empty">Todavía no hay movimientos registrados.</p>}</section>
      <section className="org-section" aria-labelledby="org-team-title"><div className="org-section__heading"><div><span className="org-eyebrow">Equipo</span><h2 id="org-team-title">Personal</h2></div><Link className="org-staff-link" to={`${ROUTES.CLUBS}/${segment(organizationSlug)}/equipo`}>Gestionar equipo <ArrowRight size={16} /></Link></div>
        <p className="org-team-count"><strong>{state.data.staff.filter((person) => person.active).length}</strong> personas con acceso activo</p>
        <ul className="org-team-list">{state.data.staff.slice(0, 6).map((person) => <li key={person.id}><span>{person.name}</span><small>{person.role === "receptionist" ? "Recepción" : "Profesorado"} · {person.venueIds.length} {person.venueIds.length === 1 ? "sede" : "sedes"}</small></li>)}</ul>
        {!state.data.staff.length && <p className="org-empty">Todavía no hay personal asignado.</p>}</section>
    </div>
  </main>;
}

export function VenueOverview() {
  const { organizationSlug, venueSlug } = useParams();
  const { organizations } = useOrganizations();
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setState({ loading: true, error: "", data: null });
    const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
    Promise.all([apiRequest(root, { signal: controller.signal }), apiRequest(`${root}/courts`, { signal: controller.signal }),
      apiRequest(`${root}/settings`, { signal: controller.signal }), apiRequest(`${root}/tournaments`, { signal: controller.signal })])
      .then(([identity, courts, settings, tournaments]) => {
        if (active) setState({ loading: false, error: "", data: { identity, courts: courts.courts, settings: settings.settings,
          tournaments: tournaments.tournaments } });
      }).catch((error) => { if (active) setState({ loading: false, error: error.message, data: null }); });
    return () => { active = false; controller.abort(); };
  }, [organizationSlug, venueSlug, retry]);
  if (state.loading) return <StatePanel title="Cargando la sede" detail="Consultando canchas y horarios." />;
  if (state.error) return <StatePanel title="No pudimos cargar la sede" detail={state.error} retry={() => setRetry((value) => value + 1)} />;
  const { identity, courts, settings, tournaments } = state.data;
  const organization = organizations.find((item) => item.slug === organizationSlug);
  const canManageBookings = ["admin", "receptionist"].includes(organization?.role) && organization.venues.some((item) => item.slug === venueSlug);
  const back = organization?.role === "admin" ? `${ROUTES.CLUBS}/${segment(organizationSlug)}` : ROUTES.CLUBS;
  const upcoming = tournaments.filter((item) => item.date >= argentinaDateISO() && item.status === "abierto").slice(0, 3);
  return <main className="org-page org-venue-page">
    <header className="org-heading"><Link className="org-back" to={back}><ArrowLeft size={16} /> {identity.organization.name}</Link>
      <span className="org-eyebrow">Sede</span><h1>{identity.venue.name}</h1>
      <p><MapPin size={16} aria-hidden="true" /> {identity.venue.address || settings.address || "Dirección pendiente"}</p></header>
    <div className="org-venue-info"><span><Building2 size={18} /> {courts.length} {courts.length === 1 ? "cancha" : "canchas"}</span>
      <span><CalendarDays size={18} /> {settings.openingHours || "Consultá los horarios de cada cancha"}</span></div>
    <div className="venue-overview-actions"><Link to={`${ROUTES.CLUBS}/${segment(organizationSlug)}/${segment(venueSlug)}/reservar`}>
      Reservar cancha <ArrowRight size={17} /></Link><Link to={`${ROUTES.CLUBS}/${segment(organizationSlug)}/${segment(venueSlug)}/mis-turnos`}>Mis turnos</Link>
      {canManageBookings && <Link to={`${ROUTES.CLUBS}/${segment(organizationSlug)}/${segment(venueSlug)}/recepcion/reservas`}>Gestionar reservas</Link>}</div>
    {organization?.role === "admin" && organization.venues.some((item) => item.slug === venueSlug) &&
      <div className="venue-overview-actions"><Link to={`${ROUTES.CLUBS}/${segment(organizationSlug)}/${segment(venueSlug)}/configuracion`}>Configurar sede <ArrowRight size={17} /></Link></div>}
    <section className="org-section" aria-labelledby="venue-courts-title"><div className="org-section__heading"><div><span className="org-eyebrow">Instalaciones</span><h2 id="venue-courts-title">Canchas</h2></div></div>
      {courts.length ? <div className="org-court-list">{courts.map((court) => <article key={court.id}><div><strong>{court.name}</strong><small>{court.surface || court.description || "Cancha de pádel"}</small></div>
        <span>{court.openingTime}–{court.closingTime}</span><b>Desde {money(court.basePrice)} / h</b></article>)}</div>
        : <p className="org-empty">Esta sede todavía no tiene canchas publicadas.</p>}</section>
    <section className="org-section" aria-labelledby="venue-tournaments-title"><div className="org-section__heading"><div><span className="org-eyebrow">Calendario</span><h2 id="venue-tournaments-title">Próximos torneos</h2></div></div>
      {upcoming.length ? <div className="org-court-list">{upcoming.map((item) => <article key={item.id}><div><strong>{item.name}</strong><small>{item.category}</small></div>
        <span>{item.date.split("-").reverse().join("/")} · {item.hour}</span></article>)}</div>
        : <p className="org-empty">No hay torneos abiertos en esta sede.</p>}</section>
  </main>;
}
