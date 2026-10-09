import mongoose from "mongoose";
import { z } from "zod";
import { Booking, Court, Membership, ScheduleBlock, Teacher, User, addActivity } from "./db.mjs";
import { venueScope } from "./tenantAccess.mjs";
import { isValidDateISO } from "./dateValidation.mjs";
import { argentinaDateISO } from "../src/utils/bookingDomain.js";
import { publicCourt } from "./courtView.mjs";

const createInput = z.object({
  name: z.string().trim().min(2).max(100),
  nickname: z.string().trim().max(40).optional().default(""),
  specialty: z.string().trim().max(100).optional().default("Clases de pádel"),
  price: z.number().int().min(0).max(100_000_000),
}).strict();
const updateInput = z.object({
  status: z.enum(["activo", "vacaciones", "baja"]).optional(),
  price: z.number().int().min(0).max(100_000_000).optional(),
}).strict();
const linkInput = z.object({ userId: z.union([z.string().refine((value) => mongoose.Types.ObjectId.isValid(value)), z.null()]) }).strict();

async function auditTeacher(req, type, teacher) {
  try {
    await addActivity({ organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId,
      type, title: type === "teacher_created" ? "Profesor creado" : "Profesor actualizado",
      detail: teacher.name, actor: req.user.name });
  } catch {
    console.error("VenueTeacherActivityError");
  }
}

export async function listAdminVenueTeachers(req, res) {
  const teachers = await Teacher.find(venueScope(req.venueContext)).sort({ name: 1 });
  res.json({ teachers: teachers.map((teacher) => teacher.toJSON()) });
}

export async function createVenueTeacher(req, res) {
  const parsed = createInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de profesor inválidos." });
  const teacher = await Teacher.create({ ...parsed.data, organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId });
  await auditTeacher(req, "teacher_created", teacher);
  res.status(201).json({ teacher: teacher.toJSON() });
}

export async function updateVenueTeacher(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Profesor no encontrado." });
  const parsed = updateInput.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Datos de profesor inválidos." });
  const teacher = await Teacher.findOneAndUpdate(venueScope(req.venueContext, { _id: req.params.id }), { $set: parsed.data },
    { returnDocument: "after", runValidators: true });
  if (!teacher) return res.status(404).json({ message: "Profesor no encontrado." });
  await auditTeacher(req, "teacher_updated", teacher);
  res.json({ teacher: teacher.toJSON() });
}

export async function linkVenueTeacher(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Profesor no encontrado." });
  const parsed = linkInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Elegí una cuenta válida." });
  const teacher = await Teacher.findOne(venueScope(req.venueContext, { _id: req.params.id }));
  if (!teacher) return res.status(404).json({ message: "Profesor no encontrado." });
  const userId = parsed.data.userId || "";
  if (userId) {
    const [user, membership] = await Promise.all([
      User.findOne({ _id: userId, active: { $ne: false } }).select("_id").lean(),
      Membership.findOne({ userId, organizationId: req.venueContext.organizationId, role: "teacher", active: true }).lean(),
    ]);
    if (!user || !membership?.venueIds.some((id) => String(id) === String(req.venueContext.venueId))) {
      return res.status(400).json({ message: "La cuenta no tiene acceso de profesor activo a esta sede." });
    }
  }
  try {
    teacher.userId = userId;
    await teacher.save();
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Esa cuenta ya está vinculada a otro perfil de esta sede." });
    throw error;
  }
  await auditTeacher(req, "teacher_updated", teacher);
  res.json({ teacher: teacher.toJSON() });
}

export async function myVenueTeacherSchedule(req, res) {
  const date = String(req.query.date || argentinaDateISO());
  if (!isValidDateISO(date)) return res.status(400).json({ message: "Fecha inválida." });
  const teacher = await Teacher.findOne(venueScope(req.venueContext, { userId: req.user.id, status: "activo" }));
  if (!teacher) return res.status(404).json({ message: "No tenés un perfil de profesor activo en esta sede." });
  const [bookings, blocks, courts] = await Promise.all([
    Booking.find(venueScope(req.venueContext, { date, teacherId: teacher.id,
      type: "class", status: { $ne: "cancelado" } })).sort({ time: 1 }).lean(),
    ScheduleBlock.find(venueScope(req.venueContext, { date, ownerId: req.user.id, type: "teacher" })).sort({ hour: 1 }).lean(),
    Court.find(venueScope(req.venueContext, { active: { $ne: false } })).sort({ sortOrder: 1, name: 1 }),
  ]);
  res.json({ teacher: { id: teacher.id, name: teacher.name, specialty: teacher.specialty },
    bookings: bookings.map((booking) => ({ id: String(booking._id), date: booking.date, time: booking.time,
      endTime: booking.endTime, courtName: booking.courtName, playerName: booking.playerName,
      phone: booking.phone, status: booking.status, paymentStatus: booking.paymentStatus })),
    blocks: blocks.map((block) => ({ id: String(block._id), date: block.date, courtId: block.courtId,
      hour: block.hour, durationMinutes: block.durationMinutes })),
    courts: courts.map((court) => ({ id: court.courtId, name: court.name, hours: publicCourt(court).hours })) });
}
