import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { MONGODB_DB_NAME, MONGODB_URI } from "./config.mjs";
import { bookingSlotStarts, canonicalCourtId } from "../src/utils/bookingDomain.js";

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
  role: { type: String, enum: ["admin", "receptionist", "teacher", "player"], default: "player" },
  active: { type: Boolean, default: true },
  sessionVersion: { type: Number, default: 0, select: false },
  phone: { type: String, default: "" },
  category: { type: String, default: "Sin categoria" },
}, baseOptions);

const passwordResetSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
  usedAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false });

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const bookingSchema = new mongoose.Schema({
  date: { type: String, required: true },
  time: { type: String, required: true },
  endTime: { type: String, default: "" },
  durationMinutes: { type: Number, default: 60 },
  courtId: { type: String, required: true },
  occupiedSlots: { type: [Number], default: undefined },
  courtName: { type: String, required: true },
  type: { type: String, default: "court" },
  teacherId: { type: String, default: null },
  teacherName: { type: String, default: "" },
  description: { type: String, default: "" },
  userId: { type: String, default: "" },
  userEmail: { type: String, default: "" },
  playerName: { type: String, default: "Jugador" },
  createdBy: { type: String, default: "" },
  source: { type: String, enum: ["online", "reception"], default: "online" },
  phone: { type: String, default: "" },
  price: { type: Number, default: 0 },
  paymentOption: { type: String, default: "cash" },
  paymentStatus: { type: String, default: "pendiente_pago" },
  amountPaid: { type: Number, default: 0 },
  paymentEntries: { type: [new mongoose.Schema({ id: String, idempotencyKey: String, amount: Number, method: String, note: String, actor: String, at: Date, reversalOf: String }, { _id: false })], default: [] },
  status: { type: String, enum: ["pendiente", "confirmado", "cancelado"], default: "pendiente" },
}, baseOptions);

bookingSchema.index({ date: 1, time: 1, courtId: 1, status: 1 });
bookingSchema.index({ date: 1, courtId: 1, occupiedSlots: 1 }, {
  unique: true,
  partialFilterExpression: { occupiedSlots: { $exists: true }, status: { $in: ["pendiente", "confirmado"] } },
});
bookingSchema.index({ date: 1, teacherId: 1, occupiedSlots: 1 }, {
  unique: true,
  partialFilterExpression: { type: "class", status: { $in: ["pendiente", "confirmado"] }, teacherId: { $type: "string" }, occupiedSlots: { $exists: true } },
});

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
  paymentEntries: { type: [new mongoose.Schema({ id: String, amount: Number, method: String, actor: String, at: Date }, { _id: false })], default: [] },
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
}, { ...baseOptions, versionKey: "__v", optimisticConcurrency: true });

const settingsSchema = new mongoose.Schema({
  clubName: { type: String, default: "Arena Norte Padel Club" },
  clubShortName: { type: String, default: "PadelBook" },
  address: { type: String, default: "Edmundo Mariotte 5308 - Córdoba Capital" },
  mapsQuery: { type: String, default: "Edmundo Mariotte 5308, Córdoba, Argentina" },
  whatsapp: { type: String, default: "+5493510000000" },
  instagram: { type: String, default: "padelbook.club" },
  openingHours: { type: String, default: "09:00 a 22:00" },
  clubStatus: { type: String, default: "Club abierto - reservas online" },
  homeHeadline: { type: String, default: "Tu próximo partido empieza antes de llegar a la cancha." },
  homeSubtitle: { type: String, default: "Reservá cancha, coordiná la seña con el club, consultá tus turnos y sumate a torneos desde una experiencia simple y rápida." },
  promoText: { type: String, default: "Tus turnos, siempre organizados" },
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
  actorId: { type: String, default: "" },
  actorRole: { type: String, default: "" },
  requestId: { type: String, default: "" },
  ipHash: { type: String, default: "" },
}, baseOptions);

const expenseSchema = new mongoose.Schema({
  date: { type: String, required: true },
  concept: { type: String, required: true },
  category: { type: String, default: "operativo" },
  amount: { type: Number, default: 0 },
  paymentMethod: { type: String, default: "efectivo" },
  note: { type: String, default: "" },
}, baseOptions);

