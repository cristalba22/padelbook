import { COURTS, COURT_HOURS } from "../data/bookingConfig.js";
import { sameSlot } from "../hooks/useSchedule.jsx";

export function money(value) {
  return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function normalizeBooking(booking = {}) {
  return {
    id: booking.id,
    date: booking.date,
    time: booking.time || booking.hour || booking.hora,
    courtId: String(booking.courtId ?? booking.court ?? ""),
    courtName: booking.courtName || booking.court || booking.courtOrClass || "Cancha",
    playerName: booking.playerName || booking.userName || booking.playerOrGroup || "Jugador",
    userEmail: booking.userEmail || "",
    phone: booking.phone || "Sin teléfono",
    type: booking.teacherId || booking.type === "clase" || booking.type === "class" ? "clase" : "cancha",
    status: booking.status || "pendiente",
    paymentStatus: booking.paymentStatus || "pendiente_pago",
    price: Number(booking.price || booking.total || booking.monto || 0),
    description: booking.description || booking.note || "Reserva registrada",
    createdAt: booking.createdAt,
  };
}

export function getActiveBookings(bookings = []) {
  return bookings.map(normalizeBooking).filter((b) => b.status !== "cancelado" && b.status !== "cancelada");
}

export function buildAdminMetrics(bookings = [], blocks = [], date = todayISO()) {
  const normalized = bookings.map(normalizeBooking);
  const active = normalized.filter((b) => b.status !== "cancelado" && b.status !== "cancelada");
  const day = active.filter((b) => b.date === date);
  const confirmed = day.filter((b) => b.status === "confirmado");
  const pending = day.filter((b) => b.status === "pendiente");
  const revenueDay = day.reduce((acc, b) => acc + b.price, 0);
  const totalSlots = COURTS.length * COURT_HOURS.length;
  const blockedDay = blocks.filter((b) => b.date === date).length;
  const occupied = Math.min(totalSlots, day.length + blockedDay);
  const occupancy = totalSlots ? Math.round((occupied / totalSlots) * 100) : 0;
  const courtDemand = COURTS.map((court) => {
    const count = day.filter((b) => String(b.courtId) === String(court.id) || String(b.courtName).includes(`Cancha ${court.id}`)).length;
    const blockCount = blocks.filter((b) => b.date === date && String(b.courtId) === String(court.id)).length;
    return { court, count, blockCount, percent: Math.round(((count + blockCount) / COURT_HOURS.length) * 100) };
  });
  const topHours = COURT_HOURS.map((hour) => ({ hour, count: day.filter((b) => b.time === hour).length })).sort((a, b) => b.count - a.count).slice(0, 4);
  const weekRevenue = active.reduce((acc, b) => acc + b.price, 0);
  return { normalized, active, day, confirmed, pending, revenueDay, weekRevenue, occupancy, totalSlots, blockedDay, courtDemand, topHours };
}

export function getAvailabilityForHome({ bookings = [], blocks = [], date = todayISO() }) {
  return COURTS.map((court) => {
    const freeHour = COURT_HOURS.find((hour) => {
      const blocked = blocks.some((block) => block.date === date && String(block.courtId) === String(court.id) && block.hour === hour);
      const reserved = bookings.some((booking) => sameSlot(booking, date, court.id, hour));
      return !blocked && !reserved;
    });
    return { court, freeHour, isAvailable: Boolean(freeHour) };
  });
}
