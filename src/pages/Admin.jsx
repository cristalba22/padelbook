import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CircleCheck, Clock3, ClipboardList, CircleDollarSign, Plus, TrendingUp } from "lucide-react";
import AdminLayout from "../components/AdminLayout.jsx";
import { useAdminDemoBookings } from "../hooks/useAdminDemoBookings.jsx";
import { COURTS } from "../data/bookingConfig.js";
import { useBooking } from "../hooks/useBooking.jsx";
import { useSchedule } from "../hooks/useSchedule.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { ROUTES } from "../constants/routes.js";
import { money } from "../utils/businessMetrics.js";
import { readActivity } from "../utils/activityLog.js";
import { apiRequest } from "../utils/apiClient.js";
import { paymentSummary } from "../utils/paymentDomain.js";

const START_MINUTES = 18 * 60;
const END_MINUTES = 22 * 60;
const GRID_TIMES = Array.from({ length: 8 }, (_, index) => `${String(18 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);

function localDateString(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutes(time = "00:00") {
  const [hour, minute] = String(time).split(":").map(Number);
  return hour * 60 + minute;
}

function courtIdOf(booking) {
  const explicit = String(booking.courtId || "");
  if (COURTS.some((court) => court.id === explicit)) return explicit;
  const match = String(booking.courtName || booking.courtOrClass || "").match(/Cancha\s*(\d+)/i);
  return match ? `court${match[1]}` : "";
}

function normalizeBooking(booking) {
  return {
    id: booking.id,
    date: booking.date,
    time: booking.time || booking.hour || "",
    durationMinutes: Number(booking.durationMinutes || 60),
    courtId: courtIdOf(booking),
    courtName: booking.courtName || booking.courtOrClass || "Cancha",
    playerName: booking.playerName || booking.playerOrGroup || "Jugador",
    price: Number(booking.price || 0),
    paymentStatus: booking.paymentStatus || "",
    amountPaid: booking.amountPaid,
    paymentOption: booking.paymentOption || "cash",
    status: booking.status || "pendiente",
    type: booking.type || "court",
  };
}

function paymentLabel(booking) {
  const payment = paymentSummary(booking);
  if (payment.due === 0) return "Pago completo";
  if (payment.paid > 0) return `Cobrado ${money(payment.paid)} · saldo ${money(payment.due)}`;
  if (booking.paymentStatus === "a_pagar_en_club") return "Paga en el club";
  if (booking.paymentStatus === "pendiente_pago") return "Pago pendiente";
  return "Pago sin verificar";
}

function slotPosition(booking) {
  const start = minutes(booking.time);
  const end = start + booking.durationMinutes;
  if (start < START_MINUTES || start >= END_MINUTES) return null;
  const row = Math.floor((start - START_MINUTES) / 30) + 2;
  const span = Math.max(1, Math.ceil((Math.min(end, END_MINUTES) - start) / 30));
  return { row, span };
}

function formatDate(date) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export default function AdminDashboard() {
  const { bookings: storedBookings = [] } = useBooking();
  const { demoBookings } = useAdminDemoBookings();
  const { apiOnline } = useAuth();
  const { blocks } = useSchedule();
  const [date, setDate] = useState(localDateString);
  const [selectedId, setSelectedId] = useState(null);
  const [activity, setActivity] = useState(() => readActivity(3));
  const isDemo = !apiOnline && storedBookings.length === 0;

  useEffect(() => {
    let active = true;
    const load = () => apiRequest("/activity")
      .then(({ activity: items }) => { if (active) setActivity((items || []).slice(0, 3)); })
      .catch(() => { if (active) setActivity(readActivity(3)); });
    load();
    window.addEventListener("padel:activity-updated", load);
    return () => { active = false; window.removeEventListener("padel:activity-updated", load); };
  }, []);

  const bookings = useMemo(() => (isDemo ? demoBookings : storedBookings).map(normalizeBooking), [isDemo, storedBookings]);
  const dayBookings = useMemo(() => bookings.filter((booking) => booking.date === date && booking.status !== "cancelado").sort((a, b) => a.time.localeCompare(b.time)), [bookings, date]);
  const dayBlocks = useMemo(() => blocks.filter((block) => block.date === date), [blocks, date]);
  const courtBookings = dayBookings.filter((booking) => booking.courtId && slotPosition(booking));
  const selected = dayBookings.find((booking) => String(booking.id) === String(selectedId)) || courtBookings[0] || dayBookings[0] || null;
  const pendingBookings = dayBookings.filter((booking) => booking.status === "pendiente");
  const bookedValue = dayBookings.reduce((sum, booking) => sum + booking.price, 0);
  const occupied = new Set();
  COURTS.forEach((court) => GRID_TIMES.forEach((time, index) => {
    const start = minutes(time);
    const taken = courtBookings.some((booking) => booking.courtId === court.id && minutes(booking.time) < start + 30 && minutes(booking.time) + booking.durationMinutes > start);
    const blocked = dayBlocks.some((block) => String(block.courtId) === court.id && minutes(block.hour || block.time) < start + 30 && minutes(block.hour || block.time) + 60 > start);
    if (taken || blocked) occupied.add(`${court.id}:${index}`);
  }));
  const capacity = COURTS.length * GRID_TIMES.length;
  const occupancy = Math.round(occupied.size / capacity * 100);
  const freeMinutes = (capacity - occupied.size) * 30;

  return (
    <AdminLayout>
      <div className="club-dashboard">
        <div className="club-dashboard__intro">
          <div><p className="club-dashboard__eyebrow">{formatDate(date)}</p><h1>Todo listo para jugar.</h1><p>Tu agenda y tus reservas, en el mismo lugar.</p></div>
          <Link to={ROUTES.ADMIN_CALENDAR} className="club-dashboard__primary"><Plus size={17} aria-hidden="true" /> Gestionar agenda</Link>
        </div>

        <div className="club-dashboard__metrics" aria-label="Resumen del día">
          <Metric Icon={CircleDollarSign} label="Valor de reservas" value={money(bookedValue)} note="Reservas activas del día" />
          <Metric Icon={Clock3} label="Por confirmar" value={pendingBookings.length} note={pendingBookings.length === 1 ? "1 reserva requiere seguimiento" : `${pendingBookings.length} reservas requieren seguimiento`} />
          <Metric Icon={TrendingUp} label="Ocupación" value={`${occupancy}%`} note={`${freeMinutes / 60} h libres entre 18 y 22`} />
        </div>

        <div className="club-dashboard__workspace">
          <section className="club-dashboard__calendar" aria-label="Agenda por cancha">
            <div className="club-dashboard__section-header"><div><p className="club-dashboard__eyebrow">OPERACIÓN</p><h2>Agenda de canchas</h2></div><label className="club-dashboard__date"><CalendarDays size={16} aria-hidden="true" /><span className="sr-only">Fecha de la agenda</span><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setSelectedId(null); }} aria-label="Fecha de la agenda" /></label></div>
            <div className="club-dashboard__grid-scroll"><div className="club-dashboard__grid">
              {COURTS.map((court, index) => <div className="club-dashboard__court" key={court.id} style={{ gridColumn: index + 2, gridRow: 1 }}>{court.name.split(" - ")[0]}</div>)}
              {GRID_TIMES.map((time, index) => <span className="club-dashboard__time" key={time} style={{ gridColumn: 1, gridRow: index + 2 }}>{time}</span>)}
              {courtBookings.map((booking) => {
                const position = slotPosition(booking);
                const column = COURTS.findIndex((court) => court.id === booking.courtId) + 2;
                return <button key={booking.id} type="button" className={`club-dashboard__slot club-dashboard__slot--${booking.paymentStatus === "pagado" ? "paid" : booking.status === "pendiente" ? "pending" : "reserved"}`} aria-pressed={selected?.id === booking.id} onClick={() => setSelectedId(booking.id)} style={{ gridColumn: column, gridRow: `${position.row} / span ${position.span}` }} aria-label={`${booking.playerName}, ${booking.courtName}, ${booking.time}, ${booking.status}`}><strong>{booking.playerName}</strong><small>{booking.time} · {booking.durationMinutes} min</small><span>{booking.status === "pendiente" ? "Por confirmar" : paymentLabel(booking)}</span></button>;
              })}
              {dayBlocks.filter((block) => minutes(block.hour || block.time) >= START_MINUTES && minutes(block.hour || block.time) < END_MINUTES && COURTS.some((court) => court.id === String(block.courtId))).map((block) => {
                const column = COURTS.findIndex((court) => court.id === String(block.courtId)) + 2;
                const row = Math.floor((minutes(block.hour || block.time) - START_MINUTES) / 30) + 2;
                const overlaps = courtBookings.some((booking) => booking.courtId === String(block.courtId) && minutes(booking.time) < minutes(block.hour || block.time) + 60 && minutes(booking.time) + booking.durationMinutes > minutes(block.hour || block.time));
                return overlaps ? null : <div key={block.id} className="club-dashboard__blocked" style={{ gridColumn: column, gridRow: `${row} / span 2` }} aria-label={`${block.reason || "Horario bloqueado"}, ${block.hour || block.time}`}><strong>Bloqueado</strong><small>{block.reason || "No disponible"}</small></div>;
              })}
              {COURTS.flatMap((court, courtIndex) => GRID_TIMES.map((time, rowIndex) => {
                const key = `${court.id}:${rowIndex}`;
                if (occupied.has(key)) return null;
                return <div key={key} className="club-dashboard__free" style={{ gridColumn: courtIndex + 2, gridRow: rowIndex + 2 }} aria-label={`${court.name}, ${time}, libre`} />;
              }))}
            </div></div>
            <div className="club-dashboard__legend"><span><i className="club-dashboard__dot club-dashboard__dot--paid" /> Pago registrado</span><span><i className="club-dashboard__dot club-dashboard__dot--reserved" /> Reservado</span><span><i className="club-dashboard__dot club-dashboard__dot--pending" /> Por confirmar</span><span><i className="club-dashboard__dot club-dashboard__dot--free" /> Libre</span></div>
          </section>

          <aside className="club-dashboard__detail" aria-live="polite">
            {selected ? <>
              <div className="club-dashboard__detail-top"><span>RESERVA</span><span className="club-dashboard__confirmed"><CircleCheck size={14} aria-hidden="true" /> {selected.status === "confirmado" ? "Confirmada" : "Por confirmar"}</span></div>
              <div className="club-dashboard__person"><span className="club-dashboard__person-avatar" aria-hidden="true">{selected.playerName.slice(0, 1).toUpperCase()}</span><div><h2>{selected.playerName}</h2><p>{selected.type === "class" || selected.type === "clase" ? "Clase con profesor" : "Turno de cancha"}</p></div></div>
              <dl className="club-dashboard__facts"><div><dt>Cancha / clase</dt><dd>{selected.courtName}</dd></div><div><dt>Horario</dt><dd>{selected.time}</dd></div><div><dt>Duración</dt><dd>{selected.durationMinutes} min</dd></div></dl>
              <div className="club-dashboard__payment"><div><span>Valor del turno</span><strong>{money(selected.price)}</strong></div><div><span>Estado de pago</span><strong>{paymentLabel(selected)}</strong></div></div>
              <Link to={ROUTES.ADMIN_BOOKINGS} className="club-dashboard__detail-action">Gestionar reserva <ArrowRight size={16} aria-hidden="true" /></Link>
            </> : <div className="club-dashboard__empty"><CalendarDays size={28} aria-hidden="true" /><h2>Sin reservas para este día</h2><p>Elegí otra fecha o consultá el calendario para gestionar la disponibilidad.</p><Link to={ROUTES.ADMIN_CALENDAR}>Abrir calendario <ArrowRight size={15} aria-hidden="true" /></Link></div>}
          </aside>
        </div>

        <div className="club-dashboard__lower">
          <section className="club-dashboard__lower-panel"><div className="club-dashboard__lower-title"><div><p className="club-dashboard__eyebrow">SEGUIMIENTO</p><h2>Reservas por confirmar</h2></div><Link to={ROUTES.ADMIN_BOOKINGS}>Ver todas <ArrowRight size={15} aria-hidden="true" /></Link></div>{pendingBookings.length ? pendingBookings.slice(0, 3).map((booking) => <div className="club-dashboard__list-row" key={booking.id}><span><strong>{booking.playerName}</strong><small>{booking.time} · {booking.courtName}</small></span><span>{money(booking.price)}</span></div>) : <p className="club-dashboard__no-data">No hay reservas por confirmar para esta fecha.</p>}</section>
          <section className="club-dashboard__lower-panel"><div className="club-dashboard__lower-title"><div><p className="club-dashboard__eyebrow">MOVIMIENTOS</p><h2>Actividad reciente</h2></div><Link to={ROUTES.ADMIN_FINANCE}>Ver cobros <ArrowRight size={15} aria-hidden="true" /></Link></div>{activity.length ? activity.map((item) => <div className="club-dashboard__list-row" key={item.id}><span><strong>{item.title}</strong><small>{item.detail}</small></span></div>) : <p className="club-dashboard__no-data">Las nuevas operaciones aparecerán acá.</p>}</section>
        </div>
        <div className="club-dashboard__bottom"><span><ClipboardList size={14} aria-hidden="true" /> {dayBookings.length} reservas activas en la fecha</span><Link to={ROUTES.ADMIN_FINANCE}>Ir a finanzas <ArrowRight size={14} aria-hidden="true" /></Link></div>
      </div>
    </AdminLayout>
  );
}

function Metric({ Icon, label, value, note }) {
  return <div className="club-dashboard__metric"><span><Icon size={15} aria-hidden="true" /> {label}</span><strong>{value}</strong><small>{note}</small></div>;
}
