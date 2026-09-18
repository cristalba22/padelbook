// src/pages/AdminBookings.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { useAdminDemoBookings } from "../hooks/useAdminDemoBookings.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { buildBookingWhatsAppUrl } from "../utils/whatsapp.js";
import { useToast } from "../components/ToastProvider.jsx";
import { lastReversiblePayment, paymentSummary, PAYMENT_METHODS } from "../utils/paymentDomain.js";
import { COURTS, COURT_HOURS, DURATION_OPTIONS } from "../data/bookingConfig.js";
import { argentinaDateISO, blockOverlapsBooking, bookingsOverlap, fitsOperatingHours, isPastSlot } from "../utils/bookingDomain.js";
import { getCourtPriceForDuration } from "../utils/pricing.js";
import { usePricing } from "../context/PricingContext.jsx";
import { useSchedule } from "../hooks/useSchedule.jsx";

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
    paymentStatus: booking.paymentStatus || "pendiente_pago",
    paymentOption: booking.paymentOption || "cash",
    amountPaid: booking.amountPaid,
    paymentEntries: booking.paymentEntries || [],
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
  const { bookings: userBookings = [], addBooking, updateBookingStatus, recordPayment, undoLastPayment } = useBooking();
  const { apiOnline } = useAuth();
  const { prices } = usePricing();
  const { blocks } = useSchedule();
  const { demoBookings, updateDemoBookingStatus } = useAdminDemoBookings();
  const { notify } = useToast();
  const [dateFilter, setDateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [paymentBooking, setPaymentBooking] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("transferencia");
  const [paymentNote, setPaymentNote] = useState("");
  const [manual, setManual] = useState({ date: argentinaDateISO(), courtId: COURTS[0].id, time: "18:00", durationMinutes: 60, playerName: "", phone: "", userEmail: "" });
  const [manualBusy, setManualBusy] = useState(false);
  const paymentDialogRef = useRef(null);
  const paymentRequestRef = useRef(null);
  const reversalRequestRef = useRef(null);

  useEffect(() => {
    if (!paymentBooking) return;
    const previousFocus = document.activeElement;
    paymentDialogRef.current?.querySelector("input, button")?.focus();
    return () => previousFocus?.focus?.();
  }, [paymentBooking?.id]);

  function handlePaymentDialogKey(event) {
    if (event.key === "Escape") { setPaymentBooking(null); return; }
    if (event.key !== "Tab") return;
    const elements = [...paymentDialogRef.current.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  const bookings = useMemo(() => {
    const webBookings = userBookings.map(normalizeUserBooking);
    return !apiOnline && webBookings.length === 0 ? demoBookings : webBookings;
  }, [userBookings, demoBookings, apiOnline]);

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
    updateDemoBookingStatus(id, status);
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

  function handlePayment(booking) {
    const summary = paymentSummary(booking);
    setPaymentBooking(booking);
    setPaymentAmount(String(summary.suggested));
    setPaymentMethod("transferencia");
    setPaymentNote("");
    paymentRequestRef.current = null;
    reversalRequestRef.current = null;
  }

  async function submitPayment(event) {
    event.preventDefault();
    if (!paymentBooking) return;
    setBusyId(`${paymentBooking.id}-payment`);
    try {
      paymentRequestRef.current ||= crypto.randomUUID();
      await recordPayment(paymentBooking.id, { amount: Number(paymentAmount), method: paymentMethod, note: paymentNote, idempotencyKey: paymentRequestRef.current });
      notify({ type: "success", title: "Cobro registrado", message: `${paymentBooking.playerOrGroup} · ${money(paymentAmount)}` });
      paymentRequestRef.current = null;
      setPaymentBooking(null);
    } catch (error) {
      notify({ type: "error", title: "No se pudo registrar el cobro", message: error.message || "Revisá la conexión." });
    } finally {
      setBusyId("");
    }
  }

  async function undoPayment() {
    if (!paymentBooking || !window.confirm("¿Revertir el último cobro registrado? El movimiento quedará en el historial.")) return;
    setBusyId(`${paymentBooking.id}-payment`);
    try {
      reversalRequestRef.current ||= crypto.randomUUID();
      await undoLastPayment(paymentBooking.id, reversalRequestRef.current);
      notify({ type: "success", title: "Cobro revertido", message: paymentBooking.playerOrGroup });
      reversalRequestRef.current = null;
      setPaymentBooking(null);
    } catch (error) {
      notify({ type: "error", title: "No se pudo revertir", message: error.message });
    } finally {
      setBusyId("");
    }
  }

  function handlePending(booking) {
    setBookingStatus(booking, "pendiente");
  }

  function handleCancel(booking) {
    const collected = paymentSummary(booking).paid;
    if (!window.confirm(`¿Seguro que querés cancelar esta reserva?${collected > 0 ? ` Hay ${money(collected)} cobrados: coordiná el reintegro y revertí el cobro en Caja.` : ""}`)) return;
    setBookingStatus(booking, "cancelado");
  }

  function handleWhatsApp(b) {
    const url = buildBookingWhatsAppUrl({ phone: b.phone, player: b.playerOrGroup, date: b.date, time: b.time, endTime: b.endTime, court: b.courtOrClass, status: b.status, price: b.price, mode: "admin" });
    if (!url) {
      notify({ type: "warning", title: "Sin teléfono", message: "Cargá el teléfono del jugador para escribirle por WhatsApp." });
      return;
    }
    window.open(url, "_blank");
    notify({ type: "info", title: "WhatsApp preparado", message: "Se abrió el mensaje con el detalle de la reserva." });
  }

  async function createManualBooking(event) {
    event.preventDefault();
    const durationMinutes = Number(manual.durationMinutes);
    const candidate = { date: manual.date, courtId: manual.courtId, time: manual.time, durationMinutes };
    if (isPastSlot(manual.date, manual.time) || !fitsOperatingHours(manual.time, durationMinutes)) {
      notify({ type: "warning", title: "Horario inválido", message: "Elegí un turno futuro dentro del horario del club." });
      return;
    }
    if (userBookings.some((item) => bookingsOverlap(item, candidate)) || blocks.some((item) => blockOverlapsBooking(item, candidate))) {
      notify({ type: "warning", title: "Horario ocupado", message: "Esa cancha ya tiene un turno o bloqueo que se cruza." });
      return;
    }
    setManualBusy(true);
    try {
      const court = COURTS.find((item) => item.id === manual.courtId);
      const booking = await addBooking({ ...candidate, type: "court", courtName: court.name, playerName: manual.playerName.trim(), phone: manual.phone.trim(), userEmail: manual.userEmail.trim(), paymentOption: "cash", price: getCourtPriceForDuration(manual.time, manual.date, durationMinutes, prices), description: "Reserva cargada por recepción" });
      if (booking?.duplicated) throw new Error("Ese horario acaba de ocuparse. Actualizá la agenda y elegí otro.");
      notify({ type: "success", title: "Reserva creada", message: `${manual.playerName} · ${manual.date} ${manual.time}. Pago pendiente en el club.` });
      setManual((current) => ({ ...current, playerName: "", phone: "", userEmail: "" }));
    } catch (cause) {
      notify({ type: "error", title: "No se pudo crear el turno", message: cause.message || "Revisá los datos y volvé a intentar." });
    } finally { setManualBusy(false); }
  }

  return (
    <AdminLayout title="Reservas" subtitle="Buscá turnos, confirmá solicitudes y seguí lo que pasa en el club.">
      <form onSubmit={createManualBooking} className="admin-panel mb-5 rounded-3xl border border-white/10 p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3"><div><p className="club-dashboard__eyebrow">MOSTRADOR Y WHATSAPP</p><h2 className="mt-1 text-xl font-bold text-white">Cargar un turno</h2><p className="mt-1 text-sm text-slate-400">Para jugadores que llaman o escriben al club. El precio se calcula en el servidor y el cobro queda pendiente.</p></div><button type="submit" disabled={manualBusy} className="btn-primary px-5 py-2.5">{manualBusy ? "Guardando..." : "Crear reserva"}</button></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><label className="text-xs text-slate-300">Fecha<input type="date" min={argentinaDateISO()} required value={manual.date} onChange={(event) => setManual((current) => ({ ...current, date: event.target.value }))} className="field mt-1" /></label><label className="text-xs text-slate-300">Cancha<select value={manual.courtId} onChange={(event) => setManual((current) => ({ ...current, courtId: event.target.value }))} className="field mt-1">{COURTS.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}</select></label><label className="text-xs text-slate-300">Hora de inicio<select value={manual.time} onChange={(event) => setManual((current) => ({ ...current, time: event.target.value }))} className="field mt-1">{COURT_HOURS.filter((hour) => fitsOperatingHours(hour, Number(manual.durationMinutes))).map((hour) => <option key={hour}>{hour}</option>)}</select></label><label className="text-xs text-slate-300">Duración<select value={manual.durationMinutes} onChange={(event) => { const duration = Number(event.target.value); setManual((current) => ({ ...current, durationMinutes: duration, time: fitsOperatingHours(current.time, duration) ? current.time : "18:00" })); }} className="field mt-1">{DURATION_OPTIONS.map((option) => <option key={option.minutes} value={option.minutes}>{option.label}</option>)}</select></label><label className="text-xs text-slate-300">Nombre del jugador<input required minLength={2} maxLength={100} value={manual.playerName} onChange={(event) => setManual((current) => ({ ...current, playerName: event.target.value }))} className="field mt-1" placeholder="Nombre y apellido" /></label><label className="text-xs text-slate-300">Teléfono<input required maxLength={40} value={manual.phone} onChange={(event) => setManual((current) => ({ ...current, phone: event.target.value }))} className="field mt-1" placeholder="351..." /></label><label className="text-xs text-slate-300">Email (opcional)<input type="email" value={manual.userEmail} onChange={(event) => setManual((current) => ({ ...current, userEmail: event.target.value }))} className="field mt-1" placeholder="jugador@email.com" /></label></div>
      </form>
      <section className="club-bookings__filters">
        <div className="club-bookings__section-heading"><div><p className="club-dashboard__eyebrow">OPERACIÓN</p><h2>Encontrá una reserva</h2></div><p>Filtrá por fecha, tipo o estado</p></div>
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

        <div className="club-bookings__metrics">
          <Metric label="Filtradas" value={filtered.length} />
          <Metric label="Confirmadas" value={summary.confirmed.length} tone="emerald" />
          <Metric label="Pendientes" value={summary.pending.length} tone="amber" />
          <Metric label="Canceladas" value={summary.cancelled.length} tone="rose" />
          <Metric label="Ingreso estimado" value={money(summary.revenue)} tone="lime" />
        </div>
      </section>

      <section className="club-bookings__list">
        <div>
          <div className="club-bookings__list-heading">
            <div>
              <p className="club-dashboard__eyebrow">LISTADO OPERATIVO</p>
              <h2>{filtered.length} {filtered.length === 1 ? "reserva encontrada" : "reservas encontradas"}</h2>
            </div>
            <button onClick={() => { setDateFilter(""); setTypeFilter("todos"); setStatusFilter("todos"); setSearch(""); }} className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:border-lime-400/50 hover:text-lime-200">Limpiar filtros</button>
          </div>

          <div className="club-bookings__table-wrap hidden overflow-x-auto lg:block">
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
                {filtered.map((booking) => <BookingRow key={booking.id} booking={booking} busyId={busyId} onWhatsApp={handleWhatsApp} onConfirm={handleConfirm} onPending={handlePending} onCancel={handleCancel} onPayment={handlePayment} />)}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-500">No hay reservas con esos filtros.</td></tr>}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 lg:hidden">
            {filtered.map((booking) => <BookingMobileCard key={booking.id} booking={booking} busyId={busyId} onWhatsApp={handleWhatsApp} onConfirm={handleConfirm} onPending={handlePending} onCancel={handleCancel} onPayment={handlePayment} />)}
            {filtered.length === 0 && <p className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No hay reservas con esos filtros.</p>}
          </div>
        </div>

      </section>
      {paymentBooking && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentBooking(null); }}>
        <form ref={paymentDialogRef} onKeyDown={handlePaymentDialogKey} onSubmit={submitPayment} role="dialog" aria-modal="true" aria-labelledby="payment-title" className="w-full max-w-md rounded-3xl border border-lime-300/25 bg-[#111827] p-6 shadow-2xl">
          <p className="club-dashboard__eyebrow">CAJA DEL CLUB</p><h2 id="payment-title" className="mt-1 text-xl font-bold">Registrar cobro</h2>
          <p className="mt-2 text-sm text-slate-300">{paymentBooking.playerOrGroup} · {paymentBooking.date} {paymentBooking.timeLabel}</p>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><Info label="Total" value={money(paymentSummary(paymentBooking).total)} /><Info label="Cobrado" value={money(paymentSummary(paymentBooking).paid)} /><Info label="Saldo" value={money(paymentSummary(paymentBooking).due)} /></div>
          {paymentBooking.paymentOption === "deposit" && <p className="mt-3 text-xs text-lime-200">Seña sugerida: {money(paymentSummary(paymentBooking).deposit)}. Podés registrar un importe distinto hasta completar el saldo.</p>}
          {paymentBooking.status !== "cancelado" && paymentSummary(paymentBooking).due > 0 && <><label className="mt-5 block text-sm">Importe recibido<input className="field mt-2" type="number" min="1" max={paymentSummary(paymentBooking).due} step="1" required value={paymentAmount} onChange={(event) => { paymentRequestRef.current = null; setPaymentAmount(event.target.value); }} /></label>
          <label className="mt-4 block text-sm">Medio de cobro<select className="field mt-2" value={paymentMethod} onChange={(event) => { paymentRequestRef.current = null; setPaymentMethod(event.target.value); }}>{PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method[0].toUpperCase() + method.slice(1)}</option>)}</select></label>
          <label className="mt-4 block text-sm">Nota (opcional)<input className="field mt-2" maxLength={300} value={paymentNote} onChange={(event) => { paymentRequestRef.current = null; setPaymentNote(event.target.value); }} placeholder="Ej. seña por transferencia" /></label></>}
          {paymentBooking.paymentEntries.length > 0 && <div className="mt-4 max-h-36 space-y-1 overflow-y-auto border-t border-white/10 pt-3 text-xs text-slate-300"><p className="font-bold text-white">Historial de cobros</p>{[...paymentBooking.paymentEntries].reverse().map((entry) => <p key={entry.id}>{new Date(entry.at).toLocaleString("es-AR")} · {entry.amount < 0 ? "Reversión " : "Cobro "}{money(Math.abs(entry.amount))} · {entry.method}</p>)}</div>}
          <div className="mt-6 flex gap-2"><button type="button" className="btn-outline flex-1" onClick={() => setPaymentBooking(null)}>Cerrar</button>{paymentBooking.status !== "cancelado" && paymentSummary(paymentBooking).due > 0 && <button type="submit" disabled={Boolean(busyId)} className="btn-primary flex-1">{busyId ? "Guardando..." : "Registrar cobro"}</button>}</div>
          {lastReversiblePayment(paymentBooking) && <button type="button" disabled={Boolean(busyId)} onClick={undoPayment} className="mt-3 w-full text-xs text-rose-200 underline underline-offset-2">Revertir último cobro</button>}
        </form>
      </div>}
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
  return <div className={`club-bookings__metric rounded-2xl border px-3 py-3 ${tones[tone]}`}><p className="text-[10px] uppercase tracking-[0.16em] opacity-70">{label}</p><p className="mt-1 text-lg font-black">{value}</p></div>;
}

