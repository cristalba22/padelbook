// src/pages/AdminBookings.jsx
import React, { useMemo, useState } from "react";
import { bookings as initialBookings } from "../data/adminMock.js";
import AdminLayout from "../components/AdminLayout.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { buildBookingWhatsAppUrl } from "../utils/whatsapp.js";
import { useToast } from "../components/ToastProvider.jsx";

function normalizeUserBooking(booking) {
  const time = booking.time || booking.hour;
  return {
    id: booking.id,
    date: booking.date,
    time,
    endTime: booking.endTime || "",
    durationMinutes: booking.durationMinutes || 60,
    timeLabel: booking.endTime ? `${time} a ${booking.endTime}` : time,
    type: booking.type === "class" || booking.teacherId || booking.teacherName ? "clase" : "cancha",
    courtOrClass: booking.courtName || booking.court || "Turno de cancha",
    playerOrGroup: booking.playerName || booking.userName || "Jugador web",
    note: booking.description || "Reserva registrada desde el sitio",
    phone: booking.phone || "Sin teléfono",
    price: Number(booking.price || booking.total || 0),
    status: booking.status || "pendiente",
    source: "web",
  };
}

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export default function AdminBookings() {
  const { bookings: userBookings = [], updateBookingStatus } = useBooking();
  const { notify } = useToast();
  const [localBookings, setLocalBookings] = useState(initialBookings);
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");

  const bookings = useMemo(() => {
    const webBookings = userBookings.map(normalizeUserBooking);
    return webBookings.length ? webBookings : localBookings;
  }, [userBookings, localBookings]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (dateFilter && b.date !== dateFilter) return false;
      if (typeFilter !== "todos" && b.type !== typeFilter) return false;
      if (statusFilter !== "todos" && b.status !== statusFilter) return false;
      if (!query) return true;
      return [b.playerOrGroup, b.courtOrClass, b.phone, b.note].some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [bookings, dateFilter, typeFilter, statusFilter, search]);

  const summary = useMemo(() => {
    const confirmed = filtered.filter((b) => b.status === "confirmado");
    const pending = filtered.filter((b) => b.status === "pendiente");
    const cancelled = filtered.filter((b) => b.status === "cancelado");
    const revenue = filtered.filter((b) => b.status !== "cancelado").reduce((acc, b) => acc + b.price, 0);
    return { confirmed, pending, cancelled, revenue };
  }, [filtered]);

  function updateLocalStatus(id, status) {
    setLocalBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status } : b)));
  }

  async function setBookingStatus(booking, status) {
    setBusyId(`${booking.id}-${status}`);
    try {
      if (booking.source === "web") {
        await updateBookingStatus(booking.id, status);
      } else {
        updateLocalStatus(booking.id, status);
      }

      const labels = {
        confirmado: "Reserva confirmada",
        pendiente: "Reserva pendiente",
        cancelado: "Reserva cancelada",
      };
      const type = status === "cancelado" ? "error" : status === "pendiente" ? "warning" : "success";
      notify({ type, title: labels[status] || "Reserva actualizada", message: `${booking.playerOrGroup} - ${booking.date} ${booking.timeLabel || booking.time}` });
    } catch (error) {
      notify({ type: "error", title: "No se pudo actualizar", message: error.message || "Revisá la conexión con la API." });
    } finally {
      setBusyId("");
    }
  }

  function handleConfirm(booking) {
    setBookingStatus(booking, "confirmado");
  }

  function handlePending(booking) {
    setBookingStatus(booking, "pendiente");
  }

  function handleCancel(booking) {
    if (!window.confirm("¿Seguro que querés cancelar esta reserva?")) return;
    setBookingStatus(booking, "cancelado");
  }

  function handleWhatsApp(b) {
    window.open(buildBookingWhatsAppUrl({ phone: b.phone, player: b.playerOrGroup, date: b.date, time: b.time, endTime: b.endTime, court: b.courtOrClass, status: b.status, price: b.price, mode: "admin" }), "_blank");
    notify({ type: "info", title: "WhatsApp preparado", message: "Se abrió el mensaje con el detalle de la reserva." });
  }

  return (
    <AdminLayout title="Reservas del club" subtitle="Gestioná reservas con filtros, acciones rápidas, estados y vista tipo CRM sin perder visibilidad.">
      <section className="mb-6 rounded-[1.7rem] border border-white/10 bg-[#0B1326]/70 p-4 shadow-xl">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_1.6fr]">
          <FilterBlock label="Fecha">
            <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} className="field" />
          </FilterBlock>
          <FilterBlock label="Tipo">
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="field">
              <option value="todos">Todos</option>
              <option value="cancha">Turnos de cancha</option>
              <option value="clase">Clases con profesor</option>
            </select>
          </FilterBlock>
          <FilterBlock label="Estado">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="field">
              <option value="todos">Todos</option>
              <option value="confirmado">Confirmados</option>
              <option value="pendiente">Pendientes</option>
              <option value="cancelado">Cancelados</option>
            </select>
          </FilterBlock>
          <FilterBlock label="Buscar">
            <input type="text" placeholder="Jugador, teléfono, cancha o nota" value={search} onChange={(e) => setSearch(e.target.value)} className="field" />
          </FilterBlock>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <Metric label="Filtradas" value={filtered.length} />
          <Metric label="Confirmadas" value={summary.confirmed.length} tone="emerald" />
          <Metric label="Pendientes" value={summary.pending.length} tone="amber" />
          <Metric label="Canceladas" value={summary.cancelled.length} tone="rose" />
          <Metric label="Ingreso estimado" value={money(summary.revenue)} tone="lime" />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="rounded-[1.7rem] border border-white/10 bg-[#0B1326]/70 p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-between px-1">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">Listado operativo</p>
              <h2 className="text-lg font-semibold text-white">Reservas encontradas</h2>
            </div>
            <button onClick={() => { setDateFilter(""); setTypeFilter("todos"); setStatusFilter("todos"); setSearch(""); }} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-lime-400/50 hover:text-lime-200">Limpiar filtros</button>
          </div>

          <div className="hidden overflow-x-auto rounded-2xl border border-white/10 lg:block">
            <table className="min-w-[900px] w-full table-auto border-collapse text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="w-[105px] px-3 py-3 text-left">Fecha</th>
                  <th className="w-[70px] px-3 py-3 text-left">Hora</th>
                  <th className="px-3 py-3 text-left">Reserva</th>
                  <th className="w-[160px] px-3 py-3 text-left">Jugador</th>
                  <th className="w-[120px] px-3 py-3 text-left">Importe</th>
                  <th className="w-[115px] px-3 py-3 text-left">Estado</th>
                  <th className="w-[230px] px-3 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => <BookingRow key={booking.id} booking={booking} busyId={busyId} onWhatsApp={handleWhatsApp} onConfirm={handleConfirm} onPending={handlePending} onCancel={handleCancel} />)}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-500">No hay reservas con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {filtered.map((booking) => <BookingMobileCard key={booking.id} booking={booking} busyId={busyId} onWhatsApp={handleWhatsApp} onConfirm={handleConfirm} onPending={handlePending} onCancel={handleCancel} />)}
            {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No hay reservas con esos filtros.</p>}
          </div>
        </div>

        <aside className="space-y-4">
          <SidePanel title="Prioridad de gestión" kicker="Checklist">
            <CheckItem ok={summary.pending.length === 0} text={summary.pending.length === 0 ? "Pagos al día" : `${summary.pending.length} pagos por confirmar`} />
            <CheckItem ok={summary.cancelled.length === 0} text={summary.cancelled.length === 0 ? "Sin cancelaciones filtradas" : `${summary.cancelled.length} cancelaciones para revisar`} />
            <CheckItem ok={filtered.length > 0} text={filtered.length > 0 ? "Listado actualizado" : "Sin reservas en la vista"} />
          </SidePanel>

          <SidePanel title="Orden de trabajo" kicker="Gestión">
            <p className="text-sm text-slate-400">Resolvé primero los pagos pendientes y después revisá el calendario para compactar horarios y reducir huecos entre turnos.</p>
          </SidePanel>
        </aside>
      </section>
    </AdminLayout>
  );
}

