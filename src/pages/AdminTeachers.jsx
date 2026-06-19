// src/pages/AdminTeachers.jsx
import React, { useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { loadTeachers, saveTeachers } from "../utils/teachersStorage.js";

const agenda = [
  { hour: "09:00", teacher: "Lucio", type: "Clase grupal", status: "confirmada" },
  { hour: "10:30", teacher: "Eze", type: "Técnica inicial", status: "pendiente" },
  { hour: "18:00", teacher: "Laura", type: "Entrenamiento", status: "confirmada" },
];

export default function AdminTeachers() {
  const { prices } = usePricing();
  const [teachers, setTeachers] = useState(() => loadTeachers(prices.classPrice));
  const [search, setSearch] = useState("");
  const [saved, setSaved] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((t) => [t.name, t.nickname, t.specialty, t.status].some((v) => String(v).toLowerCase().includes(q)));
  }, [teachers, search]);

  const stats = useMemo(() => ({
    active: teachers.filter((t) => t.status === "activo").length,
    vacation: teachers.filter((t) => t.status === "vacaciones").length,
    classes: teachers.reduce((acc, t) => acc + Number(t.todayClasses || 0), 0),
    revenue: teachers.reduce((acc, t) => acc + Number(t.todayClasses || 0) * Number(t.price || 0), 0),
  }), [teachers]);

  function updateTeacher(id, patch) { setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t))); }
  function save() { saveTeachers(teachers); setSaved(true); setTimeout(() => setSaved(false), 2500); }

  return (
    <AdminLayout title="Staff y clases" subtitle="Los precios y estados guardados se reflejan en las clases visibles para jugadores.">
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-6 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div><p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Operación de profes</p><h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Clases, precios y disponibilidad</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Gestioná quién puede dar clases hoy, cuánto cobra y qué disponibilidad se muestra en la experiencia del jugador.</p></div>
            <button onClick={save} className="btn-primary px-6 py-3">Guardar staff</button>
          </div>
          {saved && <p className="mt-3 text-sm font-bold text-lime-100">Cambios guardados ✓</p>}
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Activos" value={stats.active} /><Kpi label="Vacaciones" value={stats.vacation} warn /><Kpi label="Clases hoy" value={stats.classes} /><Kpi label="Caja clases" value={money(stats.revenue)} /></div>
        </div>
        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Agenda rápida</p><div className="mt-4 space-y-2">{agenda.map((a) => <div key={`${a.hour}-${a.teacher}`} className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex justify-between"><strong>{a.hour}</strong><span className="text-xs text-lime-100">{a.status}</span></div><p className="text-sm text-slate-300">{a.teacher} · {a.type}</p></div>)}</div></aside>
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-slate-400">Buscá por nombre, especialidad o estado.</p><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar profesor..." className="field max-w-sm" /></div>
      <section className="grid gap-4 lg:grid-cols-2">
        {filtered.map((teacher) => <TeacherCard key={teacher.id} teacher={teacher} onUpdate={updateTeacher} />)}
      </section>
    </AdminLayout>
  );
}

function TeacherCard({ teacher, onUpdate }) {
  const vacation = teacher.status === "vacaciones";
  return <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-5 shadow-xl transition hover:border-lime-300/30"><div className="flex items-start justify-between gap-3"><div className="flex gap-3"><div className={`grid h-12 w-12 place-items-center rounded-2xl font-black text-black ${vacation ? "bg-amber-300" : "bg-lime-300"}`}>{teacher.nickname?.slice(0,2).toUpperCase()}</div><div><h3 className="text-xl font-black text-white">{teacher.name}</h3><p className="text-sm text-slate-400">{teacher.specialty}</p></div></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${vacation ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"}`}>{teacher.status}</span></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Clases hoy" value={teacher.todayClasses} /><Mini label="Precio" value={money(teacher.price)} /><Mini label="Estado" value={teacher.status} /></div><div className="mt-5 grid gap-3 sm:grid-cols-[1fr_150px]"><label className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><span className="text-xs uppercase tracking-wide text-slate-500">Precio clase</span><input value={teacher.price} onChange={(e) => onUpdate(teacher.id, { price: e.target.value.replace(/\D/g, "") })} className="mt-1 w-full bg-transparent font-black text-white outline-none" /></label><select value={teacher.status} onChange={(e) => onUpdate(teacher.id, { status: e.target.value })} className="field"><option value="activo">Activo</option><option value="vacaciones">Vacaciones</option><option value="baja">De baja</option></select></div></article>;
}
function Kpi({ label, value, warn }) { return <div className={`rounded-3xl border p-4 ${warn ? "border-amber-300/25 bg-amber-300/10" : "border-white/10 bg-black/30"}`}><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>; }
function Mini({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>; }
function money(value) { return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }); }
