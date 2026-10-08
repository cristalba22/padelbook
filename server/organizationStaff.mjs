import express from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Membership, Organization, User, Venue, addActivity } from "./db.mjs";
import { requireAuth } from "./auth.mjs";
import { organizationActivity, organizationFinanceSummary } from "./venueFinance.mjs";
import { createInvitation, listInvitations, revokeInvitation } from "./invitations.mjs";

export const organizationStaffRouter = express.Router();
const objectId = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value));
const staffRole = z.enum(["receptionist", "teacher"]);
const venueIdsField = z.array(objectId).min(1).max(30).refine((ids) => new Set(ids).size === ids.length);
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
organizationStaffRouter.get("/:organizationSlug/admin/invitations", listInvitations);
organizationStaffRouter.post("/:organizationSlug/admin/invitations", createInvitation);
organizationStaffRouter.delete("/:organizationSlug/admin/invitations/:id", revokeInvitation);

organizationStaffRouter.get("/:organizationSlug/admin/staff", async (req, res) => {
  const memberships = await Membership.find({ organizationId: req.organization._id,
    role: { $in: ["admin", "receptionist", "teacher"] }, userId: { $ne: req.user.id } }).lean();
  const users = await User.find({ _id: { $in: memberships.map((membership) => membership.userId) } }).lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  const staff = memberships.filter((membership) => byId.has(String(membership.userId)))
    .map((membership) => staffView(byId.get(String(membership.userId)), membership))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
  res.json({ staff });
});

organizationStaffRouter.post("/:organizationSlug/admin/staff", (_req, res) => {
  res.status(410).json({ message: "El alta directa fue reemplazada por invitaciones por correo." });
});

organizationStaffRouter.patch("/:organizationSlug/admin/staff/:id", async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Personal no encontrado." });
  const parsed = updateStaffInput.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Cambio de personal inválido." });
  if (parsed.data.venueIds && !await validVenues(req.organization._id, parsed.data.venueIds)) {
    return res.status(400).json({ message: "Seleccioná sedes activas de esta organización." });
  }
  const current = await Membership.findOne({ userId: req.params.id, organizationId: req.organization._id,
    role: { $in: ["admin", "receptionist", "teacher"] } });
  if (String(req.params.id) === String(req.user.id) || !current) return res.status(404).json({ message: "Personal no encontrado." });
  if (current.role === "admin" && (parsed.data.role !== undefined || parsed.data.venueIds !== undefined)) {
    return res.status(400).json({ message: "El acceso de administración solo puede activarse o desactivarse." });
  }
  const membership = await Membership.findOneAndUpdate({ _id: current._id },
    { $set: parsed.data }, { returnDocument: "after", runValidators: true });
  if (!membership) return res.status(404).json({ message: "Personal no encontrado." });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Personal no encontrado." });
  await audit(req, "staff_updated", user.name);
  res.json({ employee: staffView(user, membership) });
});
