// src/pages/AdminConfig.jsx
import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { useAuth } from "../hooks/useAuth.jsx";
import { useCourtConfig } from "../context/CourtConfigContext.jsx";

const DURATIONS = [60, 90, 120, 150];
const EMPTY_COURT = { name: "", description: "", tag: "", active: true, sortOrder: 0, openingTime: "09:00", closingTime: "22:00", slotIntervalMinutes: 30, allowedDurations: [60, 90], basePrice: 18000, nightPrice: 24000, weekendExtra: 3000 };

const CONFIG_FIELDS = [
  { key: "classPrice", title: "Clase con profesor", help: "Monto base de clase individual o grupal." },
  { key: "teacherCommissionPercent", title: "Comisión profesor", help: "Porcentaje que se liquida al profesor por cada clase." },
  { key: "tournamentPrice", title: "Inscripción torneo", help: "Precio por jugador." },
];

function money(value) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`;
}

export default function AdminConfig() {
  const { prices, updatePrices } = usePricing();
  const { settings, updateSettings } = useClubSettings();
  const { apiOnline } = useAuth();
  const { allCourts, refresh: refreshCourts } = useCourtConfig();
  const [form, setForm] = useState(prices);
  const [clubForm, setClubForm] = useState(settings);
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [courtForms, setCourtForms] = useState([]);
  const [newCourt, setNewCourt] = useState(EMPTY_COURT);
  const [courtMessage, setCourtMessage] = useState("");

  useEffect(() => setForm(prices), [prices]);
  useEffect(() => setClubForm(settings), [settings]);
  useEffect(() => { refreshCourts({ admin: true }); }, [refreshCourts]);
  useEffect(() => setCourtForms(allCourts.map((court) => ({ ...court }))), [allCourts]);

  const preview = useMemo(() => {
    const firstCourt = allCourts.find((court) => court.active !== false);
    return [
      { label: "Cancha base", value: money(firstCourt?.basePrice) },
      { label: "Noche finde", value: money(Number(firstCourt?.nightPrice || 0) + Number(firstCourt?.weekendExtra || 0)) },
      { label: "Clase", value: money(form.classPrice) },
    ];
  }, [form, allCourts]);

  function handleChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value.replace(/\D/g, "") }));
  }

  function handleClubChange(key, value) {
    setClubForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setIsSaving(true);
    setSaveError("");
    try {
      const { pricingVersion, ...numericFields } = form;
      const payload = { ...clubForm, ...numericFields };
      const savedSettings = apiOnline ? (await apiRequest("/settings", { method: "PUT", body: JSON.stringify(payload) })).settings : payload;
      updatePrices(savedSettings || form);
      updateSettings(savedSettings || clubForm);
      setSavedAt(new Date());
      setTimeout(() => setSavedAt(null), 3000);
    } catch (cause) {
      setSaveError(cause.message || "No se pudo guardar la configuración. Reintentá.");
    } finally {
      setIsSaving(false);
    }
  }

  function editCourt(id, key, value) {
    setCourtForms((current) => current.map((court) => court.id === id ? { ...court, [key]: value } : court));
  }

  function toggleDuration(court, setCourt, minutes) {
    const current = court.allowedDurations || [];
    const next = current.includes(minutes) ? current.filter((item) => item !== minutes) : [...current, minutes].sort((a, b) => a - b);
    if (next.length) setCourt({ ...court, allowedDurations: next });
  }

  async function saveCourt(court) {
    setCourtMessage("");
    try {
      const payload = { ...court, basePrice: Number(court.basePrice), nightPrice: Number(court.nightPrice), weekendExtra: Number(court.weekendExtra), sortOrder: Number(court.sortOrder), slotIntervalMinutes: Number(court.slotIntervalMinutes), hours: undefined, id: undefined };
      await apiRequest(`/admin/courts/${court.id}`, { method: "PATCH", body: JSON.stringify(payload) });
      await refreshCourts({ admin: true });
      setCourtMessage(`${court.name} actualizada.`);
    } catch (cause) { setCourtMessage(cause.message || "No se pudo guardar la cancha."); }
  }

  async function createCourt() {
    setCourtMessage("");
    try {
      await apiRequest("/admin/courts", { method: "POST", body: JSON.stringify({ ...newCourt, sortOrder: allCourts.length }) });
      setNewCourt({ ...EMPTY_COURT, sortOrder: allCourts.length + 1 });
      await refreshCourts({ admin: true });
      setCourtMessage("Cancha creada y publicada.");
    } catch (cause) { setCourtMessage(cause.message || "No se pudo crear la cancha."); }
  }

  return (
    <AdminLayout title="Ajustes del club" subtitle="Administrá las canchas, los precios y la información que ven los jugadores.">
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="admin-panel rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-6 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Precios activos</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Precios del club</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Estos importes se usan en las reservas, clases y torneos que publicás.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handleSave} disabled={isSaving} className="btn-primary px-6 py-3">{isSaving ? "Guardando..." : "Guardar cambios"}</button>
            <button onClick={() => setForm(prices)} className="btn-outline px-6 py-3">Deshacer edición</button>
            {savedAt && <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-xs font-bold text-lime-100">Cambios guardados ✓</span>}
            {saveError && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">{saveError}</span>}
          </div>
        </div>
        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Resumen de precios</p>
          <div className="mt-4 space-y-3">{preview.map((p) => <div key={p.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><span className="text-sm text-slate-300">{p.label}</span><strong className="text-white">{p.value}</strong></div>)}</div>
        </aside>
      </section>

      <section className="admin-panel mb-6 rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-6 shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Datos visibles del club</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Información comercial y portada</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Completá solo los datos reales del club. Se mostrarán en la portada, el pie de página y los enlaces de contacto.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TextField label="Nombre del club" value={clubForm.clubName} onChange={(v) => handleClubChange("clubName", v)} />
          <TextField label="Nombre corto" value={clubForm.clubShortName} onChange={(v) => handleClubChange("clubShortName", v)} />
          <TextField label="Dirección" value={clubForm.address} onChange={(v) => handleClubChange("address", v)} />
          <TextField label="WhatsApp" value={clubForm.whatsapp} onChange={(v) => handleClubChange("whatsapp", v.replace(/\D/g, ""))} />
          <TextField label="Horario de atención (texto informativo)" value={clubForm.openingHours} onChange={(v) => handleClubChange("openingHours", v)} />
          <TextField label="Estado del club" value={clubForm.clubStatus} onChange={(v) => handleClubChange("clubStatus", v)} />
          <label className="md:col-span-2"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Título del home</span><input value={clubForm.homeHeadline || ""} onChange={(e) => handleClubChange("homeHeadline", e.target.value)} className="field" /></label>
          <label className="md:col-span-2"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Texto principal del home</span><textarea value={clubForm.homeSubtitle || ""} onChange={(e) => handleClubChange("homeSubtitle", e.target.value)} rows={3} className="field resize-none" /></label>
          <TextField label="Promoción destacada" value={clubForm.promoText} onChange={(v) => handleClubChange("promoText", v)} />
          <TextField label="Búsqueda para mapa" value={clubForm.mapsQuery} onChange={(v) => handleClubChange("mapsQuery", v)} />
        </div>
      </section>

      <section className="admin-panel mb-6 rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-6 shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Agenda configurable</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div><h2 className="text-3xl font-black tracking-[-0.04em] text-white">Canchas, horarios y tarifas</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Cada cancha define su apertura, cierre, salidas, duraciones y precio. Los cambios impactan en Reservar, Calendario y recepción.</p></div>
          {courtMessage && <p role="status" className="rounded-2xl border border-lime-300/20 bg-lime-300/10 px-4 py-2 text-sm text-lime-100">{courtMessage}</p>}
        </div>
        <div className="mt-6 space-y-4">
          {courtForms.map((court) => <CourtEditor key={court.id} court={court} onChange={(key, value) => editCourt(court.id, key, value)} onToggleDuration={(minutes) => toggleDuration(court, (next) => setCourtForms((current) => current.map((item) => item.id === court.id ? next : item)), minutes)} onSave={() => saveCourt(court)} />)}
        </div>
        <div className="mt-6 rounded-[1.5rem] border border-dashed border-lime-300/30 bg-black/20 p-5">
          <h3 className="text-lg font-black text-white">Agregar cancha</h3>
          <div className="mt-4"><CourtEditor court={newCourt} isNew onChange={(key, value) => setNewCourt((current) => ({ ...current, [key]: value }))} onToggleDuration={(minutes) => toggleDuration(newCourt, setNewCourt, minutes)} onSave={createCourt} /></div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CONFIG_FIELDS.map((field) => <ConfigCard key={field.key} field={field} value={form[field.key]} onChange={(value) => handleChange(field.key, value)} />)}
      </section>
    </AdminLayout>
  );
}

function CourtEditor({ court, onChange, onToggleDuration, onSave, isNew = false }) {
  return <article className="rounded-[1.5rem] border border-white/10 bg-black/25 p-4">
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <TextField label="Nombre" value={court.name} onChange={(value) => onChange("name", value)} />
      <TextField label="Descripción" value={court.description} onChange={(value) => onChange("description", value)} />
      <label><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Abre</span><input type="time" value={court.openingTime} onChange={(e) => onChange("openingTime", e.target.value)} className="field" /></label>
      <label><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Cierra</span><input type="time" value={court.closingTime} onChange={(e) => onChange("closingTime", e.target.value)} className="field" /></label>
      <NumberField label="Precio base" value={court.basePrice} onChange={(value) => onChange("basePrice", value)} />
      <NumberField label="Precio nocturno" value={court.nightPrice} onChange={(value) => onChange("nightPrice", value)} />
      <NumberField label="Extra fin de semana" value={court.weekendExtra} onChange={(value) => onChange("weekendExtra", value)} />
      <label><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Salidas cada</span><select value={court.slotIntervalMinutes} onChange={(e) => onChange("slotIntervalMinutes", Number(e.target.value))} className="field"><option value={30}>30 minutos</option><option value={60}>60 minutos</option></select></label>
    </div>
    <div className="mt-4 flex flex-wrap items-center gap-2"><span className="mr-2 text-xs font-bold text-slate-400">Duraciones:</span>{DURATIONS.map((minutes) => <button type="button" key={minutes} onClick={() => onToggleDuration(minutes)} className={`rounded-full border px-3 py-1.5 text-xs font-bold ${court.allowedDurations?.includes(minutes) ? "border-lime-300/50 bg-lime-300/15 text-lime-100" : "border-white/10 text-slate-400"}`}>{minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}${minutes % 60 ? ":30" : " h"}`}</button>)}</div>
    <div className="mt-4 flex flex-wrap items-center gap-3">{!isNew && <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={court.active !== false} onChange={(e) => onChange("active", e.target.checked)} /> Cancha activa</label>}<button type="button" onClick={onSave} disabled={!court.name || !court.allowedDurations?.length} className="btn-primary px-5 py-2">{isNew ? "Crear cancha" : "Guardar cancha"}</button></div>
  </article>;
}

function NumberField({ label, value, onChange }) {
  return <label><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</span><input type="number" min="0" value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} className="field" /></label>;
}

function ConfigCard({ field, value, onChange }) {
  const isPercent = field.key === "teacherCommissionPercent";
  return <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-5 shadow-xl transition hover:border-lime-300/30"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-white">{field.title}</h3><p className="mt-1 text-sm text-slate-400">{field.help}</p></div><span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2.5 py-1 text-[11px] font-bold text-lime-100">{isPercent ? "%" : "ARS"}</span></div><label className="mt-5 flex items-center gap-3 rounded-2xl border border-lime-300/20 bg-black/40 px-4 py-3"><span className="text-slate-500">{isPercent ? "%" : "$"}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} inputMode="numeric" className="w-full bg-transparent text-xl font-black text-white outline-none" /></label><p className="mt-3 text-xs text-slate-500">Actual: {isPercent ? `${Number(value || 0)}%` : money(value)}</p></article>;
}

function TextField({ label, value, onChange }) {
  return <label><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} className="field" /></label>;
}
