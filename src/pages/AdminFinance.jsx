import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { useBooking } from "../hooks/useBooking.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { safeRead, safeWrite } from "../utils/storage.js";

const EXPENSES_KEY = "padel_finance_expenses";

function money(value) {
  return Number(value || 0).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfWeek() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

function startOfMonth() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

function startOfYear() {
  return `${new Date().getFullYear()}-01-01`;
}

function dateShift(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function sumFrom(items, from, valueKey = "amount") {
  return items.filter((item) => String(item.date || "") >= from).reduce((acc, item) => acc + Number(item[valueKey] || 0), 0);
}

function normalizeBooking(booking) {
  return {
    id: booking.id,
    date: booking.date,
    time: booking.time || booking.hour,
    type: booking.type === "class" || booking.teacherId || booking.teacherName ? "class" : "court",
    courtName: booking.courtName || booking.court || "Cancha",
    teacherName: booking.teacherName || "",
    playerName: booking.playerName || booking.userName || "Jugador",
    price: Number(booking.price || booking.total || booking.monto || 0),
    status: booking.status || "pendiente",
    paymentStatus: booking.paymentStatus || "pendiente_pago",
  };
}

function isCollected(booking) {
  return booking.status === "confirmado" || booking.paymentStatus === "pagado";
}

function buildLocalSummary(bookings = [], pricing = {}) {
  const commissionPercent = Number(pricing.teacherCommissionPercent || 50);
  const normalized = bookings.map(normalizeBooking).filter((booking) => booking.status !== "cancelado");
  const collected = normalized.filter(isCollected);
  const pending = normalized.filter((booking) => !isCollected(booking));
  const expenses = safeRead(EXPENSES_KEY, []);
  const incomeRows = collected.map((booking) => ({ date: booking.date, amount: booking.price, type: booking.type, label: booking.courtName }));
  const teacherCommissions = collected
    .filter((booking) => booking.type === "class")
    .map((booking) => ({
      date: booking.date,
      teacherName: booking.teacherName || "Profesor",
      gross: booking.price,
      amount: Math.round((booking.price * commissionPercent) / 100),
      percent: commissionPercent,
    }));

  const periods = { day: todayISO(), week: startOfWeek(), month: startOfMonth(), year: startOfYear() };
  const byPeriod = Object.fromEntries(Object.entries(periods).map(([key, from]) => {
    const income = sumFrom(incomeRows, from);
    const expenseAmount = sumFrom(expenses, from);
    const commissions = sumFrom(teacherCommissions, from);
    return [key, { income, expenses: expenseAmount, commissions, net: income - expenseAmount - commissions }];
  }));

  const dailyTrend = Array.from({ length: 7 }, (_, index) => {
    const date = dateShift(index - 6);
    const income = incomeRows.filter((item) => item.date === date).reduce((acc, item) => acc + item.amount, 0);
    const expenseAmount = expenses.filter((item) => item.date === date).reduce((acc, item) => acc + Number(item.amount || 0), 0);
    const commissions = teacherCommissions.filter((item) => item.date === date).reduce((acc, item) => acc + item.amount, 0);
    return { date, income, expenses: expenseAmount, commissions, net: income - expenseAmount - commissions };
  });

  return {
    byPeriod,
    totals: {
      grossIncome: incomeRows.reduce((acc, item) => acc + item.amount, 0),
      collected: collected.reduce((acc, item) => acc + item.price, 0),
      pending: pending.reduce((acc, item) => acc + item.price, 0),
      expenses: expenses.reduce((acc, item) => acc + Number(item.amount || 0), 0),
      teacherCommissions: teacherCommissions.reduce((acc, item) => acc + item.amount, 0),
    },
    commissionPercent,
    dailyTrend,
    incomeByCategory: [
      { label: "Cancha", amount: collected.filter((item) => item.type === "court").reduce((acc, item) => acc + item.price, 0) },
      { label: "Clases", amount: collected.filter((item) => item.type === "class").reduce((acc, item) => acc + item.price, 0) },
      { label: "Torneos", amount: 0 },
    ],
    teacherCommissions: teacherCommissions.slice(0, 12),
    expenses: expenses.slice(0, 12),
    pendingPayments: pending.slice(0, 12),
  };
}

export default function AdminFinance() {
  const { bookings = [] } = useBooking();
  const { prices } = usePricing();
  const [summary, setSummary] = useState(() => buildLocalSummary(bookings, prices));
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ date: todayISO(), concept: "", category: "operativo", amount: "", paymentMethod: "efectivo", note: "" });
  const [message, setMessage] = useState("");

  const loadSummary = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiRequest("/finance/summary");
      setSummary(payload.summary);
    } catch {
      setSummary(buildLocalSummary(bookings, prices));
    } finally {
      setLoading(false);
    }
  }, [bookings, prices]);

  useEffect(() => {
    loadSummary();
  }, []);

  const maxTrend = useMemo(() => Math.max(1, ...summary.dailyTrend.map((item) => Math.max(item.income, item.expenses + item.commissions))), [summary.dailyTrend]);
  const month = summary.byPeriod.month || { income: 0, expenses: 0, commissions: 0, net: 0 };

  async function handleSubmit(e) {
    e.preventDefault();
    const expense = { ...form, amount: Number(form.amount || 0) };
    if (!expense.concept.trim() || expense.amount <= 0) {
      setMessage("Completá concepto e importe.");
      return;
    }
    try {
      await apiRequest("/expenses", { method: "POST", body: JSON.stringify(expense) });
    } catch {
      const local = safeRead(EXPENSES_KEY, []);
      safeWrite(EXPENSES_KEY, [{ ...expense, id: `expense-${Date.now()}` }, ...local]);
    }
    setForm({ date: todayISO(), concept: "", category: "operativo", amount: "", paymentMethod: "efectivo", note: "" });
    setMessage("Egreso registrado.");
    setTimeout(() => setMessage(""), 2500);
    loadSummary();
  }

  return (
    <AdminLayout title="Finanzas del club" subtitle="Ingresos, egresos, comisiones de profesores y rentabilidad por período.">
      <div className="mb-4 flex justify-end">
        <button type="button" onClick={loadSummary} disabled={loading} className="btn-outline px-4 py-2 text-xs">
          {loading ? "Actualizando..." : "Actualizar datos"}
        </button>
      </div>
      <section className="mobile-snap-row compact mb-6 grid gap-4 xl:grid-cols-4">
        <FinanceMetric label="Hoy" data={summary.byPeriod.day} />
        <FinanceMetric label="Semana" data={summary.byPeriod.week} />
        <FinanceMetric label="Mes" data={summary.byPeriod.month} featured />
        <FinanceMetric label="Año" data={summary.byPeriod.year} />
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel kicker="Resultado mensual" title="Ingresos, costos y neto">
          <div className="grid gap-3 md:grid-cols-3">
            <BigNumber label="Ingresos" value={month.income} tone="lime" />
            <BigNumber label="Egresos + profes" value={month.expenses + month.commissions} tone="amber" />
            <BigNumber label="Neto estimado" value={month.net} tone={month.net >= 0 ? "emerald" : "rose"} />
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {summary.incomeByCategory.map((item) => <CategoryBar key={item.label} item={item} total={Math.max(1, summary.totals.grossIncome)} />)}
          </div>
        </Panel>

        <Panel kicker="Caja por cobrar" title="Pagos pendientes">
          <p className="text-3xl font-black text-white">{money(summary.totals.pending)}</p>
          <p className="mt-1 text-sm text-slate-400">Reservas activas todavía no confirmadas como pagadas.</p>
          <div className="mt-4 space-y-2">
            {summary.pendingPayments.length ? summary.pendingPayments.slice(0, 4).map((item) => (
              <MiniRow key={item.id || `${item.date}-${item.time}`} title={item.playerName} detail={`${item.date} · ${item.time || ""}`} amount={item.price} />
            )) : <p className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3 text-sm text-emerald-100">Sin pagos pendientes.</p>}
          </div>
        </Panel>
      </section>

      <section className="mb-6 grid gap-5 xl:grid-cols-[1fr_380px]">
        <Panel kicker="Últimos 7 días" title="Evolución de caja">
          <div className="grid min-h-[260px] grid-cols-7 items-end gap-3">
            {summary.dailyTrend.map((item) => <TrendColumn key={item.date} item={item} max={maxTrend} />)}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-slate-400">
            <Legend color="bg-lime-300" label="Ingresos" />
            <Legend color="bg-amber-300" label="Egresos + comisiones" />
          </div>
        </Panel>

        <Panel kicker="Nuevo egreso" title="Registrar gasto">
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Fecha"><input type="date" className="field" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            <Field label="Concepto"><input className="field" value={form.concept} onChange={(e) => setForm({ ...form, concept: e.target.value })} placeholder="Luz, limpieza, mantenimiento..." /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoría"><select className="field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="operativo">Operativo</option><option value="mantenimiento">Mantenimiento</option><option value="insumos">Insumos</option><option value="sueldos">Sueldos</option><option value="servicios">Servicios</option></select></Field>
              <Field label="Importe"><input className="field" inputMode="numeric" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/\D/g, "") })} placeholder="0" /></Field>
            </div>
            <Field label="Medio de pago"><select className="field" value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="qr">QR</option><option value="tarjeta">Tarjeta</option></select></Field>
            <button className="btn-primary w-full justify-center py-3" type="submit">Guardar egreso</button>
            {message && <p className="rounded-2xl border border-lime-300/20 bg-lime-300/10 px-3 py-2 text-xs font-bold text-lime-100">{message}</p>}
          </form>
        </Panel>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Panel kicker={`Comisión ${summary.commissionPercent}%`} title="Liquidación de profesores">
          <div className="space-y-2">
            {summary.teacherCommissions.length ? summary.teacherCommissions.map((item) => <MiniRow key={item.bookingId || `${item.date}-${item.teacherName}`} title={item.teacherName} detail={`${item.date} · bruto ${money(item.gross)}`} amount={item.amount} />) : <EmptyText text="Todavía no hay clases confirmadas para liquidar." />}
          </div>
        </Panel>
        <Panel kicker="Gastos cargados" title="Egresos recientes">
          <div className="space-y-2">
            {summary.expenses.length ? summary.expenses.map((item) => <MiniRow key={item.id || `${item.date}-${item.concept}`} title={item.concept} detail={`${item.date} · ${item.category || "operativo"}`} amount={item.amount} />) : <EmptyText text="No hay egresos registrados." />}
          </div>
        </Panel>
      </section>

      {loading && <p className="mt-4 text-xs text-slate-500">Actualizando datos financieros...</p>}
    </AdminLayout>
  );
}