const scheduleBlockSchema = new mongoose.Schema({
  date: { type: String, required: true },
  courtId: { type: String, required: true },
  hour: { type: String, required: true },
  durationMinutes: { type: Number, default: 30 },
  reason: { type: String, default: "No disponible" },
  type: { type: String, enum: ["block", "teacher"], default: "block" },
  ownerId: { type: String, default: "" },
}, baseOptions);
scheduleBlockSchema.index({ date: 1, courtId: 1, hour: 1 }, { unique: true });

const teacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  nickname: { type: String, default: "" },
  specialty: { type: String, default: "Clases de pádel" },
  status: { type: String, enum: ["activo", "vacaciones", "baja"], default: "activo" },
  price: { type: Number, default: 30000 },
  userId: { type: String, default: "" },
}, baseOptions);

const slotClaimSchema = new mongoose.Schema({
  date: { type: String, required: true },
  courtId: { type: String, required: true },
  slot: { type: Number, required: true },
  ownerType: { type: String, enum: ["booking", "block"], required: true },
  ownerId: { type: String, required: true },
}, { versionKey: false });
slotClaimSchema.index({ date: 1, courtId: 1, slot: 1 }, { unique: true });
slotClaimSchema.index({ ownerType: 1, ownerId: 1 });

export const User = mongoose.model("User", userSchema);
export const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);
export const Booking = mongoose.model("Booking", bookingSchema);
export const Tournament = mongoose.model("Tournament", tournamentSchema);
export const Setting = mongoose.model("Setting", settingsSchema);
export const Activity = mongoose.model("Activity", activitySchema);
export const Expense = mongoose.model("Expense", expenseSchema);
export const ScheduleBlock = mongoose.model("ScheduleBlock", scheduleBlockSchema);
export const Teacher = mongoose.model("Teacher", teacherSchema);
export const SlotClaim = mongoose.model("SlotClaim", slotClaimSchema);

export async function connectDb() {
  if (!MONGODB_URI) {
    throw new Error("Falta MONGODB_URI. Configura MongoDB Atlas o una instancia local en .env.");
  }
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME, serverSelectionTimeoutMS: 10000 });
  await seedDatabase();
  await Booking.init();
  await ScheduleBlock.init();
  await migrateBookingSlots();
  await migrateLegacyPayments();
  await migrateTournamentPayments();
  await SlotClaim.init();
  await migrateSlotClaims();
}

