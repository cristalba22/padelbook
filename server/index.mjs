import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import { z } from "zod";
import { CLIENT_ORIGIN, PORT, PUBLIC_APP_ORIGIN } from "./config.mjs";
import { Activity, Booking, Expense, PasswordReset, ScheduleBlock, Setting, SlotClaim, Teacher, Tournament, User, addActivity, connectDb, dbState } from "./db.mjs";
import { clearSessionCookie, createSession, publicUser, requireAuth, requireRole, sessionCookie } from "./auth.mjs";
import { requestContextMiddleware } from "./requestContext.mjs";
import { argentinaDateISO, blockOverlapsBooking, bookingSlotStarts, bookingsOverlap, calculateBookingPrice, canonicalCourtId, fitsBlockHours, fitsOperatingHours, isPastSlot } from "../src/utils/bookingDomain.js";
import { CLASS_HOURS, COURT_HOURS, COURTS, DURATION_OPTIONS } from "../src/data/bookingConfig.js";
import { lastReversiblePayment, paymentSummary, PAYMENT_METHODS } from "../src/utils/paymentDomain.js";
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import { accountingDate, shiftClubDate, startOfClubMonth, startOfClubWeek, startOfClubYear } from "../src/utils/clubDate.js";
import { API_PROXY_SECRET } from "./config.mjs";
import { passwordEmailConfigured, sendPasswordResetEmail } from "./email.mjs";

const app = express();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("padelbook-login-timing-placeholder", 12);
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(requestContextMiddleware);
app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
app.use("/api", (req, res, next) => {
  if (process.env.NODE_ENV !== "production" || req.path === "/health") return next();
  const received = Buffer.from(String(req.get("X-PadelBook-Proxy") || ""));
  const expected = Buffer.from(API_PROXY_SECRET);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return res.status(404).json({ message: "Recurso no encontrado." });
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (origin === CLIENT_ORIGIN || (process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin))) return callback(null, true);
    return callback(new Error("Origin no permitido por CORS"));
  },
  credentials: true,
}));
app.use(express.json({ limit: "32kb", strict: true }));
app.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });

const cleanEmail = (email = "") => String(email).toLowerCase().trim();
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id || ""));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Demasiados intentos. Espera unos minutos y volve a probar." },
});
const registerLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Se alcanzó el límite de registros. Intentá nuevamente más tarde." } });
const passwordRecoveryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 4, standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Se alcanzó el límite de recuperación. Intentá nuevamente más tarde." } });
const apiLimiter = rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Demasiadas solicitudes. Esperá un momento y volvé a intentar." }, skip: (req) => req.path === "/health" });
app.use("/api", apiLimiter);

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
  return shiftClubDate(days);
}

function startOfWeekString() {
  return startOfClubWeek();
}

function startOfMonthString() {
  return startOfClubMonth();
}

function startOfYearString() {
  return startOfClubYear();
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
  const schema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(72) }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Email o contrasena invalidos." });
  const { email, password } = parsed.data;
  const account = await User.findOne({ email: cleanEmail(email) }).select("+sessionVersion");
  const passwordMatches = await bcrypt.compare(password, account?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!account || account.active === false || !passwordMatches) {
    return res.status(401).json({ message: "Credenciales incorrectas." });
  }
  if (bcrypt.getRounds(account.passwordHash) < 12) {
    account.passwordHash = await bcrypt.hash(password, 12);
    await account.save();
  }
  const session = createSession(account);
  res.setHeader("Set-Cookie", sessionCookie(session.token));
  res.json({ user: publicUser(account), csrfToken: session.csrfToken, ...(process.env.NODE_ENV !== "production" ? { token: session.token } : {}) });
});

