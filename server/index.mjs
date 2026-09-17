import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import { CLIENT_ORIGIN, PORT } from "./config.mjs";
import { Activity, Booking, Expense, ScheduleBlock, Setting, Tournament, User, addActivity, connectDb, dbState } from "./db.mjs";
import { publicUser, requireAuth, requireRole, signToken } from "./auth.mjs";
import { argentinaDateISO, blockOverlapsBooking, bookingSlotStarts, bookingsOverlap, calculateBookingPrice, canonicalCourtId, fitsBlockHours, fitsOperatingHours, isPastSlot } from "../src/utils/bookingDomain.js";
import { CLASS_HOURS, COURT_HOURS, COURTS, DURATION_OPTIONS } from "../src/data/bookingConfig.js";
import { lastReversiblePayment, paymentSummary, PAYMENT_METHODS } from "../src/utils/paymentDomain.js";
import { randomUUID } from "node:crypto";

const app = express();

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === CLIENT_ORIGIN || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)) return callback(null, true);
    return callback(new Error("Origin no permitido por CORS"));
  },
  credentials: true,
}));
app.use(express.json());

const cleanEmail = (email = "") => String(email).toLowerCase().trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 25,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiados intentos. Espera unos minutos y volve a probar." },
});

function todayString() {
  return argentinaDateISO();
}

function isPastDate(date) {
  return String(date || "") < todayString();
}

function isValidDateISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function addDaysString(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeekString() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function startOfMonthString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfYearString() {
  return `${new Date().getFullYear()}-01-01`;
}

function moneyBucket(items, from, getDate, getValue) {
  return items
    .filter((item) => String(getDate(item) || "") >= from)
    .reduce((acc, item) => acc + Number(getValue(item) || 0), 0);
}

function minutesFromHour(hour = "00:00") {
  const [hh = "0", mm = "0"] = String(hour).split(":");
  return Number(hh) * 60 + Number(mm);
}

function addMinutesToHour(hour, minutes) {
  const total = minutesFromHour(hour) + Number(minutes || 0);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

app.get("/api", (_req, res) => {
  res.json({
    name: "PadelBook API",
    status: "online",
    database: dbState(),
    endpoints: ["/api/health", "/api/auth/login", "/api/bookings", "/api/blocks", "/api/tournaments", "/api/settings", "/api/finance/summary"],
  });
});

app.get("/api/health", (_req, res) => {
  const connected = dbState() === "connected";
  res.status(connected ? 200 : 503).json({ ok: connected, name: "PadelBook API", database: dbState(), timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", authLimiter, async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Email o contrasena invalidos." });
  const { email, password } = parsed.data;
  const account = await User.findOne({ email: cleanEmail(email) });
  if (!account || !bcrypt.compareSync(password, account.passwordHash)) {
    return res.status(401).json({ message: "Credenciales incorrectas." });
  }
  res.json({ user: publicUser(account), token: signToken(account) });
});

app.post("/api/auth/register", authLimiter, async (req, res) => {
  const schema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(4),
    phone: z.string().optional().default(""),
    category: z.string().optional().default("Sin categoria"),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Revisa los datos del registro." });
  const exists = await User.exists({ email: cleanEmail(parsed.data.email) });
  if (exists) return res.status(409).json({ message: "Ya existe una cuenta con ese email." });
  const user = await User.create({
    name: parsed.data.name.trim(),
    email: cleanEmail(parsed.data.email),
    passwordHash: bcrypt.hashSync(parsed.data.password, 10),
    role: "player",
    phone: parsed.data.phone,
    category: parsed.data.category,
  });
  await addActivity({ type: "user_registered", title: "Nuevo jugador registrado", detail: user.name, actor: user.name });
  res.status(201).json({ user: publicUser(user), token: signToken(user) });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/availability", async (req, res) => {
  const date = String(req.query.date || "");
  if (!isValidDateISO(date)) return res.status(400).json({ message: "Fecha invalida." });
  const occupied = await Booking.find({ date, status: { $ne: "cancelado" } }).select("date time durationMinutes courtId status").lean();
  res.json({ occupied: occupied.map(({ date: bookingDate, time, durationMinutes, courtId, status }) => ({ date: bookingDate, time, durationMinutes, courtId: canonicalCourtId(courtId), status })) });
});

app.get("/api/blocks", async (_req, res) => {
  const blocks = await ScheduleBlock.find().sort({ date: 1, courtId: 1, hour: 1 }).limit(5000);
  res.json({ blocks: blocks.map((block) => block.toJSON()) });
});

const blockInput = z.object({
  date: z.string(), courtId: z.union([z.string(), z.number()]).transform(canonicalCourtId), hour: z.string(),
  durationMinutes: z.number().int().min(30).max(150), reason: z.string().max(120).optional().default("No disponible"),
  type: z.enum(["block", "teacher"]).optional().default("block"),
});

app.post("/api/blocks/batch", requireAuth, requireRole("admin", "teacher"), async (req, res) => {
  const parsed = z.object({ blocks: z.array(blockInput).min(1).max(120) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bloqueos invalidos." });
  const blocks = parsed.data.blocks.map((block) => ({ ...block, ownerId: req.user.role === "teacher" ? req.user.id : "",
    type: req.user.role === "teacher" ? "teacher" : "block", reason: req.user.role === "teacher" ? `No disponible - ${req.user.name}` : block.reason }));
  for (const block of blocks) {
    if (!isValidDateISO(block.date) || isPastDate(block.date) || !COURTS.some((court) => court.id === block.courtId) ||
      !COURT_HOURS.includes(block.hour) || !fitsBlockHours(block.hour, block.durationMinutes) ||
      (req.user.role === "teacher" && (block.durationMinutes !== 60 || !CLASS_HOURS.includes(block.hour)))) {
      return res.status(400).json({ message: "Cancha, fecha u horario de bloqueo invalidos." });
    }
  }
  const keys = blocks.map((block) => `${block.date}|${block.courtId}|${block.hour}`);
  if (new Set(keys).size !== keys.length) return res.status(400).json({ message: "Hay bloqueos duplicados en la solicitud." });
  if (blocks.some((block, index) => blocks.slice(index + 1).some((other) => blockOverlapsBooking(block, { date: other.date, courtId: other.courtId, time: other.hour, durationMinutes: other.durationMinutes })))) {
    return res.status(400).json({ message: "Los bloqueos solicitados se superponen." });
  }
  const dates = [...new Set(blocks.map((block) => block.date))];
  const [bookings, existingBlocks] = await Promise.all([
    Booking.find({ date: { $in: dates }, status: { $ne: "cancelado" } }),
    ScheduleBlock.find({ date: { $in: dates } }),
  ]);
  for (const block of blocks) {
    if (bookings.some((booking) => blockOverlapsBooking(block, booking))) return res.status(409).json({ message: "El rango contiene una reserva. No se puede bloquear." });
    const conflict = existingBlocks.find((existing) => blockOverlapsBooking(existing, { date: block.date, courtId: block.courtId, time: block.hour, durationMinutes: block.durationMinutes }) &&
      !(existing.date === block.date && existing.courtId === block.courtId && existing.hour === block.hour));
    if (conflict) return res.status(409).json({ message: "El rango ya tiene un bloqueo." });
    const same = existingBlocks.find((existing) => existing.date === block.date && existing.courtId === block.courtId && existing.hour === block.hour);
    if (same && req.user.role === "teacher" && same.ownerId !== req.user.id) return res.status(403).json({ message: "Ese bloqueo pertenece al club o a otro profesor." });
  }
  try {
    await ScheduleBlock.bulkWrite(blocks.map((block) => ({ updateOne: { filter: { date: block.date, courtId: block.courtId, hour: block.hour }, update: { $set: block }, upsert: true } })));
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "El calendario cambió. Actualizá e intentá de nuevo." });
    throw error;
  }
  res.json({ blocks: (await ScheduleBlock.find({ date: { $in: dates } })).map((block) => block.toJSON()) });
});

app.delete("/api/blocks/batch", requireAuth, requireRole("admin", "teacher"), async (req, res) => {
  const parsed = z.object({ keys: z.array(z.object({ date: z.string(), courtId: z.string(), hour: z.string() })).min(1).max(120) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bloqueos invalidos." });
  const keys = parsed.data.keys.map((item) => ({ date: item.date, courtId: canonicalCourtId(item.courtId), hour: item.hour }));
  const result = await ScheduleBlock.deleteMany({ $or: keys, ...(req.user.role === "teacher" ? { ownerId: req.user.id, type: "teacher" } : {}) });
  res.json({ deleted: result.deletedCount });
});

app.get("/api/bookings", requireAuth, async (req, res) => {
  const query = req.user.role === "admin"
    ? {}
    : req.user.role === "teacher"
      ? { $or: [{ teacherId: req.user.id }, { teacherName: req.user.name }] }
      : { $or: [{ userEmail: cleanEmail(req.user.email) }, { userId: req.user.id }] };
  const bookings = await Booking.find(query).sort({ date: 1, time: 1 });
  res.json({ bookings: bookings.map((booking) => booking.toJSON()) });
});

app.post("/api/bookings", requireAuth, async (req, res) => {
  const schema = z.object({
    date: z.string().min(8),
    time: z.string().min(4),
    courtId: z.union([z.string(), z.number()]).transform(canonicalCourtId),
    courtName: z.string().optional(),
    type: z.enum(["court", "class"]).optional().default("court"),
    endTime: z.string().optional().default(""),
    durationMinutes: z.number().or(z.string()).transform(Number).optional().default(60),
    price: z.number().or(z.string()).transform(Number).optional(),
    paymentOption: z.string().optional().default("cash"),
    teacherId: z.string().nullable().optional(),
    teacherName: z.string().optional().default(""),
    description: z.string().optional().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !isValidDateISO(parsed.data?.date)) return res.status(400).json({ message: "Datos de reserva invalidos." });
  if (isPastDate(parsed.data.date)) return res.status(400).json({ message: "No se pueden crear reservas en fechas pasadas." });
  if (isPastSlot(parsed.data.date, parsed.data.time)) return res.status(400).json({ message: "Ese horario ya paso. Elegi un horario futuro." });
  const court = COURTS.find((item) => item.id === parsed.data.courtId);
  const isClass = parsed.data.type === "class";
  const validTime = isClass ? CLASS_HOURS.includes(parsed.data.time) : COURT_HOURS.includes(parsed.data.time);
  const validDuration = isClass ? parsed.data.durationMinutes === 60 : DURATION_OPTIONS.some((item) => item.minutes === parsed.data.durationMinutes);
  if (!court || !validTime || !validDuration || !fitsOperatingHours(parsed.data.time, parsed.data.durationMinutes)) return res.status(400).json({ message: "Cancha, horario o duracion invalidos." });
  if (!["cash", "deposit", "full"].includes(parsed.data.paymentOption)) return res.status(400).json({ message: "Forma de pago invalida." });
  const settings = await Setting.findOne();
  if (!settings) return res.status(503).json({ message: "La configuracion del club no esta disponible." });

  const incoming = {
    ...parsed.data,
    courtId: court.id,
    courtName: court.name,
    type: isClass ? "class" : "court",
    price: calculateBookingPrice(parsed.data, settings),
    occupiedSlots: bookingSlotStarts(parsed.data.time, parsed.data.durationMinutes),
    durationMinutes: Number(parsed.data.durationMinutes || 60),
    endTime: addMinutesToHour(parsed.data.time, Number(parsed.data.durationMinutes || 60)),
  };

  const sameDayBookings = await Booking.find({
    date: parsed.data.date,
    status: { $ne: "cancelado" },
  });
  const duplicated = sameDayBookings.find((booking) => bookingsOverlap(booking, incoming));
  if (duplicated) return res.status(409).json({ message: "Ese horario ya fue reservado.", booking: duplicated.toJSON(), duplicated: true });
  const scheduleBlocks = await ScheduleBlock.find({ date: incoming.date, courtId: incoming.courtId });
  if (scheduleBlocks.some((block) => blockOverlapsBooking(block, incoming))) return res.status(409).json({ message: "Ese horario fue bloqueado por el club." });

  let booking;
  try {
    booking = await Booking.create({
      ...incoming,
      status: "pendiente",
      paymentStatus: parsed.data.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago",
      userId: req.user.id,
      userEmail: req.user.email,
      playerName: req.user.name,
      phone: req.user.phone || "",
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Ese horario ya fue reservado.", duplicated: true });
    throw error;
  }
  await addActivity({ type: "booking_created", title: "Nueva reserva", detail: `${booking.playerName} - ${booking.date} ${booking.time}${booking.endTime ? ` a ${booking.endTime}` : ""}`, actor: booking.playerName, bookingId: booking.id });
  res.status(201).json({ booking: booking.toJSON() });
});

app.patch("/api/bookings/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const schema = z.object({ status: z.enum(["pendiente", "confirmado", "cancelado"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Estado invalido." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  if (booking.status === "cancelado" && parsed.data.status !== "cancelado") {
    const occupied = await Booking.find({ date: booking.date, status: { $ne: "cancelado" } });
    if (occupied.some((item) => bookingsOverlap(item, booking))) return res.status(409).json({ message: "Ese horario ya fue ocupado. No se puede reactivar la reserva." });
  }
  booking.status = parsed.data.status;
  try {
    await booking.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Ese horario ya fue ocupado. No se puede reactivar la reserva." });
    throw error;
  }
  await addActivity({ type: `booking_${parsed.data.status}`, title: "Reserva actualizada", detail: `${booking.playerName} - ${booking.status}`, actor: req.user.name, bookingId: booking.id });
  res.json({ booking: booking.toJSON() });
});

app.post("/api/bookings/:id/payments", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const schema = z.object({ amount: z.number().int().positive(), method: z.enum(PAYMENT_METHODS), note: z.string().max(300).optional().default("") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos del cobro invalidos." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  if (booking.status === "cancelado") return res.status(409).json({ message: "No se puede registrar un pago en una reserva cancelada." });
  const current = paymentSummary(booking);
  if (parsed.data.amount > current.due) return res.status(400).json({ message: "El cobro supera el saldo pendiente." });
  const amountPaid = current.paid + parsed.data.amount;
  const entry = { id: randomUUID(), amount: parsed.data.amount, method: parsed.data.method, note: parsed.data.note.trim(), actor: req.user.name, at: new Date() };
  const updated = await Booking.findOneAndUpdate({ _id: booking.id, amountPaid: booking.amountPaid, status: { $ne: "cancelado" } }, {
    $set: { amountPaid, paymentStatus: amountPaid >= current.total ? "pagado" : "parcial" }, $push: { paymentEntries: entry },
  }, { new: true });
  if (!updated) return res.status(409).json({ message: "La reserva cambió. Actualizá la página y volvé a intentar." });
  await addActivity({ type: "booking_payment_recorded", title: "Cobro registrado", detail: `${updated.playerName} - $${parsed.data.amount}`, actor: req.user.name, bookingId: updated.id });
  res.json({ booking: updated.toJSON() });
});

app.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  const ownsBooking = booking.userId === req.user.id || cleanEmail(booking.userEmail) === cleanEmail(req.user.email);
  if (req.user.role !== "admin" && !ownsBooking) return res.status(403).json({ message: "No podés cancelar esta reserva." });
  if (isPastSlot(booking.date, booking.time)) return res.status(409).json({ message: "El turno ya comenzó. Contactá al club para resolver la cancelación." });
  if (booking.status !== "cancelado") {
    booking.status = "cancelado";
    await booking.save();
    await addActivity({ type: "booking_cancelado", title: "Reserva cancelada", detail: `${booking.playerName} - ${booking.date} ${booking.time}`, actor: req.user.name, bookingId: booking.id });
  }
  res.json({ booking: booking.toJSON() });
});

app.post("/api/bookings/:id/payments/reverse", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  const last = lastReversiblePayment(booking);
  if (!last) return res.status(409).json({ message: "No hay cobros para revertir." });
  const amountPaid = paymentSummary(booking).paid - Number(last.amount);
  const paymentStatus = amountPaid <= 0 ? booking.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago" : "parcial";
  const entry = { id: randomUUID(), amount: -Number(last.amount), method: last.method, note: "Reversión del cobro anterior", actor: req.user.name, at: new Date(), reversalOf: last.id };
  const updated = await Booking.findOneAndUpdate({ _id: booking.id, amountPaid: booking.amountPaid, "paymentEntries.id": last.id, "paymentEntries.reversalOf": { $ne: last.id } }, {
    $set: { amountPaid, paymentStatus }, $push: { paymentEntries: entry },
  }, { new: true });
  if (!updated) return res.status(409).json({ message: "El cobro cambió. Actualizá la página." });
  await addActivity({ type: "booking_payment_reversed", title: "Cobro revertido", detail: `${updated.playerName} - $${last.amount}`, actor: req.user.name, bookingId: updated.id });
  res.json({ booking: updated.toJSON() });
});

app.get("/api/tournaments", async (_req, res) => {
  const tournaments = await Tournament.find().sort({ date: 1 });
  res.json({ tournaments: tournaments.map((tournament) => tournament.toJSON()) });
});

app.post("/api/tournaments/:id/register", requireAuth, async (req, res) => {
  const schema = z.object({ partnerName: z.string().optional().default(""), partnerPhone: z.string().optional().default("") });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos invalidos." });
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  if (tournament.status !== "abierto") return res.status(409).json({ message: "La inscripcion no esta abierta." });
  if (Number(tournament.currentPlayers) >= Number(tournament.maxPlayers)) return res.status(409).json({ message: "No quedan cupos disponibles." });
  const exists = (tournament.registrations || []).some((reg) => cleanEmail(reg.email) === cleanEmail(req.user.email) && reg.status !== "cancelado");
  if (exists) return res.status(409).json({ message: "Ya estas inscripto en este torneo." });
  const registration = {
    userId: req.user.id,
    name: req.user.name,
    email: req.user.email,
    phone: req.user.phone || "",
    category: req.user.category || tournament.category,
    partnerName: parsed.data.partnerName,
    partnerPhone: parsed.data.partnerPhone,
    status: "pendiente",
    paymentStatus: Number(tournament.pricePerPlayer || 0) > 0 ? "pendiente" : "sin_cargo",
  };
  tournament.registrations.push(registration);
  tournament.currentPlayers = Math.min(Number(tournament.maxPlayers), Number(tournament.currentPlayers || 0) + 1);
  await tournament.save();
  await addActivity({ type: "tournament_signup", title: "Inscripcion a torneo", detail: `${registration.name} - ${tournament.name}`, actor: registration.name });
  res.status(201).json({ tournament: tournament.toJSON(), registration: tournament.registrations.at(-1).toJSON() });
});

app.get("/api/settings", async (_req, res) => {
  const settings = await Setting.findOneAndUpdate(
    {},
    { $setOnInsert: {} },
    { returnDocument: "after", upsert: true, setDefaultsOnInsert: true },
  );
  res.json({ settings: settings.toJSON() });
});

app.put("/api/settings", requireAuth, requireRole("admin"), async (req, res) => {
  const schema = z.object({
    clubName: z.string().min(2).optional(),
    clubShortName: z.string().min(2).optional(),
    address: z.string().optional(),
    mapsQuery: z.string().optional(),
    whatsapp: z.string().optional(),
    instagram: z.string().optional(),
    openingHours: z.string().optional(),
    clubStatus: z.string().optional(),
    homeHeadline: z.string().optional(),
    homeSubtitle: z.string().optional(),
    promoText: z.string().optional(),
    courtPrice: z.number().or(z.string()).transform(Number).optional(),
    nightPrice: z.number().or(z.string()).transform(Number).optional(),
    weekendExtra: z.number().or(z.string()).transform(Number).optional(),
    classPrice: z.number().or(z.string()).transform(Number).optional(),
    tournamentPrice: z.number().or(z.string()).transform(Number).optional(),
    teacherCommissionPercent: z.number().or(z.string()).transform(Number).optional(),
  }).passthrough();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de configuracion invalidos." });

  const numericKeys = ["courtPrice", "nightPrice", "weekendExtra", "classPrice", "tournamentPrice", "teacherCommissionPercent"];
  for (const key of numericKeys) {
    if (parsed.data[key] !== undefined && (!Number.isFinite(parsed.data[key]) || Number(parsed.data[key]) < 0)) {
      return res.status(400).json({ message: "Los precios deben ser numeros positivos." });
    }
  }

  const patch = {
    ...parsed.data,
    whatsapp: parsed.data.whatsapp ? String(parsed.data.whatsapp).replace(/\D/g, "") : parsed.data.whatsapp,
    instagram: parsed.data.instagram ? String(parsed.data.instagram).replace(/^@/, "").trim() : parsed.data.instagram,
  };

  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
  const settings = await Setting.findOneAndUpdate({}, { $set: patch }, { returnDocument: "after", upsert: true, setDefaultsOnInsert: true });
  await addActivity({ type: "settings_updated", title: "Configuracion actualizada", detail: "Precios y datos del club", actor: req.user.name });
  res.json({ settings: settings.toJSON() });
});

app.get("/api/finance/summary", requireAuth, requireRole("admin"), async (_req, res) => {
  const [bookings, expenses, settingsDoc] = await Promise.all([
    Booking.find().sort({ date: -1, time: -1 }),
    Expense.find().sort({ date: -1, createdAt: -1 }).limit(80),
    Setting.findOne().sort({ createdAt: 1 }),
  ]);

  const settings = settingsDoc?.toJSON?.() || {};
  const commissionPercent = Number(settings.teacherCommissionPercent ?? 50);
  const allBookings = bookings.map((booking) => booking.toJSON());
  const activeBookings = allBookings.filter((booking) => booking.status !== "cancelado");
  const expenseRows = expenses.map((expense) => expense.toJSON());
  const collectedBookings = allBookings.filter((booking) => paymentSummary(booking).paid > 0);
  const pendingBookings = activeBookings.filter((booking) => paymentSummary(booking).due > 0).map((booking) => ({ ...booking, amountDue: paymentSummary(booking).due }));
  const incomeRows = allBookings.flatMap((booking) => {
    const entries = booking.paymentEntries || [];
    return entries.length ? entries.map((entry) => ({ date: String(entry.at).slice(0, 10), amount: Number(entry.amount || 0), type: booking.type, label: booking.courtName }))
      : paymentSummary(booking).paid > 0 ? [{ date: String(booking.updatedAt || booking.date).slice(0, 10), amount: paymentSummary(booking).paid, type: booking.type, label: booking.courtName }] : [];
  });

  const teacherCommissions = collectedBookings
    .filter((booking) => booking.type === "class" || booking.teacherId || booking.teacherName)
    .flatMap((booking) => {
      const entries = booking.paymentEntries?.length ? booking.paymentEntries : [{ amount: paymentSummary(booking).paid, at: booking.updatedAt || booking.date }];
      return entries.map((entry) => ({
        date: String(entry.at).slice(0, 10), teacherName: booking.teacherName || "Profesor", bookingId: booking.id,
        gross: Number(entry.amount || 0), amount: Math.round((Number(entry.amount || 0) * commissionPercent) / 100), percent: commissionPercent,
      }));
    });

  const expenseTotal = expenseRows.reduce((acc, item) => acc + Number(item.amount || 0), 0);
  const commissionTotal = teacherCommissions.reduce((acc, item) => acc + Number(item.amount || 0), 0);
  const periods = {
    day: todayString(),
    week: startOfWeekString(),
    month: startOfMonthString(),
    year: startOfYearString(),
  };

  const byPeriod = Object.fromEntries(Object.entries(periods).map(([key, from]) => {
    const income = moneyBucket(incomeRows, from, (item) => item.date, (item) => item.amount);
    const expensesAmount = moneyBucket(expenseRows, from, (item) => item.date, (item) => item.amount);
    const commissions = moneyBucket(teacherCommissions, from, (item) => item.date, (item) => item.amount);
    return [key, { income, expenses: expensesAmount, commissions, net: income - expensesAmount - commissions }];
  }));

  const dailyTrend = Array.from({ length: 7 }, (_, index) => {
    const date = addDaysString(index - 6);
    const income = moneyBucket(incomeRows, date, (item) => item.date === date ? date : "", (item) => item.amount);
    const expensesAmount = moneyBucket(expenseRows, date, (item) => item.date === date ? date : "", (item) => item.amount);
    const commissions = moneyBucket(teacherCommissions, date, (item) => item.date === date ? date : "", (item) => item.amount);
    return { date, income, expenses: expensesAmount, commissions, net: income - expensesAmount - commissions };
  });

  const incomeByCategory = [
    { label: "Cancha", amount: collectedBookings.filter((booking) => booking.type !== "class").reduce((acc, booking) => acc + paymentSummary(booking).paid, 0) },
    { label: "Clases", amount: collectedBookings.filter((booking) => booking.type === "class" || booking.teacherId || booking.teacherName).reduce((acc, booking) => acc + paymentSummary(booking).paid, 0) },
    { label: "Torneos", amount: 0 },
  ];

  res.json({
    summary: {
      byPeriod,
      totals: {
        grossIncome: incomeRows.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        collected: collectedBookings.reduce((acc, booking) => acc + paymentSummary(booking).paid, 0),
        pending: pendingBookings.reduce((acc, booking) => acc + booking.amountDue, 0),
        expenses: expenseTotal,
        teacherCommissions: commissionTotal,
      },
      commissionPercent,
      dailyTrend,
      incomeByCategory,
      teacherCommissions: teacherCommissions.slice(0, 12),
      expenses: expenseRows.slice(0, 12),
      pendingPayments: pendingBookings.slice(0, 12),
    },
  });
});

app.post("/api/expenses", requireAuth, requireRole("admin"), async (req, res) => {
  const schema = z.object({
    date: z.string().min(8).optional().default(todayString()),
    concept: z.string().min(2),
    category: z.string().optional().default("operativo"),
    amount: z.number().or(z.string()).transform(Number),
    paymentMethod: z.string().optional().default("efectivo"),
    note: z.string().optional().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !Number.isFinite(parsed.data.amount) || parsed.data.amount <= 0) {
    return res.status(400).json({ message: "Datos de egreso invalidos." });
  }
  const expense = await Expense.create(parsed.data);
  await addActivity({ type: "expense_created", title: "Egreso registrado", detail: `${expense.concept} - $${expense.amount}`, actor: req.user.name });
  res.status(201).json({ expense: expense.toJSON() });
});

app.get("/api/activity", requireAuth, requireRole("admin"), async (_req, res) => {
  const activity = await Activity.find().sort({ createdAt: -1 }).limit(30);
  res.json({ activity: activity.map((item) => item.toJSON()) });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: "Error interno del servidor." });
});

connectDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`PadelBook API running at http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
