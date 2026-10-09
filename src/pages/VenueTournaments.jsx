import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { argentinaDateISO } from "../utils/bookingDomain.js";
import "./organizations.css";
import "./venueManagement.css";
import "./venueTournaments.css";

const segment = (value) => encodeURIComponent(String(value || ""));
const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const blank = () => ({ name: "", date: "", hour: "20:00", status: "abierto", category: "Mixto · libre", surface: "Mixta",
  pricePerPlayer: 0, seededPlayers: 0, maxPlayers: 16, prize: "", description: "" });
const statusLabel = { abierto: "Inscripción abierta", lleno: "Cupos completos", en_curso: "En curso", finalizado: "Finalizado", cancelado: "Cancelado" };

export default function VenueTournaments({ management = false }) {
  const { organizationSlug, venueSlug } = useParams();
  const { user, openLogin } = useAuth();
  const { organizations, loading: permissionsLoading, refresh: refreshOrganizations } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug);
  const canManage = organization?.role === "admin" && organization.venues.some((item) => item.slug === venueSlug);
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [state, setState] = useState({ loading: true, error: "", tournaments: [], mine: [] });
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (management && !canManage) return;
    let active = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    const list = management ? `${root}/admin/tournaments` : `${root}/tournaments`;
    Promise.all([apiRequest(list, { signal: controller.signal }),
      !management && user && organization?.venues.some((item) => item.slug === venueSlug)
        ? apiRequest(`${root}/tournaments/mine`, { signal: controller.signal }) : Promise.resolve({ registrations: [] })])
      .then(([data, mine]) => { if (active) setState({ loading: false, error: "", tournaments: data.tournaments, mine: mine.registrations }); })
      .catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { active = false; controller.abort(); };
  }, [root, management, canManage, user?.id, organization?.role, reload]);

  async function create(event) {
    event.preventDefault(); setBusy("create"); setNotice("");
    try {
      await apiRequest(`${root}/admin/tournaments`, { method: "POST", body: JSON.stringify(form) });
      setForm(blank()); setReload((value) => value + 1); setNotice("Torneo publicado en esta sede.");
    } catch (error) { setNotice(error.message || "No pudimos publicar el torneo."); }
    finally { setBusy(""); }
  }

  async function updateTournament(tournament, patch) {
    setBusy(tournament.id); setNotice("");
    try {
      await apiRequest(`${root}/admin/tournaments/${segment(tournament.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      setReload((value) => value + 1); setNotice("Torneo actualizado.");
    } catch (error) { setNotice(error.message || "No pudimos actualizar el torneo."); }
    finally { setBusy(""); }
  }

  async function updateRegistration(tournament, registration, patch) {
    setBusy(registration.id); setNotice("");
    try {
      await apiRequest(`${root}/admin/tournaments/${segment(tournament.id)}/registrations/${segment(registration.id)}`,
        { method: "PATCH", body: JSON.stringify(patch) });
      setReload((value) => value + 1); setNotice("Inscripción actualizada.");
    } catch (error) { setNotice(error.message || "No pudimos actualizar la inscripción."); }
    finally { setBusy(""); }
  }

  async function register(tournament, partnerName, partnerPhone) {
    if (!user) { openLogin(); return; }
    setBusy(tournament.id); setNotice("");
    try {
      await apiRequest(`${root}/join`, { method: "POST" });
      await apiRequest(`${root}/tournaments/${segment(tournament.id)}/register`,
        { method: "POST", body: JSON.stringify({ partnerName, partnerPhone }) });
      void refreshOrganizations(); setReload((value) => value + 1); setNotice("Inscripción recibida. El club confirmará tu lugar.");
    } catch (error) { setNotice(error.message || "No pudimos registrar la inscripción."); }
    finally { setBusy(""); }
  }

  if (management && permissionsLoading) return <section className="org-state" role="status"><h1>Verificando acceso…</h1></section>;
  if (management && !canManage) return <section className="org-state"><h1>Sin acceso a torneos</h1><p>Solo la administración de esta sede puede publicar torneos.</p></section>;
  const visible = management ? state.tournaments : state.tournaments.filter((item) => item.date >= argentinaDateISO() && item.status !== "cancelado");
  return <main className="org-page venue-management venue-tournaments">
    <header className="org-heading"><Link className="org-back" to={venuePath}><ArrowLeft size={16} /> Volver a la sede</Link>
      <span className="org-eyebrow">{management ? "Administración" : "Competencia"} · {organization?.name || organizationSlug}</span>
      <h1>{management ? "Gestionar torneos" : "Torneos de la sede"}</h1><p>{management ? "Publicá eventos y gestioná inscripciones." : "Elegí un torneo y participá en esta sede."}</p></header>
    {notice && <p className="venue-management__notice" role="status">{notice}</p>}
    {state.error && <div className="venue-error" role="alert">{state.error} <button type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button></div>}
    <div className={management ? "venue-management__layout" : ""}>
      <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">{management ? "Calendario de la sede" : "Próximos eventos"}</span><h2>{management ? "Torneos publicados" : "Elegí tu torneo"}</h2></div>
        {canManage && !management && <Link className="org-staff-link" to={`${venuePath}/torneos/gestionar`}>Gestionar <ArrowRight size={16} /></Link>}</div>
        {state.loading ? <p className="org-empty" role="status">Cargando torneos…</p> : visible.length ? <div className="venue-tournaments__list">
          {visible.map((tournament) => management ? <AdminTournament key={tournament.id} tournament={tournament} busy={Boolean(busy)}
            onUpdate={(patch) => updateTournament(tournament, patch)} onRegistration={(registration, patch) => updateRegistration(tournament, registration, patch)} />
            : <PublicTournament key={tournament.id} tournament={tournament} mine={state.mine} busy={Boolean(busy)}
              onRegister={(partnerName, partnerPhone) => register(tournament, partnerName, partnerPhone)} />)}</div>
          : <p className="org-empty">{management ? "Todavía no se publicaron torneos en esta sede." : "No hay torneos abiertos próximamente."}</p>}</section>
      {management && <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Nuevo evento</span><h2>Publicar torneo</h2></div></div>
        <form className="venue-management__form" onSubmit={create}>
          <label>Nombre<input required minLength={2} maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <div className="venue-tournaments__fields"><label>Fecha<input required type="date" min={argentinaDateISO()} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
            <label>Hora<input required type="time" value={form.hour} onChange={(event) => setForm({ ...form, hour: event.target.value })} /></label></div>
          <label>Categoría<input required maxLength={80} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} /></label>
          <label>Superficie<input maxLength={80} value={form.surface} onChange={(event) => setForm({ ...form, surface: event.target.value })} /></label>
          <div className="venue-tournaments__fields"><label>Precio por jugador<input required type="number" min="0" max="100000000" step="1" value={form.pricePerPlayer} onChange={(event) => setForm({ ...form, pricePerPlayer: Number(event.target.value) })} /></label>
            <label>Cupos<input required type="number" min="1" step="1" value={form.maxPlayers} onChange={(event) => setForm({ ...form, maxPlayers: Number(event.target.value) })} /></label></div>
          <label>Premio<input maxLength={120} value={form.prize} onChange={(event) => setForm({ ...form, prize: event.target.value })} /></label>
          <label>Descripción<textarea maxLength={1000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
          <button type="submit" disabled={Boolean(busy)}><Plus size={16} /> Publicar torneo</button></form></section>}
    </div>
  </main>;
}

function PublicTournament({ tournament, mine, busy, onRegister }) {
  const [partnerName, setPartnerName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const registration = mine.find((item) => item.tournamentId === tournament.id && item.status !== "cancelado");
  const open = tournament.status === "abierto" && tournament.currentPlayers < tournament.maxPlayers;
  return <article className="venue-tournaments__card"><div className="venue-tournaments__top"><div><strong>{tournament.name}</strong><small>{tournament.category} · {tournament.surface}</small></div><span>{statusLabel[tournament.status] || tournament.status}</span></div>
    <p>{tournament.date.split("-").reverse().join("/")} · {tournament.hour} · {tournament.currentPlayers}/{tournament.maxPlayers} cupos · {money(tournament.pricePerPlayer)} por jugador</p>
    {tournament.description && <p>{tournament.description}</p>}{tournament.prize && <p>Premio: {tournament.prize}</p>}
    {registration ? <p className="venue-tournaments__registered">Tu inscripción está {registration.status}. Pago: {registration.paymentStatus}.</p>
      : open && <form className="venue-tournaments__register" onSubmit={(event) => { event.preventDefault(); onRegister(partnerName.trim(), partnerPhone.trim()); }}>
        <label>Compañero/a (opcional)<input maxLength={100} value={partnerName} onChange={(event) => setPartnerName(event.target.value)} /></label>
        <label>Teléfono de compañero/a (opcional)<input maxLength={40} value={partnerPhone} onChange={(event) => setPartnerPhone(event.target.value)} /></label>
        <button className="venue-management__action" type="submit" disabled={busy}>Solicitar inscripción <ArrowRight size={16} /></button></form>}</article>;
}

function AdminTournament({ tournament, busy, onUpdate, onRegistration }) {
  return <article className="venue-tournaments__card"><div className="venue-tournaments__top"><div><strong>{tournament.name}</strong><small>{tournament.date.split("-").reverse().join("/")} · {tournament.hour} · {tournament.category}</small></div>
    <label>Estado<select value={tournament.status} disabled={busy} onChange={(event) => onUpdate({ status: event.target.value })}>
      {Object.entries(statusLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    <p>{tournament.currentPlayers}/{tournament.maxPlayers} cupos · {money(tournament.pricePerPlayer)} por jugador</p>
    {(tournament.registrations || []).length ? <div className="venue-tournaments__registrations">{tournament.registrations.map((registration) => <div key={registration.id}>
      <span><strong>{registration.name}</strong><small>{registration.email} · {registration.status}</small></span>
      <label>Inscripción<select value={registration.status} disabled={busy} onChange={(event) => onRegistration(registration, { status: event.target.value })}>
        <option value="pendiente">Pendiente</option><option value="confirmado">Confirmada</option><option value="cancelado">Cancelada</option></select></label>
      <label>Pago registrado<select value={registration.paymentStatus} disabled={busy} onChange={(event) => onRegistration(registration, { paymentStatus: event.target.value })}>
        <option value="pendiente">Pendiente</option><option value="pagado">Pagado</option><option value="sin_cargo">Sin cargo</option></select></label></div>)}</div>
      : <p className="org-empty">Sin inscripciones todavía.</p>}</article>;
}
