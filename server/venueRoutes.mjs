import express from "express";
import mongoose from "mongoose";
import { Booking, Court, Setting, Teacher, Tournament } from "./db.mjs";
import { requireAuth } from "./auth.mjs";
import { publicCourt } from "./courtView.mjs";
import { requireVenueContext, requireVenueRole, venueScope } from "./tenantAccess.mjs";
import { canonicalCourtId } from "../src/utils/bookingDomain.js";

export const venueRouter = express.Router();
venueRouter.use("/:organizationSlug/:venueSlug", requireVenueContext);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

venueRouter.get("/:organizationSlug/:venueSlug", (req, res) => {
  const { organization, venue } = req.venueContext;
  res.json({ organization: { slug: organization.slug, name: organization.name },
    venue: { slug: venue.slug, name: venue.name, address: venue.address, timeZone: venue.timeZone } });
});

venueRouter.get("/:organizationSlug/:venueSlug/courts", async (req, res) => {
  const courts = await Court.find(venueScope(req.venueContext, { active: { $ne: false } })).sort({ sortOrder: 1, name: 1 });
  res.json({ courts: courts.map(publicCourt) });
});

venueRouter.get("/:organizationSlug/:venueSlug/availability", async (req, res) => {
  const date = String(req.query.date || "");
  if (!validDate(date)) return res.status(400).json({ message: "Fecha inválida." });
  const occupied = await Booking.find(venueScope(req.venueContext, { date, status: { $ne: "cancelado" } }))
    .select("date time durationMinutes courtId status teacherId").lean();
  res.json({ occupied: occupied.map(({ date: bookingDate, time, durationMinutes, courtId, status }) => ({
    date: bookingDate, time, durationMinutes, courtId: canonicalCourtId(courtId), status,
  })), teacherBusy: occupied.filter((booking) => booking.teacherId).map(({ teacherId, time }) => ({ teacherId, time })) });
});

venueRouter.get("/:organizationSlug/:venueSlug/teachers", async (req, res) => {
  const teachers = await Teacher.find(venueScope(req.venueContext)).sort({ name: 1 });
  res.json({ teachers: teachers.map(({ id, name, nickname, specialty, status, price }) => ({ id, name, nickname, specialty, status, price })) });
});

venueRouter.get("/:organizationSlug/:venueSlug/tournaments", async (req, res) => {
  const tournaments = await Tournament.find(venueScope(req.venueContext)).sort({ date: 1 });
  res.json({ tournaments: tournaments.map((tournament) => {
    const item = tournament.toJSON();
    delete item.registrations;
    delete item.__v;
    delete item.organizationId;
    delete item.venueId;
    return item;
  }) });
});

venueRouter.get("/:organizationSlug/:venueSlug/settings", async (req, res) => {
  const settings = await Setting.findOne(venueScope(req.venueContext));
  if (!settings) return res.status(503).json({ message: "La configuración de la sede no está disponible." });
  const item = settings.toJSON();
  delete item.organizationId;
  delete item.venueId;
  res.json({ settings: item });
});

venueRouter.get("/:organizationSlug/:venueSlug/admin/courts", requireAuth, requireVenueRole("admin"), async (req, res) => {
  const courts = await Court.find(venueScope(req.venueContext)).sort({ sortOrder: 1, name: 1 });
  res.json({ courts: courts.map(publicCourt) });
});

venueRouter.get("/:organizationSlug/:venueSlug/admin/bookings", requireAuth, requireVenueRole("admin", "receptionist"), async (req, res) => {
  const bookings = await Booking.find(venueScope(req.venueContext)).sort({ date: 1, time: 1 });
  res.json({ bookings: bookings.map((booking) => booking.toJSON()) });
});

venueRouter.get("/:organizationSlug/:venueSlug/admin/bookings/:id", requireAuth, requireVenueRole("admin", "receptionist"), async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) return res.status(404).json({ message: "Reserva no encontrada." });
  const booking = await Booking.findOne(venueScope(req.venueContext, { _id: req.params.id }));
  if (!booking) return res.status(404).json({ message: "Reserva no encontrada." });
  res.json({ booking: booking.toJSON() });
});
