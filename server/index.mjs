import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { CLIENT_ORIGIN, PORT } from "./config.mjs";
import { Activity, Booking, Expense, Setting, Tournament, User, addActivity, connectDb, dbState } from "./db.mjs";
import { publicUser, requireAuth, requireRole, signToken } from "./auth.mjs";

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
const normalizeStatus = (status = "pendiente") => String(status || "pendiente").toLowerCase();

function todayString() {
  return new Date().toISOString().slice(0, 10);
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

function isCollectedBooking(booking) {
  return booking.status === "confirmado" || booking.paymentStatus === "pagado";
}

app.get("/api", (_req, res) => {
  res.json({
    name: "PadelBook API",
    status: "online",
    database: dbState(),
    endpoints: ["/api/health", "/api/auth/login", "/api/bookings", "/api/tournaments", "/api/settings", "/api/finance/summary"],
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "PadelBook API", database: dbState(), timestamp: new Date().toISOString() });
});

app.post("/api/auth/login", async (req, res) => {
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

app.post("/api/auth/register", async (req, res) => {
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
    courtId: z.union([z.string(), z.number()]).transform(String),
    courtName: z.string().min(2),
    type: z.string().optional().default("court"),
    price: z.number().or(z.string()).transform(Number),
    paymentOption: z.string().optional().default("cash"),
    teacherId: z.string().nullable().optional(),
    teacherName: z.string().optional().default(""),
    description: z.string().optional().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de reserva invalidos." });

  const duplicated = await Booking.findOne({
    date: parsed.data.date,
    time: parsed.data.time,
    courtId: parsed.data.courtId,
    status: { $ne: "cancelado" },
  });
  if (duplicated) return res.status(409).json({ message: "Ese horario ya fue reservado.", booking: duplicated.toJSON(), duplicated: true });

  const booking = await Booking.create({
    ...parsed.data,
    status: "pendiente",
    paymentStatus: parsed.data.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago",
    userId: req.user.id,
    userEmail: req.user.email,
    playerName: req.user.name,
    phone: req.user.phone || "",
  });
  await addActivity({ type: "booking_created", title: "Nueva reserva", detail: `${booking.playerName} - ${booking.date} ${booking.time}`, actor: booking.playerName, bookingId: booking.id });
  res.status(201).json({ booking: booking.toJSON() });
});

app.patch("/api/bookings/:id/status", requireAuth, requireRole("admin"), async (req, res) => {
  const schema = z.object({ status: z.enum(["pendiente", "confirmado", "cancelado"]) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Estado invalido." });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  booking.status = parsed.data.status;
  if (parsed.data.status === "confirmado") booking.paymentStatus = "pagado";
  await booking.save();
  await addActivity({ type: `booking_${parsed.data.status}`, title: "Reserva actualizada", detail: `${booking.playerName} - ${booking.status}`, actor: req.user.name, bookingId: booking.id });
  res.json({ booking: booking.toJSON() });
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
  const settings = await Setting.findOne().sort({ createdAt: 1 });
  res.json({ settings: settings?.toJSON() || {} });
});

app.get("/api/finance/summary", requireAuth, requireRole("admin"), async (_req, res) => {
  const [bookings, tournaments, expenses, settingsDoc] = await Promise.all([
    Booking.find().sort({ date: -1, time: -1 }),
    Tournament.find().sort({ date: -1 }),
    Expense.find().sort({ date: -1, createdAt: -1 }).limit(80),
    Setting.findOne().sort({ createdAt: 1 }),
  ]);

  const settings = settingsDoc?.toJSON?.() || {};
  const commissionPercent = Number(settings.teacherCommissionPercent ?? 50);
  const activeBookings = bookings.map((booking) => booking.toJSON()).filter((booking) => booking.status !== "cancelado");
  const activeTournaments = tournaments.map((tournament) => tournament.toJSON()).filter((tournament) => tournament.status !== "cancelado");
  const expenseRows = expenses.map((expense) => expense.toJSON());
  const collectedBookings = activeBookings.filter(isCollectedBooking);
  const pendingBookings = activeBookings.filter((booking) => !isCollectedBooking(booking));

  const tournamentRevenue = activeTournaments.map((tournament) => ({
    date: tournament.date,
    amount: Number(tournament.pricePerPlayer || 0) * Number(tournament.currentPlayers || 0),
    name: tournament.name,
  }));

  const incomeRows = [
    ...collectedBookings.map((booking) => ({ date: booking.date, amount: Number(booking.price || 0), type: booking.type, label: booking.courtName })),
    ...tournamentRevenue,
  ];

  const teacherCommissions = collectedBookings
    .filter((booking) => booking.type === "class" || booking.teacherId || booking.teacherName)
    .map((booking) => ({
      date: booking.date,
      teacherName: booking.teacherName || "Profesor",
      bookingId: booking.id,
      gross: Number(booking.price || 0),
      amount: Math.round((Number(booking.price || 0) * commissionPercent) / 100),
      percent: commissionPercent,
    }));

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
    { label: "Cancha", amount: collectedBookings.filter((booking) => booking.type !== "class").reduce((acc, booking) => acc + Number(booking.price || 0), 0) },
    { label: "Clases", amount: collectedBookings.filter((booking) => booking.type === "class" || booking.teacherId || booking.teacherName).reduce((acc, booking) => acc + Number(booking.price || 0), 0) },
    { label: "Torneos", amount: tournamentRevenue.reduce((acc, item) => acc + Number(item.amount || 0), 0) },
  ];

  res.json({
    summary: {
      byPeriod,
      totals: {
        grossIncome: incomeRows.reduce((acc, item) => acc + Number(item.amount || 0), 0),
        collected: collectedBookings.reduce((acc, booking) => acc + Number(booking.price || 0), 0),
        pending: pendingBookings.reduce((acc, booking) => acc + Number(booking.price || 0), 0),
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