function FinanceMetric({ label, data = {}, featured = false }) {
  return <article className={`rounded-[1.8rem] border p-5 shadow-xl ${featured ? "border-lime-300/30 bg-lime-300/10" : "border-white/10 bg-[#0B1326]/75"}`}><p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p><p className="mt-3 text-3xl font-black text-white">{money(data.net)}</p><div className="mt-3 space-y-1 text-xs text-slate-400"><p>Ingresos: <span className="text-lime-100">{money(data.income)}</span></p><p>Egresos: <span className="text-amber-100">{money(Number(data.expenses || 0) + Number(data.commissions || 0))}</span></p></div></article>;
}

function Panel({ kicker, title, children }) {
  return <section className="rounded-[1.8rem] border border-white/10 bg-[#0B1326]/75 p-5 shadow-xl"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">{kicker}</p><h2 className="mb-4 mt-1 text-xl font-black text-white">{title}</h2>{children}</section>;
}

function BigNumber({ label, value, tone }) {
  const colors = { lime: "text-lime-100 border-lime-300/20 bg-lime-300/10", amber: "text-amber-100 border-amber-300/20 bg-amber-300/10", emerald: "text-emerald-100 border-emerald-300/20 bg-emerald-300/10", rose: "text-rose-100 border-rose-300/20 bg-rose-300/10" };
  return <div className={`rounded-3xl border p-4 ${colors[tone]}`}><p className="text-[11px] uppercase tracking-[0.18em] opacity-70">{label}</p><p className="mt-2 text-2xl font-black">{money(value)}</p></div>;
}

