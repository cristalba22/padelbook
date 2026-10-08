import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { argentinaDateISO } from "../utils/bookingDomain.js";
import { CLASS_HOURS } from "../data/bookingConfig.js";
import "./organizations.css";
import "./venueManagement.css";
import "./venueTeacherSchedule.css";

const segment = (value) => encodeURIComponent(String(value || ""));

export default function VenueTeacherSchedule() {
  const { organizationSlug, venueSlug } = useParams();
  const { user, openLogin } = useAuth();
  const { organizations, loading: permissionsLoading } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug);
  const allowed = organization?.role === "teacher" && organization.venues.some((item) => item.slug === venueSlug);
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [date, setDate] = useState(argentinaDateISO);
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [courtId, setCourtId] = useState("");
  const [hour, setHour] = useState(CLASS_HOURS[0]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    const controller = new AbortController();
    setState({ loading: true, error: "", data: null });
    apiRequest(`${root}/teacher/me?date=${encodeURIComponent(date)}`, { signal: controller.signal })
      .then((data) => { if (active) setState({ loading: false, error: "", data }); })
      .catch((error) => { if (active) setState({ loading: false, error: error.message, data: null }); });
    return () => { active = false; controller.abort(); };
  }, [root, date, allowed, reload]);

  async function block(event) {
    event.preventDefault();
    const selectedCourt = state.data?.courts.find((item) => item.id === courtId) || state.data?.courts[0];
    if (!selectedCourt) return;
    setBusy(true); setNotice("");
    try {
      await apiRequest(`${root}/admin/blocks/batch`, { method: "POST", body: JSON.stringify({ blocks: [
        { date, courtId: selectedCourt.id, hour, durationMinutes: 60 },
      ] }) });
      setNotice("Horario bloqueado."); setReload((value) => value + 1);
    } catch (error) { setNotice(error.message || "No pudimos bloquear el horario."); }
    finally { setBusy(false); }
  }

  async function release(item) {
    setBusy(true); setNotice("");
    try {
      await apiRequest(`${root}/admin/blocks/batch`, { method: "DELETE", body: JSON.stringify({ keys: [
        { date: item.date, courtId: item.courtId, hour: item.hour },
      ] }) });
      setNotice("Horario liberado."); setReload((value) => value + 1);
    } catch (error) { setNotice(error.message || "No pudimos liberar el horario."); }
    finally { setBusy(false); }
  }

  if (!user) return <section className="org-state"><h1>Ingresá para ver tus clases</h1><p>Tu agenda está disponible con tu cuenta de profesor.</p>
    <button type="button" onClick={openLogin}>Ingresar</button></section>;
  if (permissionsLoading) return <section className="org-state" role="status"><h1>Verificando acceso…</h1></section>;
  if (!allowed) return <section className="org-state"><h1>Sin acceso a esta sede</h1><p>Pedile al club que revise tus permisos.</p></section>;
  return <main className="org-page venue-management venue-teacher">
    <header className="org-heading"><Link className="org-back" to={venuePath}><ArrowLeft size={16} /> Volver a la sede</Link>
      <span className="org-eyebrow">Profesorado · {organization.name}</span><h1>Mis clases</h1>
      <p>Agenda y disponibilidad de {organization.venues.find((item) => item.slug === venueSlug)?.name}.</p></header>
    {notice && <p className="venue-management__notice" role="status">{notice}</p>}
    <div className="venue-teacher__toolbar"><label>Fecha<input aria-label="Fecha de clases" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <button type="button" onClick={() => setReload((value) => value + 1)}><RefreshCw size={16} /> Actualizar</button></div>
    {state.loading ? <section className="org-section" role="status">Consultando tus clases…</section> : state.error ?
      <div className="venue-error" role="alert">{state.error} <button type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button></div> :
      <div className="venue-management__layout"><section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">{state.data.teacher.specialty}</span>
        <h2>Clases de {state.data.teacher.name}</h2></div><small>{state.data.bookings.length} turnos</small></div>
        {state.data.bookings.length ? <div className="venue-teacher__classes">{state.data.bookings.map((booking) => <article key={booking.id}>
          <strong>{booking.time}–{booking.endTime}</strong><div><b>{booking.playerName}</b><small>{booking.courtName} · {booking.status}</small>
            {booking.phone && <small>Tel. {booking.phone}</small>}</div><span>{booking.paymentStatus}</span></article>)}</div>
          : <p className="org-empty">No tenés clases asignadas para esta fecha.</p>}</section>
      <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Disponibilidad</span><h2>Bloquear una clase</h2></div></div>
        <p className="venue-management__hint">Los bloqueos impiden reservas que se crucen con esa hora. El club puede verlos en su agenda.</p>
        <form className="venue-management__form" onSubmit={block}><label>Cancha<select value={courtId || state.data.courts[0]?.id || ""}
          onChange={(event) => setCourtId(event.target.value)}>{state.data.courts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></label>
          <label>Hora<select value={hour} onChange={(event) => setHour(event.target.value)}>{CLASS_HOURS.map((value) => <option key={value}>{value}</option>)}</select></label>
          <button type="submit" disabled={busy || !state.data.courts.length || date < argentinaDateISO()}>Bloquear hora</button></form>
        {state.data.blocks.length ? <div className="venue-teacher__blocks">{state.data.blocks.map((item) => <div key={item.id}>
          <span>{item.hour} · {state.data.courts.find((court) => court.id === item.courtId)?.name || item.courtId}</span>
          <button type="button" disabled={busy} onClick={() => release(item)}>Liberar</button></div>)}</div>
          : <p className="venue-management__hint">No cargaste bloqueos para este día.</p>}</section></div>}
  </main>;
}
