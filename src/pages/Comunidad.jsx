// src/pages/Comunidad.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";

const GROUPS = [
  { id: "7ma", label: "7ma categoría", level: "Intermedio", players: 42, next: "Hoy 19:00", vibe: "Partidos amistosos y ritmo tranquilo" },
  { id: "6ta", label: "6ta categoría", level: "Intermedio alto", players: 36, next: "Hoy 20:00", vibe: "Buen ritmo, ideal para relámpagos" },
  { id: "5ta", label: "5ta categoría", level: "Avanzado", players: 28, next: "Mañana 18:00", vibe: "Competitivo, ranking y torneos" },
  { id: "4ta", label: "4ta categoría", level: "Pre competitivo", players: 19, next: "Viernes 21:00", vibe: "Partidos fuertes y técnicos" },
  { id: "3ra", label: "3ra categoría", level: "Alto", players: 14, next: "Sábado 17:00", vibe: "Jugadores de circuito" },
  { id: "2da", label: "2da categoría", level: "Élite", players: 8, next: "A coordinar", vibe: "Nivel exhibición" },
];

export default function Comunidad() {
  const { settings } = useClubSettings();
  const [filter, setFilter] = useState("todas");
  const visible = useMemo(() => filter === "todas" ? GROUPS : GROUPS.filter((g) => g.id === filter), [filter]);
  const totalPlayers = GROUPS.reduce((acc, g) => acc + g.players, 0);

  return (
    <main className="main-container max-w-7xl text-white">
      <section className="relative mb-7 overflow-hidden rounded-[2.4rem] border border-lime-300/20 bg-[#050814] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.9)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(190,242,100,0.22),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(45,212,191,0.14),transparent_34%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_360px]">
          <div><p className="section-eyebrow">Comunidad del club</p><h1 className="mt-3 text-4xl font-black tracking-[-0.06em] md:text-6xl">Nunca más te quedes sin pareja.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Entrá al grupo de tu categoría, encontrá jugadores con tu nivel, armá partido y reservá cancha desde el mismo flujo.</p><div className="mt-6 flex flex-wrap gap-3"><Link to={ROUTES.BOOKING} className="btn-primary">Reservar cancha</Link><Link to={ROUTES.TOURNAMENTS} className="btn-outline">Ver torneos</Link></div></div>
          <aside className="rounded-[2rem] border border-white/10 bg-black/35 p-5"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Red activa</p><p className="mt-2 text-5xl font-black text-lime-100">{totalPlayers}</p><p className="text-sm text-slate-400">jugadores organizados por nivel</p><div className="mt-5 grid grid-cols-2 gap-2"><Mini label="Categorías" value="7ma–2da" /><Mini label="Partidos" value="diarios" /></div></aside>
        </div>
      </section>

      <section className="mb-5 flex flex-wrap gap-2"><button onClick={() => setFilter("todas")} className={chip(filter === "todas")}>Todas</button>{GROUPS.map((g) => <button key={g.id} onClick={() => setFilter(g.id)} className={chip(filter === g.id)}>{g.id}</button>)}</section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((group) => <GroupCard key={group.id} group={group} phone={settings.whatsapp} />)}
      </section>
    </main>
  );
}
function GroupCard({ group, phone }) { return <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl transition hover:-translate-y-1 hover:border-lime-300/35"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{group.level}</p><h3 className="mt-1 text-2xl font-black text-white">{group.label}</h3></div><span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-bold text-lime-100">{group.players} jugadores</span></div><p className="mt-4 text-sm leading-6 text-slate-400">{group.vibe}</p><div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-3"><p className="text-xs text-slate-500">Próximo partido sugerido</p><p className="font-black text-white">{group.next}</p></div><a href={`https://wa.me/${phone || "5493510000000"}?text=Hola%2C%20quiero%20sumarme%20al%20grupo%20${group.id}`} target="_blank" rel="noreferrer" className="btn-primary mt-5 w-full justify-center">Sumarme al grupo</a></article>; }
function Mini({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="font-black text-white">{value}</p></div>; }
function chip(active) { return `rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-lime-300 bg-lime-300 text-black" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-lime-300/40 hover:text-lime-100"}`; }