function BookingRow({ booking, busyId, onWhatsApp, onConfirm, onPending, onCancel, onPayment }) {
  return (
    <tr className="border-t border-white/10 align-top transition hover:bg-white/[0.03]">
      <td className="px-3 py-4 font-semibold text-white">{booking.date}</td>
      <td className="px-3 py-4 text-slate-200">{booking.timeLabel || booking.time}</td>
      <td className="px-3 py-4"><p className="font-semibold text-white">{booking.courtOrClass}</p><p className="mt-1 text-xs text-slate-500">{booking.note || (booking.type === "clase" ? "Clase con profe" : "Turno de cancha")}</p></td>
      <td className="px-3 py-4"><p className="font-semibold text-white">{booking.playerOrGroup}</p><p className="mt-1 text-xs text-slate-500">{booking.phone}</p></td>
      <td className="px-3 py-4 font-bold text-white">{money(booking.price)}<span className="club-bookings__payment-label">{paymentText(booking)}</span></td>
      <td className="px-3 py-4"><StatusPill status={booking.status} /></td>
      <td className="px-3 py-4"><ActionBar booking={booking} busyId={busyId} onWhatsApp={onWhatsApp} onConfirm={onConfirm} onPending={onPending} onCancel={onCancel} onPayment={onPayment} align="end" /></td>
    </tr>
  );
}

