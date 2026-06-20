// src/pages/Home.jsx
import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import heroImg from "../assets/hero-padel.webp";
import { ROUTES } from "../constants/routes.js";
import { usePricing } from "../context/PricingContext.jsx";
import { useClubSettings } from "../context/ClubSettingsContext.jsx";
import { getCourtPrice, getClassPrice } from "../utils/pricing.js";
import { useBooking } from "../hooks/useBooking.jsx";
import { useSchedule, sameSlot } from "../hooks/useSchedule.jsx";
import { COURTS, COURT_HOURS } from "../data/bookingConfig.js";
import { loadTournaments } from "../utils/tournamentsStorage.js";

const experience = [
  { title: "Reservá en 30 segundos", text: "Ves disponibilidad real, elegís cancha y confirmás sin esperar respuesta por WhatsApp.", icon: "⚡" },
  { title: "Tu agenda siempre clara", text: "Próximos turnos, pagos pendientes y cancelaciones quedan ordenados en tu panel.", icon: "📅" },
  { title: "Jugá más, organizá menos", text: "Torneos, comunidad por categoría y clases con profes desde el mismo sistema.", icon: "🎾" },
];


export default function Home() {
  const { prices } = usePricing();
  const { settings } = useClubSettings();
  const { bookings } = useBooking();
  const { getBlock } = useSchedule();
  const tournaments = useMemo(() => loadTournaments(prices.tournamentPrice), [prices.tournamentPrice]);
  const openTournaments = tournaments.filter((t) => t.status === "abierto").length;
  const courtPrice = getCourtPrice("15:00", new Date(), prices);
  const classPrice = getClassPrice(prices);
  const nextTournament = tournaments.find((t) => t.status === "abierto") || tournaments[0];
  const today = new Date().toISOString().slice(0, 10);
  const courtAvailability = COURTS.map((court) => {
    const freeHour = COURT_HOURS.find((hour) => !getBlock(today, court.id, hour) && !bookings.some((booking) => sameSlot(booking, today, court.id, hour)));
    return {
      id: court.id,
      name: court.name.replace("Cancha ", ""),
      detail: court.description,
      free: freeHour || "Completa",
      status: freeHour ? "Libre" : "Sin turnos",
      tone: freeHour ? "lime" : "amber",
    };
  });
  const liveSlots = courtAvailability.slice(0, 3).map((court) => ({ hour: court.free, court: court.name, status: court.status, tone: court.tone }));
  const availableCount = courtAvailability.filter((court) => court.free !== "Completa").length;
  const tournamentRanking = useMemo(() => {
    const registeredPlayers = tournaments
      .flatMap((tournament) => tournament.registrations || [])
      .filter((registration) => !["cancelado", "rechazado"].includes(String(registration.status || "").toLowerCase()))
      .map((registration, index) => ({
        name: registration.name || "Jugador del club",
        category: registration.category || "Mixto libre",
        points: 980 - index * 55,
      }));

    const fallback = [
      { name: "Cristian Alba", category: "6ta caballeros", points: 980 },
      { name: "Laura Lencina", category: "Mixto libre", points: 930 },
      { name: "Bruno Pérez", category: "7ma caballeros", points: 875 },
      { name: "Mica Torres", category: "6ta damas", points: 820 },
    ];

    return (registeredPlayers.length ? registeredPlayers : fallback)
      .sort((a, b) => b.points - a.points)
      .slice(0, 4);
  }, [tournaments]);
  return (
    <main className="home-wrapper text-white">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-lime-300/20 bg-[#030611] shadow-[0_35px_130px_rgba(0,0,0,0.95)] sm:rounded-[2.5rem]">
        <img src={heroImg} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-[66%_center] opacity-45 lg:hidden" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgba(163,230,53,0.28),transparent_32%),radial-gradient(circle_at_92%_20%,rgba(45,212,191,0.16),transparent_30%),linear-gradient(135deg,rgba(2,6,23,0.1),rgba(2,6,23,0.75))]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#030611]/72 via-[#030611]/58 to-[#030611]/92 lg:hidden" />
        <div className="absolute left-8 top-8 h-28 w-28 rounded-full border border-lime-300/20 opacity-40 animate-pulse" />
        <div className="absolute bottom-16 right-16 h-44 w-44 rounded-full bg-lime-300/10 blur-3xl" />

        <div className="relative z-10 grid min-h-[560px] lg:min-h-[640px] lg:grid-cols-[1.05fr_0.95fr]">
          <div className="flex flex-col justify-center px-4 py-6 sm:px-8 sm:py-12 lg:px-12">
            <div className="mb-4 inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-lime-100 backdrop-blur sm:mb-5 sm:text-[11px] sm:tracking-[0.24em]">
              <span className="h-2 w-2 rounded-full bg-lime-300 shadow-[0_0_18px_rgba(190,242,100,0.95)]" />
              {settings.clubStatus}
            </div>

            <h1 className="max-w-[18rem] text-[2rem] font-black leading-[1] tracking-[-0.045em] text-white sm:max-w-4xl sm:text-6xl sm:leading-[0.95] sm:tracking-[-0.075em] xl:text-7xl">
              {settings.homeHeadline}
            </h1>

            <p className="mt-5 max-w-[19rem] text-sm leading-6 text-slate-200 sm:mt-6 sm:max-w-2xl sm:text-lg sm:leading-8">
              {settings.homeSubtitle}
            </p>

            <div className="mt-6 flex flex-wrap gap-3 sm:mt-8">
              <Link to={ROUTES.BOOKING} className="btn-primary px-5 py-2.5 text-sm sm:px-7 sm:py-3">
                Reservar ahora
              </Link>
              <Link to={ROUTES.COMMUNITY} className="btn-outline px-5 py-2.5 text-sm sm:px-7 sm:py-3">
                Buscar partido
              </Link>
            </div>

            <div className="mt-6 grid max-w-3xl grid-cols-3 gap-2 sm:mt-9 sm:gap-3">
              <HeroMetric value={`$${courtPrice.toLocaleString("es-AR")}`} label="turno base" />
              <HeroMetric value={settings.openingHours} label="agenda del club" />
              <HeroMetric value={settings.promoText} label="beneficio activo" />
            </div>
          </div>

          <div className="relative min-h-[250px] overflow-hidden sm:min-h-[420px] lg:min-h-full">
            <img src={heroImg} alt="Jugador de pádel" className="absolute inset-0 hidden h-full w-full scale-105 object-cover object-center opacity-95 lg:block" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030611] via-[#030611]/25 to-transparent lg:bg-gradient-to-r lg:from-[#030611] lg:via-[#030611]/15 lg:to-transparent" />

            <div className="absolute right-5 top-5 hidden rounded-[1.4rem] border border-white/15 bg-black/55 px-4 py-3 backdrop-blur md:block">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Ocupación hoy</p>
              <div className="mt-2 flex items-end gap-2"><span className="text-3xl font-black text-lime-100">{availableCount}</span><span className="pb-1 text-xs text-slate-400">canchas con turno</span></div>
            </div>

            <div className="absolute bottom-4 left-4 right-4 rounded-[1.45rem] border border-white/15 bg-black/60 p-3 shadow-2xl backdrop-blur-md sm:bottom-5 sm:left-5 sm:right-5 sm:rounded-[1.8rem] sm:p-4 md:left-auto md:w-[410px]">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="hidden text-[11px] uppercase tracking-[0.22em] text-slate-400 sm:block">Disponibilidad rápida</p>
                  <h2 className="text-base font-black text-white sm:text-lg">Horarios destacados</h2>
                </div>
                <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-black text-black">En vivo</span>
              </div>
              <div className="space-y-2">
                {liveSlots.map((slot) => <LiveSlot key={`${slot.hour}-${slot.court}`} slot={slot} />)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mobile-snap-row compact mt-8 grid gap-4 lg:grid-cols-3">
        {experience.map((item, index) => <ExperienceCard key={item.title} index={index + 1} {...item} />)}
      </section>
      <p className="mobile-scroll-hint">Deslizá para ver más</p>


      <section className="mobile-tight-section mt-8 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-6 shadow-xl">
          <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-lime-300/20 blur-3xl" />
          <p className="section-eyebrow">Experiencia del jugador</p>
          <h2 className="mt-3 text-3xl font-black tracking-[-0.04em] text-white">Todo lo que importa, a un toque.</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
            Toda la información del club se actualiza desde administración: precios, horarios, contacto, torneos y disponibilidad visible para el jugador.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Pill>{`Turno desde $${courtPrice.toLocaleString("es-AR")}`}</Pill><Pill>{`Clase $${classPrice.toLocaleString("es-AR")}`}</Pill><Pill>{settings.openingHours}</Pill><Pill>{nextTournament?.name || "Torneos"}</Pill>
          </div>
          <Link to={ROUTES.PLAYER} className="btn-primary mt-7">Abrir mi panel</Link>
        </div>

        <div className="mobile-snap-row compact grid gap-3 md:grid-cols-3">
          {courtAvailability.map((court) => (
            <article key={court.id} className="group rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl transition hover:-translate-y-1 hover:border-lime-300/35 hover:bg-[#101B32]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Cancha</p>
              <h3 className="mt-3 text-xl font-black text-white">{court.name}</h3>
              <p className="mt-1 text-sm text-slate-400">{court.detail}</p>
              <div className="mt-8 rounded-2xl border border-lime-300/20 bg-lime-300/10 p-3">
                <p className="text-xs text-slate-400">Próximo libre</p>
                <p className="text-2xl font-black text-lime-100">{court.free}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="mobile-tight-section mt-8 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl sm:p-6">
          <p className="section-eyebrow">Ranking competitivo</p>
          <h2 className="mt-2 text-xl font-black tracking-[-0.04em] text-white sm:text-2xl">Jugadores del torneo</h2>
          <div className="mt-4 grid gap-2 sm:mt-5 sm:grid-cols-2 sm:gap-3">
            {tournamentRanking.map((player, index) => (
              <div key={player.name} className={`${index > 2 ? "hidden sm:flex" : "flex"} items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 sm:px-4 sm:py-3`}>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-lime-300 text-sm font-black text-black sm:h-9 sm:w-9">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-white">{player.name}</p>
                    <p className="truncate text-xs text-slate-500">{player.category}</p>
                  </div>
                </div>
                <span className="shrink-0 pl-3 text-sm font-black text-lime-100">{player.points} pts</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-6 shadow-xl">
          <p className="section-eyebrow">Beneficio activo</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{settings.promoText}</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">El jugador puede consultar sus turnos, cancelar cuando corresponda y contactar al club con el detalle armado por WhatsApp.</p>
          <Link to={ROUTES.MY_BOOKINGS} className="btn-primary mt-6">Ver mi agenda</Link>
        </div>
      </section>
    </main>
  );
}

function HeroMetric({ value, label }) {
  return <div className="min-w-0 rounded-2xl border border-white/10 bg-black/25 px-2 py-2 backdrop-blur sm:bg-white/[0.045] sm:px-4 sm:py-3"><p className="whitespace-nowrap text-[clamp(0.78rem,3.3vw,1rem)] font-black leading-tight text-lime-100 sm:text-2xl">{value}</p><p className="mt-0.5 truncate text-[8px] uppercase tracking-wide text-slate-400 sm:text-[11px] sm:text-slate-500">{label}</p></div>;
}
function LiveSlot({ slot }) {
  const cls = slot.tone === "amber" ? "border-amber-300/30 bg-amber-300/10 text-amber-100" : "border-lime-300/30 bg-lime-300/10 text-lime-100";
  return <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.07]"><div><p className="text-sm font-black text-white">{slot.hour}</p><p className="text-xs text-slate-400">{slot.court}</p></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>{slot.status}</span></div>;
}
function ExperienceCard({ icon, title, text, index }) {
  return <article className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-6 shadow-xl transition hover:-translate-y-1 hover:border-lime-300/35"><div className="flex items-center justify-between"><span className="text-3xl">{icon}</span><span className="text-xs font-black text-lime-200">0{index}</span></div><h3 className="mt-7 text-xl font-black text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{text}</p></article>;
}
function Pill({ children }) { return <span className="rounded-full border border-lime-300/20 bg-black/25 px-3 py-1 text-xs font-bold text-lime-100">{children}</span>; }
