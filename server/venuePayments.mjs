import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { Booking, addActivity } from "./db.mjs";
import { venueScope } from "./tenantAccess.mjs";
import { lastReversiblePayment, paymentSummary, PAYMENT_METHODS } from "../src/utils/paymentDomain.js";

const paymentInput = z.object({
  amount: z.number().int().positive().max(100_000_000),
  method: z.enum(PAYMENT_METHODS),
  note: z.string().max(300).optional().default(""),
  idempotencyKey: z.string().uuid(),
}).strict();
const reversalInput = z.object({ idempotencyKey: z.string().uuid() }).strict();

async function recordPaymentActivity(req, type, title, booking, amount) {
  try {
    await addActivity({ organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId,
      type, title, detail: `${booking.playerName} - $${amount}`, actor: req.user.name, bookingId: booking.id });
  } catch {
    console.error("VenuePaymentActivityError");
  }
}

export async function recordVenuePayment(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Reserva no encontrada." });
  const parsed = paymentInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos del cobro inválidos." });
  const scope = venueScope(req.venueContext, { _id: req.params.id });
  const booking = await Booking.findOne(scope);
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
  const entry = { id: randomUUID(), idempotencyKey: parsed.data.idempotencyKey, amount: parsed.data.amount,
    method: parsed.data.method, note, actor: req.user.name, at: new Date() };
  const updated = await Booking.findOneAndUpdate(venueScope(req.venueContext, {
    _id: booking.id, amountPaid: booking.amountPaid, status: { $ne: "cancelado" },
    "paymentEntries.idempotencyKey": { $ne: parsed.data.idempotencyKey },
  }), {
    $set: { amountPaid, paymentStatus: amountPaid >= current.total ? "pagado" : "parcial" }, $push: { paymentEntries: entry },
  }, { returnDocument: "after" });
  if (!updated) {
    const latest = await Booking.findOne(scope);
    const replay = latest?.paymentEntries.find((item) => item.idempotencyKey === parsed.data.idempotencyKey);
    if (replay) return replay.amount === parsed.data.amount && replay.method === parsed.data.method && replay.note === note
      ? res.json({ booking: latest.toJSON(), replayed: true })
      : res.status(409).json({ message: "La clave de esta operación ya se usó para otro movimiento." });
    return res.status(409).json({ message: "La reserva cambió. Actualizá la página y volvé a intentar." });
  }
  await recordPaymentActivity(req, "booking_payment_recorded", "Cobro registrado", updated, parsed.data.amount);
  res.json({ booking: updated.toJSON() });
}

export async function reverseVenuePayment(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Reserva no encontrada." });
  const parsed = reversalInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de reversión inválidos." });
  const scope = venueScope(req.venueContext, { _id: req.params.id });
  const booking = await Booking.findOne(scope);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  const previous = booking.paymentEntries.find((entry) => entry.idempotencyKey === parsed.data.idempotencyKey);
  if (previous) return previous.reversalOf
    ? res.json({ booking: booking.toJSON(), replayed: true })
    : res.status(409).json({ message: "La clave de esta operación ya se usó para otro movimiento." });
  const last = lastReversiblePayment(booking);
  if (!last) return res.status(409).json({ message: "No hay cobros para revertir." });
  const amountPaid = paymentSummary(booking).paid - Number(last.amount);
  const paymentStatus = amountPaid <= 0 ? booking.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago" : "parcial";
  const entry = { id: randomUUID(), idempotencyKey: parsed.data.idempotencyKey, amount: -Number(last.amount),
    method: last.method, note: "Reversión del cobro anterior", actor: req.user.name, at: new Date(), reversalOf: last.id };
  const updated = await Booking.findOneAndUpdate(venueScope(req.venueContext, {
    _id: booking.id, amountPaid: booking.amountPaid, "paymentEntries.id": last.id,
    "paymentEntries.reversalOf": { $ne: last.id }, "paymentEntries.idempotencyKey": { $ne: parsed.data.idempotencyKey },
  }), { $set: { amountPaid, paymentStatus }, $push: { paymentEntries: entry } }, { returnDocument: "after" });
  if (!updated) {
    const latest = await Booking.findOne(scope);
    const replay = latest?.paymentEntries.find((item) => item.idempotencyKey === parsed.data.idempotencyKey);
    if (replay) return replay.reversalOf
      ? res.json({ booking: latest.toJSON(), replayed: true })
      : res.status(409).json({ message: "La clave de esta operación ya se usó para otro movimiento." });
    return res.status(409).json({ message: "El cobro cambió. Actualizá la página." });
  }
  await recordPaymentActivity(req, "booking_payment_reversed", "Cobro revertido", updated, last.amount);
  res.json({ booking: updated.toJSON() });
}
