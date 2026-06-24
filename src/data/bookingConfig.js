// src/data/bookingConfig.js
export const COURTS = [
  {
    id: "court1",
    name: "Cancha 1 - Cesped sintetico",
    description: "Outdoor - Cesped sintetico - LED",
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
    description: "Outdoor tech - Cesped fibrilado - LED",
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
    label: "Sena online (30%) - Mercado Pago",
    subtitle: "Pagas una sena ahora y el resto en el club.",
    badge: "Recomendado",
  },
  {
    id: "full",
    label: "Pagar todo ahora - Mercado Pago",
    subtitle: "Dejas el turno totalmente pago desde la web.",
    badge: "Pago completo",
  },
  {
    id: "cash",
    label: "Pagar en el club",
    subtitle: "Reservas ahora y abonas en efectivo o QR al llegar.",
    badge: "Efectivo / QR",
  },
];