app.post("/api/auth/register", registerLimiter, async (req, res) => {
  const schema = z.object({
    name: z.string().trim().min(2).max(100),
    email: z.string().email().max(254),
    password: z.string().min(12).max(72),
    phone: z.string().trim().max(40).optional().default(""),
    category: z.string().trim().max(60).optional().default("Sin categoria"),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Revisa los datos del registro." });
  const exists = await User.exists({ email: cleanEmail(parsed.data.email) });
  if (exists) return res.status(409).json({ message: "Ya existe una cuenta con ese email." });
  const user = await User.create({
    name: parsed.data.name.trim(),
    email: cleanEmail(parsed.data.email),
    passwordHash: await bcrypt.hash(parsed.data.password, 12),
    role: "player",
    phone: parsed.data.phone,
    category: parsed.data.category,
  });
  await addActivity({ type: "user_registered", title: "Nuevo jugador registrado", detail: user.name, actor: user.name });
  const session = createSession(user);
  res.setHeader("Set-Cookie", sessionCookie(session.token));
  res.status(201).json({ user: publicUser(user), csrfToken: session.csrfToken, ...(process.env.NODE_ENV !== "production" ? { token: session.token } : {}) });
});

app.post("/api/auth/password/forgot", passwordRecoveryLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().email().max(254) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Ingresá un email válido." });
  if (!passwordEmailConfigured()) return res.status(503).json({ message: "La recuperación por correo está temporalmente en configuración." });

  const neutralResponse = { message: "Si existe una cuenta activa con ese email, vas a recibir un enlace válido por 20 minutos." };
  const account = await User.findOne({ email: cleanEmail(parsed.data.email), active: { $ne: false } });
  if (!account) {
    await bcrypt.compare(randomBytes(16).toString("hex"), DUMMY_PASSWORD_HASH);
    return res.status(202).json(neutralResponse);
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 20 * 60 * 1000);
  await PasswordReset.deleteMany({ userId: account._id, usedAt: null });
  const reset = await PasswordReset.create({ userId: account._id, tokenHash, expiresAt });
  const resetUrl = `${PUBLIC_APP_ORIGIN}/restablecer-clave?token=${encodeURIComponent(token)}`;
  try {
    await sendPasswordResetEmail({ to: account.email, name: account.name, resetUrl });
  } catch (error) {
    await PasswordReset.deleteOne({ _id: reset._id });
    const requestId = res.getHeader("X-Request-ID") || "unknown";
    console.error(`[${requestId}] PasswordEmailDeliveryError`);
  }
  return res.status(202).json(neutralResponse);
});

app.post("/api/auth/password/reset", authLimiter, async (req, res) => {
  const parsed = z.object({
    token: z.string().min(32).max(200),
    password: z.string().min(12).max(72),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "El enlace o la contraseña no son válidos." });

  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const reset = await PasswordReset.findOneAndUpdate(
    { tokenHash, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!reset) return res.status(400).json({ message: "El enlace venció o ya fue utilizado. Solicitá uno nuevo." });

  const account = await User.findById(reset.userId).select("+sessionVersion");
  if (!account || account.active === false) return res.status(400).json({ message: "El enlace venció o ya fue utilizado. Solicitá uno nuevo." });
  account.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  account.sessionVersion = Number(account.sessionVersion || 0) + 1;
  await account.save();
  await PasswordReset.deleteMany({ userId: account._id, _id: { $ne: reset._id } });
  await addActivity({ type: "password_reset", title: "Contraseña restablecida", detail: account.email, actor: account.name });
  res.setHeader("Set-Cookie", clearSessionCookie());
  return res.status(204).end();
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: req.user, csrfToken: req.csrfToken });
});

app.post("/api/auth/logout", requireAuth, (_req, res) => {
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(204).end();
});

app.patch("/api/auth/me", requireAuth, async (req, res) => {
  const parsed = z.object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().max(40),
    category: z.string().trim().max(60),
  }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Revisá los datos del perfil." });
  const user = await User.findByIdAndUpdate(req.user.id, { $set: parsed.data }, { returnDocument: "after", runValidators: true });
  if (!user) return res.status(404).json({ message: "Cuenta no encontrada." });
  res.json({ user: publicUser(user) });
});

app.patch("/api/auth/password", authLimiter, requireAuth, async (req, res) => {
  const parsed = z.object({
    currentPassword: z.string().min(1).max(72),
    newPassword: z.string().min(12).max(72),
  }).strict().refine(({ currentPassword, newPassword }) => currentPassword !== newPassword, {
    message: "La contraseña nueva debe ser diferente.",
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "La contraseña nueva debe tener entre 12 y 72 caracteres y ser diferente de la actual." });

  const account = await User.findById(req.user.id).select("+sessionVersion");
  const passwordMatches = await bcrypt.compare(parsed.data.currentPassword, account?.passwordHash || DUMMY_PASSWORD_HASH);
  if (!account || account.active === false || !passwordMatches) {
    return res.status(401).json({ message: "La contraseña actual no es correcta." });
  }

  account.passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  account.sessionVersion = Number(account.sessionVersion || 0) + 1;
  await account.save();
  res.setHeader("Set-Cookie", clearSessionCookie());
  res.status(204).end();
});

app.get("/api/admin/staff", requireAuth, requireRole("admin"), async (_req, res) => {
  const staff = await User.find({ role: "receptionist" }).sort({ name: 1 });
  res.json({ staff: staff.map(publicUser) });
});

app.post("/api/admin/staff", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), email: z.string().email(), password: z.string().min(12).max(72), phone: z.string().trim().max(40).optional().default("") }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Revisá nombre, email y contraseña (mínimo 12 caracteres)." });
  const email = cleanEmail(parsed.data.email);
  if (await User.exists({ email })) return res.status(409).json({ message: "Ya existe una cuenta con ese email." });
  const employee = await User.create({ name: parsed.data.name, email, passwordHash: await bcrypt.hash(parsed.data.password, 12), phone: parsed.data.phone, role: "receptionist", category: "Recepción", active: true });
  await addActivity({ type: "staff_created", title: "Recepcionista creado", detail: employee.name, actor: req.user.name });
  res.status(201).json({ employee: publicUser(employee) });
});

