// src/data/slots.js

const today = new Date();
const addDays = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

// Horarios disponibles por cancha.
export const mockSlots = [
  { courtId: 1, time: "18:00", isAvailable: false, price: 18000 },
  { courtId: 1, time: "19:00", isAvailable: true, price: 24000 },
  { courtId: 1, time: "20:00", isAvailable: true, price: 24000 },

  { courtId: 2, time: "18:00", isAvailable: true, price: 18000 },
  { courtId: 2, time: "19:00", isAvailable: true, price: 24000 },
  { courtId: 2, time: "20:00", isAvailable: true, price: 24000 },

  { courtId: 3, time: "18:00", isAvailable: true, price: 18000 },
  { courtId: 3, time: "19:00", isAvailable: true, price: 24000 },
  { courtId: 3, time: "20:00", isAvailable: false, price: 24000 },

  { courtId: 4, time: "09:00", isAvailable: true, price: 30000 },
  { courtId: 4, time: "10:00", isAvailable: true, price: 30000 },
  { courtId: 4, time: "11:00", isAvailable: true, price: 30000 },
];

export const mockBookings = [
  {
    id: 101,
    date: addDays(0),
    time: "19:00",
    courtName: "Cancha 2 - Blindex Premium",
    price: 24000,
    playerName: "Laura Lencina",
    phone: "+54 11 5555-1111",
    status: "confirmado",
  },
  {
    id: 102,
    date: addDays(0),
    time: "20:00",
    courtName: "Cancha 1 - Césped sintético",
    price: 24000,
    playerName: "Cristian Alba",
    phone: "+54 11 5555-2222",
    status: "pendiente",
  },
  {
    id: 103,
    date: addDays(1),
    time: "21:00",
    courtName: "Cancha 3 - Techada",
    price: 24000,
    playerName: "Mila Domínguez",
    phone: "+54 11 5555-3333",
    status: "confirmado",
  },
];
