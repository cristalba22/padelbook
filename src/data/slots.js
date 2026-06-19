// src/data/slots.js

// horarios disponibles por cancha
export const mockSlots = [
  // cancha 1
  { courtId: 1, time: "18:00", isAvailable: false, price: 18000 },
  { courtId: 1, time: "19:00", isAvailable: true, price: 24000 },
  { courtId: 1, time: "20:00", isAvailable: true, price: 24000 },

  // cancha 2
  { courtId: 2, time: "18:00", isAvailable: true, price: 18000 },
  { courtId: 2, time: "19:00", isAvailable: true, price: 24000 },
  { courtId: 2, time: "20:00", isAvailable: true, price: 24000 },

  // cancha 3
  { courtId: 3, time: "18:00", isAvailable: true, price: 18000 },
  { courtId: 3, time: "19:00", isAvailable: true, price: 24000 },
  { courtId: 3, time: "20:00", isAvailable: false, price: 24000 },

  // clases (id 4)
  { courtId: 4, time: "09:00", isAvailable: true, price: 30000 },
  { courtId: 4, time: "10:00", isAvailable: true, price: 30000 },
  { courtId: 4, time: "11:00", isAvailable: true, price: 30000 },
];

// si tu Admin.jsx todavía espera esto, lo dejamos
export const mockBookings = [
  {
    id: 101,
    date: "2025-10-28",
    time: "19:00",
    courtName: "Cancha 2 - Blindex Premium",
    price: 24000,
    playerName: "Laura Lencina",
    phone: "+54 11 5555-1111",
    status: "confirmado",
  },
  {
    id: 102,
    date: "2025-10-28",
    time: "20:00",
    courtName: "Cancha 1 - Césped Sintético",
    price: 24000,
    playerName: "Cristian Alba",
    phone: "+54 11 5555-2222",
    status: "pendiente",
  },
  {
    id: 103,
    date: "2025-10-30",
    time: "21:00",
    courtName: "Cancha 3 - Techada",
    price: 24000,
    playerName: "Mila Dog",
    phone: "+54 11 5555-3333",
    status: "confirmado",
  },
];
