import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, MapPin, RefreshCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { argentinaDateISO, calculateBookingPrice } from "../utils/bookingDomain.js";
import { shiftClubDate } from "../utils/clubDate.js";
import { endTime, venueSlots } from "../utils/venueAvailability.js";
import "./organizations.css";
import "./venueBooking.css";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const segment = (value) => encodeURIComponent(String(value || ""));
const durationLabel = (value) => ({ 60: "1 h", 90: "1 h 30", 120: "2 h", 150: "2 h 30" })[value];

export default function VenueBooking() {
  const { organizationSlug, venueSlug } = useParams();
  const { user, openLogin, apiOnline } = useAuth();
  const { refresh: refreshOrganizations } = useOrganizations();
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [date, setDate] = useState(argentinaDateISO);
  const [duration, setDuration] = useState(90);
  const [courtId, setCourtId] = useState("");
  const [time, setTime] = useState("");
  const [identity, setIdentity] = useState(null);
  const [courts, setCourts] = useState([]);
  const [agenda, setAgenda] = useState({ loading: true, occupied: [], blocks: [], error: "" });
  const [pageError, setPageError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.all([apiRequest(root, { signal: controller.signal }), apiRequest(`${root}/courts`, { signal: controller.signal })])
      .then(([details, response]) => { if (active) { setIdentity(details); setCourts(response.courts); setPageError(""); } })
      .catch((error) => { if (active) setPageError(error.message || "No pudimos cargar la sede."); });
    return () => { active = false; controller.abort(); };
  }, [root, refresh]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    setAgenda({ loading: true, occupied: [], blocks: [], error: "" });
    setTime("");
    Promise.all([
      apiRequest(`${root}/availability?date=${date}`, { signal: controller.signal }),
      apiRequest(`${root}/blocks?date=${date}`, { signal: controller.signal }),
    ]).then(([availability, blocks]) => {
      if (active) setAgenda({ loading: false, occupied: availability.occupied, blocks: blocks.blocks, error: "" });
    }).catch((error) => {
      if (active) setAgenda({ loading: false, occupied: [], blocks: [], error: error.message || "No pudimos consultar la agenda." });
    });
    return () => { active = false; controller.abort(); };
  }, [root, date, refresh]);

  const court = useMemo(() => courts.find((item) => item.id === courtId) || courts[0], [courts, courtId]);
  const validDurations = court?.allowedDurations?.filter((item) => [60, 90, 120, 150].includes(item)) || [];
  const selectedDuration = validDurations.includes(duration) ? duration : validDurations[0];
  const slots = useMemo(() => venueSlots(court, date, selectedDuration, agenda.occupied, agenda.blocks),
    [court, date, selectedDuration, agenda.occupied, agenda.blocks]);
  const selectedSlot = slots.find((item) => item.time === time && item.available);
  const estimate = selectedSlot ? calculateBookingPrice({ date, time, type: "court", durationMinutes: selectedDuration },
    { courtPrice: court.basePrice, nightPrice: court.nightPrice, weekendExtra: court.weekendExtra }) : 0;

  async function confirm() {
    if (!user) { openLogin(); return; }
    if (!apiOnline || !court || !selectedSlot || saving) return;
    setSaving(true);
    setPageError("");
    try {
      await apiRequest(`${root}/join`, { method: "POST" });
      const response = await apiRequest(`${root}/bookings`, { method: "POST", body: JSON.stringify({
        date, time, courtId: court.id, type: "court", durationMinutes: selectedDuration, paymentOption: "cash",
      }) });
      setSaved(response.booking);
      void refreshOrganizations();
    } catch (error) {
      setPageError(error.message || "No pudimos confirmar el turno.");
      if (error.status === 409) setRefresh((value) => value + 1);
    } finally { setSaving(false); }
  }

  if (saved) return <main className="org-page"><section className="org-section venue-success" role="status">
    <span className="org-eyebrow">Reserva recibida</span><h1>Tu turno está solicitado</h1>
    <p>{saved.courtName} · {saved.date.split("-").reverse().join("/")} · {saved.time} a {saved.endTime}</p>
    <p>Importe: <strong>{money(saved.price)}</strong>. Pagás en el club. El estado inicial es pendiente hasta que el club lo confirme.</p>
    <div className="venue-actions"><Link to={`${venuePath}/mis-turnos`}>Ver mis turnos <ArrowRight size={16} /></Link>
      <button type="button" onClick={() => { setSaved(null); setTime(""); setRefresh((value) => value + 1); }}>Reservar otro</button></div>
  </section></main>;

  return <main className="org-page venue-booking-page">
    <header className="org-heading"><Link className="org-back" to={venuePath}><ArrowLeft size={16} /> Volver a la sede</Link>
      <span className="org-eyebrow">Agenda de la sede</span><h1>Reservá tu cancha</h1>
      <p><MapPin size={16} /> {identity ? `${identity.organization.name} · ${identity.venue.name}` : "Consultando la sede"}</p></header>
    {pageError && <div className="venue-error" role="alert">{pageError} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div>}
    <div className="venue-booking-layout">
      <section className="org-section venue-agenda" aria-labelledby="venue-agenda-title">
        <div className="org-section__heading"><div><span className="org-eyebrow">Elegí tu turno</span><h2 id="venue-agenda-title">Disponibilidad</h2></div>
          <button type="button" className="venue-reload" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Actualizar</button></div>
        <div className="venue-filters"><label><span>Fecha</span><input aria-label="Fecha del turno" type="date" min={argentinaDateISO()} max={shiftClubDate(90)} value={date}
          onChange={(event) => setDate(event.target.value)} /></label>
          <label><span>Cancha</span><select aria-label="Cancha" value={court?.id || ""} onChange={(event) => { setCourtId(event.target.value); setTime(""); }}>
            {courts.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label></div>
        {court && <><fieldset className="venue-durations"><legend>Duración</legend><div>{validDurations.map((item) => <button type="button" key={item}
          aria-pressed={selectedDuration === item} className={selectedDuration === item ? "is-selected" : ""}
          onClick={() => { setDuration(item); setTime(""); }}>{durationLabel(item)}</button>)}</div></fieldset>
          <div className="venue-slots-heading"><span><Clock3 size={17} /> Horarios de {court.name}</span><small>Precio final al elegir</small></div>
          {agenda.loading ? <p className="org-empty">Consultando horarios…</p> : agenda.error ? <div className="venue-error" role="alert">{agenda.error}
            <button type="button" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div> :
            <div className="venue-slots">{slots.map((slot) => <button type="button" key={slot.time} disabled={!slot.available}
              aria-pressed={time === slot.time} className={time === slot.time ? "is-selected" : ""} onClick={() => setTime(slot.time)}>
              <strong>{slot.time}–{endTime(slot.time, selectedDuration)}</strong><small>{slot.available ? "Disponible" : "Ocupado"}</small></button>)}</div>}
          {!agenda.loading && !agenda.error && !slots.length && <p className="org-empty">Esta cancha no ofrece esa duración en la fecha elegida.</p>}</>}
        {!court && !pageError && <p className="org-empty">Todavía no hay canchas publicadas en esta sede.</p>}
      </section>
      <aside className="org-section venue-summary"><span className="org-eyebrow">Tu selección</span><h2>Detalle del turno</h2>
        {selectedSlot ? <><p><CalendarDays size={17} /> {date.split("-").reverse().join("/")} · {time}–{endTime(time, selectedDuration)}</p>
          <p>{court.name} · {durationLabel(selectedDuration)}</p><strong className="venue-summary__price">{money(estimate)}</strong>
          <small>Precio estimado. El servidor confirma el importe al reservar.</small>
          <button className="venue-confirm" type="button" disabled={saving || !apiOnline} onClick={confirm}>
            {saving ? "Confirmando…" : user ? "Solicitar turno" : "Ingresar para reservar"} <ArrowRight size={18} /></button>
          <p className="venue-summary__note">Pago en el club. La reserva queda pendiente de confirmación; no se cobra online.</p></>
          : <p className="org-empty">Seleccioná un horario disponible para ver el importe y continuar.</p>}
        {user && <Link className="venue-my-link" to={`${venuePath}/mis-turnos`}>Ver mis turnos</Link>}
      </aside>
    </div>
  </main>;
}
