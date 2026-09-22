// src/data/bookingConfig.js
export const COURTS = [
  {
    id: "court1",
    name: "Cancha 1 - Césped sintético",
    description: "Outdoor - Césped sintético - LED",
    tag: "Muy elegida para partidos nocturnos",
  },
  {
    id: "court2",
    name: "Cancha 2 - Blindex Premium",
    description: "Indoor - Blindex - Tech / LED",
    tag: "Ideal para viento o lluvia",
  },
  {
    id: "court3",
    name: "Cancha 3 - Techada",
    description: "Outdoor tech - Césped fibrilado - LED",
    tag: "Perfecta para clases y torneos",
  },
];

export const CLASS_HOURS = ["09:00", "10:00", "11:00", "12:00"];
export const COURT_DAY_START = "09:00";
export const COURT_DAY_END = "22:00";
export function buildCourtHours(openingTime = COURT_DAY_START, closingTime = COURT_DAY_END, intervalMinutes = 30) {
  const [openHour, openMinute] = openingTime.split(":").map(Number);
  const [closeHour, closeMinute] = closingTime.split(":").map(Number);
  const start = openHour * 60 + openMinute;
  const end = closeHour * 60 + closeMinute;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || ![30, 60].includes(Number(intervalMinutes))) return [];
  return Array.from({ length: Math.ceil((end - start) / Number(intervalMinutes)) }, (_, index) => {
    const totalMinutes = start + index * Number(intervalMinutes);
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  }).filter((hour) => {
    const [hh, mm] = hour.split(":").map(Number);
    return hh * 60 + mm < end;
  });
}

export const COURT_HOURS = buildCourtHours();

export const DURATION_OPTIONS = [
  { minutes: 60, label: "1 h", shortLabel: "1h" },
  { minutes: 90, label: "1:30 h", shortLabel: "1:30", recommended: true },
  { minutes: 120, label: "2 h", shortLabel: "2h" },
  { minutes: 150, label: "2:30 h", shortLabel: "2:30" },
];

export const PAYMENT_OPTIONS = [
  {
    id: "deposit",
    label: "Seña coordinada (30%)",
    subtitle: "El club te confirma el medio de pago por WhatsApp o en recepción.",
    badge: "Recomendado",
  },
  {
    id: "full",
    label: "Pago total coordinado",
    subtitle: "Dejás el turno reservado y el club registra el pago cuando lo recibe.",
    badge: "Monto total",
  },
  {
    id: "cash",
    label: "Pagar en el club",
    subtitle: "Reservás ahora y abonás en efectivo o QR al llegar.",
    badge: "Efectivo / QR",
  },
];