app.patch("/api/admin/staff/:id", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de empleado inválido." });
  const parsed = z.object({ active: z.boolean().optional(), password: z.string().min(12).max(72).optional() }).strict().refine((value) => Object.keys(value).length > 0).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Cambio inválido. La contraseña debe tener al menos 12 caracteres." });
  const employee = await User.findOne({ _id: req.params.id, role: "receptionist" }).select("+sessionVersion");
  if (!employee) return res.status(404).json({ message: "Recepcionista no encontrado." });
  if (parsed.data.active !== undefined) employee.active = parsed.data.active;
  if (parsed.data.password) employee.passwordHash = await bcrypt.hash(parsed.data.password, 12);
  employee.sessionVersion = Number(employee.sessionVersion || 0) + 1;
  await employee.save();
  await addActivity({ type: "staff_updated", title: "Acceso de recepcionista actualizado", detail: employee.name, actor: req.user.name });
  res.json({ employee: publicUser(employee) });
});

app.get("/api/availability", async (req, res) => {
  const date = String(req.query.date || "");
  if (!isValidDateISO(date)) return res.status(400).json({ message: "Fecha invalida." });
  const occupied = await Booking.find({ date, status: { $ne: "cancelado" } }).select("date time durationMinutes courtId status teacherId").lean();
  res.json({ occupied: occupied.map(({ date: bookingDate, time, durationMinutes, courtId, status }) => ({ date: bookingDate, time, durationMinutes, courtId: canonicalCourtId(courtId), status })),
    teacherBusy: occupied.filter((booking) => booking.teacherId).map(({ teacherId, time }) => ({ teacherId, time })) });
});

app.get("/api/teachers", async (_req, res) => {
  const teachers = await Teacher.find().sort({ name: 1 });
  res.json({ teachers: teachers.map(({ id, name, nickname, specialty, status, price }) => ({ id, name, nickname, specialty, status, price })) });
});

app.post("/api/admin/teachers", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = z.object({ name: z.string().trim().min(2).max(100), nickname: z.string().trim().max(40).optional().default(""),
    specialty: z.string().trim().max(100).optional().default("Clases de pádel"), price: z.number().int().min(0).max(100_000_000) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de profesor inválidos." });
  const teacher = await Teacher.create(parsed.data);
  res.status(201).json({ teacher: teacher.toJSON() });
});

app.patch("/api/admin/teachers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de profesor inválido." });
  const parsed = z.object({ status: z.enum(["activo", "vacaciones", "baja"]).optional(),
    price: z.number().int().min(0).max(100_000_000).optional() }).strict().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Datos de profesor inválidos." });
  const teacher = await Teacher.findByIdAndUpdate(req.params.id, { $set: parsed.data }, { returnDocument: "after", runValidators: true });
  if (!teacher) return res.status(404).json({ message: "Profesor no encontrado." });
  res.json({ teacher: teacher.toJSON() });
});

app.get("/api/blocks", async (_req, res) => {
  const blocks = await ScheduleBlock.find().sort({ date: 1, courtId: 1, hour: 1 }).limit(5000);
  res.json({ blocks: blocks.map((block) => block.toJSON()) });
});

const blockInput = z.object({
  date: z.string(), courtId: z.union([z.string(), z.number()]).transform(canonicalCourtId), hour: z.string(),
  durationMinutes: z.number().int().min(30).max(150), reason: z.string().trim().max(120).optional().default("No disponible"),
  type: z.enum(["block", "teacher"]).optional().default("block"),
});

app.post("/api/blocks/batch", requireAuth, requireRole("admin", "receptionist", "teacher"), async (req, res) => {
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
    await withAgendaTransaction(async (session) => {
      for (const block of blocks) {
        const same = existingBlocks.find((item) => item.date === block.date && item.courtId === block.courtId && item.hour === block.hour);
        const id = same?._id || new mongoose.Types.ObjectId();
        if (same) await SlotClaim.deleteMany({ ownerType: "block", ownerId: String(id) }, { session });
        await SlotClaim.insertMany(claimsFor({ date: block.date, courtId: block.courtId, time: block.hour, durationMinutes: block.durationMinutes }, "block", id), { session });
        await ScheduleBlock.updateOne({ _id: id }, { $set: block }, { upsert: true, session });
      }
    });
  } catch (error) {
    if (error.code === 11000 || error.code === 112) return res.status(409).json({ message: "El calendario cambió. Actualizá e intentá de nuevo." });
    throw error;
  }
  res.json({ blocks: (await ScheduleBlock.find({ date: { $in: dates } })).map((block) => block.toJSON()) });
});

