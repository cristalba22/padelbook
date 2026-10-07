import express from "express";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { z } from "zod";
import { Membership, Organization, User, Venue, addActivity } from "./db.mjs";
import { requireAuth } from "./auth.mjs";
import { organizationActivity, organizationFinanceSummary } from "./venueFinance.mjs";

export const organizationStaffRouter = express.Router();
const objectId = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value));
const staffRole = z.enum(["receptionist", "teacher"]);
const venueIdsField = z.array(objectId).min(1).max(30).refine((ids) => new Set(ids).size === ids.length);
const createStaffInput = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(254),
  password: z.string().min(12).max(72),
  phone: z.string().trim().max(40).optional().default(""),
  role: staffRole,
  venueIds: venueIdsField,
}).strict();
const updateStaffInput = z.object({
  role: staffRole.optional(),
  venueIds: venueIdsField.optional(),
  active: z.boolean().optional(),
}).strict();

function staffView(user, membership) {
  return { id: String(user._id), name: user.name, email: user.email, phone: user.phone,
    role: membership.role, venueIds: membership.venueIds.map(String), active: membership.active && user.active !== false };
}

async function audit(req, type, name) {
  try {
    await addActivity({ organizationId: req.organization._id, type,
      title: type === "staff_created" ? "Personal creado" : "Acceso de personal actualizado",
      detail: name, actor: req.user.name });
  } catch {
    console.error("OrganizationStaffActivityError");
  }
}

async function validVenues(organizationId, ids) {
  const venues = await Venue.find({ _id: { $in: ids }, organizationId, active: true }).select("_id").lean();
  return venues.length === ids.length;
}

organizationStaffRouter.use("/:organizationSlug", requireAuth, async (req, res, next) => {
  const slug = req.params.organizationSlug;
  if (typeof slug !== "string" || slug.length > 63 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return res.status(404).json({ message: "Organización no encontrada." });
  }
  const organization = await Organization.findOne({ slug, status: "active" }).lean();
  if (!organization) return res.status(404).json({ message: "Organización no encontrada." });
  const membership = await Membership.findOne({ userId: req.user.id, organizationId: organization._id,
    active: true, role: "admin" }).lean();
  if (!membership) return res.status(404).json({ message: "Organización no encontrada." });
  req.organization = organization;
  next();
});

organizationStaffRouter.get("/:organizationSlug/venues", async (req, res) => {
  const venues = await Venue.find({ organizationId: req.organization._id, active: true })
    .select("slug name address timeZone").sort({ name: 1 }).lean();
  res.json({ venues: venues.map((venue) => ({ id: String(venue._id), slug: venue.slug,
    name: venue.name, address: venue.address, timeZone: venue.timeZone })) });
});
organizationStaffRouter.get("/:organizationSlug/admin/finance/summary", organizationFinanceSummary);
organizationStaffRouter.get("/:organizationSlug/admin/activity", organizationActivity);

organizationStaffRouter.get("/:organizationSlug/admin/staff", async (req, res) => {
  const memberships = await Membership.find({ organizationId: req.organization._id,
    role: { $in: ["receptionist", "teacher"] } }).lean();
  const users = await User.find({ _id: { $in: memberships.map((membership) => membership.userId) } }).lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const staff = memberships.filter((membership) => byId.has(String(membership.userId)))
    .map((membership) => staffView(byId.get(String(membership.userId)), membership))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
  res.json({ staff });
});

organizationStaffRouter.post("/:organizationSlug/admin/staff", async (req, res) => {
  const parsed = createStaffInput.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de personal inválidos." });
  if (!await validVenues(req.organization._id, parsed.data.venueIds)) {
    return res.status(400).json({ message: "Seleccioná sedes activas de esta organización." });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const session = await mongoose.startSession();
  let created;
  try {
    created = await session.withTransaction(async () => {
      const [user] = await User.create([{ name: parsed.data.name, email, passwordHash,
        phone: parsed.data.phone, role: "player", active: true }], { session });
      const [membership] = await Membership.create([{ userId: user._id, organizationId: req.organization._id,
        role: parsed.data.role, venueIds: parsed.data.venueIds, active: true }], { session });
      return { user, membership };
    });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Ya existe una cuenta con ese email." });
    throw error;
  } finally {
    await session.endSession();
  }
  await audit(req, "staff_created", created.user.name);
  res.status(201).json({ employee: staffView(created.user, created.membership) });
});

organizationStaffRouter.patch("/:organizationSlug/admin/staff/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Personal no encontrado." });
  const parsed = updateStaffInput.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Cambio de personal inválido." });
  if (parsed.data.venueIds && !await validVenues(req.organization._id, parsed.data.venueIds)) {
    return res.status(400).json({ message: "Seleccioná sedes activas de esta organización." });
  }
  const membership = await Membership.findOneAndUpdate({ userId: req.params.id,
    organizationId: req.organization._id, role: { $in: ["receptionist", "teacher"] } },
  { $set: parsed.data }, { returnDocument: "after", runValidators: true });
  if (!membership) return res.status(404).json({ message: "Personal no encontrado." });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Personal no encontrado." });
  await audit(req, "staff_updated", user.name);
  res.json({ employee: staffView(user, membership) });
});
