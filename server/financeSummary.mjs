import { paymentSummary } from "../src/utils/paymentDomain.js";
import { argentinaDateISO } from "../src/utils/bookingDomain.js";
import { accountingDate, shiftClubDate, startOfClubMonth, startOfClubWeek, startOfClubYear } from "../src/utils/clubDate.js";

function moneyBucket(items, from, getDate, getValue) {
  return items.filter((item) => String(getDate(item) || "") >= from)
    .reduce((sum, item) => sum + Number(getValue(item) || 0), 0);
}

export function buildFinanceSummary({ bookings, expenses, settings, tournaments }) {
  const commissionPercent = Number(settings?.teacherCommissionPercent ?? 50);
  const allBookings = bookings.map((booking) => booking.toJSON ? booking.toJSON() : booking);
  const activeBookings = allBookings.filter((booking) => booking.status !== "cancelado");
  const expenseRows = expenses.map((expense) => expense.toJSON ? expense.toJSON() : expense);
  const collectedBookings = allBookings.filter((booking) => paymentSummary(booking).paid > 0);
  const pendingBookings = activeBookings.filter((booking) => paymentSummary(booking).due > 0)
    .map((booking) => ({ ...booking, amountDue: paymentSummary(booking).due }));
  const tournamentIncomeRows = tournaments.flatMap((tournament) => tournament.registrations.flatMap((registration) =>
    (registration.paymentEntries || []).map((entry) => ({ date: accountingDate(entry.at), amount: Number(entry.amount || 0),
      type: "tournament", label: tournament.name }))));
  const incomeRows = [...allBookings.flatMap((booking) => {
    const entries = booking.paymentEntries || [];
    return entries.length ? entries.map((entry) => ({ date: accountingDate(entry.at), amount: Number(entry.amount || 0),
      type: booking.type, label: booking.courtName }))
      : paymentSummary(booking).paid > 0 ? [{ date: accountingDate(booking.updatedAt || booking.date),
        amount: paymentSummary(booking).paid, type: booking.type, label: booking.courtName }] : [];
  }), ...tournamentIncomeRows];
  const teacherCommissions = collectedBookings
    .filter((booking) => booking.type === "class" || booking.teacherId || booking.teacherName)
    .flatMap((booking) => {
      const entries = booking.paymentEntries?.length ? booking.paymentEntries
        : [{ amount: paymentSummary(booking).paid, at: booking.updatedAt || booking.date }];
      return entries.map((entry) => ({ date: accountingDate(entry.at), teacherName: booking.teacherName || "Profesor",
        bookingId: booking.id, gross: Number(entry.amount || 0),
        amount: Math.round((Number(entry.amount || 0) * commissionPercent) / 100), percent: commissionPercent }));
    });
  const periods = { day: argentinaDateISO(), week: startOfClubWeek(), month: startOfClubMonth(), year: startOfClubYear() };
  const byPeriod = Object.fromEntries(Object.entries(periods).map(([key, from]) => {
    const income = moneyBucket(incomeRows, from, (item) => item.date, (item) => item.amount);
    const expensesAmount = moneyBucket(expenseRows, from, (item) => item.date, (item) => item.amount);
    const commissions = moneyBucket(teacherCommissions, from, (item) => item.date, (item) => item.amount);
    return [key, { income, expenses: expensesAmount, commissions, net: income - expensesAmount - commissions }];
  }));
  const dailyTrend = Array.from({ length: 7 }, (_, index) => {
    const date = shiftClubDate(index - 6);
    const income = moneyBucket(incomeRows, date, (item) => item.date === date ? date : "", (item) => item.amount);
    const expensesAmount = moneyBucket(expenseRows, date, (item) => item.date === date ? date : "", (item) => item.amount);
    const commissions = moneyBucket(teacherCommissions, date, (item) => item.date === date ? date : "", (item) => item.amount);
    return { date, income, expenses: expensesAmount, commissions, net: income - expensesAmount - commissions };
  });
  const incomeByCategory = [
    { label: "Cancha", amount: collectedBookings.filter((booking) => booking.type !== "class" && !booking.teacherId && !booking.teacherName)
      .reduce((sum, booking) => sum + paymentSummary(booking).paid, 0) },
    { label: "Clases", amount: collectedBookings.filter((booking) => booking.type === "class" || booking.teacherId || booking.teacherName)
      .reduce((sum, booking) => sum + paymentSummary(booking).paid, 0) },
    { label: "Torneos", amount: tournamentIncomeRows.reduce((sum, item) => sum + item.amount, 0) },
  ];
  return { byPeriod,
    totals: { grossIncome: incomeRows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      collected: collectedBookings.reduce((sum, booking) => sum + paymentSummary(booking).paid, 0)
        + tournamentIncomeRows.reduce((sum, item) => sum + item.amount, 0),
      pending: pendingBookings.reduce((sum, booking) => sum + booking.amountDue, 0),
      expenses: expenseRows.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      teacherCommissions: teacherCommissions.reduce((sum, item) => sum + Number(item.amount || 0), 0) },
    commissionPercent, dailyTrend, incomeByCategory, teacherCommissions: teacherCommissions.slice(0, 12),
    expenses: expenseRows.slice(0, 12), pendingPayments: pendingBookings.slice(0, 12) };
}