app.delete("/api/blocks/batch", requireAuth, requireRole("admin", "receptionist", "teacher"), async (req, res) => {
  const parsed = z.object({ keys: z.array(z.object({ date: z.string(), courtId: z.string(), hour: z.string() })).min(1).max(120) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bloqueos invalidos." });
  const keys = parsed.data.keys.map((item) => ({ date: item.date, courtId: canonicalCourtId(item.courtId), hour: item.hour }));
  const query = { $or: keys, ...(req.user.role === "teacher" ? { ownerId: req.user.id, type: "teacher" } : {}) };
  const deleted = await withAgendaTransaction(async (session) => {
    const blocks = await ScheduleBlock.find(query).session(session);
    await SlotClaim.deleteMany({ ownerType: "block", ownerId: { $in: blocks.map((block) => block.id) } }, { session });
    const result = await ScheduleBlock.deleteMany({ _id: { $in: blocks.map((block) => block._id) } }, { session });
    return result.deletedCount;
  });
  res.json({ deleted });
});

app.get("/api/bookings", requireAuth, async (req, res) => {
  let query;
  if (["admin", "receptionist"].includes(req.user.role)) query = {};
  else if (req.user.role === "teacher") {
    const teacher = await Teacher.findOne({ userId: req.user.id });
    query = teacher ? { teacherId: teacher.id } : { _id: null };
  } else query = { userId: req.user.id };
  const bookings = await Booking.find(query).sort({ date: 1, time: 1 });
  res.json({ bookings: bookings.map((booking) => booking.toJSON()) });
});

app.post("/api/bookings", requireAuth, async (req, res) => {
  const schema = z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    courtId: z.union([z.string(), z.number()]).transform(canonicalCourtId),
    courtName: z.string().max(120).optional(),
    type: z.enum(["court", "class"]).optional().default("court"),
    endTime: z.string().max(5).optional().default(""),
    durationMinutes: z.number().or(z.string()).transform(Number).optional().default(60),
    price: z.number().or(z.string()).transform(Number).optional(),
    paymentOption: z.string().optional().default("cash"),
    teacherId: z.string().nullable().optional(),
    teacherName: z.string().max(100).optional().default(""),
    description: z.string().max(300).optional().default(""),
    playerName: z.string().trim().min(2).max(100).optional(),
    phone: z.string().trim().max(40).optional(),
    userEmail: z.union([z.string().email(), z.literal("")]).optional(),
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
  let teacher = null;
  if (isClass) {
    if (!isValidObjectId(parsed.data.teacherId)) return res.status(400).json({ message: "Elegí un profesor para la clase." });
    teacher = await Teacher.findById(parsed.data.teacherId);
    if (!teacher || teacher.status !== "activo") return res.status(409).json({ message: "El profesor ya no está disponible." });
    const teacherBookings = await Booking.find({ date: parsed.data.date, teacherId: teacher.id, status: { $ne: "cancelado" } });
    if (teacherBookings.some((booking) => booking.time === parsed.data.time)) return res.status(409).json({ message: "El profesor ya tiene una clase en ese horario." });
  }
  if (!["cash", "deposit", "full"].includes(parsed.data.paymentOption)) return res.status(400).json({ message: "Forma de pago invalida." });
  const settings = await Setting.findOne();
  if (!settings) return res.status(503).json({ message: "La configuracion del club no esta disponible." });

  const incoming = {
    ...parsed.data,
    courtId: court.id,
    courtName: court.name,
    type: isClass ? "class" : "court",
    teacherId: teacher?.id || null,
    teacherName: teacher?.name || "",
    price: isClass ? teacher.price : calculateBookingPrice(parsed.data, settings),
    occupiedSlots: bookingSlotStarts(parsed.data.time, parsed.data.durationMinutes),
    durationMinutes: Number(parsed.data.durationMinutes || 60),
    endTime: addMinutesToHour(parsed.data.time, Number(parsed.data.durationMinutes || 60)),
  };
  const staffBooking = ["admin", "receptionist"].includes(req.user.role) && Boolean(parsed.data.playerName);

  const sameDayBookings = await Booking.find({
    date: parsed.data.date,
    status: { $ne: "cancelado" },
  });
  const duplicated = sameDayBookings.find((booking) => bookingsOverlap(booking, incoming));
  if (duplicated) return res.status(409).json({ message: "Ese horario ya fue reservado.", duplicated: true });
  const scheduleBlocks = await ScheduleBlock.find({ date: incoming.date, courtId: incoming.courtId });
  if (scheduleBlocks.some((block) => blockOverlapsBooking(block, incoming))) return res.status(409).json({ message: "Ese horario fue bloqueado por el club." });

  let booking;
  try {
    booking = await withAgendaTransaction(async (session) => {
      const id = new mongoose.Types.ObjectId();
      await SlotClaim.insertMany(claimsFor(incoming, "booking", id), { session });
      const [created] = await Booking.create([{
        _id: id, ...incoming,
        status: "pendiente",
        paymentStatus: parsed.data.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago",
        userId: staffBooking ? "" : req.user.id,
        userEmail: staffBooking ? cleanEmail(parsed.data.userEmail || "") : req.user.email,
        playerName: staffBooking ? parsed.data.playerName : req.user.name,
        phone: staffBooking ? parsed.data.phone || "" : req.user.phone || "",
        createdBy: req.user.id,
        source: staffBooking ? "reception" : "online",
      }], { session });
      return created;
    });
  } catch (error) {
    if (error.code === 11000 || error.code === 112) return res.status(409).json({ message: "Ese horario ya fue reservado o bloqueado.", duplicated: true });
    throw error;
  }
  await addActivity({ type: "booking_created", title: "Nueva reserva", detail: `${booking.playerName} - ${booking.date} ${booking.time}${booking.endTime ? ` a ${booking.endTime}` : ""}`, actor: req.user.name, bookingId: booking.id });
  res.status(201).json({ booking: booking.toJSON() });
});

app.patch("/api/bookings/:id/status", requireAuth, requireRole("admin", "receptionist"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const schema = z.object({ status: z.enum(["pendiente", "confirmado", "cancelado"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Estado invalido." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  if (booking.status === "cancelado" && parsed.data.status !== "cancelado") {
    const [occupied, blocks] = await Promise.all([
      Booking.find({ date: booking.date, status: { $ne: "cancelado" } }),
      ScheduleBlock.find({ date: booking.date, courtId: booking.courtId }),
    ]);
    if (occupied.some((item) => bookingsOverlap(item, booking))) return res.status(409).json({ message: "Ese horario ya fue ocupado. No se puede reactivar la reserva." });
    if (blocks.some((block) => blockOverlapsBooking(block, booking))) return res.status(409).json({ message: "Ese horario está bloqueado. No se puede reactivar la reserva." });
  }
  try {
    await withAgendaTransaction(async (session) => {
      const current = await Booking.findById(booking.id).session(session);
      if (!current) throw Object.assign(new Error("Reserva no encontrada."), { status: 404 });
      if (current.status === "cancelado" && parsed.data.status !== "cancelado") {
        await SlotClaim.insertMany(claimsFor(current, "booking", current.id), { session });
      } else if (current.status !== "cancelado" && parsed.data.status === "cancelado") {
        await SlotClaim.deleteMany({ ownerType: "booking", ownerId: current.id }, { session });
      }
      current.status = parsed.data.status;
      await current.save({ session });
    });
  } catch (error) {
    if (error.code === 11000 || error.code === 112) return res.status(409).json({ message: "Ese horario ya fue ocupado. No se puede reactivar la reserva." });
    throw error;
  }
  booking.status = parsed.data.status;
  await addActivity({ type: `booking_${parsed.data.status}`, title: "Reserva actualizada", detail: `${booking.playerName} - ${booking.status}`, actor: req.user.name, bookingId: booking.id });
  res.json({ booking: booking.toJSON() });
});

app.post("/api/bookings/:id/payments", requireAuth, requireRole("admin", "receptionist"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const schema = z.object({ amount: z.number().int().positive().max(100_000_000), method: z.enum(PAYMENT_METHODS), note: z.string().max(300).optional().default(""), idempotencyKey: z.string().uuid() }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos del cobro invalidos." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  const note = parsed.data.note.trim();
  const previous = booking.paymentEntries.find((entry) => entry.idempotencyKey === parsed.data.idempotencyKey);
  if (previous) return previous.amount === parsed.data.amount && previous.method === parsed.data.method && previous.note === note
    ? res.json({ booking: booking.toJSON(), replayed: true })
    : res.status(409).json({ message: "La clave de esta operación ya se usó para otro movimiento." });
  if (booking.status === "cancelado") return res.status(409).json({ message: "No se puede registrar un pago en una reserva cancelada." });
  const current = paymentSummary(booking);
  if (parsed.data.amount > current.due) return res.status(400).json({ message: "El cobro supera el saldo pendiente." });
  const amountPaid = current.paid + parsed.data.amount;
  const entry = { id: randomUUID(), idempotencyKey: parsed.data.idempotencyKey, amount: parsed.data.amount, method: parsed.data.method, note, actor: req.user.name, at: new Date() };
  const updated = await Booking.findOneAndUpdate({ _id: booking.id, amountPaid: booking.amountPaid, status: { $ne: "cancelado" }, "paymentEntries.idempotencyKey": { $ne: parsed.data.idempotencyKey } }, {
    $set: { amountPaid, paymentStatus: amountPaid >= current.total ? "pagado" : "parcial" }, $push: { paymentEntries: entry },
  }, { returnDocument: "after" });
  if (!updated) {
    const latest = await Booking.findById(req.params.id);
    const replay = latest?.paymentEntries.find((item) => item.idempotencyKey === parsed.data.idempotencyKey);
    if (replay) return replay.amount === parsed.data.amount && replay.method === parsed.data.method && replay.note === note
      ? res.json({ booking: latest.toJSON(), replayed: true })
      : res.status(409).json({ message: "La clave de esta operación ya se usó para otro movimiento." });
    return res.status(409).json({ message: "La reserva cambió. Actualizá la página y volvé a intentar." });
  }
  await addActivity({ type: "booking_payment_recorded", title: "Cobro registrado", detail: `${updated.playerName} - $${parsed.data.amount}`, actor: req.user.name, bookingId: updated.id });
  res.json({ booking: updated.toJSON() });
});

app.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  const ownsBooking = Boolean(booking.userId) && booking.userId === req.user.id;
  if (!["admin", "receptionist"].includes(req.user.role) && !ownsBooking) return res.status(403).json({ message: "No podés cancelar esta reserva." });
  if (isPastSlot(booking.date, booking.time)) return res.status(409).json({ message: "El turno ya comenzó. Contactá al club para resolver la cancelación." });
  if (booking.status !== "cancelado") {
    await withAgendaTransaction(async (session) => {
      const current = await Booking.findById(booking.id).session(session);
      if (current?.status === "cancelado") return;
      await SlotClaim.deleteMany({ ownerType: "booking", ownerId: booking.id }, { session });
      current.status = "cancelado";
      await current.save({ session });
    });
    booking.status = "cancelado";
    await addActivity({ type: "booking_cancelado", title: "Reserva cancelada", detail: `${booking.playerName} - ${booking.date} ${booking.time}`, actor: req.user.name, bookingId: booking.id });
  }
  res.json({ booking: booking.toJSON() });
});

app.post("/api/bookings/:id/payments/reverse", requireAuth, requireRole("admin", "receptionist"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de reserva invalido." });
  const parsed = z.object({ idempotencyKey: z.string().uuid() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de reversión invalidos." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  const previous = booking.paymentEntries.find((entry) => entry.idempotencyKey === parsed.data.idempotencyKey);
  if (previous) return previous.reversalOf
    ? res.json({ booking: booking.toJSON(), replayed: true })
    : res.status(409).json({ message: "La clave de esta operación ya se usó para otro movimiento." });
  const last = lastReversiblePayment(booking);
  if (!last) return res.status(409).json({ message: "No hay cobros para revertir." });
  const amountPaid = paymentSummary(booking).paid - Number(last.amount);
  const paymentStatus = amountPaid <= 0 ? booking.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago" : "parcial";
  const entry = { id: randomUUID(), idempotencyKey: parsed.data.idempotencyKey, amount: -Number(last.amount), method: last.method, note: "Reversión del cobro anterior", actor: req.user.name, at: new Date(), reversalOf: last.id };
  const updated = await Booking.findOneAndUpdate({ _id: booking.id, amountPaid: booking.amountPaid, "paymentEntries.id": last.id, "paymentEntries.reversalOf": { $ne: last.id }, "paymentEntries.idempotencyKey": { $ne: parsed.data.idempotencyKey } }, {
    $set: { amountPaid, paymentStatus }, $push: { paymentEntries: entry },
  }, { returnDocument: "after" });
  if (!updated) {
    const latest = await Booking.findById(req.params.id);
    const replay = latest?.paymentEntries.find((item) => item.idempotencyKey === parsed.data.idempotencyKey);
    if (replay) return replay.reversalOf
      ? res.json({ booking: latest.toJSON(), replayed: true })
      : res.status(409).json({ message: "La clave de esta operación ya se usó para otro movimiento." });
    return res.status(409).json({ message: "El cobro cambió. Actualizá la página." });
  }
  await addActivity({ type: "booking_payment_reversed", title: "Cobro revertido", detail: `${updated.playerName} - $${last.amount}`, actor: req.user.name, bookingId: updated.id });
  res.json({ booking: updated.toJSON() });
});

function publicTournament(tournament) {
  const item = tournament.toJSON();
  delete item.registrations;
  delete item.__v;
  return item;
}

function claimsFor({ date, courtId, time, durationMinutes }, ownerType, ownerId) {
  return bookingSlotStarts(time, durationMinutes).map((slot) => ({ date, courtId, slot, ownerType, ownerId: String(ownerId) }));
}

async function withAgendaTransaction(work) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}

app.get("/api/tournaments", async (_req, res) => {
  const tournaments = await Tournament.find().sort({ date: 1 });
  res.json({ tournaments: tournaments.map(publicTournament) });
});

app.get("/api/tournaments/mine", requireAuth, async (req, res) => {
  const tournaments = await Tournament.find({ "registrations.userId": req.user.id }).sort({ date: 1 });
  const registrations = tournaments.flatMap((tournament) => tournament.registrations
    .filter((registration) => registration.userId === req.user.id)
    .map((registration) => ({ ...registration.toJSON(), tournamentId: tournament.id, tournamentName: tournament.name,
      tournamentDate: tournament.date, tournamentHour: tournament.hour, pricePerPlayer: tournament.pricePerPlayer,
      statusTournament: tournament.status })));
  res.json({ registrations });
});

app.get("/api/admin/tournaments", requireAuth, requireRole("admin"), async (_req, res) => {
  const tournaments = await Tournament.find().sort({ date: 1 });
  res.json({ tournaments: tournaments.map((tournament) => tournament.toJSON()) });
});

const tournamentFields = z.object({
  name: z.string().trim().min(2).max(120), date: z.string(), hour: z.string(),
  status: z.enum(["abierto", "lleno", "en_curso", "finalizado", "cancelado"]),
  category: z.string().trim().max(80), surface: z.string().trim().max(80),
  pricePerPlayer: z.number().int().min(0).max(100_000_000), seededPlayers: z.number().int().min(0),
  maxPlayers: z.number().int().min(1), prize: z.string().trim().max(120),
  description: z.string().trim().max(1000),
});

app.post("/api/admin/tournaments", requireAuth, requireRole("admin"), async (req, res) => {
  const parsed = tournamentFields.safeParse(req.body);
  if (!parsed.success || !isValidDateISO(parsed.data?.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.data?.hour || "") ||
    parsed.data.seededPlayers > parsed.data.maxPlayers) return res.status(400).json({ message: "Datos de torneo inválidos." });
  const tournament = await Tournament.create({ ...parsed.data, currentPlayers: parsed.data.seededPlayers, registrations: [] });
  res.status(201).json({ tournament: tournament.toJSON() });
});

app.patch("/api/admin/tournaments/:id", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de torneo inválido." });
  const parsed = tournamentFields.partial().strict().safeParse(req.body);
  if (!parsed.success || (parsed.data.date && !isValidDateISO(parsed.data.date)) ||
    (parsed.data.hour && !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.data.hour))) return res.status(400).json({ message: "Datos de torneo inválidos." });
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  Object.assign(tournament, parsed.data);
  const active = tournament.registrations.filter((registration) => registration.status !== "cancelado").length;
  if (tournament.seededPlayers + active > tournament.maxPlayers) return res.status(409).json({ message: "El cupo no puede ser menor a las inscripciones activas." });
  tournament.currentPlayers = tournament.seededPlayers + active;
  await tournament.save();
  res.json({ tournament: tournament.toJSON() });
});

app.delete("/api/admin/tournaments/:id", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de torneo inválido." });
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  if (tournament.registrations.length) return res.status(409).json({ message: "El torneo tiene inscripciones. Cancelalo en lugar de eliminarlo." });
  await tournament.deleteOne();
  res.json({ deleted: true });
});

app.patch("/api/admin/tournaments/:id/registrations/:registrationId", requireAuth, requireRole("admin"), async (req, res) => {
  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.registrationId)) return res.status(400).json({ message: "ID inválido." });
  const parsed = z.object({ status: z.enum(["pendiente", "confirmado", "cancelado"]).optional(),
    paymentStatus: z.enum(["pendiente", "pagado", "sin_cargo"]).optional() }).strict().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Estado inválido." });
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  const registration = tournament.registrations.id(req.params.registrationId);
  if (!registration) return res.status(404).json({ message: "Inscripción no encontrada." });
  if (parsed.data.paymentStatus && parsed.data.paymentStatus !== registration.paymentStatus) {
    const wasPaid = registration.paymentStatus === "pagado";
    const isPaid = parsed.data.paymentStatus === "pagado";
    const collected = registration.paymentEntries.reduce((acc, entry) => acc + Number(entry.amount || 0), 0);
    if (wasPaid !== isPaid) registration.paymentEntries.push({ id: randomUUID(), amount: isPaid ? tournament.pricePerPlayer : -collected,
      method: "registro manual", actor: req.user.name, at: new Date() });
  }
  Object.assign(registration, parsed.data, { updatedAt: new Date() });
  const active = tournament.registrations.filter((item) => item.status !== "cancelado").length;
  if (tournament.seededPlayers + active > tournament.maxPlayers) return res.status(409).json({ message: "No quedan cupos disponibles." });
  tournament.currentPlayers = tournament.seededPlayers + active;
  await tournament.save();
  res.json({ tournament: tournament.toJSON() });
});

