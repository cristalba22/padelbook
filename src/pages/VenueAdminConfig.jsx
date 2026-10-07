import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import "./organizations.css";
import "./venueAdminConfig.css";

const segment = (value) => encodeURIComponent(String(value || ""));
const durations = [60, 90, 120, 150];
const blankCourt = () => ({ name: "", description: "", tag: "", active: true, sortOrder: 0,
  openingTime: "09:00", closingTime: "22:00", slotIntervalMinutes: 30, allowedDurations: [60, 90],
  basePrice: 0, nightPrice: 0, weekendExtra: 0 });
const courtFields = ["name", "description", "tag", "active", "sortOrder", "openingTime", "closingTime",
  "slotIntervalMinutes", "allowedDurations", "basePrice", "nightPrice", "weekendExtra"];
const settingFields = ["clubName", "address", "openingHours", "whatsapp", "instagram"];

function CourtEditor({ court, onChange, onSave, busy, isNew }) {
  const set = (key, value) => onChange({ ...court, [key]: value });
  return <form className="venue-config-card" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
    <div className="venue-config-card__top"><div><strong>{isNew ? "Nueva cancha" : court.name}</strong>
      <small>{isNew ? "Definí su agenda antes de publicarla" : court.active ? "Visible para jugadores" : "Fuera de la agenda pública"}</small></div>
      {!isNew && <label className="venue-config-switch"><input type="checkbox" checked={court.active} onChange={(event) => set("active", event.target.checked)} /> Activa</label>}</div>
    <div className="venue-config-grid">
      <label>Nombre<input required minLength={2} maxLength={100} value={court.name} onChange={(event) => set("name", event.target.value)} /></label>
      <label>Descripción<input maxLength={160} value={court.description || ""} onChange={(event) => set("description", event.target.value)} /></label>
      <label>Apertura<input required type="time" value={court.openingTime} onChange={(event) => set("openingTime", event.target.value)} /></label>
      <label>Cierre<input required type="time" value={court.closingTime} onChange={(event) => set("closingTime", event.target.value)} /></label>
      <label>Intervalo de inicio<select value={court.slotIntervalMinutes} onChange={(event) => set("slotIntervalMinutes", Number(event.target.value))}><option value={30}>Cada 30 minutos</option><option value={60}>Cada 60 minutos</option></select></label>
      <label>Precio base por hora<input required type="number" min="0" max="100000000" step="1" value={court.basePrice} onChange={(event) => set("basePrice", Number(event.target.value))} /></label>
      <label>Precio nocturno por hora<input required type="number" min="0" max="100000000" step="1" value={court.nightPrice} onChange={(event) => set("nightPrice", Number(event.target.value))} /></label>
      <label>Extra fin de semana<input required type="number" min="0" max="100000000" step="1" value={court.weekendExtra} onChange={(event) => set("weekendExtra", Number(event.target.value))} /></label>
    </div>
    <fieldset className="venue-config-durations"><legend>Duraciones disponibles</legend><div>{durations.map((minutes) => <label key={minutes}><input type="checkbox" checked={court.allowedDurations.includes(minutes)} onChange={(event) => set("allowedDurations", event.target.checked ? [...court.allowedDurations, minutes].sort((a, b) => a - b) : court.allowedDurations.filter((item) => item !== minutes))} /> {minutes === 60 ? "1 h" : minutes === 90 ? "1 h 30" : minutes === 120 ? "2 h" : "2 h 30"}</label>)}</div></fieldset>
    <button className="venue-config-save" disabled={busy || !court.allowedDurations.length} type="submit"><Save size={16} /> {busy ? "Guardando…" : isNew ? "Crear cancha" : "Guardar cancha"}</button>
  </form>;
}

