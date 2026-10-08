import { createHash, randomBytes } from "node:crypto";
import express from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { PUBLIC_APP_ORIGIN, PADELBOOK_OPERATING_MODE } from "./config.mjs";
import { Invitation, Membership, Organization, User, Venue, addActivity } from "./db.mjs";
import { requireAuth } from "./auth.mjs";
import { passwordEmailConfigured, sendInvitationEmail } from "./email.mjs";

export const invitationRouter = express.Router();
const tokenInput = z.object({ token: z.string().min(40).max(200) }).strict();
const inviteInput = z.object({
  email: z.email().max(254).transform((value) => value.trim().toLowerCase()),
  role: z.enum(["admin", "receptionist", "teacher"]),
  venueIds: z.array(z.string().refine((id) => mongoose.Types.ObjectId.isValid(id))).max(30)
    .refine((ids) => ids.length === new Set(ids).size),
}).strict();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: "draft-8", legacyHeaders: false,
  message: { message: "Demasiados intentos. Esperá unos minutos." } });
const hash = (token) => createHash("sha256").update(token).digest("hex");
const publicInvitation = (invitation, organization, venues) => ({
  email: invitation.email, role: invitation.role, clubName: organization.name,
  venues: venues.map((venue) => ({ id: String(venue._id), name: venue.name })),
  expiresAt: invitation.expiresAt,
});
const invalid = (res) => res.status(400).json({ message: "La invitación venció o ya fue utilizada. Pedí una nueva al club." });

invitationRouter.use((_req, res, next) => PADELBOOK_OPERATING_MODE === "multiclub" ? next() : res.status(404).json({ message: "Recurso no encontrado." }));

invitationRouter.post("/preview", limiter, async (req, res) => {
  const parsed = tokenInput.safeParse(req.body);
  if (!parsed.success) return invalid(res);
  const invitation = await Invitation.findOne({ tokenHash: hash(parsed.data.token), status: "pending", expiresAt: { $gt: new Date() } }).lean();
  if (!invitation) return invalid(res);
  const organization = await Organization.findOne({ _id: invitation.organizationId, status: "active" }).lean();
  if (!organization) return invalid(res);
  const venues = await Venue.find({ _id: { $in: invitation.venueIds }, organizationId: invitation.organizationId, active: true }).lean();
  if (venues.length !== invitation.venueIds.length) return invalid(res);
  res.json({ invitation: publicInvitation(invitation, organization, venues) });
});

invitationRouter.post("/accept", limiter, requireAuth, async (req, res) => {
  const parsed = tokenInput.safeParse(req.body);
  if (!parsed.success) return invalid(res);
  const session = await mongoose.startSession();
  let accepted;
  try {
    await session.withTransaction(async () => {
      const invitation = await Invitation.findOne({ tokenHash: hash(parsed.data.token), email: req.user.email,
        status: "pending", expiresAt: { $gt: new Date() } }).session(session);
      if (!invitation) throw Object.assign(new Error("invalid_invitation"), { status: 400 });
      const organization = await Organization.findOne({ _id: invitation.organizationId, status: "active" }).session(session);
      const venues = await Venue.find({ _id: { $in: invitation.venueIds }, organizationId: invitation.organizationId,
        active: true }).session(session);
      if (!organization || venues.length !== invitation.venueIds.length) throw Object.assign(new Error("invalid_invitation"), { status: 400 });
      const membership = await Membership.findOne({ userId: req.user.id, organizationId: invitation.organizationId }).session(session);
      if (membership?.active && membership.role !== "player") throw Object.assign(new Error("membership_exists"), { status: 409 });
      if (membership) {
        membership.role = invitation.role;
        membership.venueIds = invitation.venueIds;
        membership.active = true;
        await membership.save({ session });
      } else {
        await Membership.create([{ userId: req.user.id, organizationId: invitation.organizationId,
          role: invitation.role, venueIds: invitation.venueIds, active: true }], { session });
      }
      invitation.status = "accepted";
      invitation.acceptedAt = new Date();
      await invitation.save({ session });
      accepted = { organizationId: organization._id, organizationSlug: organization.slug, clubName: organization.name };
    });
  } catch (error) {
    if (error.status === 409) return res.status(409).json({ message: "Ya tenés un acceso de personal en este club." });
    if (error.status === 400 || error.code === 11000) return invalid(res);
    throw error;
  } finally {
    await session.endSession();
  }
  try {
    await addActivity({ organizationId: accepted.organizationId, type: "invitation_accepted",
      title: "Invitación aceptada", detail: req.user.email, actor: req.user.name });
  } catch { console.error("InvitationActivityError"); }
  res.json({ organizationSlug: accepted.organizationSlug, clubName: accepted.clubName });
});

export async function listInvitations(req, res) {
  const invitations = await Invitation.find({ organizationId: req.organization._id, status: "pending",
    expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean();
  res.json({ invitations: invitations.map((item) => ({ id: String(item._id), email: item.email,
    role: item.role, venueIds: item.venueIds.map(String), expiresAt: item.expiresAt })) });
}

export async function createInvitation(req, res) {
  const parsed = inviteInput.safeParse(req.body);
  if (!parsed.success || (parsed.data.role !== "admin" && parsed.data.venueIds.length === 0) ||
    (parsed.data.role === "admin" && parsed.data.venueIds.length !== 0)) {
    return res.status(400).json({ message: "Revisá el email, la función y las sedes." });
  }
  if (!passwordEmailConfigured()) return res.status(503).json({ message: "El envío de invitaciones no está configurado." });
  const venueIds = parsed.data.venueIds;
  const venues = await Venue.find({ _id: { $in: venueIds }, organizationId: req.organization._id, active: true }).select("_id").lean();
  if (venues.length !== venueIds.length) return res.status(400).json({ message: "Seleccioná sedes activas de este club." });
  const account = await User.findOne({ email: parsed.data.email }).select("_id").lean();
  if (account && await Membership.exists({ organizationId: req.organization._id, userId: account._id,
    active: true, role: { $ne: "player" } })) {
    return res.status(409).json({ message: "Esa persona ya tiene acceso a este club." });
  }
  await Invitation.updateMany({ organizationId: req.organization._id, email: parsed.data.email,
    status: "pending", expiresAt: { $lte: new Date() } }, { $set: { status: "revoked" } });
  const token = randomBytes(32).toString("base64url");
  let invitation;
  try {
    invitation = await Invitation.create({ organizationId: req.organization._id, email: parsed.data.email,
      role: parsed.data.role, venueIds, tokenHash: hash(token), expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      invitedBy: req.user.id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: "Ya hay una invitación pendiente para ese email." });
    throw error;
  }
  try {
    await sendInvitationEmail({ to: invitation.email, clubName: req.organization.name, role: invitation.role,
      acceptUrl: `${PUBLIC_APP_ORIGIN}/invitacion#token=${encodeURIComponent(token)}` });
  } catch {
    await Invitation.deleteOne({ _id: invitation._id, status: "pending" });
    return res.status(503).json({ message: "No pudimos enviar la invitación. Intentá de nuevo." });
  }
  res.status(201).json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role,
    venueIds: invitation.venueIds.map(String), expiresAt: invitation.expiresAt } });
}

export async function revokeInvitation(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Invitación no encontrada." });
  const result = await Invitation.findOneAndUpdate({ _id: req.params.id, organizationId: req.organization._id, status: "pending" },
    { $set: { status: "revoked" } });
  if (!result) return res.status(404).json({ message: "Invitación no encontrada." });
  res.status(204).end();
}
