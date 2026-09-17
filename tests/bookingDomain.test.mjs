import test from "node:test";
import assert from "node:assert/strict";
import { argentinaDateISO, bookingSlotStarts, bookingsOverlap, calculateBookingPrice, canonicalCourtId, isPastSlot, minutesFromTime } from "../src/utils/bookingDomain.js";

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
