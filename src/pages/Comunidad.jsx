// src/pages/Comunidad.jsx
import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";

const GROUPS = [
  { id: "7ma", label: "7ma categoría", level: "Intermedio", vibe: "Partidos amistosos y ritmo tranquilo" },
  { id: "6ta", label: "6ta categoría", level: "Intermedio alto", vibe: "Buen ritmo, ideal para relámpagos" },
  { id: "5ta", label: "5ta categoría", level: "Avanzado", vibe: "Competitivo, ranking y torneos" },
  { id: "4ta", label: "4ta categoría", level: "Pre competitivo", vibe: "Partidos fuertes y técnicos" },
  { id: "3ra", label: "3ra categoría", level: "Alto", vibe: "Jugadores de circuito" },
  { id: "2da", label: "2da categoría", level: "Élite", vibe: "Nivel exhibición" },
];

export default function Comunidad() {
  const { settings } = useClubSettings();
  const [filter, setFilter] = useState("todas");
  const visible = useMemo(() => filter === "todas" ? GROUPS : GROUPS.filter((g) => g.id === filter), [filter]);

  return (
    <main className="main-container max-w-7xl text-white">
      <section className="relative mb-7 overflow-hidden rounded-[2.4rem] border border-lime-300/20 bg-[#050814] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.9)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(190,242,100,0.22),transparent_32%),radial-gradient(circle_at_90%_10%,rgba(45,212,191,0.14),transparent_34%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_360px]">
          <div><p className="section-eyebrow">Comunidad del club</p><h1 className="mt-3 text-4xl font-black tracking-[-0.06em] md:text-6xl">Encontrá con quién jugar.</h1><p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Elegí tu categoría y consultá al club por jugadores y partidos. Cuando tengas grupo, reservá la cancha desde acá.</p><div className="mt-6 flex flex-wrap gap-3"><Link to={ROUTES.BOOKING} className="btn-primary">Reservar cancha</Link><Link to={ROUTES.TOURNAMENTS} className="btn-outline">Ver torneos</Link></div></div>
          <aside className="rounded-[2rem] border border-white/10 bg-black/35 p-5"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Jugá a tu nivel</p><p className="mt-2 text-5xl font-black text-lime-100">6</p><p className="text-sm text-slate-400">categorías para consultar al club</p><div className="mt-5 grid grid-cols-2 gap-2"><Mini label="Categorías" value="7ma–2da" /><Mini label="Contacto" value="WhatsApp" /></div></aside>
        </div>
      </section>

      <section className="mb-5 flex flex-wrap gap-2"><button onClick={() => setFilter("todas")} className={chip(filter === "todas")}>Todas</button>{GROUPS.map((g) => <button key={g.id} onClick={() => setFilter(g.id)} className={chip(filter === g.id)}>{g.id}</button>)}</section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visible.map((group) => <GroupCard key={group.id} group={group} phone={settings.whatsapp} />)}
      </section>
    </main>
  );
}
function GroupCard({ group, phone }) {
  const digits = String(phone || "").replace(/\D/g, "");
  const message = encodeURIComponent(`Hola, quiero consultar por jugadores de ${group.id} en el club.`);
  return (
    <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl transition hover:-translate-y-1 hover:border-lime-300/35">
      <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{group.level}</p>
      <h3 className="mt-1 text-2xl font-black text-white">{group.label}</h3>
      <p className="mt-4 text-sm leading-6 text-slate-400">{group.vibe}</p>
      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-3">
        <p className="text-xs text-slate-500">Coordinación</p>
        <p className="font-black text-white">Consultá disponibilidad con el club</p>
      </div>
      {digits && <a href={`https://wa.me/${digits}?text=${message}`} target="_blank" rel="noreferrer" className="btn-primary mt-5 w-full justify-center">Consultar por WhatsApp</a>}
    </article>
  );
}
function Mini({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="font-black text-white">{value}</p></div>; }
function chip(active) { return `rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-lime-300 bg-lime-300 text-black" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-lime-300/40 hover:text-lime-100"}`; }
