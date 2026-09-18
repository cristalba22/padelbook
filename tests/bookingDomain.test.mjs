import test from "node:test";
import assert from "node:assert/strict";
import { argentinaDateISO, blockOverlapsBooking, bookingSlotStarts, bookingsOverlap, calculateBookingPrice, canonicalCourtId, fitsBlockHours, fitsOperatingHours, isPastSlot, minutesFromTime } from "../src/utils/bookingDomain.js";
import { COURT_HOURS, DURATION_OPTIONS } from "../src/data/bookingConfig.js";
import { applyPayment, paymentSummary, reversePayment } from "../src/utils/paymentDomain.js";

test("normaliza identificadores heredados de cancha", () => {
  assert.equal(canonicalCourtId(1), "court1");
  assert.equal(canonicalCourtId("1"), "court1");
  assert.equal(canonicalCourtId("court1"), "court1");
  assert.equal(canonicalCourtId("cancha 1"), "court1");
});

test("detecta cruces entre reservas de distinta duración", () => {
  const existing = { date: "2026-09-20", time: "19:00", courtId: "1", durationMinutes: 90, status: "confirmado" };
  assert.equal(bookingsOverlap(existing, { date: "2026-09-20", time: "20:00", courtId: "court1", durationMinutes: 60 }), true);
  assert.equal(bookingsOverlap(existing, { date: "2026-09-20", time: "20:30", courtId: "court1", durationMinutes: 60 }), false);
  assert.equal(bookingsOverlap(existing, { date: "2026-09-20", time: "20:00", courtId: "court2", durationMinutes: 60 }), false);
  assert.equal(bookingsOverlap({ ...existing, status: "cancelado" }, { date: "2026-09-20", time: "19:00", courtId: "court1" }), false);
});

test("un único turno de una hora bloquea los inicios superpuestos, no turnos adicionales", () => {
  const existing = { date: "2026-09-20", time: "13:00", courtId: "court1", durationMinutes: 60, status: "confirmado" };
  const candidate = (time) => ({ date: existing.date, time, courtId: existing.courtId, durationMinutes: 60 });
  assert.deepEqual(["12:00", "12:30", "13:00", "13:30", "14:00"].map((time) => bookingsOverlap(existing, candidate(time))),
    [false, true, true, true, false]);
});

test("rechaza horas fuera de formato", () => {
  assert.equal(minutesFromTime("09:30"), 570);
  assert.equal(Number.isNaN(minutesFromTime("25:00")), true);
  assert.equal(Number.isNaN(minutesFromTime("19:99")), true);
});

test("calcula el precio en servidor sin confiar en el importe enviado", () => {
  const settings = { courtPrice: 18000, nightPrice: 24000, weekendExtra: 3000, classPrice: 30000 };
  assert.equal(calculateBookingPrice({ date: "2026-09-17", time: "18:00", type: "court", durationMinutes: 90 }, settings), 30000);
  assert.equal(calculateBookingPrice({ date: "2026-09-19", time: "19:00", type: "court", durationMinutes: 60 }, settings), 27000);
  assert.equal(calculateBookingPrice({ date: "2026-09-17", time: "09:00", type: "class", durationMinutes: 60 }, settings), 30000);
});

test("divide una reserva en franjas únicas de treinta minutos", () => {
  assert.deepEqual(bookingSlotStarts("19:00", 90), [1140, 1170, 1200]);
  assert.deepEqual(bookingSlotStarts("19:15", 60), []);
});

test("usa la fecha de Argentina cerca del cambio de día UTC", () => {
  assert.equal(argentinaDateISO(new Date("2026-09-18T01:30:00Z")), "2026-09-17");
  assert.equal(isPastSlot("2026-09-17", "13:00", new Date("2026-09-17T17:00:00Z")), true);
  assert.equal(isPastSlot("2026-09-17", "15:00", new Date("2026-09-17T17:00:00Z")), false);
});

test("acepta los cuatro turnos entre 09:00 y 22:00, con inicios cada media hora", () => {
  assert.equal(COURT_HOURS[0], "09:00");
  assert.equal(COURT_HOURS.at(-1), "21:30");
  for (const { minutes } of DURATION_OPTIONS) {
    const valid = COURT_HOURS.filter((hour) => fitsOperatingHours(hour, minutes));
    assert.equal(valid[0], "09:00");
    assert.equal(minutesFromTime(valid.at(-1)) + minutes, 22 * 60);
  }
  assert.equal(fitsOperatingHours("21:30", 60), false);
  assert.equal(fitsOperatingHours("08:30", 60), false);
  assert.equal(fitsOperatingHours("19:15", 90), false);
});

test("un bloqueo de media hora impide turnos que se crucen", () => {
  const block = { date: "2026-09-20", courtId: "court1", hour: "10:30", durationMinutes: 30 };
  assert.equal(blockOverlapsBooking(block, { date: block.date, courtId: "court1", time: "09:00", durationMinutes: 120 }), true);
  assert.equal(blockOverlapsBooking(block, { date: block.date, courtId: "court1", time: "11:00", durationMinutes: 60 }), false);
  assert.equal(fitsBlockHours("09:00", 30), true);
  assert.equal(fitsBlockHours("21:30", 30), true);
  assert.equal(fitsBlockHours("21:30", 60), false);
});

test("la seña mantiene saldo y el segundo cobro completa el turno", () => {
  const booking = { price: 30000, paymentOption: "deposit", paymentStatus: "pendiente_pago", status: "confirmado" };
  assert.deepEqual(paymentSummary(booking), { total: 30000, paid: 0, due: 30000, deposit: 9000, suggested: 9000, status: "pendiente_pago" });
  const partial = applyPayment(booking, { amount: 9000, method: "transferencia" });
  assert.equal(paymentSummary(partial).due, 21000);
  assert.equal(partial.paymentStatus, "parcial");
  const full = applyPayment(partial, { amount: 21000, method: "efectivo" });
  assert.equal(paymentSummary(full).due, 0);
  assert.equal(full.paymentStatus, "pagado");
  assert.throws(() => applyPayment(partial, { amount: 22000, method: "efectivo" }));
  const reversed = reversePayment(full);
  assert.equal(paymentSummary(reversed).due, 21000);
  assert.equal(reversePayment(reversed).amountPaid, 0);
});
