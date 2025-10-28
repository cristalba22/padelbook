// Disponibilidad mock
export const mockSlots = [
  { courtId: 1, time: "18:00", isAvailable: false, price: 5000 },
  { courtId: 1, time: "19:00", isAvailable: true,  price: 5000 },
  { courtId: 1, time: "20:00", isAvailable: true,  price: 5000 },

  { courtId: 2, time: "18:00", isAvailable: true,  price: 5500 },
  { courtId: 2, time: "19:00", isAvailable: false, price: 5500 },
  { courtId: 2, time: "20:00", isAvailable: true,  price: 5500 },

  { courtId: 3, time: "18:00", isAvailable: true,  price: 6000 },
  { courtId: 3, time: "19:00", isAvailable: true,  price: 6000 },
  { courtId: 3, time: "20:00", isAvailable: false, price: 6000 }
];

// Reservas mock para el panel admin
export const mockBookings = [
  {
    id: 101,
    date: "2025-10-28",
    time: "19:00",
    courtName: "Cancha 2 - Blindex Premium",
    price: 5500,
    playerName: "Laura Lencina",
    phone: "+54 11 5555-1111",
    status: "confirmado"
  },
  {
    id: 102,
    date: "2025-10-28",
    time: "20:00",
    courtName: "Cancha 1 - Césped Sintético",
    price: 5000,
    playerName: "Cristian Alba",
    phone: "+54 11 5555-2222",
    status: "pendiente"
  },
  {
    id: 103,
    date: "2025-10-30",
    time: "21:00",
    courtName: "Cancha 3 - Techada",
    price: 6000,
    playerName: "Mila Dog",
    phone: "+54 11 5555-3333",
    status: "confirmado"
  }
];
