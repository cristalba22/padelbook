import mongoose from "mongoose";
import { z } from "zod";
import { Teacher, addActivity } from "./db.mjs";
import { venueScope } from "./tenantAccess.mjs";

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
