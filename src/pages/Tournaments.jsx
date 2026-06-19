// src/pages/Tournaments.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ROUTES } from "../constants/routes.js";
import { usePricing } from "../context/PricingContext.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { loadTournaments, registerToTournament, TOURNAMENTS_EVENT } from "../utils/tournamentsStorage.js";
import { cleanPhone } from "../utils/whatsapp.js";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { useToast } from "../components/ToastProvider.jsx";

const RANKING = ["Bruno Pérez", "Lucía Torres", "Martín Silva", "Laura Lencina"];

function money(value) { return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }); }
function statusLabel(status) { return ({ abierto: "Inscripción abierta", lleno: "Cupos completos", en_curso: "En juego", finalizado: "Finalizado", cancelado: "Cancelado" })[status] || status; }

export default function Tournaments() {
  const { prices } = usePricing();
  const { settings } = useClubSettings();
  const { user, openLogin } = useAuth();
  const { notify } = useToast();
  const [tournaments, setTournaments] = useState(() => loadTournaments(prices.tournamentPrice));
  const [category, setCategory] = useState("todas");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null);
  const [partnerName, setPartnerName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");

  useEffect(() => {
    const sync = () => setTournaments(loadTournaments(prices.tournamentPrice));
    window.addEventListener(TOURNAMENTS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(TOURNAMENTS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [prices.tournamentPrice]);

  const filtered = useMemo(() => category === "todas" ? tournaments : tournaments.filter((t) => String(t.category || "").includes(category)), [category, tournaments]);
  const featured = filtered.find((t) => t.status === "abierto") || filtered[0] || tournaments[0];
  const openCount = tournaments.filter((t) => t.status === "abierto").length;
  const nextOpen = tournaments.find((t) => t.status === "abierto");

  function startSignup(tournament) {
    setMessage("");
    if (!user) {
      openLogin();
      notify({ type: "info", title: "Ingresá para anotarte", message: "La inscripción queda asociada a tu cuenta de jugador." });
      return;
    }
    if (tournament.status !== "abierto") {
      setMessage("Este torneo no tiene inscripción abierta.");
      notify({ type: "warning", title: "Inscripción cerrada", message: "Elegí otro torneo abierto." });
      return;
    }
    if (Number(tournament.currentPlayers) >= Number(tournament.maxPlayers)) {
      setMessage("El torneo ya no tiene cupos disponibles.");
      notify({ type: "warning", title: "Cupos completos", message: "El club puede abrir nuevas fechas desde admin." });
      return;
    }
    setSelected(tournament);
  }

  function confirmSignup(event) {
    event.preventDefault();
    if (!selected) return;
    const result = registerToTournament(selected.id, user, { partnerName, partnerPhone }, prices.tournamentPrice);
    if (!result.ok) {
      setMessage(result.error);
      notify({ type: "warning", title: "No se pudo anotar", message: result.error });
      return;
    }
    setTournaments(loadTournaments(prices.tournamentPrice));
    setSelected(null);
    setPartnerName("");
    setPartnerPhone("");
    setMessage(`Inscripción enviada para ${result.tournament.name}. El club va a confirmar el cupo.`);
    notify({ type: "success", title: "Inscripción enviada", message: "Ya aparece en tu panel como evento próximo." });
  }

  return (
    <main className="main-container max-w-7xl text-white">
      <section className="relative mb-7 overflow-hidden rounded-[2.4rem] border border-lime-300/20 bg-[#050814] p-6 shadow-[0_28px_100px_rgba(0,0,0,0.9)] md:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,rgba(190,242,100,0.2),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.14),transparent_30%)]" />
        <div className="relative grid gap-6 xl:grid-cols-[1fr_410px]">
          <div>
            <p className="section-eyebrow">Torneos y ranking</p>
            <h1 className="mt-3 text-4xl font-black tracking-[-0.06em] md:text-6xl">Competí, inscribite y seguí tu progreso.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">Elegí un torneo abierto, mandá tu inscripción y el club confirma el cupo desde administración. Todo queda vinculado a tu cuenta.</p>
            <div className="mt-6 flex flex-wrap gap-3"><Link to={ROUTES.BOOKING} className="btn-primary">Reservar práctica</Link><Link to={ROUTES.ACCOUNT} className="btn-outline">Ver mi perfil</Link></div>
          </div>
          <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Próximo torneo</p>
            <h2 className="mt-3 text-2xl font-black text-white">{featured?.name || "Torneos del club"}</h2>
            <p className="mt-1 text-sm text-slate-300">{featured?.category} · {featured?.date} · {featured?.hour}</p>
            <div className="mt-5 grid grid-cols-2 gap-2"><Mini label="Abiertos" value={openCount} /><Mini label="Cupos" value={featured ? `${featured.currentPlayers}/${featured.maxPlayers}` : "-"} /></div>
            {featured && <button onClick={() => startSignup(featured)} className="btn-primary mt-5 w-full justify-center">Inscribirme</button>}
          </aside>
        </div>
      </section>

      {message && <div className="mb-5 rounded-2xl border border-lime-300/20 bg-lime-300/10 px-5 py-4 text-sm font-bold text-lime-50">{message}</div>}

      <section className="mb-5 flex flex-wrap gap-2"><button onClick={() => setCategory("todas")} className={chip(category === "todas")}>Todos</button><button onClick={() => setCategory("Mixto")} className={chip(category === "Mixto")}>Mixto</button><button onClick={() => setCategory("Caballeros")} className={chip(category === "Caballeros")}>Caballeros</button></section>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => <TournamentCard key={t.id} tournament={t} onSignup={startSignup} />)}
        </div>
        <aside className="space-y-4">
          <Panel title="Ranking del club" kicker="Top jugadores">{RANKING.map((name, index) => <div key={name} className="mb-2 flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3"><span className="font-bold text-white">#{index + 1} {name}</span><span className="text-xs text-lime-100">{320 - index * 45} pts</span></div>)}</Panel>
          <Panel title="Inscripción" kicker="Funcionamiento"><p className="text-sm leading-6 text-slate-400">La inscripción queda pendiente hasta que el club confirme el cupo. Si el torneo es por pareja, cargá el nombre de tu compañero al anotarte.</p>{nextOpen && <a className="btn-outline mt-4 w-full justify-center" target="_blank" rel="noreferrer" href={`https://wa.me/${cleanPhone(settings.whatsapp)}?text=${encodeURIComponent(`Hola, quiero consultar por el torneo ${nextOpen.name} del ${nextOpen.date}.`)}`}>Consultar por WhatsApp</a>}</Panel>
        </aside>
      </section>

      {selected && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <form onSubmit={confirmSignup} className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-[#0B1326] p-6 shadow-2xl">
            <p className="section-eyebrow">Confirmar inscripción</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white">{selected.name}</h2>
            <p className="mt-2 text-sm text-slate-400">{selected.date} · {selected.hour} · {selected.category}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2"><Mini label="Jugador" value={user?.name || user?.email} /><Mini label="Precio" value={money(selected.pricePerPlayer)} /></div>
            <label className="mt-4 block"><span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-slate-500">Compañero/a de pareja</span><input className="field" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Opcional" /></label>
            <label className="mt-3 block"><span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-slate-500">Teléfono del compañero/a</span><input className="field" value={partnerPhone} onChange={(e) => setPartnerPhone(e.target.value)} placeholder="Opcional" /></label>
            <div className="mt-6 flex flex-wrap gap-3"><button className="btn-primary">Enviar inscripción</button><button type="button" onClick={() => setSelected(null)} className="btn-outline">Cancelar</button></div>
          </form>
        </div>
      )}
    </main>
  );
}

function TournamentCard({ tournament, onSignup }) {
  const progress = Math.min(100, Math.round((Number(tournament.currentPlayers || 0) / Number(tournament.maxPlayers || 1)) * 100));
  const disabled = tournament.status !== "abierto" || Number(tournament.currentPlayers) >= Number(tournament.maxPlayers);
  return <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl transition hover:-translate-y-1 hover:border-lime-300/35"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{tournament.date} · {tournament.hour}</p><h3 className="mt-1 text-2xl font-black text-white">{tournament.name}</h3><p className="text-sm text-slate-400">{tournament.category} · {tournament.surface}</p></div><span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-bold text-lime-100">{statusLabel(tournament.status)}</span></div><p className="mt-4 text-sm leading-6 text-slate-400">{tournament.description}</p><div className="mt-5 grid grid-cols-3 gap-2"><Mini label="Cupos" value={`${tournament.currentPlayers}/${tournament.maxPlayers}`} /><Mini label="Precio" value={money(tournament.pricePerPlayer)} /><Mini label="Premio" value={tournament.prize || "Premio del club"} /></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${progress}%` }} /></div><button disabled={disabled} onClick={() => onSignup(tournament)} className={`mt-5 w-full justify-center ${disabled ? "btn-outline opacity-50" : "btn-primary"}`}>{disabled ? "No disponible" : "Inscribirme"}</button></article>;
}
function Panel({ kicker, title, children }) { return <section className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{kicker}</p><h2 className="mb-4 mt-1 text-xl font-black text-white">{title}</h2>{children}</section>; }
function Mini({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-sm font-black text-white">{value}</p></div>; }
function chip(active) { return `rounded-full border px-4 py-2 text-sm font-bold transition ${active ? "border-lime-300 bg-lime-300 text-black" : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-lime-300/40 hover:text-lime-100"}`; }
