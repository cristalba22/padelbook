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
export const COURT_HOURS = ["13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"];
export const COURT_DAY_END = "23:00";

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
    badge: "Pago completo",
  },
  {
    id: "cash",
    label: "Pagar en el club",
    subtitle: "Reservás ahora y abonás en efectivo o QR al llegar.",
    badge: "Efectivo / QR",
  },
];