export function dbState() {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

export function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function addActivity(item) {
  const { requestContext } = await import("./requestContext.mjs");
  const context = requestContext.getStore() || {};
  await Activity.create({ ...item, actorId: item.actorId || context.actorId || "", actorRole: item.actorRole || context.actorRole || "", requestId: context.requestId || "", ipHash: context.ipHash || "" });
  const count = await Activity.countDocuments();
  if (count > 5000) {
    const old = await Activity.find().sort({ createdAt: -1 }).skip(5000).select("_id");
    await Activity.deleteMany({ _id: { $in: old.map((item) => item._id) } });
  }
}

async function seedDatabase() {
  if (await User.countDocuments()) return;

  if (process.env.PADELBOOK_DEMO_SEED !== "true") {
    const email = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
    const password = String(process.env.ADMIN_PASSWORD || "");
    if (!email.includes("@") || password.length < 12 || password.length > 72) {
      throw new Error("Para iniciar una base vacía, configurá ADMIN_EMAIL y ADMIN_PASSWORD (12 a 72 caracteres), o activá PADELBOOK_DEMO_SEED=true solo en desarrollo.");
    }
    await User.create({ name: process.env.ADMIN_NAME || "Administrador del club", email, passwordHash: bcrypt.hashSync(password, 12), role: "admin" });
    await Setting.create({});
    return;
  }

  await User.insertMany([
    { name: "Admin Club", email: "admin@club.com", passwordHash: bcrypt.hashSync("admin123", 10), role: "admin", phone: "+5493510000000", category: "Gestión" },
    { name: "Recepción Club", email: "recepcion@club.com", passwordHash: bcrypt.hashSync("recepcion123", 10), role: "receptionist", phone: "+5493510000001", category: "Recepción" },
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

  const teacherUser = await User.findOne({ email: "lucio@club.com" });
  await Teacher.create({ name: "Lucio Profe", nickname: "Lucio", specialty: "Clases individuales", status: "activo", price: 30000, userId: teacherUser?.id || "" });

  await Setting.create({ courtPrice: 18000, nightPrice: 24000, weekendExtra: 3000, classPrice: 30000, tournamentPrice: 25000 });
  await Expense.insertMany([
    { date: addDays(0), concept: "Limpieza y mantenimiento diario", category: "mantenimiento", amount: 18000, paymentMethod: "efectivo" },
    { date: addDays(0), concept: "Pelotas y consumibles", category: "insumos", amount: 22000, paymentMethod: "transferencia" },
  ]);
}

async function migrateBookingSlots() {
  const legacy = await Booking.find({ $or: [{ occupiedSlots: { $exists: false } }, { courtId: { $in: ["1", "2", "3"] } }] });
  for (const booking of legacy) {
    booking.courtId = canonicalCourtId(booking.courtId);
    booking.occupiedSlots = bookingSlotStarts(booking.time, booking.durationMinutes || 60);
    if (!booking.occupiedSlots.length) throw new Error(`Reserva ${booking.id} tiene una franja horaria invalida.`);
    await booking.save();
  }
}

async function migrateLegacyPayments() {
  await Booking.updateMany({ amountPaid: { $exists: false }, paymentStatus: { $ne: "pagado" } }, { $set: { amountPaid: 0, paymentEntries: [] } });
  const paid = await Booking.find({ paymentStatus: "pagado", $or: [{ amountPaid: { $exists: false } }, { amountPaid: 0 }] });
  for (const booking of paid) {
    if (Number(booking.price || 0) <= 0) continue;
    booking.amountPaid = booking.price;
    booking.paymentEntries = [{ id: `legacy-${booking.id}`, amount: booking.price, method: "otro", note: "Pago registrado antes del historial de cobros", actor: "Migración", at: booking.updatedAt || booking.createdAt || new Date() }];
    await booking.save();
  }
}

async function migrateTournamentPayments() {
  const tournaments = await Tournament.find({ "registrations.paymentStatus": "pagado" });
  for (const tournament of tournaments) {
    let changed = false;
    for (const registration of tournament.registrations) {
      if (registration.paymentStatus !== "pagado" || registration.paymentEntries.length) continue;
      registration.paymentEntries.push({ id: `legacy-${registration.id}`, amount: tournament.pricePerPlayer,
        method: "registro anterior", actor: "Migración", at: registration.updatedAt || registration.createdAt || tournament.createdAt });
      changed = true;
    }
    if (changed) await tournament.save();
  }
}

async function migrateSlotClaims() {
  const [bookings, blocks] = await Promise.all([
    Booking.find({ status: { $ne: "cancelado" } }), ScheduleBlock.find(),
  ]);
  const expected = [
    ...bookings.flatMap((booking) => bookingSlotStarts(booking.time, booking.durationMinutes || 60)
      .map((slot) => ({ date: booking.date, courtId: canonicalCourtId(booking.courtId), slot, ownerType: "booking", ownerId: booking.id }))),
    ...blocks.flatMap((block) => bookingSlotStarts(block.hour, block.durationMinutes || 30)
      .map((slot) => ({ date: block.date, courtId: canonicalCourtId(block.courtId), slot, ownerType: "block", ownerId: block.id }))),
  ];
  const claimKey = (claim) => `${claim.date}|${claim.courtId}|${claim.slot}|${claim.ownerType}|${claim.ownerId}`;
  const expectedKeys = new Set(expected.map(claimKey));
  const allClaims = await SlotClaim.find();
  const stale = allClaims.filter((claim) => !expectedKeys.has(claimKey(claim)));
  if (stale.length) await SlotClaim.deleteMany({ _id: { $in: stale.map((claim) => claim._id) } });
  for (const claim of expected) {
    const existing = await SlotClaim.findOne({ date: claim.date, courtId: claim.courtId, slot: claim.slot });
    if (!existing) await SlotClaim.create(claim);
    else if (existing.ownerType !== claim.ownerType || existing.ownerId !== claim.ownerId) {
      throw new Error(`Conflicto de agenda previo en ${claim.date} ${claim.courtId} ${claim.slot}. Requiere revisión manual.`);
    }
  }
}
