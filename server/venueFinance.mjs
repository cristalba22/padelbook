import { z } from "zod";
import { Activity, Booking, Expense, Setting, Tournament, Venue, addActivity } from "./db.mjs";
import { argentinaDateISO } from "../src/utils/bookingDomain.js";
import { isValidDateISO } from "./dateValidation.mjs";
import { buildFinanceSummary } from "./financeSummary.mjs";
import { venueScope } from "./tenantAccess.mjs";

const expenseInput = z.object({
  date: z.string().refine(isValidDateISO).optional(),
  concept: z.string().trim().min(2).max(160),
  category: z.string().trim().max(60).optional().default("operativo"),
  amount: z.number().int().positive().max(1_000_000_000),
  paymentMethod: z.string().trim().max(60).optional().default("efectivo"),
  note: z.string().trim().max(500).optional().default(""),
}).strict();

async function summaryFor(context) {
  const [bookings, expenses, settings, tournaments] = await Promise.all([
    Booking.find(venueScope(context)).sort({ date: -1, time: -1 }),
    Expense.find(venueScope(context)).sort({ date: -1, createdAt: -1 }),
    Setting.findOne(venueScope(context)),
    Tournament.find(venueScope(context)).select("name registrations pricePerPlayer"),
  ]);
  return buildFinanceSummary({ bookings, expenses, settings, tournaments });
}

export async function venueFinanceSummary(req, res) {
  res.json({ summary: await summaryFor(req.venueContext) });
}

export async function createVenueExpense(req, res) {
  const parsed = expenseInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de egreso inválidos." });
  const expense = await Expense.create({ ...parsed.data, date: parsed.data.date || argentinaDateISO(),
    organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId });
  try {
    await addActivity({ organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId,
      type: "expense_created", title: "Egreso registrado", detail: `${expense.concept} - $${expense.amount}`,
      actor: req.user.name });
  } catch {
    console.error("VenueExpenseActivityError");
  }
  res.status(201).json({ expense: expense.toJSON() });
}

export async function venueActivity(req, res) {
  const activity = await Activity.find(venueScope(req.venueContext)).sort({ createdAt: -1 }).limit(30);
  res.json({ activity: activity.map((item) => item.toJSON()) });
}

function consolidate(summaries) {
  const values = summaries.map((item) => item.summary);
  const periods = ["day", "week", "month", "year"];
  const moneyFields = ["income", "expenses", "commissions", "net"];
  const byPeriod = Object.fromEntries(periods.map((period) => [period,
    Object.fromEntries(moneyFields.map((key) => [key, values.reduce((sum, value) => sum + value.byPeriod[period][key], 0)]))]));
  const totals = Object.fromEntries(["grossIncome", "collected", "pending", "expenses", "teacherCommissions"]
    .map((key) => [key, values.reduce((sum, value) => sum + value.totals[key], 0)]));
  const dailyTrend = values[0]?.dailyTrend.map((row, index) => ({ date: row.date,
    income: values.reduce((sum, value) => sum + value.dailyTrend[index].income, 0),
    expenses: values.reduce((sum, value) => sum + value.dailyTrend[index].expenses, 0),
    commissions: values.reduce((sum, value) => sum + value.dailyTrend[index].commissions, 0),
    net: values.reduce((sum, value) => sum + value.dailyTrend[index].net, 0) })) || [];
  const incomeByCategory = ["Cancha", "Clases", "Torneos"].map((label) => ({ label,
    amount: values.reduce((sum, value) => sum + (value.incomeByCategory.find((item) => item.label === label)?.amount || 0), 0) }));
  const recent = (key, field) => summaries.flatMap(({ venue, summary }) => summary[key].map((item) => ({ ...item,
    venueId: String(venue._id), venueName: venue.name }))).sort((a, b) => String(b[field] || "").localeCompare(String(a[field] || ""))).slice(0, 12);
  return { byPeriod, totals, dailyTrend, incomeByCategory,
    teacherCommissions: recent("teacherCommissions", "date"),
    expenses: recent("expenses", "date"), pendingPayments: recent("pendingPayments", "date") };
}

export async function organizationFinanceSummary(req, res) {
  const venues = await Venue.find({ organizationId: req.organization._id }).sort({ name: 1 }).lean();
  const summaries = await Promise.all(venues.map(async (venue) => ({ venue,
    summary: await summaryFor({ organizationId: req.organization._id, venueId: venue._id }) })));
  res.json({ summary: consolidate(summaries), venues: summaries.map(({ venue, summary }) => ({
    id: String(venue._id), slug: venue.slug, name: venue.name, active: venue.active, summary,
  })) });
}

export async function organizationActivity(req, res) {
  const activity = await Activity.find({ organizationId: req.organization._id }).sort({ createdAt: -1 }).limit(50);
  res.json({ activity: activity.map((item) => item.toJSON()) });
}
