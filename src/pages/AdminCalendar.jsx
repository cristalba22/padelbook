import React, { useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { bookings as mockBookings } from "../data/adminMock.js";
import { COURTS, CLASS_HOURS, COURT_HOURS } from "../data/bookingConfig.js";
import { useBooking } from "../hooks/useBooking.jsx";
import { useSchedule } from "../hooks/useSchedule.jsx";

const BLOCK_REASONS = ["Mantenimiento", "Clase fija", "Torneo", "Limpieza", "Club cerrado"];
const ALL_HOURS = [...CLASS_HOURS, ...COURT_HOURS];

function normalizeBooking(booking) {
  const type = booking.type || (CLASS_HOURS.includes(booking.time || booking.hour) ? "clase" : "cancha");
  return {
    id: booking.id,
    date: booking.date,
    time: booking.time || booking.hour,
    courtId: String(booking.courtId || findCourtId(booking.courtOrClass || booking.courtName || booking.court)),
    court: booking.courtOrClass || booking.courtName || booking.court || "Cancha",
    player: booking.playerOrGroup || booking.playerName || booking.userName || "Jugador",
    price: Number(booking.price || booking.total || 0),
    status: booking.status || "pendiente",
    type,
  };
}

function findCourtId(name = "") {
  const found = COURTS.find((court) => String(name).toLowerCase().includes(court.name.toLowerCase().split(" - ")[0]));
  return found?.id || COURTS[0].id;
}

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function AdminCalendar() {
  const { bookings: userBookings = [] } = useBooking();
  const { blocks, addBlocks, clearDate, getBlock, toggleBlock, removeBlocksWhere } = useSchedule();
  const today = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(today);
  const [selectedReason, setSelectedReason] = useState(BLOCK_REASONS[0]);
  const [rangeStart, setRangeStart] = useState(CLASS_HOURS[0]);
  const [rangeEnd, setRangeEnd] = useState(CLASS_HOURS[CLASS_HOURS.length - 1]);
  const [rangeCourtId, setRangeCourtId] = useState("all");

  const allBookings = useMemo(() => {
    const source = userBookings.length ? userBookings : mockBookings;
    return source.map(normalizeBooking);
  }, [userBookings]);
  const dayBookings = useMemo(() => allBookings.filter((b) => b.date === selectedDate && b.status !== "cancelado"), [allBookings, selectedDate]);
  const dayBlocks = useMemo(() => blocks.filter((b) => b.date === selectedDate), [blocks, selectedDate]);
  const confirmed = dayBookings.filter((b) => b.status === "confirmado");
  const pending = dayBookings.filter((b) => b.status === "pendiente");
  const revenue = dayBookings.reduce((acc, b) => acc + b.price, 0);
  const totalSlots = COURTS.length * ALL_HOURS.length;
  const usedSlots = dayBookings.length + dayBlocks.length;
  const occupancy = Math.round((usedSlots / totalSlots) * 100);

  function findBooking(court, hour) {
    return dayBookings.find((b) => b.time === hour && String(b.courtId) === String(court.id));
  }

  function findBlock(court, hour) {
    return getBlock(selectedDate, court.id, hour);
  }

  function handleToggle(court, hour) {
    if (findBooking(court, hour)) return;
    toggleBlock({ date: selectedDate, courtId: court.id, hour, reason: selectedReason });
  }

  function getSelectedHours() {
    const startIndex = ALL_HOURS.indexOf(rangeStart);
    const endIndex = ALL_HOURS.indexOf(rangeEnd);
    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    return ALL_HOURS.slice(from, to + 1);
  }

  function getSelectedCourts() {
    if (rangeCourtId === "all") return COURTS;
    return COURTS.filter((court) => String(court.id) === String(rangeCourtId));
  }

  function applyCustomBlock() {
    const selectedHours = getSelectedHours();
    const selectedCourts = getSelectedCourts();
    const newBlocks = [];
    selectedCourts.forEach((court) => {
      selectedHours.forEach((hour) => {
        const hasBooking = dayBookings.some((booking) => String(booking.courtId) === String(court.id) && booking.time === hour);
        if (!hasBooking) newBlocks.push({ date: selectedDate, courtId: court.id, hour, reason: selectedReason });
      });
    });
    addBlocks(newBlocks);
  }

  function releaseCustomBlock() {
    const selectedHours = new Set(getSelectedHours());
    const selectedCourtIds = new Set(getSelectedCourts().map((court) => String(court.id)));
    removeBlocksWhere((block) => block.date === selectedDate && selectedCourtIds.has(String(block.courtId)) && selectedHours.has(block.hour));
  }

  function closeClub() {
    addBlocks(COURTS.flatMap((court) => ALL_HOURS.map((hour) => ({ date: selectedDate, courtId: court.id, hour, reason: "Club cerrado" }))));
  }

  return (
    <AdminLayout title="Calendario operativo" subtitle="Bloqueá horarios y administrá la disponibilidad real que ven los jugadores al reservar.">
      <section className="mb-6 grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-5 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-100">Agenda del día</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Disponibilidad por cancha</h2>
              <p className="mt-2 text-sm text-slate-400">Los bloqueos que cargues acá impactan inmediatamente en la pantalla de reservas.</p>
            </div>
            <label className="min-w-[210px]"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">Fecha</span><input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="field" /></label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Reservas" value={dayBookings.length} detail="cancha + clases" />
            <Kpi label="Confirmadas" value={confirmed.length} detail="listas para jugar" />
            <Kpi label="Pendientes" value={pending.length} detail="revisar pago" warn />
            <Kpi label="Caja estimada" value={money(revenue)} detail="del día" />
          </div>
        </div>

        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Gestión de disponibilidad</p>
          <p className="mt-2 text-sm text-slate-300">Elegí cancha, rango horario y motivo para aplicar cambios sobre el día seleccionado.</p>

          <label className="mt-4 block">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Cancha</span>
            <select value={rangeCourtId} onChange={(e) => setRangeCourtId(e.target.value)} className="field">
              <option value="all">Todas las canchas</option>
              {COURTS.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
            </select>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Desde</span><select value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="field">{ALL_HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
            <label className="block"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Hasta</span><select value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="field">{ALL_HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
          </div>

          <label className="mt-4 block"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Motivo</span><select value={selectedReason} onChange={(e) => setSelectedReason(e.target.value)} className="field">{BLOCK_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>

          <div className="mt-5 grid gap-2">
            <button onClick={applyCustomBlock} className="btn-primary justify-center">Bloquear rango seleccionado</button>
            <button onClick={releaseCustomBlock} className="btn-outline justify-center">Liberar rango seleccionado</button>
            <button onClick={closeClub} className="btn-outline justify-center">Cerrar club todo el día</button>
            <button onClick={() => clearDate(selectedDate)} className="btn-outline justify-center">Liberar bloqueos del día</button>
          </div>
        </aside>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {COURTS.map((court) => (
            <article key={court.id} className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-4 shadow-xl">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-lg font-black text-white">{court.name}</h3><p className="text-xs text-slate-500">Clases por la mañana y turnos de pádel por la tarde/noche.</p></div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">{courtOccupancy(court, dayBookings, dayBlocks)}% ocupada</span>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
                {ALL_HOURS.map((hour) => {
                  const booking = findBooking(court, hour);
                  const block = findBlock(court, hour);
                  return <SlotCard key={hour} hour={hour} booking={booking} block={block} onClick={() => handleToggle(court, hour)} />;
                })}
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <Side title="Ocupación del día" kicker="Indicador">
            <p className="text-5xl font-black text-lime-100">{occupancy}%</p>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${occupancy}%` }} /></div>
            <p className="mt-3 text-sm text-slate-400">{usedSlots} de {totalSlots} franjas ocupadas o bloqueadas.</p>
          </Side>
          <Side title="Bloqueos activos" kicker="Agenda">
            {dayBlocks.length === 0 ? <p className="text-sm text-slate-400">No hay bloqueos para esta fecha.</p> : dayBlocks.slice(0, 8).map((b) => <div key={b.id} className="mb-2 rounded-2xl border border-orange-300/20 bg-orange-300/10 p-3"><p className="font-bold text-white">{b.hour} · {courtName(b.courtId)}</p><p className="text-xs text-orange-100">{b.reason}</p></div>)}
          </Side>
          <Side title="Pagos pendientes" kicker="Prioridad">
            {pending.length === 0 ? <p className="text-sm text-slate-400">No hay pagos pendientes para esta fecha.</p> : pending.map((b) => <div key={b.id} className="mb-2 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-3"><p className="font-bold text-white">{b.player}</p><p className="text-xs text-amber-100">{b.time} · {b.court}</p></div>)}
          </Side>
        </aside>
      </section>
    </AdminLayout>
  );
}

function courtName(courtId) {
  return COURTS.find((c) => String(c.id) === String(courtId))?.name || "Cancha";
}
function courtOccupancy(court, bookings, blocks) {
  const used = bookings.filter((b) => String(b.courtId) === String(court.id)).length + blocks.filter((b) => String(b.courtId) === String(court.id)).length;
  return Math.round((used / ALL_HOURS.length) * 100);
}
function Kpi({ label, value, detail, warn }) { return <div className={`rounded-3xl border p-4 ${warn ? "border-amber-300/25 bg-amber-300/10" : "border-white/10 bg-black/30"}`}><p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-white">{value}</p><p className="text-xs text-slate-400">{detail}</p></div>; }
function SlotCard({ hour, booking, block, onClick }) {
  if (booking) return <div className={`rounded-2xl border p-3 ${booking.status === "pendiente" ? "border-amber-300/30 bg-amber-300/10" : "border-emerald-300/30 bg-emerald-300/10"}`}><p className="text-xs font-black text-white">{hour}</p><p className="mt-2 truncate text-sm font-bold text-white">{booking.player}</p><p className="text-[11px] uppercase text-slate-300">{booking.status}</p></div>;
  if (block) return <button onClick={onClick} className="rounded-2xl border border-orange-300/30 bg-orange-400/10 p-3 text-left transition hover:bg-orange-400/20"><p className="text-xs font-black text-white">{hour}</p><p className="mt-2 text-sm font-bold text-orange-100">{block.reason}</p><p className="text-[11px] text-orange-100/70">Liberar horario</p></button>;
  return <button onClick={onClick} className="rounded-2xl border border-white/10 bg-black/25 p-3 text-left transition hover:border-lime-300/40 hover:bg-lime-300/10"><p className="text-xs font-black text-white">{hour}</p><p className="mt-2 text-sm font-bold text-lime-100">Disponible</p><p className="text-[11px] text-slate-500">Bloquear horario</p></button>;
}
function Side({ kicker, title, children }) { return <section className="rounded-[2rem] border border-white/10 bg-[#0B1326]/75 p-5 shadow-xl"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{kicker}</p><h3 className="mb-4 mt-1 text-lg font-black text-white">{title}</h3>{children}</section>; }
