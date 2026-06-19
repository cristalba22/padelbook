// src/pages/Admin.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../components/AdminLayout.jsx";
import { bookings as baseBookings, courts, teachers, tournaments } from "../data/adminMock.js";
import { useBooking } from "../hooks/useBooking.jsx";
import { useSchedule } from "../hooks/useSchedule.jsx";
import { ROUTES } from "../constants/routes.js";
import { buildAdminMetrics, money, todayISO, normalizeBooking } from "../utils/businessMetrics.js";
import { readActivity } from "../utils/activityLog.js";

const HOURS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00"];

function normalizeMockBooking(booking) {
  return normalizeBooking({
    id: booking.id,
    date: booking.date,
    time: booking.time,
    type: booking.type,
    courtName: booking.courtOrClass,
    playerName: booking.playerOrGroup,
    phone: booking.phone,
    price: booking.price,
    status: booking.status,
    description: booking.note,
  });
}

export default function AdminDashboard() {
  const { bookings: userBookings = [] } = useBooking();
  const { blocks } = useSchedule();
  const [activity, setActivity] = useState(() => readActivity(8));
  const date = todayISO();

  useEffect(() => {
    const sync = () => setActivity(readActivity(8));
    window.addEventListener("padel:activity-updated", sync);
    window.addEventListener("padel:bookings-updated", sync);
    window.addEventListener("padel:schedule-updated", sync);
    return () => {
      window.removeEventListener("padel:activity-updated", sync);
      window.removeEventListener("padel:bookings-updated", sync);
      window.removeEventListener("padel:schedule-updated", sync);
    };
  }, []);

  const allBookings = useMemo(() => {
    const normalizedWeb = userBookings.map(normalizeBooking);
    const normalizedMock = baseBookings.map(normalizeMockBooking);
    const source = normalizedWeb.length ? normalizedWeb : normalizedMock;
    return source.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  }, [userBookings]);

  const metrics = useMemo(() => buildAdminMetrics(allBookings, blocks, date), [allBookings, blocks, date]);
  const activeTeachers = teachers.filter((t) => t.status === "activo");
  const openTournaments = tournaments.filter((t) => t.status === "abierto" || t.status === "en_curso");
  const agenda = metrics.day.slice(0, 6);
  const pendingPayments = metrics.pending.slice(0, 4);
  const freeSlots = Math.max(0, metrics.totalSlots - metrics.day.length - metrics.blockedDay);
  const healthScore = Math.max(0, Math.min(100, metrics.occupancy + metrics.confirmed.length * 4 - metrics.pending.length * 6));
  const focusItems = [
    metrics.pending.length > 0 ? `${metrics.pending.length} pagos pendientes para cerrar caja` : "Caja del día sin pendientes críticos",
    freeSlots > 0 ? `${freeSlots} franjas libres para vender hoy` : "Agenda completa para hoy",
    openTournaments.length > 0 ? `${openTournaments.length} torneos activos para empujar inscripción` : "Sin torneos abiertos para comunicar",
  ];

  return (
    <AdminLayout title="Dashboard del club" subtitle="Control real de reservas, caja, ocupación y actividad operativa del día.">
      <section className="mb-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#060B18] p-6 shadow-[0_24px_90px_rgba(0,0,0,0.9)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_0%_0%,rgba(190,242,100,0.22),transparent_35%),radial-gradient(circle_at_100%_0%,rgba(20,184,166,0.14),transparent_35%)]" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-lime-200">Panel operativo</p>
              <h2 className="mt-2 max-w-3xl text-3xl font-black tracking-[-0.05em] text-white md:text-4xl">Hoy: reservas, bloqueos y caja en una sola vista.</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Los datos se calculan desde reservas y bloqueos reales. Todo cambio del panel se refleja en la experiencia del jugador.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to={ROUTES.ADMIN_CALENDAR} className="btn-primary">Gestionar calendario</Link>
              <Link to={ROUTES.ADMIN_BOOKINGS} className="btn-outline">Ver reservas</Link>
            </div>
          </div>
          <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <ExecutiveMetric label="Caja del día" value={money(metrics.revenueDay)} detail={`${metrics.day.length} reservas activas`} />
            <ExecutiveMetric label="Ocupación" value={`${metrics.occupancy}%`} detail={`${metrics.day.length} reservas + ${metrics.blockedDay} bloqueos`} />
            <ExecutiveMetric label="Confirmadas" value={metrics.confirmed.length} detail="listas para jugar" />
            <ExecutiveMetric label="Pendientes" value={metrics.pending.length} detail="requieren seguimiento" alert={metrics.pending.length > 0} />
          </div>
          <div className="relative mt-5 grid gap-3 lg:grid-cols-[220px_1fr]">
            <div className="rounded-[1.5rem] border border-lime-300/20 bg-black/35 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-500">Salud operativa</p>
              <div className="mt-3 flex items-end gap-2">
                <span className="text-4xl font-black text-lime-100">{healthScore}</span>
                <span className="pb-1 text-sm text-slate-400">/100</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-lime-300" style={{ width: `${healthScore}%` }} />
              </div>
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              {focusItems.map((item, index) => <FocusCard key={item} index={index + 1} text={item} />)}
            </div>
          </div>
        </div>

        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-lime-100">Prioridad comercial</p>
          <h3 className="mt-2 text-xl font-bold text-white">Pagos por resolver</h3>
          <div className="mt-4 space-y-2">
            {pendingPayments.length === 0 ? <div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">Sin pagos pendientes para hoy.</div> : pendingPayments.map((booking) => <PendingItem key={booking.id} booking={booking} />)}
          </div>
          <Link to={ROUTES.ADMIN_BOOKINGS} className="mt-4 inline-flex text-sm font-bold text-lime-100 hover:text-white">Gestionar reservas →</Link>
        </aside>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="Ocupación por cancha" kicker="Capacidad">
          <div className="space-y-3">
            {metrics.courtDemand.map(({ court, count, blockCount, percent }) => <ProgressRow key={court.id} label={court.name} value={`${percent}%`} percent={percent} hint={`${count} reservas · ${blockCount} bloqueos`} />)}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <SmallSignal label="Profes activos" value={activeTeachers.length} />
            <SmallSignal label="Torneos abiertos" value={openTournaments.length} />
            <SmallSignal label="Franjas libres" value={freeSlots} />
          </div>
        </Panel>

        <Panel title="Agenda próxima del día" kicker="Operación">
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <div className="grid min-w-[430px] grid-cols-[92px_1fr_104px_96px] bg-white/[0.04] px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500"><span>Hora</span><span>Reserva</span><span>Importe</span><span>Estado</span></div>
            <div className="divide-y divide-white/10">
              {agenda.length ? agenda.map((booking) => <AgendaRow key={booking.id} booking={booking} />) : <p className="px-4 py-8 text-sm text-slate-500">Todavía no hay reservas para hoy.</p>}
            </div>
          </div>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-3">
        <Panel title="Actividad reciente" kicker="Sistema vivo">
          <div className="space-y-2">
            {activity.length ? activity.map((item) => <ActivityRow key={item.id} item={item} />) : <p className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-slate-400">Cuando haya reservas o bloqueos, se verán acá.</p>}
          </div>
        </Panel>
        <Panel title="Horarios más pedidos" kicker="Demanda">
          <div className="space-y-3">
            {metrics.topHours.map((h) => <ProgressRow key={h.hour} label={h.hour} value={`${h.count}`} percent={Math.min(100, h.count * 25)} hint="reservas" />)}
          </div>
        </Panel>
        <Panel title="Accesos de gestión" kicker="Atajos">
          <div className="grid gap-2">
            <QuickAction to={ROUTES.ADMIN_CALENDAR} code="CAL" title="Bloquear o liberar horarios" />
            <QuickAction to={ROUTES.ADMIN_BOOKINGS} code="RES" title="Confirmar pagos y reservas" />
            <QuickAction to={ROUTES.ADMIN_TEACHERS} code="PRO" title="Gestionar profesores" />
            <QuickAction to={ROUTES.ADMIN_CONFIG} code="CFG" title="Actualizar precios visibles" />
          </div>
        </Panel>
      </section>
    </AdminLayout>
  );
}

function ExecutiveMetric({ label, value, detail, alert = false }) { return <div className={`rounded-[1.6rem] border p-4 ${alert ? "border-amber-300/25 bg-amber-300/10" : "border-white/10 bg-black/35"}`}><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</p><p className="mt-2 text-3xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>; }
function FocusCard({ index, text }) { return <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.04] p-4 transition hover:-translate-y-0.5 hover:border-lime-300/35 hover:bg-lime-300/10"><p className="text-[10px] font-black text-lime-200">0{index}</p><p className="mt-2 text-sm font-semibold leading-5 text-white">{text}</p></div>; }
function PendingItem({ booking }) { return <div className="rounded-2xl border border-amber-300/20 bg-black/30 p-3"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-white">{booking.playerName}</p><p className="text-xs text-amber-100">{booking.date} · {booking.time}</p><p className="text-xs text-slate-400">{booking.courtName}</p></div><p className="font-black text-amber-100">{money(booking.price)}</p></div></div>; }
function Panel({ kicker, title, children }) { return <section className="min-w-0 max-w-full rounded-[1.8rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl"><p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">{kicker}</p><h2 className="mb-4 mt-1 text-xl font-bold text-white">{title}</h2>{children}</section>; }
function ProgressRow({ label, value, percent, hint }) { return <div><div className="mb-1 flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-white">{label}</span><span className="text-slate-300">{value}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} /></div><p className="mt-1 text-xs text-slate-500">{hint}</p></div>; }
function SmallSignal({ label, value }) { return <div className="rounded-2xl border border-white/10 bg-black/30 px-3 py-3"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>; }
function AgendaRow({ booking }) { return <div className="grid min-w-[430px] grid-cols-[92px_1fr_104px_96px] items-center px-4 py-3 text-sm hover:bg-white/[0.03]"><span className="font-black text-white">{booking.time}</span><div className="min-w-0"><p className="truncate font-semibold text-white">{booking.playerName}</p><p className="truncate text-xs text-slate-500">{booking.courtName}</p></div><span className="font-bold text-slate-200">{money(booking.price)}</span><StatusPill status={booking.status} /></div>; }
function ActivityRow({ item }) { return <div className="rounded-2xl border border-white/10 bg-black/25 p-3"><p className="text-sm font-semibold text-white">{item.title}</p><p className="mt-1 text-xs leading-5 text-slate-400">{item.detail}</p></div>; }
function QuickAction({ to, code, title }) { return <Link to={to} className="group flex items-center justify-between rounded-2xl border border-white/10 bg-black/30 px-4 py-3 transition hover:border-lime-300/35 hover:bg-lime-300/10"><span className="flex items-center gap-3"><span className="rounded-xl border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] font-black text-lime-100">{code}</span><span className="text-sm font-semibold text-white group-hover:text-lime-100">{title}</span></span><span className="text-slate-500 group-hover:text-lime-100">→</span></Link>; }
function StatusPill({ status }) { const c = { pendiente: "border-amber-400/40 bg-amber-400/10 text-amber-200", confirmado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200", cancelado: "border-rose-400/40 bg-rose-400/10 text-rose-200" }; const l = { pendiente: "Pendiente", confirmado: "Confirmado", cancelado: "Cancelado" }; return <span className={`w-fit rounded-full border px-2.5 py-1 text-[11px] font-bold ${c[status] || c.pendiente}`}>{l[status] || status}</span>; }
