// src/pages/AdminConfig.jsx
import React, { useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { apiRequest } from "../utils/apiClient.js";

const CONFIG_FIELDS = [
  { key: "courtPrice", title: "Turno base", help: "Precio estándar de cancha." },
  { key: "nightPrice", title: "Horario nocturno", help: "Valor aplicado desde las 19:00." },
  { key: "classPrice", title: "Clase con profesor", help: "Monto base de clase individual o grupal." },
  { key: "teacherCommissionPercent", title: "Comisión profesor", help: "Porcentaje que se liquida al profesor por cada clase." },
  { key: "tournamentPrice", title: "Inscripción torneo", help: "Precio por jugador." },
  { key: "weekendExtra", title: "Extra fin de semana", help: "Adicional sábado y domingo." },
];

function money(value) {
  return `$${Number(value || 0).toLocaleString("es-AR")}`;
}

export default function AdminConfig() {
  const { prices, updatePrices } = usePricing();
  const { settings, updateSettings } = useClubSettings();
  const [form, setForm] = useState(prices);
  const [clubForm, setClubForm] = useState(settings);
  const [savedAt, setSavedAt] = useState(null);
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => setForm(prices), [prices]);
  useEffect(() => setClubForm(settings), [settings]);

  const preview = useMemo(() => {
    const prime = Number(form.nightPrice || form.courtPrice || 0) + Number(form.weekendExtra || 0);
    return [
      { label: "Cancha tarde", value: money(form.courtPrice) },
      { label: "Noche finde", value: money(prime) },
      { label: "Clase", value: money(form.classPrice) },
    ];
  }, [form]);

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
      const payload = { ...clubForm, ...form };
      const { settings: savedSettings } = await apiRequest("/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      updatePrices(savedSettings || form);
      updateSettings(savedSettings || clubForm);
      setSavedAt(new Date());
      setTimeout(() => setSavedAt(null), 3000);
    } catch {
      updatePrices(form);
      updateSettings(clubForm);
      setSaveError("No se pudo guardar en MongoDB. Quedó guardado localmente en este navegador.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AdminLayout title="Configuración comercial" subtitle="Todo lo que cargues acá se refleja en la web pública, reservas, torneos, comunidad y footer.">
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-6 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Precios activos</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Valores del sistema</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Estos valores se reflejan automáticamente en reservas, clases, torneos y la vista pública del club.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={handleSave} disabled={isSaving} className="btn-primary px-6 py-3">{isSaving ? "Guardando..." : "Guardar cambios"}</button>
            <button onClick={() => setForm(prices)} className="btn-outline px-6 py-3">Deshacer edición</button>
            {savedAt && <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-xs font-bold text-lime-100">Cambios guardados ✓</span>}
            {saveError && <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-bold text-amber-100">{saveError}</span>}
          </div>
        </div>
        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Preview para venta</p>
          <div className="mt-4 space-y-3">{preview.map((p) => <div key={p.label} className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><span className="text-sm text-slate-300">{p.label}</span><strong className="text-white">{p.value}</strong></div>)}</div>
        </aside>
      </section>

      <section className="mb-6 rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-6 shadow-xl">
        <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Datos visibles del club</p>
        <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Información comercial y portada</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Nombre, dirección, WhatsApp y textos principales se muestran en el home, footer, comunidad y acciones de contacto.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <TextField label="Nombre del club" value={clubForm.clubName} onChange={(v) => handleClubChange("clubName", v)} />
          <TextField label="Nombre corto" value={clubForm.clubShortName} onChange={(v) => handleClubChange("clubShortName", v)} />
          <TextField label="Dirección" value={clubForm.address} onChange={(v) => handleClubChange("address", v)} />
          <TextField label="WhatsApp" value={clubForm.whatsapp} onChange={(v) => handleClubChange("whatsapp", v.replace(/\D/g, ""))} />
          <TextField label="Horario de atención" value={clubForm.openingHours} onChange={(v) => handleClubChange("openingHours", v)} />
          <TextField label="Estado del club" value={clubForm.clubStatus} onChange={(v) => handleClubChange("clubStatus", v)} />
          <label className="md:col-span-2"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Título del home</span><input value={clubForm.homeHeadline || ""} onChange={(e) => handleClubChange("homeHeadline", e.target.value)} className="field" /></label>
          <label className="md:col-span-2"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Texto principal del home</span><textarea value={clubForm.homeSubtitle || ""} onChange={(e) => handleClubChange("homeSubtitle", e.target.value)} rows={3} className="field resize-none" /></label>
          <TextField label="Promoción destacada" value={clubForm.promoText} onChange={(v) => handleClubChange("promoText", v)} />
          <TextField label="Búsqueda para mapa" value={clubForm.mapsQuery} onChange={(v) => handleClubChange("mapsQuery", v)} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {CONFIG_FIELDS.map((field) => <ConfigCard key={field.key} field={field} value={form[field.key]} onChange={(value) => handleChange(field.key, value)} />)}
      </section>
    </AdminLayout>
  );
}

function ConfigCard({ field, value, onChange }) {
  const isPercent = field.key === "teacherCommissionPercent";
  return <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-5 shadow-xl transition hover:border-lime-300/30"><div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-black text-white">{field.title}</h3><p className="mt-1 text-sm text-slate-400">{field.help}</p></div><span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-2.5 py-1 text-[11px] font-bold text-lime-100">{isPercent ? "%" : "ARS"}</span></div><label className="mt-5 flex items-center gap-3 rounded-2xl border border-lime-300/20 bg-black/40 px-4 py-3"><span className="text-slate-500">{isPercent ? "%" : "$"}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} inputMode="numeric" className="w-full bg-transparent text-xl font-black text-white outline-none" /></label><p className="mt-3 text-xs text-slate-500">Actual: {isPercent ? `${Number(value || 0)}%` : money(value)}</p></article>;
}

function TextField({ label, value, onChange }) {
  return <label><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</span><input value={value || ""} onChange={(e) => onChange(e.target.value)} className="field" /></label>;
}
