// src/pages/PlayerDashboard.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { ROUTES } from "../constants/routes.js";
import { usePricing } from "../context/PricingContext.jsx";
import { getUserTournamentRegistrations, TOURNAMENTS_EVENT } from "../utils/tournamentsStorage.js";

function bookingDate(booking) {
  return new Date(`${booking.date}T${booking.time || booking.hour || "00:00"}:00`);
}

function isFutureBooking(booking) {
  return bookingDate(booking) >= new Date() && booking.status !== "cancelado";
}

function bookingTimeLabel(booking = {}) {
  const start = booking.time || booking.hour || "";
  return booking.endTime ? `${start} a ${booking.endTime}` : start;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function eventDate(event) {
  return new Date(`${event.date || todayISO()}T${event.time || "00:00"}:00`);
}

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

function statusText(status) {
  const labels = { pendiente: "Pendiente", confirmado: "Confirmado", cancelado: "Cancelado" };
  return labels[status] || status || "Pendiente";
}

export default function PlayerDashboard() {
  const { user } = useAuth();
  const { bookings = [], cancelBooking, markAsPaid } = useBooking();
  const { prices } = usePricing();
  const [tournamentSync, setTournamentSync] = useState(0);

  useEffect(() => {
    const refresh = () => setTournamentSync((value) => value + 1);
    window.addEventListener(TOURNAMENTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(TOURNAMENTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const myBookings = useMemo(() => {
    if (!user?.email) return [];
    return bookings
      .filter((b) => !b.userEmail || b.userEmail === user.email)
      .sort((a, b) => bookingDate(a) - bookingDate(b));
  }, [bookings, user?.email]);

  const data = useMemo(() => {
    const upcoming = myBookings.filter(isFutureBooking);
    const pending = myBookings.filter((b) => b.status === "pendiente");
    const confirmed = myBookings.filter((b) => b.status === "confirmado" || b.paymentStatus === "pagado");
    const cancelled = myBookings.filter((b) => b.status === "cancelado");
    const total = myBookings.filter((b) => b.status !== "cancelado").reduce((acc, b) => acc + Number(b.price || b.total || 0), 0);
    const progress = Math.min(100, Math.round((confirmed.length / 8) * 100));
    return { upcoming, pending, confirmed, cancelled, total, progress };
  }, [myBookings]);

  const tournamentData = useMemo(() => {
    const fallbackDate = todayISO();
    const registrations = getUserTournamentRegistrations(user, prices.tournamentPrice)
      .sort((a, b) => `${a.tournamentDate || fallbackDate}T${a.tournamentHour || "00:00"}`.localeCompare(`${b.tournamentDate || fallbackDate}T${b.tournamentHour || "00:00"}`));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const isPast = (item) => {
      if (["finalizado", "cancelado"].includes(String(item.statusTournament || "").toLowerCase())) return true;
      if (!item.tournamentDate) return false;
      const d = new Date(`${item.tournamentDate}T23:59:59`);
      return !Number.isNaN(d.getTime()) && d < today;
    };
    const upcoming = registrations.filter((item) => !isPast(item) && item.status !== "cancelado");
    const history = registrations.filter((item) => isPast(item) || item.status === "cancelado").reverse();
    const confirmed = registrations.filter((item) => item.status === "confirmado");
    const pending = registrations.filter((item) => item.status === "pendiente");
    return { registrations, upcoming, history, confirmed, pending };
  }, [user, prices.tournamentPrice, tournamentSync]);

  const upcomingEvents = useMemo(() => {
    const bookingEvents = data.upcoming.map((booking) => ({
      id: `booking-${booking.id}`,
      kind: "booking",
      date: booking.date,
      time: booking.time || booking.hour,
      displayTime: bookingTimeLabel(booking),
      title: booking.courtName || booking.court || "Reserva de cancha",
      detail: booking.description || "Turno de padel",
      status: booking.status,
      price: booking.price || booking.total,
      booking,
    }));
    const tournamentEvents = tournamentData.upcoming.map((registration) => ({
      id: `tournament-${registration.tournamentId}-${registration.id}`,
      kind: "tournament",
      date: registration.tournamentDate,
      time: registration.tournamentHour || "20:00",
      title: registration.tournamentName,
      detail: `Torneo - ${registration.category || "Sin categoría"}`,
      status: registration.status,
      price: registration.pricePerPlayer,
      registration,
    }));
    return [...bookingEvents, ...tournamentEvents].sort((a, b) => eventDate(a) - eventDate(b));
  }, [data.upcoming, tournamentData.upcoming]);

  const nextEvent = upcomingEvents[0];
  const lastBookings = [...myBookings].reverse().slice(0, 4);
  const missingForFree = Math.max(0, 8 - data.confirmed.length);

  if (!user) return <Navigate to={ROUTES.HOME} replace />;

  return (
    <main className="main-container max-w-7xl text-white">
      <section className="mb-6 grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#060B18] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.9)] md:p-8">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(190,242,100,0.20),transparent_36%),radial-gradient(circle_at_100%_0%,rgba(20,184,166,0.12),transparent_34%)]" />
          <div className="relative">
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-lime-200">Panel jugador</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">Hola, {user.name || "jugador"}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Tu agenda de pádel ordenada: próximo turno, pagos pendientes, historial reciente y progreso para la reserva bonificada.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to={ROUTES.BOOKING} className="btn-primary">Nueva reserva</Link>
              <Link to={ROUTES.MY_BOOKINGS} className="btn-outline">Mi agenda</Link>
              <Link to={ROUTES.COMMUNITY} className="btn-outline">Buscar jugadores</Link>
            </div>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-lime-100">Próximo evento</p>
          {nextEvent ? (
            <>
              <div className="mt-4 rounded-3xl border border-white/10 bg-black/35 p-4">
                <p className="text-4xl font-black text-white">{nextEvent.time || "20:00"}</p>
                <p className="mt-2 font-semibold text-lime-100">{nextEvent.date}</p>
                <p className="text-sm text-slate-400">{nextEvent.title}</p>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <InfoBox label="Tipo" value={nextEvent.kind === "tournament" ? "Torneo" : "Turno"} />
                <InfoBox label="Estado" value={statusText(nextEvent.status)} />
              </div>
            </>
          ) : (
            <div className="mt-4 rounded-3xl border border-dashed border-lime-200/30 bg-black/25 p-5 text-sm leading-6 text-lime-100/80">
              No tenés eventos próximos. Reservá una cancha o inscribite a un torneo y este panel se actualiza solo.
            </div>
          )}
        </aside>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Próximos" value={upcomingEvents.length} detail="Turnos y torneos" />
        <Metric label="Pendientes" value={data.pending.length} detail="Pago o confirmación" alert />
        <Metric label="Confirmados" value={data.confirmed.length} detail="Listos para jugar" />
        <Metric label="Total activo" value={money(data.total)} detail="No cancelados" />
        <Metric label="Torneos" value={tournamentData.upcoming.length} detail="Inscripciones activas" />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-5">
        <Panel title="Agenda próxima" kicker="Turnos">
          {upcomingEvents.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-3">
              {upcomingEvents.slice(0, 5).map((event) => (
                <PlayerEventRow key={event.id} event={event} onCancel={cancelBooking} onPaid={markAsPaid} />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Mis torneos" kicker="Competencia">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-3xl border border-lime-300/20 bg-lime-300/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.22em] text-lime-100">Próximos</p>
                  <p className="mt-1 text-3xl font-black text-white">{tournamentData.upcoming.length}</p>
                </div>
                <Link to={ROUTES.TOURNAMENTS} className="rounded-full border border-lime-200/30 px-3 py-2 text-xs font-black text-lime-50 hover:bg-lime-300 hover:text-black">Ver torneos</Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/25 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Tu categoría</p>
              <p className="mt-1 text-2xl font-black text-white">{user.category || "Sin categoría"}</p>
              <p className="mt-1 text-xs text-slate-400">Se usa para inscripciones y comunidad.</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {tournamentData.upcoming.length ? tournamentData.upcoming.slice(0, 3).map((item) => (
              <TournamentRow key={`${item.tournamentId}-${item.id}`} item={item} />
            )) : (
              <div className="rounded-3xl border border-dashed border-white/15 bg-black/25 p-5 text-sm text-slate-400">No tenés torneos próximos. Inscribite desde la sección Torneos.</div>
            )}
          </div>

          {tournamentData.history.length > 0 && (
            <details className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
              <summary className="cursor-pointer text-sm font-black text-white">Ver torneos anteriores ({tournamentData.history.length})</summary>
              <div className="mt-3 space-y-2">
                {tournamentData.history.slice(0, 4).map((item) => <TournamentRow key={`${item.tournamentId}-${item.id}`} item={item} compact />)}
              </div>
            </details>
          )}
        </Panel>
        </div>

        <aside className="space-y-5">
          <Panel title="Reserva bonificada" kicker="Beneficio">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-5xl font-black text-lime-100">{Math.min(data.confirmed.length, 8)}/8</p>
                <p className="mt-1 text-sm text-slate-400">{missingForFree === 0 ? "Ya podés pedir el beneficio" : `Faltan ${missingForFree} confirmadas`}</p>
              </div>
              <span className="rounded-full border border-lime-300/20 bg-lime-300/10 px-3 py-1 text-xs font-bold text-lime-100">9ª gratis</span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${data.progress}%` }} /></div>
          </Panel>

          <Panel title="Acciones" kicker="Rápido">
            <div className="grid gap-2">
              <QuickLink to={ROUTES.BOOKING} code="01" title="Reservar cancha" />
              <QuickLink to={ROUTES.TOURNAMENTS} code="02" title="Inscribirme a torneo" />
              <QuickLink to={ROUTES.COMMUNITY} code="03" title="Buscar compañero" />
            </div>
          </Panel>

          <Panel title="Actividad reciente" kicker="Historial">
            <div className="space-y-2">
              {lastBookings.length === 0 ? <p className="text-sm text-slate-500">Sin actividad todavía.</p> : lastBookings.map((booking) => (
                <div key={booking.id} className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                  <p className="text-sm font-semibold text-white">{booking.courtName || booking.court || "Reserva"}</p>
                  <p className="text-xs text-slate-500">{booking.date} · {bookingTimeLabel(booking)} · {statusText(booking.status)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </section>
    </main>
  );
}

function TournamentRow({ item, compact = false }) {
  const status = String(item.status || "pendiente").toLowerCase();
  const statusClass = status === "confirmado"
    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
    : status === "cancelado"
      ? "border-red-300/30 bg-red-300/10 text-red-100"
      : "border-amber-300/30 bg-amber-300/10 text-amber-100";
  return (
    <article className={`rounded-3xl border border-white/10 bg-black/30 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-black text-white">{item.tournamentName}</p>
          <p className="mt-1 text-xs text-slate-400">{item.tournamentDate || "Fecha a confirmar"} · {item.tournamentHour || "20:00"}</p>
          <p className="mt-1 text-xs font-bold text-lime-100">Categoría: {item.category || "Sin categoría"}</p>
          {item.partnerName && <p className="mt-1 text-xs text-slate-300">Pareja: {item.partnerName}</p>}
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black capitalize ${statusClass}`}>{status}</span>
      </div>
    </article>
  );
}

function EmptyState() {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-black/30 p-8 text-center">
      <h3 className="text-lg font-bold text-white">Todavía no hay turnos próximos</h3>
      <p className="mt-1 text-sm text-slate-400">Cuando reserves una cancha, aparece acá con estado y acciones.</p>
      <Link to={ROUTES.BOOKING} className="btn-primary mt-5">Reservar ahora</Link>
    </div>
  );
}

function Metric({ label, value, detail, alert = false }) {
  return (
    <div className={`rounded-3xl border p-4 shadow-xl ${alert ? "border-amber-300/25 bg-amber-300/10" : "border-white/10 bg-[#0B1326]/80"}`}>
      <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function Panel({ kicker, title, children }) {
  return <section className="rounded-[1.8rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl"><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{kicker}</p><h2 className="mb-4 mt-1 text-xl font-bold text-white">{title}</h2>{children}</section>;
}

function PlayerEventRow({ event, onCancel, onPaid }) {
  if (event.kind === "booking") {
    return <PlayerBookingRow booking={event.booking} onCancel={onCancel} onPaid={onPaid} />;
  }

  return (
    <article className="grid gap-3 rounded-3xl border border-lime-300/20 bg-lime-300/10 p-4 transition hover:border-lime-300/40 hover:bg-lime-300/15 lg:grid-cols-[130px_1fr_auto] lg:items-center">
      <div>
        <p className="text-2xl font-black text-white">{event.displayTime || event.time}</p>
        <p className="text-xs text-lime-100">{event.date || "Fecha a confirmar"}</p>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-white">{event.title}</h3>
          <StatusPill status={event.status} />
        </div>
        <p className="mt-1 text-sm text-slate-300">{event.detail} · {money(event.price)}</p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Link to={ROUTES.TOURNAMENTS} className="rounded-full border border-lime-300/40 px-3 py-1.5 text-xs font-black text-lime-100 hover:bg-lime-300 hover:text-black">Ver torneo</Link>
      </div>
    </article>
  );
}

function PlayerBookingRow({ booking, onCancel, onPaid }) {
  const pending = booking.status === "pendiente";
  return (
    <article className="grid gap-3 rounded-3xl border border-white/10 bg-black/30 p-4 transition hover:border-lime-300/35 hover:bg-black/45 lg:grid-cols-[130px_1fr_auto] lg:items-center">
      <div>
        <p className="text-2xl font-black text-white">{bookingTimeLabel(booking)}</p>
        <p className="text-xs text-slate-500">{booking.date}</p>
      </div>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-bold text-white">{booking.courtName || booking.court || "Cancha"}</h3>
          <StatusPill status={booking.status} />
        </div>
        <p className="mt-1 text-sm text-slate-400">{booking.description || "Turno de pádel"} · {money(booking.price || booking.total)}</p>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        {pending && <button onClick={() => onPaid(booking.id)} className="rounded-full bg-lime-300 px-3 py-1.5 text-xs font-black text-black hover:bg-lime-200">Marcar pagado</button>}
        {booking.status !== "cancelado" && <button onClick={() => onCancel(booking.id)} className="rounded-full border border-rose-400/40 px-3 py-1.5 text-xs font-bold text-rose-200 hover:bg-rose-500/10">Cancelar</button>}
      </div>
    </article>
  );
}

function InfoBox({ label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="font-bold text-white">{value || "-"}</p></div>;
}

function QuickLink({ to, code, title }) {
  return <Link to={to} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 transition hover:border-lime-300/35 hover:bg-lime-300/10"><span className="flex items-center gap-3"><span className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-black text-lime-100">{code}</span><span className="text-sm font-semibold text-white group-hover:text-lime-100">{title}</span></span><span className="text-slate-500 group-hover:text-lime-100">→</span></Link>;
}

function StatusPill({ status }) {
  const classes = {
    pendiente: "border-amber-400/40 bg-amber-400/10 text-amber-200",
    confirmado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200",
    cancelado: "border-rose-400/40 bg-rose-400/10 text-rose-200",
  };
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${classes[status] || classes.pendiente}`}>{statusText(status)}</span>;
}