function BookingMobileCard({ booking, busyId, onWhatsApp, onConfirm, onPending, onCancel, onPayment }) {
  return <article className="rounded-3xl border border-white/10 bg-black/35 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-slate-500">{booking.date} · {booking.timeLabel || booking.time}</p><h3 className="mt-1 font-semibold text-white">{booking.playerOrGroup}</h3><p className="text-sm text-slate-400">{booking.courtOrClass}</p></div><StatusPill status={booking.status} /></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><Info label="Teléfono" value={booking.phone} /><Info label="Importe" value={`${money(booking.price)} · ${paymentText(booking)}`} /></div><ActionBar booking={booking} busyId={busyId} onWhatsApp={onWhatsApp} onConfirm={onConfirm} onPending={onPending} onCancel={onCancel} onPayment={onPayment} /></article>;
}

function ActionBar({ booking, busyId, onWhatsApp, onConfirm, onPending, onCancel, onPayment, align = "start" }) {
  const isBusy = String(busyId || "").startsWith(`${booking.id}-`);
  return <div className={`mt-0 flex flex-wrap gap-2 ${align === "end" ? "justify-end" : "mt-4"}`}><button disabled={isBusy} onClick={() => onWhatsApp(booking)} className="action-btn border-emerald-400/35 text-emerald-200 hover:bg-emerald-400/10">WhatsApp</button>{booking.status === "pendiente" && <button disabled={isBusy} onClick={() => onConfirm(booking)} className="action-btn border-sky-400/35 text-sky-200 hover:bg-sky-400/10">{busyId === `${booking.id}-confirmado` ? "Guardando..." : "Confirmar"}</button>}{booking.status === "confirmado" && <button disabled={isBusy} onClick={() => onPending(booking)} className="action-btn border-amber-400/35 text-amber-200 hover:bg-amber-400/10">{busyId === `${booking.id}-pendiente` ? "Guardando..." : "Pendiente"}</button>}{booking.source === "web" && (booking.status !== "cancelado" || lastReversiblePayment(booking)) && <button disabled={isBusy} onClick={() => onPayment(booking)} className="action-btn border-lime-400/35 text-lime-200 hover:bg-lime-400/10">{paymentSummary(booking).due > 0 && booking.status !== "cancelado" ? "Registrar cobro" : "Ver cobros"}</button>}{booking.status !== "cancelado" && <button disabled={isBusy} onClick={() => onCancel(booking)} className="action-btn border-rose-400/35 text-rose-200 hover:bg-rose-400/10">{busyId === `${booking.id}-cancelado` ? "Cancelando..." : "Cancelar"}</button>}</div>;
}

function paymentText(booking) {
  const summary = paymentSummary(booking);
  if (summary.due === 0) return "Pago completo";
  if (summary.paid > 0) return `Cobrado ${money(summary.paid)} · Saldo ${money(summary.due)}`;
  if (booking.paymentStatus === "a_pagar_en_club") return "Paga en el club";
  return booking.source === "web" ? "Pago pendiente" : "Pago sin verificar";
}

function Info({ label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2"><p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p><p className="font-semibold text-white">{value}</p></div>;
}

function StatusPill({ status }) {
  const classes = { confirmado: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200", pendiente: "border-amber-400/40 bg-amber-400/10 text-amber-200", cancelado: "border-rose-400/40 bg-rose-400/10 text-rose-200" };
  const labels = { confirmado: "Confirmado", pendiente: "Pendiente", cancelado: "Cancelado" };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes[status] || classes.pendiente}`}>{labels[status] || status}</span>;
}