function CategoryBar({ item, total }) {
  const percent = Math.round((Number(item.amount || 0) / total) * 100);
  return <div className="rounded-2xl border border-white/10 bg-black/30 p-3"><div className="flex items-center justify-between text-sm"><span className="font-bold text-white">{item.label}</span><span className="text-slate-300">{money(item.amount)}</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-lime-300" style={{ width: `${percent}%` }} /></div></div>;
}

function TrendColumn({ item, max }) {
  const costs = Number(item.expenses || 0) + Number(item.commissions || 0);
  return <div className="flex h-full flex-col justify-end gap-2"><div className="flex min-h-[190px] items-end gap-1 rounded-2xl border border-white/10 bg-black/25 px-2 py-2"><div className="w-full rounded-t-lg bg-lime-300" style={{ height: `${Math.max(4, (Number(item.income || 0) / max) * 100)}%` }} /><div className="w-full rounded-t-lg bg-amber-300" style={{ height: `${Math.max(4, (costs / max) * 100)}%` }} /></div><p className="truncate text-center text-[10px] text-slate-500">{item.date.slice(5)}</p></div>;
}

function Legend({ color, label }) {
  return <span className="inline-flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${color}`} />{label}</span>;
}

function MiniRow({ title, detail, amount }) {
  return <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-bold text-white">{title}</p><p className="truncate text-xs text-slate-500">{detail}</p></div><p className="shrink-0 text-sm font-black text-white">{money(amount)}</p></div>;
}

function Field({ label, children }) {
  return <label><span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-slate-500">{label}</span>{children}</label>;
}

function EmptyText({ text }) {
  return <p className="rounded-2xl border border-dashed border-white/10 p-4 text-sm text-slate-500">{text}</p>;
}
