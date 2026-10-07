import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { Tournament, addActivity } from "./db.mjs";
import { argentinaDateISO } from "../src/utils/bookingDomain.js";
import { membershipForVenue, venueScope } from "./tenantAccess.mjs";
import { registrationStatusFields, tournamentFields, tournamentSignupFields } from "./tournamentInput.mjs";

function publicTournament(tournament) {
  const item = tournament.toJSON();
  delete item.registrations;
  delete item.organizationId;
  delete item.venueId;
  delete item.__v;
  return item;
}

async function audit(req, type, title, detail) {
  try {
    await addActivity({ organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId,
      type, title, detail, actor: req.user.name });
  } catch {
    console.error("VenueTournamentActivityError");
  }
}

function validId(id) { return mongoose.Types.ObjectId.isValid(id); }

export async function listAdminVenueTournaments(req, res) {
  const tournaments = await Tournament.find(venueScope(req.venueContext)).sort({ date: 1 });
  res.json({ tournaments: tournaments.map((tournament) => tournament.toJSON()) });
}

export async function createVenueTournament(req, res) {
  const parsed = tournamentFields.safeParse(req.body);
  if (!parsed.success || parsed.data.seededPlayers > parsed.data.maxPlayers) {
    return res.status(400).json({ message: "Datos de torneo inválidos." });
  }
  const tournament = await Tournament.create({ ...parsed.data, organizationId: req.venueContext.organizationId,
    venueId: req.venueContext.venueId, currentPlayers: parsed.data.seededPlayers, registrations: [] });
  await audit(req, "tournament_created", "Torneo creado", tournament.name);
  res.status(201).json({ tournament: tournament.toJSON() });
}

export async function updateVenueTournament(req, res) {
  if (!validId(req.params.id)) return res.status(404).json({ message: "Torneo no encontrado." });
  const parsed = tournamentFields.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Datos de torneo inválidos." });
  const tournament = await Tournament.findOne(venueScope(req.venueContext, { _id: req.params.id }));
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  Object.assign(tournament, parsed.data);
  const active = tournament.registrations.filter((registration) => registration.status !== "cancelado").length;
  if (tournament.seededPlayers + active > tournament.maxPlayers) return res.status(409).json({ message: "El cupo no puede ser menor a las inscripciones activas." });
  tournament.currentPlayers = tournament.seededPlayers + active;
  await tournament.save();
  await audit(req, "tournament_updated", "Torneo actualizado", tournament.name);
  res.json({ tournament: tournament.toJSON() });
}

export async function deleteVenueTournament(req, res) {
  if (!validId(req.params.id)) return res.status(404).json({ message: "Torneo no encontrado." });
  const tournament = await Tournament.findOne(venueScope(req.venueContext, { _id: req.params.id }));
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  if (tournament.registrations.length) return res.status(409).json({ message: "El torneo tiene inscripciones. Cancelalo en lugar de eliminarlo." });
  const removed = await Tournament.deleteOne(venueScope(req.venueContext, { _id: tournament.id, __v: tournament.__v,
    "registrations.0": { $exists: false } }));
  if (!removed.deletedCount) return res.status(409).json({ message: "El torneo cambió. Volvé a intentar." });
  await audit(req, "tournament_deleted", "Torneo eliminado", tournament.name);
  res.json({ deleted: true });
}

export async function listMyVenueTournaments(req, res) {
  const membership = await membershipForVenue(req.user.id, req.venueContext);
  if (!membership) return res.status(403).json({ message: "No tenés acceso a esta sede." });
  const tournaments = await Tournament.find(venueScope(req.venueContext, { "registrations.userId": req.user.id })).sort({ date: 1 });
  const registrations = tournaments.flatMap((tournament) => tournament.registrations
    .filter((registration) => registration.userId === req.user.id)
    .map((registration) => ({ ...registration.toJSON(), tournamentId: tournament.id, tournamentName: tournament.name,
      tournamentDate: tournament.date, tournamentHour: tournament.hour, pricePerPlayer: tournament.pricePerPlayer,
      statusTournament: tournament.status })));
  res.json({ registrations });
}

export async function registerVenueTournament(req, res) {
  if (!validId(req.params.id)) return res.status(404).json({ message: "Torneo no encontrado." });
  const membership = await membershipForVenue(req.user.id, req.venueContext);
  if (!membership) return res.status(403).json({ message: "No tenés acceso a esta sede." });
  const parsed = tournamentSignupFields.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Datos de inscripción inválidos." });
  const tournament = await Tournament.findOne(venueScope(req.venueContext, { _id: req.params.id }));
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  if (tournament.status !== "abierto" || tournament.date < argentinaDateISO()) return res.status(409).json({ message: "La inscripción no está abierta." });
  if (tournament.currentPlayers >= tournament.maxPlayers) return res.status(409).json({ message: "No quedan cupos disponibles." });
  if (tournament.registrations.some((registration) => registration.userId === req.user.id && registration.status !== "cancelado")) {
    return res.status(409).json({ message: "Ya estás inscripto en este torneo." });
  }
  tournament.registrations.push({ userId: req.user.id, name: req.user.name, email: req.user.email,
    phone: req.user.phone || "", category: req.user.category || tournament.category, ...parsed.data,
    status: "pendiente", paymentStatus: tournament.pricePerPlayer > 0 ? "pendiente" : "sin_cargo" });
  tournament.currentPlayers += 1;
  await tournament.save();
  await audit(req, "tournament_signup", "Inscripción a torneo", `${req.user.name} - ${tournament.name}`);
  res.status(201).json({ tournament: publicTournament(tournament), registration: tournament.registrations.at(-1).toJSON() });
}

export async function updateVenueRegistration(req, res) {
  if (!validId(req.params.id) || !validId(req.params.registrationId)) return res.status(404).json({ message: "Inscripción no encontrada." });
  const parsed = registrationStatusFields.safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Estado inválido." });
  const tournament = await Tournament.findOne(venueScope(req.venueContext, { _id: req.params.id }));
  if (!tournament) return res.status(404).json({ message: "Torneo no encontrado." });
  const registration = tournament.registrations.id(req.params.registrationId);
  if (!registration) return res.status(404).json({ message: "Inscripción no encontrada." });
  if (parsed.data.paymentStatus && parsed.data.paymentStatus !== registration.paymentStatus) {
    const wasPaid = registration.paymentStatus === "pagado";
    const isPaid = parsed.data.paymentStatus === "pagado";
    const collected = registration.paymentEntries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    if (wasPaid !== isPaid) registration.paymentEntries.push({ id: randomUUID(),
      amount: isPaid ? tournament.pricePerPlayer : -collected, method: "registro manual", actor: req.user.name, at: new Date() });
  }
  Object.assign(registration, parsed.data, { updatedAt: new Date() });
  const active = tournament.registrations.filter((item) => item.status !== "cancelado").length;
  if (tournament.seededPlayers + active > tournament.maxPlayers) return res.status(409).json({ message: "No quedan cupos disponibles." });
  tournament.currentPlayers = tournament.seededPlayers + active;
  await tournament.save();
  await audit(req, "tournament_registration_updated", "Inscripción actualizada", `${registration.name} - ${tournament.name}`);
  res.json({ tournament: tournament.toJSON() });
}
