// src/pages/AdminTournaments.jsx
import React, { useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { loadTournaments, saveTournaments, updateTournamentRegistration } from "../utils/tournamentsStorage.js";
import { cleanPhone } from "../utils/whatsapp.js";

function money(value) { return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }); }
function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }
function activeRegs(t) { return (t.registrations || []).filter((r) => !["cancelado", "rechazado"].includes(r.status)); }
function pendingRegs(tournaments) { return tournaments.flatMap((t) => (t.registrations || []).filter((r) => r.status === "pendiente").map((r) => ({ ...r, tournamentName: t.name, tournamentId: t.id, tournamentDate: t.date }))); }

export default function AdminTournaments() {
  const { prices } = usePricing();
  const [tournaments, setTournaments] = useState(() => loadTournaments(prices.tournamentPrice));
  const [status, setStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [quickName, setQuickName] = useState("Relámpago viernes noche");
  const [quickDate, setQuickDate] = useState("");
  const [quickHour, setQuickHour] = useState("20:00");
  const [quickCategory, setQuickCategory] = useState("Mixto · libre");

  const filtered = useMemo(() => tournaments.filter((t) => {
    if (status !== "todos" && t.status !== status) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [t.name, t.category, t.surface, t.status].some((v) => String(v).toLowerCase().includes(q));
  }), [tournaments, status, search]);

  const pending = useMemo(() => pendingRegs(tournaments), [tournaments]);
  const stats = useMemo(() => ({
    open: tournaments.filter((t) => t.status === "abierto").length,
    pending: pending.length,
    players: tournaments.reduce((acc, t) => acc + Number(t.currentPlayers || 0), 0),
    revenue: tournaments.reduce((acc, t) => acc + activeRegs(t).length * Number(t.pricePerPlayer || 0), 0),
  }), [tournaments, pending.length]);

  function persist(next) {
    const saved = saveTournaments(next, prices.tournamentPrice);
    setTournaments(saved);
  }

  function createTournament() {
    if (!quickName || !quickDate) return;
    persist([{ id: Date.now(), name: quickName, date: quickDate, hour: quickHour, status: "abierto", category: quickCategory, surface: "Mixta", pricePerPlayer: prices.tournamentPrice || 25000, seededPlayers: 0, currentPlayers: 0, maxPlayers: 16, prize: "Premio del club", registrations: [], description: "Torneo relámpago con cupos limitados." }, ...tournaments]);
    setQuickName("Relámpago viernes noche"); setQuickDate(""); setQuickHour("20:00");
  }
  function update(id, patch) { persist(tournaments.map((t) => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)); }
  function updateReg(tournamentId, registrationId, patch) { updateTournamentRegistration(tournamentId, registrationId, patch, prices.tournamentPrice); setTournaments(loadTournaments(prices.tournamentPrice)); }
  function removeTournament(id) { persist(tournaments.filter((t) => t.id !== id)); }

  return (
    <AdminLayout title="Torneos del club" subtitle="Gestioná eventos, cupos e inscripciones desde un solo lugar.">
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-6 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Calendario competitivo</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Eventos, cupos y jugadores</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Los jugadores pueden inscribirse desde la web pública. Acá confirmás cupos, controlás pagos y actualizás el estado del torneo.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Kpi label="Abiertos" value={stats.open} /><Kpi label="Pendientes" value={stats.pending} /><Kpi label="Jugadores" value={stats.players} /><Kpi label="Caja inscriptos" value={money(stats.revenue)} /></div>
        </div>
        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Crear torneo</p>
          <input value={quickName} onChange={(e) => setQuickName(e.target.value)} className="field mt-4" placeholder="Nombre" />
          <div className="mt-3 grid grid-cols-2 gap-2"><input type="date" value={quickDate} onChange={(e) => setQuickDate(e.target.value)} className="field" /><input type="time" value={quickHour} onChange={(e) => setQuickHour(e.target.value)} className="field" /></div>
          <select value={quickCategory} onChange={(e) => setQuickCategory(e.target.value)} className="field mt-3"><option>Mixto · libre</option><option>Mixto · hasta 7ma</option><option>Caballeros · 5ta/6ta</option><option>Damas · libre</option></select>
          <button onClick={createTournament} className="btn-primary mt-4 w-full justify-center">Crear torneo</button>
        </aside>
      </section>

      {pending.length > 0 && <section className="mb-6 rounded-[2rem] border border-amber-300/20 bg-amber-300/10 p-5"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-100">Inscripciones pendientes</p><div className="mt-4 grid gap-3 lg:grid-cols-2">{pending.slice(0, 4).map((r) => <PendingRow key={r.id} reg={r} onConfirm={() => updateReg(r.tournamentId, r.id, { status: "confirmado", paymentStatus: "pagado" })} onCancel={() => updateReg(r.tournamentId, r.id, { status: "cancelado" })} />)}</div></section>}

      <section className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-2"><select value={status} onChange={(e) => setStatus(e.target.value)} className="field"><option value="todos">Todos</option><option value="abierto">Abiertos</option><option value="lleno">Llenos</option><option value="en_curso">En curso</option><option value="finalizado">Finalizados</option><option value="cancelado">Cancelados</option></select></div><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar torneo..." className="field max-w-sm" /></section>
      <section className="grid gap-4 lg:grid-cols-2">
        {filtered.map((t) => <TournamentCard key={t.id} tournament={t} onUpdate={update} onUpdateReg={updateReg} onRemove={removeTournament} />)}
      </section>
    </AdminLayout>
  );
}

function PendingRow({ reg, onConfirm, onCancel }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">{reg.name}</p><p className="text-xs text-slate-400">{reg.tournamentName} · {reg.tournamentDate}</p><p className="mt-1 text-xs text-lime-100">{reg.category}</p></div><div className="flex gap-2"><button onClick={onConfirm} className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-black">Confirmar</button><button onClick={onCancel} className="rounded-full border border-white/15 px-3 py-1 text-xs font-bold text-white">Cancelar</button></div></div></div>;
}

function TournamentCard({ tournament, onUpdate, onUpdateReg, onRemove }) {
  const progress = pct(tournament.currentPlayers, tournament.maxPlayers);
  const regs = tournament.registrations || [];
  return <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-5 shadow-xl transition hover:border-lime-300/30">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0 flex-1"><input value={tournament.name} onChange={(e) => onUpdate(tournament.id, { name: e.target.value })} className="w-full bg-transparent text-2xl font-black text-white outline-none" /><p className="mt-1 text-sm text-slate-400">{tournament.category} · {tournament.surface}</p></div><select value={tournament.status} onChange={(e) => onUpdate(tournament.id, { status: e.target.value })} className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white"><option value="abierto">Abierto</option><option value="lleno">Lleno</option><option value="en_curso">En curso</option><option value="finalizado">Finalizado</option><option value="cancelado">Cancelado</option></select></div>
    <div className="mt-4 grid gap-3 sm:grid-cols-3"><label className="mini-field"><span>Fecha</span><input type="date" value={tournament.date} onChange={(e) => onUpdate(tournament.id, { date: e.target.value })} /></label><label className="mini-field"><span>Hora</span><input type="time" value={tournament.hour || "20:00"} onChange={(e) => onUpdate(tournament.id, { hour: e.target.value })} /></label><label className="mini-field"><span>Cupos</span><input value={tournament.maxPlayers} onChange={(e) => onUpdate(tournament.id, { maxPlayers: Number(e.target.value.replace(/\D/g, "")) })} /></label></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Inscriptos" value={`${tournament.currentPlayers}/${tournament.maxPlayers}`} /><Mini label="Precio" value={money(tournament.pricePerPlayer)} /><Mini label="Caja" value={money(activeRegs(tournament).length * tournament.pricePerPlayer)} /></div>
    <div className="mt-5"><div className="flex justify-between text-xs text-slate-500"><span>Cupos ocupados</span><span>{progress}%</span></div><div className="mt-2 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${progress}%` }} /></div></div>
    <div className="mt-5 grid gap-3 sm:grid-cols-3"><label className="mini-field"><span>Jugadores base</span><input value={tournament.seededPlayers} onChange={(e) => onUpdate(tournament.id, { seededPlayers: Number(e.target.value.replace(/\D/g, "")) })} /></label><label className="mini-field"><span>Precio</span><input value={tournament.pricePerPlayer} onChange={(e) => onUpdate(tournament.id, { pricePerPlayer: Number(e.target.value.replace(/\D/g, "")) })} /></label><label className="mini-field"><span>Categoría</span><input value={tournament.category} onChange={(e) => onUpdate(tournament.id, { category: e.target.value })} /></label></div>
    <div className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4"><p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Inscriptos web</p>{regs.length ? <div className="mt-3 space-y-2">{regs.map((r) => <RegistrationRow key={r.id} tournament={tournament} reg={r} onUpdateReg={onUpdateReg} />)}</div> : <p className="mt-3 text-sm text-slate-500">Todavía no hay inscripciones web.</p>}</div>
    <button onClick={() => onRemove(tournament.id)} className="mt-4 text-xs font-bold text-red-200 hover:text-red-100">Eliminar torneo</button>
  </article>;
}

function RegistrationRow({ tournament, reg, onUpdateReg }) {
  const wa = reg.phone ? `https://wa.me/${cleanPhone(reg.phone)}?text=${encodeURIComponent(`Hola ${reg.name}, te escribimos por tu inscripción al torneo ${tournament.name}.`)}` : null;
  return <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-white">{reg.name}</p><p className="text-xs text-slate-400">{reg.email || reg.phone || "Sin contacto"} · {reg.category}</p>{reg.partnerName && <p className="text-xs text-lime-100">Pareja: {reg.partnerName}</p>}</div><div className="flex flex-wrap gap-2"><select value={reg.status} onChange={(e) => onUpdateReg(tournament.id, reg.id, { status: e.target.value })} className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white"><option value="pendiente">Pendiente</option><option value="confirmado">Confirmado</option><option value="cancelado">Cancelado</option></select><select value={reg.paymentStatus} onChange={(e) => onUpdateReg(tournament.id, reg.id, { paymentStatus: e.target.value })} className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white"><option value="pendiente">Pago pendiente</option><option value="pagado">Pagado</option><option value="sin_cargo">Sin cargo</option></select>{wa && <a className="rounded-full border border-lime-300/30 px-3 py-2 text-xs font-bold text-lime-100" href={wa} target="_blank" rel="noreferrer">WhatsApp</a>}</div></div></div>;
}
function Kpi({ label, value }) { return <div className="rounded-3xl border border-white/10 bg-black/30 p-4"><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p></div>; }
function Mini({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>; }
