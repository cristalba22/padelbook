export const PAYMENT_METHODS = ["efectivo", "transferencia", "qr", "tarjeta"];

export function paymentSummary(booking) {
  const total = Math.max(0, Number(booking?.price || 0));
  const explicit = booking?.amountPaid;
  const paid = Math.min(total, Math.max(0, Number(explicit ?? (booking?.paymentStatus === "pagado" ? total : 0))));
  const due = Math.max(0, total - paid);
  const deposit = Math.ceil(total * 0.3);
  return { total, paid, due, deposit, suggested: booking?.paymentOption === "deposit" && paid < deposit ? deposit - paid : due,
    status: due === 0 ? "pagado" : paid > 0 ? "parcial" : booking?.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago" };
}

export function applyPayment(booking, { amount, method, note = "", actor = "Club" }) {
  const summary = paymentSummary(booking);
  const value = Number(amount);
  if (!Number.isSafeInteger(value) || value <= 0 || value > summary.due) throw new Error("Ingresá un importe válido, igual o menor al saldo pendiente.");
  if (!PAYMENT_METHODS.includes(method)) throw new Error("Elegí un medio de cobro válido.");
  if (booking.status === "cancelado") throw new Error("No se puede cobrar una reserva cancelada.");
  const entry = { id: globalThis.crypto?.randomUUID?.() || `payment-${Date.now()}`, amount: value, method, note: String(note).trim(), actor, at: new Date().toISOString() };
  const amountPaid = summary.paid + value;
  return { ...booking, amountPaid, paymentStatus: amountPaid >= summary.total ? "pagado" : "parcial", paymentEntries: [...(booking.paymentEntries || []), entry], updatedAt: entry.at };
}

export function lastReversiblePayment(booking) {
  const entries = booking?.paymentEntries || [];
  const reversed = new Set(entries.map((entry) => entry.reversalOf).filter(Boolean));
  return [...entries].reverse().find((entry) => Number(entry.amount) > 0 && !reversed.has(entry.id)) || null;
}

export function reversePayment(booking, actor = "Club") {
  const last = lastReversiblePayment(booking);
  if (!last) throw new Error("No hay cobros para revertir.");
  const at = new Date().toISOString();
  const amountPaid = paymentSummary(booking).paid - Number(last.amount);
  return { ...booking, amountPaid, paymentStatus: amountPaid <= 0 ? booking.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago" : "parcial",
    paymentEntries: [...(booking.paymentEntries || []), { id: globalThis.crypto?.randomUUID?.() || `reversal-${Date.now()}`, amount: -Number(last.amount), method: last.method, note: "Reversión del cobro anterior", actor, at, reversalOf: last.id }], updatedAt: at };
}
