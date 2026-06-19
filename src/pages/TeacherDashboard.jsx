import React, { useMemo, useState } from "react";
import { COURTS, CLASS_HOURS } from "../data/bookingConfig.js";
import { useBooking } from "../hooks/useBooking.jsx";
import { sameSlot, useSchedule } from "../hooks/useSchedule.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { loadTeachers } from "../utils/teachersStorage.js";
import { usePricing } from "../context/PricingContext.jsx";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { bookings } = useBooking();
  const { prices } = usePricing();
  const { blocks, addBlocks, getBlock, removeBlocksWhere } = useSchedule();
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedCourtId, setSelectedCourtId] = useState("all");
  const [rangeStart, setRangeStart] = useState(CLASS_HOURS[0]);
  const [rangeEnd, setRangeEnd] = useState(CLASS_HOURS[CLASS_HOURS.length - 1]);

  const teachers = useMemo(() => loadTeachers(prices.classPrice), [prices.classPrice]);
  const teacherName = user?.name || teachers[0]?.name || "Profesor";
  const teacherNameLower = teacherName.toLowerCase();

  const classBookings = useMemo(() => bookings.filter((b) => {
    const isClass = b.type === "class" || b.type === "clase" || CLASS_HOURS.includes(b.time || b.hour);
    const assignedToMe = !b.teacherName || String(b.teacherName).toLowerCase() === teacherNameLower || String(b.teacherId || "") === String(user?.id || "");
    return isClass && assignedToMe && b.date === selectedDate && b.status !== "cancelado";
  }).sort((a, b) => String(a.time || a.hour).localeCompare(String(b.time || b.hour))), [bookings, selectedDate, teacherNameLower, user?.id]);

  const dayBlocks = blocks.filter((b) => b.date === selectedDate && CLASS_HOURS.includes(b.hour));
  const confirmed = classBookings.filter((b) => b.status === "confirmado");
  const pending = classBookings.filter((b) => b.status === "pendiente");
  const revenue = classBookings.reduce((acc, b) => acc + Number(b.price || 0), 0);

  function getSelectedHours() {
    const startIndex = CLASS_HOURS.indexOf(rangeStart);
    const endIndex = CLASS_HOURS.indexOf(rangeEnd);
    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    return CLASS_HOURS.slice(from, to + 1);
  }

  function getSelectedCourts() {
    if (selectedCourtId === "all") return COURTS;
    return COURTS.filter((court) => String(court.id) === String(selectedCourtId));
  }

  function blockSelectedRange() {
    const selectedHours = getSelectedHours();
    const selectedCourts = getSelectedCourts();
    const newBlocks = [];
    selectedCourts.forEach((court) => {
      selectedHours.forEach((hour) => {
        const reserved = classBookings.some((booking) => sameSlot(booking, selectedDate, court.id, hour));
        if (!reserved) newBlocks.push({ date: selectedDate, courtId: court.id, hour, reason: `No disponible - ${teacherName}`, type: "teacher" });
      });
    });
    addBlocks(newBlocks);
  }

  function freeSelectedRange() {
    const selectedHours = new Set(getSelectedHours());
    const selectedCourtIds = new Set(getSelectedCourts().map((court) => String(court.id)));
    removeBlocksWhere((block) => {
      const mine = block.reason?.includes(teacherName) || block.type === "teacher";
      return mine && block.date === selectedDate && selectedCourtIds.has(String(block.courtId)) && selectedHours.has(block.hour);
    });
  }

  return (
    <main className="py-10 text-white">
      <header className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-6 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.26em] text-lime-300">Panel del profesor</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">Agenda de clases</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">Visualizá alumnos, horarios y disponibilidad. Los bloqueos que cargues acá se reflejan en Reservar.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Kpi label="Clases" value={classBookings.length} detail="en el día" />
            <Kpi label="Confirmadas" value={confirmed.length} detail="listas" />
            <Kpi label="Pendientes" value={pending.length} detail="a revisar" warn />
            <Kpi label="Ingresos" value={money(revenue)} detail="estimado" />
          </div>
        </div>

        <aside className="rounded-[2rem] border border-lime-300/20 bg-lime-300/10 p-5 shadow-xl">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Mi disponibilidad</p>
          <label className="mt-4 block"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Fecha</span><input type="date" className="field" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></label>
          <label className="mt-4 block">
            <span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Cancha</span>
            <select value={selectedCourtId} onChange={(e) => setSelectedCourtId(e.target.value)} className="field">
              <option value="all">Todas las canchas</option>
              {COURTS.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
            </select>
          </label>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Desde</span><select value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} className="field">{CLASS_HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
            <label className="block"><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-400">Hasta</span><select value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} className="field">{CLASS_HOURS.map((hour) => <option key={hour}>{hour}</option>)}</select></label>
          </div>
          <div className="mt-4 grid gap-2">
            <button onClick={blockSelectedRange} className="btn-primary justify-center">Bloquear rango seleccionado</button>
            <button onClick={freeSelectedRange} className="btn-outline justify-center">Liberar rango seleccionado</button>
          </div>
        </aside>
      </header>

      <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Clases del día</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">Alumnos y horarios</h2>
            </div>
            <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-slate-300">{teacherName}</span>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                <tr className="border-b border-white/10"><th className="py-3 pr-4">Hora</th><th className="py-3 pr-4">Cancha</th><th className="py-3 pr-4">Alumno</th><th className="py-3 pr-4">Pago</th><th className="py-3 pr-4">Estado</th></tr>
              </thead>
              <tbody>
                {classBookings.map((booking) => (
                  <tr key={booking.id} className="border-b border-white/5 last:border-0">
                    <td className="py-4 pr-4 font-black text-white">{booking.time || booking.hour}</td>
                    <td className="py-4 pr-4 text-slate-300">{booking.courtName || booking.court || "Cancha"}</td>
                    <td className="py-4 pr-4"><p className="font-bold text-white">{booking.playerName || booking.userName || "Jugador"}</p><p className="text-xs text-slate-500">{booking.userEmail}</p></td>
                    <td className="py-4 pr-4 font-bold text-lime-200">{money(booking.price)}</td>
                    <td className="py-4 pr-4"><Status status={booking.status} /></td>
                  </tr>
                ))}
                {!classBookings.length && <tr><td colSpan="5" className="py-10 text-center text-slate-500">No hay clases reservadas para esta fecha.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-[2rem] border border-white/10 bg-[#0B1326]/80 p-5 shadow-xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-100">Disponibilidad 09–12</p>
            <div className="mt-4 space-y-3">
              {COURTS.map((court) => (
                <div key={court.id} className="rounded-2xl border border-white/10 bg-black/25 p-3">
                  <p className="text-sm font-black">{court.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {CLASS_HOURS.map((hour) => {
                      const block = getBlock(selectedDate, court.id, hour);
                      const reserved = classBookings.find((b) => sameSlot(b, selectedDate, court.id, hour));
                      return <span key={hour} className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reserved ? "border-emerald-300/40 bg-emerald-400/10 text-emerald-100" : block ? "border-orange-300/40 bg-orange-400/10 text-orange-100" : "border-white/10 text-slate-300"}`}>{hour} {reserved ? "Reservado" : block ? "Bloq." : "Libre"}</span>;
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Kpi({ label, value, detail, warn = false }) {
  return <div className={`rounded-3xl border p-4 ${warn ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-black/25"}`}><p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function Status({ status }) {
  const map = { confirmado: "border-emerald-300/40 bg-emerald-400/10 text-emerald-100", pendiente: "border-amber-300/40 bg-amber-400/10 text-amber-100", cancelado: "border-red-300/40 bg-red-400/10 text-red-100" };
  return <span className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase ${map[status] || map.pendiente}`}>{status || "pendiente"}</span>;
}
