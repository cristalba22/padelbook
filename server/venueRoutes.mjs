import express from "express";
import mongoose from "mongoose";
import { Booking, Court, Setting, Teacher, Tournament } from "./db.mjs";
import { requireAuth } from "./auth.mjs";
import { publicCourt } from "./courtView.mjs";
import { requireVenueContext, requireVenueRole, venueScope } from "./tenantAccess.mjs";
import { canonicalCourtId } from "../src/utils/bookingDomain.js";
import { cancelVenueBooking, createVenueBooking, updateVenueBookingStatus } from "./venueBookings.mjs";
import { recordVenuePayment, reverseVenuePayment } from "./venuePayments.mjs";
import { isValidDateISO } from "./dateValidation.mjs";
import { createVenueCourt, updateVenueCourt } from "./venueCourts.mjs";
import { createVenueBlocks, deleteVenueBlocks, listAdminVenueBlocks, listVenueBlocks } from "./venueBlocks.mjs";
import { updateVenueSettings } from "./venueSettings.mjs";
import { createVenueTeacher, listAdminVenueTeachers, updateVenueTeacher } from "./venueTeachers.mjs";
import { createVenueTournament, deleteVenueTournament, listAdminVenueTournaments, listMyVenueTournaments,
  registerVenueTournament, updateVenueRegistration, updateVenueTournament } from "./venueTournaments.mjs";
import { createVenueExpense, venueActivity, venueFinanceSummary } from "./venueFinance.mjs";

export const venueRouter = express.Router();
venueRouter.use("/:organizationSlug/:venueSlug", requireVenueContext);

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
  if (!isValidDateISO(date)) return res.status(400).json({ message: "Fecha inválida." });
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
venueRouter.get("/:organizationSlug/:venueSlug/admin/teachers", requireAuth, requireVenueRole("admin"), listAdminVenueTeachers);
venueRouter.post("/:organizationSlug/:venueSlug/admin/teachers", requireAuth, requireVenueRole("admin"), createVenueTeacher);
venueRouter.patch("/:organizationSlug/:venueSlug/admin/teachers/:id", requireAuth, requireVenueRole("admin"), updateVenueTeacher);

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
venueRouter.get("/:organizationSlug/:venueSlug/tournaments/mine", requireAuth, listMyVenueTournaments);
venueRouter.post("/:organizationSlug/:venueSlug/tournaments/:id/register", requireAuth, registerVenueTournament);
venueRouter.get("/:organizationSlug/:venueSlug/admin/tournaments", requireAuth, requireVenueRole("admin"), listAdminVenueTournaments);
venueRouter.post("/:organizationSlug/:venueSlug/admin/tournaments", requireAuth, requireVenueRole("admin"), createVenueTournament);
venueRouter.patch("/:organizationSlug/:venueSlug/admin/tournaments/:id", requireAuth, requireVenueRole("admin"), updateVenueTournament);
venueRouter.delete("/:organizationSlug/:venueSlug/admin/tournaments/:id", requireAuth, requireVenueRole("admin"), deleteVenueTournament);
venueRouter.patch("/:organizationSlug/:venueSlug/admin/tournaments/:id/registrations/:registrationId",
  requireAuth, requireVenueRole("admin"), updateVenueRegistration);

venueRouter.get("/:organizationSlug/:venueSlug/settings", async (req, res) => {
  const settings = await Setting.findOne(venueScope(req.venueContext));
  if (!settings) return res.status(503).json({ message: "La configuración de la sede no está disponible." });
  const item = settings.toJSON();
  delete item.organizationId;
  delete item.venueId;
  res.json({ settings: item });
});
venueRouter.put("/:organizationSlug/:venueSlug/admin/settings", requireAuth, requireVenueRole("admin"), updateVenueSettings);
venueRouter.get("/:organizationSlug/:venueSlug/blocks", listVenueBlocks);
venueRouter.get("/:organizationSlug/:venueSlug/admin/blocks", requireAuth, requireVenueRole("admin", "receptionist", "teacher"), listAdminVenueBlocks);
venueRouter.post("/:organizationSlug/:venueSlug/admin/blocks/batch", requireAuth, requireVenueRole("admin", "receptionist", "teacher"), createVenueBlocks);
venueRouter.delete("/:organizationSlug/:venueSlug/admin/blocks/batch", requireAuth, requireVenueRole("admin", "receptionist", "teacher"), deleteVenueBlocks);

venueRouter.post("/:organizationSlug/:venueSlug/bookings", requireAuth, createVenueBooking);
venueRouter.post("/:organizationSlug/:venueSlug/bookings/:id/cancel", requireAuth, cancelVenueBooking);
venueRouter.post("/:organizationSlug/:venueSlug/admin/bookings/:id/payments", requireAuth, requireVenueRole("admin", "receptionist"), recordVenuePayment);
venueRouter.post("/:organizationSlug/:venueSlug/admin/bookings/:id/payments/reverse", requireAuth, requireVenueRole("admin", "receptionist"), reverseVenuePayment);
venueRouter.patch("/:organizationSlug/:venueSlug/admin/bookings/:id/status", requireAuth, requireVenueRole("admin", "receptionist"), updateVenueBookingStatus);
venueRouter.get("/:organizationSlug/:venueSlug/admin/finance/summary", requireAuth, requireVenueRole("admin"), venueFinanceSummary);
venueRouter.post("/:organizationSlug/:venueSlug/admin/expenses", requireAuth, requireVenueRole("admin"), createVenueExpense);
venueRouter.get("/:organizationSlug/:venueSlug/admin/activity", requireAuth, requireVenueRole("admin"), venueActivity);

venueRouter.get("/:organizationSlug/:venueSlug/admin/courts", requireAuth, requireVenueRole("admin"), async (req, res) => {
  const courts = await Court.find(venueScope(req.venueContext)).sort({ sortOrder: 1, name: 1 });
  res.json({ courts: courts.map(publicCourt) });
});
venueRouter.post("/:organizationSlug/:venueSlug/admin/courts", requireAuth, requireVenueRole("admin"), createVenueCourt);
venueRouter.patch("/:organizationSlug/:venueSlug/admin/courts/:courtId", requireAuth, requireVenueRole("admin"), updateVenueCourt);

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