app.post("/api/tournaments/:id/register", requireAuth, async (req, res) => {
  if (!isValidObjectId(req.params.id)) return res.status(400).json({ message: "ID de torneo inválido." });
  const schema = z.object({ partnerName: z.string().trim().max(100).optional().default(""), partnerPhone: z.string().trim().max(40).optional().default("") }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos invalidos." });
  const tournament = await Tournament.findById(req.params.id);
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  if (tournament.status !== "abierto") return res.status(409).json({ message: "La inscripcion no esta abierta." });
  if (Number(tournament.currentPlayers) >= Number(tournament.maxPlayers)) return res.status(409).json({ message: "No quedan cupos disponibles." });
  if (isPastDate(tournament.date)) return res.status(409).json({ message: "El torneo ya comenzó o pasó." });
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
  res.status(201).json({ tournament: publicTournament(tournament), registration: tournament.registrations.at(-1).toJSON() });
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
    clubName: z.string().trim().min(2).max(120).optional(),
    clubShortName: z.string().trim().min(2).max(40).optional(),
    address: z.string().trim().max(200).optional(),
    mapsQuery: z.string().trim().max(200).optional(),
    whatsapp: z.string().trim().max(40).optional(),
    instagram: z.string().trim().max(80).optional(),
    openingHours: z.string().trim().max(100).optional(),
    clubStatus: z.string().trim().max(160).optional(),
    homeHeadline: z.string().trim().max(180).optional(),
    homeSubtitle: z.string().trim().max(500).optional(),
    promoText: z.string().trim().max(160).optional(),
    courtPrice: z.number().or(z.string()).transform(Number).optional(),
    nightPrice: z.number().or(z.string()).transform(Number).optional(),
    weekendExtra: z.number().or(z.string()).transform(Number).optional(),
    classPrice: z.number().or(z.string()).transform(Number).optional(),
    tournamentPrice: z.number().or(z.string()).transform(Number).optional(),
    teacherCommissionPercent: z.number().or(z.string()).transform(Number).optional(),
  }).strict();

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de configuracion invalidos." });

  const numericKeys = ["courtPrice", "nightPrice", "weekendExtra", "classPrice", "tournamentPrice", "teacherCommissionPercent"];
  for (const key of numericKeys) {
    if (parsed.data[key] !== undefined && (!Number.isFinite(parsed.data[key]) || Number(parsed.data[key]) < 0 || Number(parsed.data[key]) > (key === "teacherCommissionPercent" ? 100 : 100_000_000))) {
      return res.status(400).json({ message: "Los precios deben ser numeros positivos." });
    }
  }
  if (parsed.data.teacherCommissionPercent > 100) return res.status(400).json({ message: "La comisión debe estar entre 0 y 100%." });

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
  const [bookings, expenses, settingsDoc, tournaments] = await Promise.all([
    Booking.find().sort({ date: -1, time: -1 }),
    Expense.find().sort({ date: -1, createdAt: -1 }).limit(80),
    Setting.findOne().sort({ createdAt: 1 }),
    Tournament.find().select("name registrations pricePerPlayer"),
  ]);

  const settings = settingsDoc?.toJSON?.() || {};
  const commissionPercent = Number(settings.teacherCommissionPercent ?? 50);
  const allBookings = bookings.map((booking) => booking.toJSON());
  const activeBookings = allBookings.filter((booking) => booking.status !== "cancelado");
  const expenseRows = expenses.map((expense) => expense.toJSON());
  const collectedBookings = allBookings.filter((booking) => paymentSummary(booking).paid > 0);
  const pendingBookings = activeBookings.filter((booking) => paymentSummary(booking).due > 0).map((booking) => ({ ...booking, amountDue: paymentSummary(booking).due }));
  const tournamentIncomeRows = tournaments.flatMap((tournament) => tournament.registrations.flatMap((registration) => (registration.paymentEntries || [])
    .map((entry) => ({ date: accountingDate(entry.at), amount: Number(entry.amount || 0), type: "tournament", label: tournament.name }))));
  const incomeRows = [...allBookings.flatMap((booking) => {
    const entries = booking.paymentEntries || [];
    return entries.length ? entries.map((entry) => ({ date: accountingDate(entry.at), amount: Number(entry.amount || 0), type: booking.type, label: booking.courtName }))
      : paymentSummary(booking).paid > 0 ? [{ date: accountingDate(booking.updatedAt || booking.date), amount: paymentSummary(booking).paid, type: booking.type, label: booking.courtName }] : [];
  }), ...tournamentIncomeRows];

  const teacherCommissions = collectedBookings
    .filter((booking) => booking.type === "class" || booking.teacherId || booking.teacherName)
    .flatMap((booking) => {
      const entries = booking.paymentEntries?.length ? booking.paymentEntries : [{ amount: paymentSummary(booking).paid, at: booking.updatedAt || booking.date }];
      return entries.map((entry) => ({
        date: accountingDate(entry.at), teacherName: booking.teacherName || "Profesor", bookingId: booking.id,
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
    { label: "Torneos", amount: tournamentIncomeRows.reduce((acc, item) => acc + item.amount, 0) },
  ];

  res.json({
    summary: {
      byPeriod,
      totals: {
        grossIncome: incomeRows.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        collected: collectedBookings.reduce((acc, booking) => acc + paymentSummary(booking).paid, 0) + tournamentIncomeRows.reduce((acc, item) => acc + item.amount, 0),
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
    concept: z.string().trim().min(2).max(160),
    category: z.string().trim().max(60).optional().default("operativo"),
    amount: z.number().or(z.string()).transform(Number),
    paymentMethod: z.string().trim().max(60).optional().default("efectivo"),
    note: z.string().trim().max(500).optional().default(""),
  }).strict();
  const parsed = schema.safeParse(req.body);
  if (!parsed.success || !Number.isFinite(parsed.data.amount) || parsed.data.amount <= 0 || parsed.data.amount > 1_000_000_000) {
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

app.use((err, req, res, _next) => {
  if (err?.type === "entity.too.large") return res.status(413).json({ message: "La solicitud supera el tamaño permitido." });
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ message: "El cuerpo JSON no es válido." });
  if (err?.name === "CastError") return res.status(400).json({ message: "El identificador enviado no es válido." });
  if (err?.code === 11000) return res.status(409).json({ message: "Ya existe un registro con esos datos." });
  if (err.name === "VersionError") return res.status(409).json({ message: "Los datos cambiaron. Actualizá la página y volvé a intentar." });
  const requestId = res.getHeader("X-Request-ID") || "unknown";
  if (process.env.NODE_ENV === "production") console.error(`[${requestId}] ${err?.name || "Error"}`);
  else console.error(`[${requestId}]`, err);
  res.status(500).json({ message: "Error interno del servidor.", requestId });
});

export { app };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
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
}