export default function VenueAdminConfig() {
  const { organizationSlug, venueSlug } = useParams();
  const { organizations, loading: permissionsLoading, error: permissionsError } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug);
  const canManage = organization?.role === "admin" && organization.venues.some((item) => item.slug === venueSlug);
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [state, setState] = useState({ loading: true, error: "" });
  const [settings, setSettings] = useState({});
  const [courts, setCourts] = useState([]);
  const [newCourt, setNewCourt] = useState(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    const controller = new AbortController();
    setState({ loading: true, error: "" });
    Promise.all([apiRequest(`${root}/settings`, { signal: controller.signal }),
      apiRequest(`${root}/admin/courts`, { signal: controller.signal })]).then(([settingResponse, courtResponse]) => {
      if (!active) return;
      setSettings(settingResponse.settings);
      setCourts(courtResponse.courts);
      setState({ loading: false, error: "" });
    }).catch((error) => { if (active) setState({ loading: false, error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [root, canManage, reload]);

  async function saveSettings(event) {
    event.preventDefault();
    setBusy("settings"); setNotice("");
    try {
      const body = Object.fromEntries(settingFields.map((key) => [key, settings[key] || ""]));
      const response = await apiRequest(`${root}/admin/settings`, { method: "PUT", body: JSON.stringify(body) });
      setSettings(response.settings); setNotice("Datos de la sede guardados.");
    } catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }

  async function saveCourt(court, isNew) {
    setBusy(isNew ? "new" : court.id); setNotice("");
    try {
      const body = Object.fromEntries(courtFields.map((key) => [key, court[key]]));
      const response = await apiRequest(isNew ? `${root}/admin/courts` : `${root}/admin/courts/${segment(court.id)}`,
        { method: isNew ? "POST" : "PATCH", body: JSON.stringify(body) });
      if (isNew) { setCourts((current) => [...current, response.court]); setNewCourt(null); }
      else setCourts((current) => current.map((item) => item.id === court.id ? response.court : item));
      setNotice(isNew ? "Cancha creada." : "Cancha actualizada. Las reservas existentes conservan su horario original.");
    } catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }

  if (permissionsLoading) return <section className="org-state" role="status"><h1>Verificando acceso</h1></section>;
  if (permissionsError || !canManage) return <section className="org-state"><h1>Sin acceso a esta configuración</h1><p>{permissionsError || "Solo la administración de esta organización puede editar la sede."}</p><Link to="/clubes">Mis clubes</Link></section>;
  return <main className="org-page venue-config-page">
    <header className="org-heading"><Link className="org-back" to={venuePath}><ArrowLeft size={16} /> Volver a la sede</Link>
      <span className="org-eyebrow">Administración · {organization.name}</span><h1>Configurar {organization.venues.find((item) => item.slug === venueSlug)?.name || "sede"}</h1>
      <p>Horarios, precios y datos propios de esta sede.</p></header>
    {state.loading ? <section className="org-state" role="status"><h2>Cargando configuración</h2></section>
      : state.error ? <section className="org-state" role="alert"><h2>No pudimos cargar la configuración</h2><p>{state.error}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button></section>
        : <>
          {notice && <p className="venue-config-notice" role="status">{notice}</p>}
          <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Identidad</span><h2>Datos de la sede</h2></div></div>
            <form onSubmit={saveSettings}><div className="venue-config-grid">
              <label>Nombre público<input required minLength={2} maxLength={120} value={settings.clubName || ""} onChange={(event) => setSettings({ ...settings, clubName: event.target.value })} /></label>
              <label>Dirección<input maxLength={200} value={settings.address || ""} onChange={(event) => setSettings({ ...settings, address: event.target.value })} /></label>
              <label>Horario visible<input maxLength={100} placeholder="Lunes a domingo, 9 a 22 h" value={settings.openingHours || ""} onChange={(event) => setSettings({ ...settings, openingHours: event.target.value })} /></label>
              <label>WhatsApp<input maxLength={40} inputMode="tel" value={settings.whatsapp || ""} onChange={(event) => setSettings({ ...settings, whatsapp: event.target.value })} /></label>
              <label>Instagram<input maxLength={80} value={settings.instagram || ""} onChange={(event) => setSettings({ ...settings, instagram: event.target.value })} /></label>
            </div><button className="venue-config-save" type="submit" disabled={Boolean(busy)}><Save size={16} /> {busy === "settings" ? "Guardando…" : "Guardar datos"}</button></form></section>
          <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Agenda</span><h2>Canchas</h2></div><button className="venue-config-add" type="button" onClick={() => setNewCourt(blankCourt())} disabled={Boolean(newCourt)}><Plus size={17} /> Agregar cancha</button></div>
            <p className="venue-config-help">Los cambios de horario o estado afectan a nuevas reservas. Revisá los turnos existentes antes de cerrar una cancha.</p>
            <div className="venue-config-courts">{courts.map((court) => <CourtEditor key={court.id} court={court} busy={Boolean(busy)} onChange={(next) => setCourts((current) => current.map((item) => item.id === court.id ? next : item))} onSave={() => saveCourt(court, false)} />)}
              {newCourt && <CourtEditor court={newCourt} isNew busy={Boolean(busy)} onChange={setNewCourt} onSave={() => saveCourt(newCourt, true)} />}</div>
            {!courts.length && !newCourt && <p className="org-empty">Esta sede todavía no tiene canchas. Agregá la primera para abrir la agenda.</p>}
          </section>
        </>}
  </main>;
}
