import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MONGODB_URI } from "./config.mjs";

const today = new Date();
const addDays = (days) => {
  const date = new Date(today);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

const baseOptions = {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(_doc, ret) {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      return ret;
    },
  },
};

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ["admin", "teacher", "player"], default: "player" },
  phone: { type: String, default: "" },
  category: { type: String, default: "Sin categoria" },
}, baseOptions);

const bookingSchema = new mongoose.Schema({
  date: { type: String, required: true },
  time: { type: String, required: true },
  courtId: { type: String, required: true },
  courtName: { type: String, required: true },
  type: { type: String, default: "court" },
  teacherId: { type: String, default: null },
  teacherName: { type: String, default: "" },
  description: { type: String, default: "" },
  userId: { type: String, default: "" },
  userEmail: { type: String, default: "" },
  playerName: { type: String, default: "Jugador" },
  phone: { type: String, default: "" },
  price: { type: Number, default: 0 },
  paymentOption: { type: String, default: "cash" },
  paymentStatus: { type: String, default: "pendiente_pago" },
  status: { type: String, enum: ["pendiente", "confirmado", "cancelado"], default: "pendiente" },
}, baseOptions);

bookingSchema.index({ date: 1, time: 1, courtId: 1, status: 1 });

const registrationSchema = new mongoose.Schema({
  userId: String,
  name: String,
  email: String,
  phone: String,
  category: String,
  partnerName: { type: String, default: "" },
  partnerPhone: { type: String, default: "" },
  status: { type: String, default: "pendiente" },
  paymentStatus: { type: String, default: "pendiente" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: null },
}, { _id: true, versionKey: false, toJSON: { virtuals: true } });

const tournamentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ["abierto", "lleno", "en_curso", "finalizado", "cancelado"], default: "abierto" },
  date: { type: String, required: true },
  hour: { type: String, default: "19:00" },
  category: { type: String, default: "Mixto libre" },
  surface: { type: String, default: "Mixta" },
  pricePerPlayer: { type: Number, default: 25000 },
  seededPlayers: { type: Number, default: 0 },
  currentPlayers: { type: Number, default: 0 },
  maxPlayers: { type: Number, default: 16 },
  prize: { type: String, default: "Premio del club" },
  description: { type: String, default: "" },
  registrations: [registrationSchema],
}, baseOptions);

const settingsSchema = new mongoose.Schema({
  clubName: { type: String, default: "Arena Norte Padel Club" },
  whatsapp: { type: String, default: "+5493510000000" },
  openingHours: { type: String, default: "09:00 a 22:00" },
  courtPrice: { type: Number, default: 18000 },
  nightPrice: { type: Number, default: 24000 },
  weekendExtra: { type: Number, default: 3000 },
  classPrice: { type: Number, default: 30000 },
  tournamentPrice: { type: Number, default: 25000 },
  teacherCommissionPercent: { type: Number, default: 50 },
}, baseOptions);

const activitySchema = new mongoose.Schema({
  type: String,
  title: String,
  detail: String,
  actor: String,
  bookingId: String,
}, baseOptions);

const expenseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  concept: { type: String, required: true },
  category: { type: String, default: "operativo" },
  amount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: "efectivo" },
  note: { type: String, default: "" },
}, baseOptions);

export const User = mongoose.model("User", userSchema);
export const Booking = mongoose.model("Booking", bookingSchema);
export const Tournament = mongoose.model("Tournament", tournamentSchema);
export const Setting = mongoose.model("Setting", settingsSchema);
export const Activity = mongoose.model("Activity", activitySchema);
export const Expense = mongoose.model("Expense", expenseSchema);

export async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error("Falta MONGODB_URI. Configura MongoDB Atlas o una instancia local en .env.");
  }
  await mongoose.connect(MONGODB_URI, { dbName: "padelbook" });
  await seedDatabase();
}

export function dbState() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function addActivity(item) {
  await Activity.create(item);
  const count = await Activity.countDocuments();
  if (count > 80) {
    const old = await Activity.find().sort({ createdAt: -1 }).skip(80).select("_id");
    await Activity.deleteMany({ _id: { $in: old.map((item) => item._id) } });
  }
}

async function seedDatabase() {
  if (await User.countDocuments()) return;

  await User.insertMany([
    { name: "Admin Club", email: "admin@club.com", passwordHash: bcrypt.hashSync("admin123", 10), role: "admin", phone: "+5493510000000", category: "Gestión" },
    { name: "Lucio Profe", email: "lucio@club.com", passwordHash: bcrypt.hashSync("profe123", 10), role: "teacher", phone: "+5493511111111", category: "Profesor" },
    { name: "Cristian Alba", email: "crisalba@test.com", passwordHash: bcrypt.hashSync("player123", 10), role: "player", phone: "+5493512222222", category: "6ta" },
  ]);

  await Booking.insertMany([
    { date: addDays(0), time: "19:00", courtId: "1", courtName: "Cancha 1 - Césped sintético", type: "court", playerName: "Laura Lencina", userEmail: "laura@test.com", phone: "+5493511111111", price: 24000, paymentOption: "full", paymentStatus: "pagado", status: "confirmado" },
    { date: addDays(0), time: "21:00", courtId: "3", courtName: "Cancha 3 - Techada", type: "court", playerName: "Bruno Pérez", userEmail: "bruno@test.com", phone: "+5493512222222", price: 24000, paymentOption: "cash", paymentStatus: "a_pagar_en_club", status: "pendiente" },
    { date: addDays(0), time: "09:00", courtId: "1", courtName: "Clase con profesor (Lucio)", type: "class", teacherId: "teacher-1", teacherName: "Lucio Profe", playerName: "Grupo intermedio", userEmail: "grupo@test.com", phone: "+5493513333333", price: 30000, paymentOption: "deposit", paymentStatus: "pendiente_pago", status: "confirmado" },
  ]);

  await Tournament.insertMany([
    { name: "Relámpago nocturno", status: "abierto", date: addDays(5), hour: "20:00", category: "Mixto hasta 7ma", surface: "Césped sintético", pricePerPlayer: 25000, seededPlayers: 12, currentPlayers: 12, maxPlayers: 16, prize: "Paletas + turno gratis", description: "Formato rápido con fase de grupos y finales.", registrations: [] },
    { name: "Ranking interno", status: "en_curso", date: addDays(12), hour: "18:00", category: "Caballeros 5ta/6ta", surface: "Mixta", pricePerPlayer: 0, seededPlayers: 40, currentPlayers: 40, maxPlayers: 64, prize: "Puntos ranking", description: "Liga interna mensual para socios.", registrations: [] },
  ]);

  await Setting.create({ courtPrice: 18000, classPrice: 30000, tournamentPrice: 25000 });
  await Expense.insertMany([
    { date: addDays(0), concept: "Limpieza y mantenimiento diario", category: "mantenimiento", amount: 18000, paymentMethod: "efectivo" },
    { date: addDays(0), concept: "Pelotas y consumibles", category: "insumos", amount: 22000, paymentMethod: "transferencia" },
  ]);
}
