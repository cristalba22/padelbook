import mongoose from "mongoose";
import { z } from "zod";
import { Booking, Court, ScheduleBlock, Setting, SlotClaim, Teacher, addActivity } from "./db.mjs";
import { addMinutesToHour, fitsCourtHours } from "./courtView.mjs";
import { membershipForVenue, venueScope } from "./tenantAccess.mjs";
import { sendBookingEmail } from "./email.mjs";
import { CLASS_HOURS } from "../src/data/bookingConfig.js";
import { argentinaDateISO, blockOverlapsBooking, bookingSlotStarts, bookingsOverlap, calculateBookingPrice, canonicalCourtId, isPastSlot } from "../src/utils/bookingDomain.js";

const bookingInput = z.object({
  date: z.string(),
  time: z.string(),
  courtId: z.union([z.string(), z.number()]).transform(canonicalCourtId),
  type: z.enum(["court", "class"]).optional().default("court"),
  durationMinutes: z.union([z.literal(60), z.literal(90), z.literal(120), z.literal(150)]),
  paymentOption: z.enum(["cash", "deposit", "full"]).optional().default("cash"),
  teacherId: z.string().optional(),
  description: z.string().max(300).optional().default(""),
  playerName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(40).optional(),
  userEmail: z.union([z.string().email(), z.literal("")]).optional(),
}).strict();

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

async function withAgendaTransaction(work) {
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session)); }
  finally { await session.endSession(); }
}

function notifyBooking(booking, action, settings) {
  if (!booking.userEmail) return;
  void sendBookingEmail({ to: booking.userEmail, name: booking.playerName, action,
    booking: booking.toJSON(), clubName: settings?.clubName || "PadelBook" })
    .catch(() => console.error("VenueBookingEmailDeliveryError"));
}

async function recordActivity(context, item) {
  try {
    await addActivity({ ...item, organizationId: context.organizationId, venueId: context.venueId });
  } catch {
    console.error("VenueBookingActivityError");
  }
}