function FilterBlock({ label, children }) {
  return <label><span className="mb-2 block text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</span>{children}</label>;
}

function Metric({ label, value, tone = "slate" }) {
  const tones = {
    slate: "border-white/10 bg-black/35 text-white",
    emerald: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    rose: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    lime: "border-lime-400/25 bg-lime-400/10 text-lime-200",
  };
  return <div className={`rounded-2xl border px-3 py-3 ${tones[tone]}`}><p className="text-[10px] uppercase tracking-[0.16em] opacity-70">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}

function BookingRow({ booking, busyId, onWhatsApp, onConfirm, onPending, onCancel }) {
  return (
    <tr className="border-t border-white/10 align-top transition hover:bg-white/[0.03]">
      <td className="px-3 py-4 font-semibold text-white">{booking.date}</td>
      <td className="px-3 py-4 text-slate-200">{booking.timeLabel || booking.time}</td>
      <td className="px-3 py-4"><p className="font-semibold text-white">{booking.courtOrClass}</p><p className="mt-1 text-xs text-slate-500">{booking.note || (booking.type === "clase" ? "Clase con profe" : "Turno de cancha")}</p></td>
      <td className="px-3 py-4"><p className="font-semibold text-white">{booking.playerOrGroup}</p><p className="mt-1 text-xs text-slate-500">{booking.phone}</p></td>
      <td className="px-3 py-4 font-bold text-white">{money(booking.price)}</td>
      <td className="px-3 py-4"><StatusPill status={booking.status} /></td>
      <td className="px-3 py-4"><ActionBar booking={booking} busyId={busyId} onWhatsApp={onWhatsApp} onConfirm={onConfirm} onPending={onPending} onCancel={onCancel} align="end" /></td>
    </tr>
  );
}

