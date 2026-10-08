import mongoose from "mongoose";
import { z } from "zod";
import { Booking, Court, ScheduleBlock, SlotClaim, Teacher, addActivity } from "./db.mjs";
import { withAgendaTransaction } from "./agendaTransaction.mjs";
import { isValidDateISO } from "./dateValidation.mjs";
import { fitsCourtHours } from "./courtView.mjs";
import { venueScope } from "./tenantAccess.mjs";
import { CLASS_HOURS } from "../src/data/bookingConfig.js";
import { argentinaDateISO, blockOverlapsBooking, bookingSlotStarts, canonicalCourtId, isPastSlot } from "../src/utils/bookingDomain.js";

const blockInput = z.object({
  date: z.string(),
  courtId: z.union([z.string(), z.number()]).transform(canonicalCourtId),
  hour: z.string(),
  durationMinutes: z.number().int().min(30).max(150).refine((value) => value % 30 === 0),
  reason: z.string().trim().max(120).optional().default("No disponible"),
}).strict();
const createInput = z.object({ blocks: z.array(blockInput).min(1).max(120) }).strict();
const keyInput = z.object({ date: z.string(), courtId: z.string(), hour: z.string() }).strict();
const deleteInput = z.object({ keys: z.array(keyInput).min(1).max(120) }).strict();

async function auditBlock(req, type, title, detail) {
  try {
    await addActivity({ organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId,
      type, title, detail, actor: req.user.name });
  } catch {
    console.error("VenueBlockActivityError");
  }
}

export async function listVenueBlocks(req, res) {
  const date = String(req.query.date || "");
  if (!isValidDateISO(date)) return res.status(400).json({ message: "Fecha inválida." });
  const blocks = await ScheduleBlock.find(venueScope(req.venueContext, { date })).sort({ courtId: 1, hour: 1 });
  res.json({ blocks: blocks.map((block) => ({ date: block.date, courtId: block.courtId,
    hour: block.hour, durationMinutes: block.durationMinutes })) });
}

export async function listAdminVenueBlocks(req, res) {
  const own = req.venueMembership.role === "teacher" ? { ownerId: req.user.id, type: "teacher" } : {};
  const blocks = await ScheduleBlock.find(venueScope(req.venueContext, own)).sort({ date: 1, courtId: 1, hour: 1 }).limit(5000);
  res.json({ blocks: blocks.map((block) => block.toJSON()) });
}

export async function createVenueBlocks(req, res) {
  const parsed = createInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bloqueos inválidos." });
  const context = req.venueContext;
  const role = req.venueMembership.role;
  if (role === "teacher" && !await Teacher.exists(venueScope(context, { userId: req.user.id, status: "activo" }))) {
    return res.status(403).json({ message: "Tu perfil de profesor no está activo en esta sede." });
  }
  const blocks = parsed.data.blocks.map((item) => ({ ...item,
    organizationId: context.organizationId, venueId: context.venueId,
    ownerId: role === "teacher" ? req.user.id : "",
    type: role === "teacher" ? "teacher" : "block",
    reason: role === "teacher" ? `No disponible - ${req.user.name}` : item.reason,
  }));
  const courts = await Court.find(venueScope(context, { active: { $ne: false }, courtId: { $in: blocks.map((block) => block.courtId) } }));
  const courtMap = new Map(courts.map((court) => [court.courtId, court]));
  for (const block of blocks) {
    const court = courtMap.get(block.courtId);
    if (!isValidDateISO(block.date) || block.date < argentinaDateISO() ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(block.hour) || isPastSlot(block.date, block.hour) ||
      !court || !fitsCourtHours(court, block.hour, block.durationMinutes) ||
      (role === "teacher" && (block.durationMinutes !== 60 || !CLASS_HOURS.includes(block.hour)))) {
      return res.status(400).json({ message: "Cancha, fecha u horario de bloqueo inválidos." });
    }
  }
  if (blocks.some((block, index) => blocks.slice(index + 1).some((other) => blockOverlapsBooking(block,
    { date: other.date, courtId: other.courtId, time: other.hour, durationMinutes: other.durationMinutes })))) {
    return res.status(400).json({ message: "Los bloqueos solicitados se superponen." });
  }
  const dates = [...new Set(blocks.map((block) => block.date))];
  const [bookings, existingBlocks] = await Promise.all([
    Booking.find(venueScope(context, { date: { $in: dates }, status: { $ne: "cancelado" } })),
    ScheduleBlock.find(venueScope(context, { date: { $in: dates } })),
  ]);
  for (const block of blocks) {
    if (bookings.some((booking) => blockOverlapsBooking(block, booking))) {
      return res.status(409).json({ message: "El rango contiene una reserva." });
    }
    if (existingBlocks.some((other) => blockOverlapsBooking(other,
      { date: block.date, courtId: block.courtId, time: block.hour, durationMinutes: block.durationMinutes }))) {
      return res.status(409).json({ message: "El rango ya está bloqueado." });
    }
  }
  try {
    await withAgendaTransaction(async (session) => {
      for (const block of blocks) {
        const id = new mongoose.Types.ObjectId();
        const claims = bookingSlotStarts(block.hour, block.durationMinutes).map((slot) => ({
          organizationId: context.organizationId, venueId: context.venueId,
          date: block.date, courtId: block.courtId, slot, ownerType: "block", ownerId: String(id),
        }));
        await SlotClaim.insertMany(claims, { session });
        await ScheduleBlock.create([{ _id: id, ...block }], { session });
      }
    });
  } catch (error) {
    if (error.code === 11000 || error.code === 112) return res.status(409).json({ message: "El calendario cambió. Actualizá e intentá de nuevo." });
    throw error;
  }
  await auditBlock(req, "block_created", "Bloqueo creado", `${blocks.length} franjas bloqueadas`);
  const stored = await ScheduleBlock.find(venueScope(context, { date: { $in: dates } }));
  res.status(201).json({ blocks: stored.map((block) => block.toJSON()) });
}

export async function deleteVenueBlocks(req, res) {
  const parsed = deleteInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Bloqueos inválidos." });
  if (req.venueMembership.role === "teacher" && !await Teacher.exists(venueScope(req.venueContext,
    { userId: req.user.id, status: "activo" }))) {
    return res.status(403).json({ message: "Tu perfil de profesor no está activo en esta sede." });
  }
  const keys = parsed.data.keys.map(({ date, courtId, hour }) => ({ date, courtId: canonicalCourtId(courtId), hour }));
  const context = req.venueContext;
  const filter = venueScope(context, { $or: keys,
    ...(req.venueMembership.role === "teacher" ? { ownerId: req.user.id, type: "teacher" } : {}) });
  const deleted = await withAgendaTransaction(async (session) => {
    const blocks = await ScheduleBlock.find(filter).session(session);
    const ids = blocks.map((block) => block.id);
    if (!ids.length) return 0;
    await SlotClaim.deleteMany(venueScope(context, { ownerType: "block", ownerId: { $in: ids } }), { session });
    const result = await ScheduleBlock.deleteMany(venueScope(context, { _id: { $in: blocks.map((block) => block._id) } }), { session });
    return result.deletedCount;
  });
  if (deleted) await auditBlock(req, "block_deleted", "Bloqueo eliminado", `${deleted} bloqueos eliminados`);
  res.json({ deleted });
}