export async function createVenueBooking(req, res) {
  const membership = await membershipForVenue(req.user.id, req.venueContext);
  if (!membership) return res.status(403).json({ message: "No tenés acceso a esta sede." });
  const parsed = bookingInput.safeParse(req.body);
  if (!parsed.success || !validDate(parsed.data?.date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(parsed.data?.time || "")) {
    return res.status(400).json({ message: "Datos de reserva inválidos." });
  }
  const input = parsed.data;
  if (input.date < argentinaDateISO() || isPastSlot(input.date, input.time)) {
    return res.status(400).json({ message: "Ese horario ya pasó." });
  }
  const context = req.venueContext;
  const court = await Court.findOne(venueScope(context, { courtId: input.courtId, active: { $ne: false } }));
  const isClass = input.type === "class";
  const validTime = court && (isClass
    ? CLASS_HOURS.includes(input.time) && fitsCourtHours(court, input.time, 60)
    : fitsCourtHours(court, input.time, input.durationMinutes));
  if (!validTime || (isClass ? input.durationMinutes !== 60 : !court.allowedDurations.includes(input.durationMinutes))) {
    return res.status(400).json({ message: "Cancha, horario o duración inválidos." });
  }
  let teacher = null;
  if (isClass) {
    if (!mongoose.Types.ObjectId.isValid(input.teacherId || "")) return res.status(400).json({ message: "Elegí un profesor." });
    teacher = await Teacher.findOne(venueScope(context, { _id: input.teacherId, status: "activo" }));
    if (!teacher) return res.status(409).json({ message: "El profesor ya no está disponible." });
    const teacherBookings = await Booking.find(venueScope(context, { date: input.date, teacherId: teacher.id, status: { $ne: "cancelado" } }));
    if (teacherBookings.some((booking) => booking.time === input.time)) return res.status(409).json({ message: "El profesor ya tiene una clase en ese horario." });
  }
  const settings = await Setting.findOne(venueScope(context));
  if (!settings) return res.status(503).json({ message: "La configuración de la sede no está disponible." });
  const staffBooking = ["admin", "receptionist"].includes(membership.role) && Boolean(input.playerName);
  const incoming = {
    organizationId: context.organizationId,
    venueId: context.venueId,
    date: input.date,
    time: input.time,
    courtId: court.courtId,
    courtName: court.name,
    type: input.type,
    durationMinutes: input.durationMinutes,
    endTime: addMinutesToHour(input.time, input.durationMinutes),
    occupiedSlots: bookingSlotStarts(input.time, input.durationMinutes),
    teacherId: teacher?.id || null,
    teacherName: teacher?.name || "",
    description: input.description,
    paymentOption: input.paymentOption,
    price: isClass ? teacher.price : calculateBookingPrice(input, {
      ...settings.toObject(), courtPrice: court.basePrice, nightPrice: court.nightPrice, weekendExtra: court.weekendExtra,
    }),
    status: "pendiente",
    paymentStatus: input.paymentOption === "cash" ? "a_pagar_en_club" : "pendiente_pago",
    userId: staffBooking ? "" : req.user.id,
    userEmail: staffBooking ? String(input.userEmail || "").toLowerCase() : req.user.email,
    playerName: staffBooking ? input.playerName : req.user.name,
    phone: staffBooking ? input.phone || "" : req.user.phone || "",
    createdBy: req.user.id,
    source: staffBooking ? "reception" : "online",
  };
  const [sameDayBookings, blocks] = await Promise.all([
    Booking.find(venueScope(context, { date: input.date, status: { $ne: "cancelado" } })),
    ScheduleBlock.find(venueScope(context, { date: input.date, courtId: court.courtId })),
  ]);
  if (sameDayBookings.some((booking) => bookingsOverlap(booking, incoming))) {
    return res.status(409).json({ message: "Ese horario ya fue reservado." });
  }
  if (blocks.some((block) => blockOverlapsBooking(block, incoming))) {
    return res.status(409).json({ message: "Ese horario fue bloqueado por el club." });
  }
  let booking;
  try {
    booking = await withAgendaTransaction(async (session) => {
      const id = new mongoose.Types.ObjectId();
      const claims = incoming.occupiedSlots.map((slot) => ({ organizationId: context.organizationId, venueId: context.venueId,
        date: input.date, courtId: court.courtId, slot, ownerType: "booking", ownerId: String(id) }));
      await SlotClaim.insertMany(claims, { session });
      const [created] = await Booking.create([{ _id: id, ...incoming }], { session });
      return created;
    });
  } catch (error) {
    if (error.code === 11000 || error.code === 112) return res.status(409).json({ message: "Ese horario ya fue reservado o bloqueado." });
    throw error;
  }
  await recordActivity(context, { type: "booking_created", title: "Nueva reserva", detail: `${booking.playerName} - ${booking.date} ${booking.time}`,
    actor: req.user.name, bookingId: booking.id });
  notifyBooking(booking, "created", settings);
  res.status(201).json({ booking: booking.toJSON() });
}

export async function cancelVenueBooking(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Reserva no encontrada." });
  const context = req.venueContext;
  const membership = await membershipForVenue(req.user.id, context);
  if (!membership) return res.status(403).json({ message: "No tenés acceso a esta sede." });
  const booking = await Booking.findOne(venueScope(context, { _id: req.params.id }));
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  const staff = ["admin", "receptionist"].includes(membership.role);
  const owner = booking.userId && booking.userId === req.user.id;
  if (!staff && !owner) return res.status(403).json({ message: "No podés cancelar esta reserva." });
  if (isPastSlot(booking.date, booking.time)) return res.status(409).json({ message: "El turno ya comenzó. Contactá al club." });
  if (booking.status !== "cancelado") {
    await withAgendaTransaction(async (session) => {
      const current = await Booking.findOne(venueScope(context, { _id: booking.id })).session(session);
      if (!current || current.status === "cancelado") return;
      await SlotClaim.deleteMany(venueScope(context, { ownerType: "booking", ownerId: booking.id }), { session });
      current.status = "cancelado";
      await current.save({ session });
    });
    booking.status = "cancelado";
    await recordActivity(context, { type: "booking_cancelado", title: "Reserva cancelada", detail: `${booking.playerName} - ${booking.date} ${booking.time}`,
      actor: req.user.name, bookingId: booking.id });
    const settings = await Setting.findOne(venueScope(context));
    notifyBooking(booking, "cancelled", settings);
  }
  res.json({ booking: booking.toJSON() });
}

export async function updateVenueBookingStatus(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Reserva no encontrada." });
  const parsed = z.object({ status: z.enum(["pendiente", "confirmado", "cancelado"]) }).strict().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Estado inválido." });
  const context = req.venueContext;
  const filter = venueScope(context, { _id: req.params.id });
  const booking = await Booking.findOne(filter);
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  if (booking.status === parsed.data.status) return res.json({ booking: booking.toJSON() });
  if (booking.status === "cancelado" && parsed.data.status !== "cancelado") {
    const [occupied, blocks] = await Promise.all([
      Booking.find(venueScope(context, { date: booking.date, status: { $ne: "cancelado" } })),
      ScheduleBlock.find(venueScope(context, { date: booking.date, courtId: booking.courtId })),
    ]);
    if (occupied.some((item) => bookingsOverlap(item, booking)) || blocks.some((block) => blockOverlapsBooking(block, booking))) {
      return res.status(409).json({ message: "Ese horario ya está ocupado o bloqueado." });
    }
  }
  let updated;
  try {
    updated = await withAgendaTransaction(async (session) => {
      const current = await Booking.findOne(filter).session(session);
      if (!current) return null;
      if (current.status === "cancelado" && parsed.data.status !== "cancelado") {
        const claims = bookingSlotStarts(current.time, current.durationMinutes || 60).map((slot) => ({
          organizationId: context.organizationId, venueId: context.venueId, date: current.date,
          courtId: current.courtId, slot, ownerType: "booking", ownerId: current.id,
        }));
        await SlotClaim.insertMany(claims, { session });
      } else if (current.status !== "cancelado" && parsed.data.status === "cancelado") {
        await SlotClaim.deleteMany(venueScope(context, { ownerType: "booking", ownerId: current.id }), { session });
      }
      current.status = parsed.data.status;
      await current.save({ session });
      return current;
    });
  } catch (error) {
    if (error.code === 11000 || error.code === 112) return res.status(409).json({ message: "Ese horario ya está ocupado o bloqueado." });
    throw error;
  }
  if (!updated) return res.status(404).json({ message: "Reserva no encontrada." });
  await recordActivity(context, { type: `booking_${updated.status}`, title: "Reserva actualizada", detail: `${updated.playerName} - ${updated.status}`,
    actor: req.user.name, bookingId: updated.id });
  const settings = await Setting.findOne(venueScope(context));
  notifyBooking(updated, updated.status === "cancelado" ? "cancelled" : updated.status === "confirmado" ? "confirmed" : "updated", settings);
  res.json({ booking: updated.toJSON() });
}