function BookingMobileCard({ booking, busyId, onWhatsApp, onConfirm, onPending, onCancel }) {
  return <article className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{booking.date} · {booking.timeLabel || booking.time}</p><h3 className="mt-1 font-semibold text-white">{booking.playerOrGroup}</h3><p className="text-sm text-slate-400">{booking.courtOrClass}</p></div><StatusPill status={booking.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Info label="Teléfono" value={booking.phone} /><Info label="Importe" value={money(booking.price)} /></div><ActionBar booking={booking} busyId={busyId} onWhatsApp={onWhatsApp} onConfirm={onConfirm} onPending={onPending} onCancel={onCancel} /></article>;
}

function ActionBar({ booking, busyId, onWhatsApp, onConfirm, onPending, onCancel, align = "start" }) {
  const isBusy = String(busyId || "").startsWith(`${booking.id}-`);
  return <div className={`mt-0 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : "mt-4"}`}><button disabled={isBusy} onClick={() => onWhatsApp(booking)} className="action-btn border-emerald-400/35 text-emerald-200 hover:bg-emerald-400/10">WhatsApp</button>{booking.status === "pendiente" && <button disabled={isBusy} onClick={() => onConfirm(booking)} className="action-btn border-sky-400/35 text-sky-200 hover:bg-sky-400/10">{busyId === `${booking.id}-confirmado` ? "Guardando..." : "Confirmar"}</button>}{booking.status === "confirmado" && <button disabled={isBusy} onClick={() => onPending(booking)} className="action-btn border-amber-400/35 text-amber-200 hover:bg-amber-400/10">{busyId === `${booking.id}-pendiente` ? "Guardando..." : "Pendiente"}</button>}{booking.status !== "cancelado" && <button disabled={isBusy} onClick={() => onCancel(booking)} className="action-btn border-rose-400/35 text-rose-200 hover:bg-rose-400/10">{busyId === `${booking.id}-cancelado` ? "Cancelando..." : "Cancelar"}</button>}</div>;
}

function Info({ label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="font-semibold text-white">{value}</p></div>;
}

function StatusPill({ status }) {
  const classes = { confirmado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200", pendiente: "border-amber-400/40 bg-amber-400/10 text-amber-200", cancelado: "border-rose-400/40 bg-rose-400/10 text-rose-200" };
  const labels = { confirmado: "Confirmado", pendiente: "Pendiente", cancelado: "Cancelado" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes[status] || classes.pendiente}`}>{labels[status] || status}</span>;
}

function SidePanel({ kicker, title, children }) {
  return <section className="rounded-[1.7rem] border border-white/10 bg-[#0B1326]/70 p-4"><p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{kicker}</p><h3 className="mb-4 mt-1 text-lg font-semibold text-white">{title}</h3>{children}</section>;
}

function CheckItem({ ok, text }) {
  return <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-sm"><span className={ok ? "text-emerald-300" : "text-amber-300"}>{ok ? "✓" : "!"}</span><span className="text-slate-300">{text}</span></div>;
}
