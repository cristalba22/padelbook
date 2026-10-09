import test from "node:test";
import assert from "node:assert/strict";
import { buildFinanceSummary } from "../server/financeSummary.mjs";

test("la caja clasifica una reserva con profesor como clase una sola vez", () => {
  const bookings = [
    { id: "court-1", type: "court", price: 20000, amountPaid: 20000, status: "confirmado", paymentEntries: [] },
    { id: "class-1", type: "court", teacherId: "teacher-1", teacherName: "Profe", price: 30000,
      amountPaid: 30000, status: "confirmado", paymentEntries: [] },
  ];
  const summary = buildFinanceSummary({ bookings, expenses: [], settings: { teacherCommissionPercent: 40 }, tournaments: [] });
  assert.equal(summary.totals.collected, 50000);
  assert.deepEqual(summary.incomeByCategory, [
    { label: "Cancha", amount: 20000 },
    { label: "Clases", amount: 30000 },
    { label: "Torneos", amount: 0 },
  ]);
  assert.equal(summary.totals.teacherCommissions, 12000);
});
