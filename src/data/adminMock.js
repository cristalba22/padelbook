// src/data/adminMock.js

const today = new Date();
const addDays = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

export const courts = [
  { id: 1, name: "Cancha 1 - Cesped sintetico" },
  { id: 2, name: "Cancha 2 - Blindex Premium" },
  { id: 3, name: "Cancha 3 - Techada" },
];

export const teachers = [
  {
    id: 1,
    name: "Lucio Profe",
    nickname: "Lucio",
    specialty: "Clases individuales",
    status: "activo",
    todayClasses: 3,
  },
  {
    id: 2,
    name: "Eze Entrenador",
    nickname: "Eze",
    specialty: "Clases grupales / mixtas",
    status: "activo",
    todayClasses: 2,
  },
  {
    id: 3,
    name: "Laura Tecnica",
    nickname: "Laura",
    specialty: "Tecnica y nivel intermedio",
    status: "activo",
    todayClasses: 1,
  },
  {
    id: 4,
    name: "Juan Carlos",
    nickname: "Juan",
    specialty: "Turnos nocturnos",
    status: "vacaciones",
    todayClasses: 0,
  },
];

export const tournaments = [
  {
    id: 1,
    name: "Copa Primavera",
    status: "finalizado",
    date: addDays(-14),
    category: "Mixto libre",
    surface: "Mixta",
    pricePerPlayer: 25000,
    currentPlayers: 32,
    maxPlayers: 32,
    revenueConfirmed: 32 * 25000,
  },
  {
    id: 2,
    name: "Relampago nocturno",
    status: "abierto",
    date: addDays(5),
    category: "Mixto hasta 7ma",
    surface: "Cesped sintetico",
    pricePerPlayer: 25000,
    currentPlayers: 12,
    maxPlayers: 16,
    revenueConfirmed: 12 * 25000,
  },
  {
    id: 3,
    name: "Mixto finde",
    status: "lleno",
    date: addDays(9),
    category: "Mixto libre",
    surface: "Blindex premium",
    pricePerPlayer: 28000,
    currentPlayers: 24,
    maxPlayers: 24,
    revenueConfirmed: 24 * 28000,
  },
  {
    id: 4,
    name: "Ranking interno",
    status: "en_curso",
    date: addDays(16),
    category: "Caballeros 5ta/6ta",
    surface: "Mixta",
    pricePerPlayer: 0,
    currentPlayers: 40,
    maxPlayers: 64,
    revenueConfirmed: 0,
  },
];

export const bookings = [
  {
    id: 1,
    date: addDays(0),
    time: "19:00",
    type: "cancha",
    courtOrClass: "Cancha 1 - Cesped sintetico",
    playerOrGroup: "Laura Lencina",
    note: "Turno regular de los viernes",
    phone: "+5493511111111",
    price: 24000,
    status: "confirmado",
  },
  {
    id: 2,
    date: addDays(0),
    time: "21:00",
    type: "cancha",
    courtOrClass: "Cancha 3 - Techada",
    playerOrGroup: "Bruno Perez",
    note: "Pidio pagar en el club",
    phone: "+5493512222222",
    price: 24000,
    status: "pendiente",
  },
  {
    id: 3,
    date: addDays(0),
    time: "09:00",
    type: "clase",
    courtOrClass: "Clase con profesor (Lucio)",
    playerOrGroup: "Grupo intermedio",
    note: "Clase grupal hasta 4",
    phone: "+5493513333333",
    price: 30000,
    status: "confirmado",
  },
  {
    id: 4,
    date: addDays(1),
    time: "11:00",
    type: "clase",
    courtOrClass: "Clase con profesor (Lucio)",
    playerOrGroup: "Clase individual",
    note: "Cancelado por lluvia",
    phone: "+5493514444444",
    price: 30000,
    status: "cancelado",
  },
];
