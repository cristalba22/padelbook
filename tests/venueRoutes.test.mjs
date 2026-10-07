import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("las rutas de sede aíslan agenda y reservas de dos clubes y usan la membresía, no el rol global", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "padelbook_venue_routes_qa";
  process.env.JWT_SECRET = "venue-routes-test-secret-long-enough-to-be-private";
  const [{ app }, { Organization, Venue, Membership, User, Court, Booking, Setting, Teacher, Tournament, SlotClaim }, { createSession }] = await Promise.all([
    import("../server/index.mjs"), import("../server/db.mjs"), import("../server/auth.mjs"),
  ]);
  let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: process.env.MONGODB_DB_NAME });
    await Promise.all([Booking.init(), SlotClaim.init(), Setting.init(), User.init(), Membership.init()]);
    const [orgA, orgB] = await Organization.create([{ slug: "club-a", name: "Club A" }, { slug: "club-b", name: "Club B" }]);
    const [venueA, venueA2, venueB] = await Venue.create([
      { organizationId: orgA.id, slug: "centro", name: "Centro A" },
      { organizationId: orgA.id, slug: "norte", name: "Norte A" },
      { organizationId: orgB.id, slug: "centro", name: "Centro B" },
    ]);
    await Court.create([
      { organizationId: orgA.id, venueId: venueA.id, courtId: "court-a", name: "Cancha A" },
      { organizationId: orgA.id, venueId: venueA2.id, courtId: "court-a2", name: "Cancha Norte" },
      { organizationId: orgB.id, venueId: venueB.id, courtId: "court-b", name: "Cancha B" },
    ]);
    await Setting.create([
      { organizationId: orgA.id, venueId: venueA.id, clubName: "Club A Centro" },
      { organizationId: orgA.id, venueId: venueA2.id, clubName: "Club A Norte" },
      { organizationId: orgB.id, venueId: venueB.id, clubName: "Club B Centro" },
    ]);
    const [teacherA, teacherB] = await Teacher.create([
      { organizationId: orgA.id, venueId: venueA.id, name: "Profe A" },
      { organizationId: orgB.id, venueId: venueB.id, name: "Profe B" },
    ]);
    const [tournamentA, tournamentB] = await Tournament.create([
      { organizationId: orgA.id, venueId: venueA.id, name: "Torneo A", date: "2026-11-01", registrations: [{ name: "Privado A", email: "a@test.local" }] },
      { organizationId: orgB.id, venueId: venueB.id, name: "Torneo B", date: "2026-11-02", registrations: [{ name: "Privado B", email: "b@test.local" }] },
    ]);
    const [bookingA, bookingB] = await Booking.create([
      { organizationId: orgA.id, venueId: venueA.id, date: "2026-10-20", time: "19:00", courtId: "court-a", courtName: "Cancha A", playerName: "Jugadora A",
        price: 24000, amountPaid: 10000, paymentEntries: [{ id: "seed-a", amount: 10000, method: "efectivo", actor: "QA", at: new Date() }] },
      { organizationId: orgB.id, venueId: venueB.id, date: "2026-10-20", time: "20:00", courtId: "court-b", courtName: "Cancha B", playerName: "Jugador B",
        price: 30000, amountPaid: 20000, paymentEntries: [{ id: "seed-b", amount: 20000, method: "efectivo", actor: "QA", at: new Date() }] },
    ]);
    const [adminA, adminB, receptionistA, playerA, playerA2, playerB, teacherUserA] = await User.create([
      { name: "Admin A", email: "admin-a@test.local", passwordHash: "test-hash", role: "player" },
      { name: "Admin B", email: "admin-b@test.local", passwordHash: "test-hash", role: "admin" },
      { name: "Recepción A", email: "recepcion-a@test.local", passwordHash: "test-hash", role: "player" },
      { name: "Jugador A", email: "jugador-a@test.local", passwordHash: "test-hash", role: "player" },
      { name: "Jugador A2", email: "jugador-a2@test.local", passwordHash: "test-hash", role: "player" },
      { name: "Jugador B", email: "jugador-b@test.local", passwordHash: "test-hash", role: "player" },
      { name: "Profesor A", email: "profe-a@test.local", passwordHash: "test-hash", role: "player" },
    ]);
    await Membership.create([
      { userId: adminA.id, organizationId: orgA.id, role: "admin", venueIds: [venueA.id] },
      { userId: adminB.id, organizationId: orgB.id, role: "admin", venueIds: [venueB.id] },
      { userId: receptionistA.id, organizationId: orgA.id, role: "receptionist", venueIds: [venueA.id] },
      { userId: playerA.id, organizationId: orgA.id, role: "player", venueIds: [] },
      { userId: playerA2.id, organizationId: orgA.id, role: "player", venueIds: [] },
      { userId: playerB.id, organizationId: orgB.id, role: "player", venueIds: [] },
      { userId: teacherUserA.id, organizationId: orgA.id, role: "teacher", venueIds: [venueA.id] },
    ]);

    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/venues`;
    const request = async (path, user, { method = "GET", body } = {}) => {
      const token = user ? createSession(user).token : "";
      const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json() };
    };
    const organizationRequest = async (path, user, { method = "GET", body } = {}) => {
      const token = user ? createSession(user).token : "";
      const response = await fetch(`${base.replace(/\/venues$/, "/organizations")}${path}`, {
        method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      return { status: response.status, data: await response.json() };
    };

    assert.equal((await organizationRequest("/club-a/admin/staff", receptionistA)).status, 404);
    assert.equal((await organizationRequest("/club-b/admin/staff", adminA)).status, 404);
    assert.deepEqual((await organizationRequest("/club-a/venues", adminA)).data.venues.map((venue) => venue.slug), ["centro", "norte"]);
    assert.equal((await organizationRequest("/club-a/venues", adminB)).status, 404);
    assert.equal((await organizationRequest("/club-a/admin/staff", adminA)).data.staff.length, 2);
    assert.equal((await organizationRequest("/club-a/admin/staff", adminA, { method: "POST", body: {
      name: "Recepción ajena", email: "ajena@test.local", password: "clave-muy-larga-123",
      role: "receptionist", venueIds: [venueB.id],
    } })).status, 400);
    const createdStaff = await organizationRequest("/club-a/admin/staff", adminA, { method: "POST", body: {
      name: "Recepción Norte", email: "norte@test.local", password: "clave-muy-larga-123",
      role: "receptionist", venueIds: [venueA.id],
    } });
    assert.equal(createdStaff.status, 201);
    assert.equal((await organizationRequest("/club-a/admin/staff", adminA, { method: "POST", body: {
      name: "Cuenta existente", email: "jugador-b@test.local", password: "clave-muy-larga-123",
      role: "teacher", venueIds: [venueA.id],
    } })).status, 409);
    const staffUser = await User.findById(createdStaff.data.employee.id);
    assert.equal(staffUser.role, "player");
    assert.equal((await organizationRequest("/club-a/admin/staff", adminA)).data.staff.length, 3);
    assert.equal((await organizationRequest("/club-b/admin/staff", adminB)).data.staff.length, 0);
    assert.equal((await request("/club-a/centro/admin/bookings", staffUser)).status, 200);
    assert.equal((await request("/club-a/norte/admin/bookings", staffUser)).status, 403);
    assert.equal((await organizationRequest(`/club-a/admin/staff/${createdStaff.data.employee.id}`, adminB,
      { method: "PATCH", body: { active: false } })).status, 404);
    assert.equal((await organizationRequest(`/club-a/admin/staff/${createdStaff.data.employee.id}`, adminA,
      { method: "PATCH", body: { venueIds: [venueA2.id] } })).status, 200);
    assert.equal((await request("/club-a/centro/admin/bookings", staffUser)).status, 403);
    assert.equal((await request("/club-a/norte/admin/bookings", staffUser)).status, 200);
    assert.equal((await organizationRequest(`/club-a/admin/staff/${createdStaff.data.employee.id}`, adminA,
      { method: "PATCH", body: { active: false } })).status, 200);
    assert.equal((await request("/club-a/norte/admin/bookings", staffUser)).status, 403);
    assert.equal((await request("/club-a/centro/admin/finance/summary", receptionistA)).status, 403);
    assert.equal((await request("/club-b/centro/admin/finance/summary", adminA)).status, 403);
    assert.equal((await request("/club-a/centro/admin/expenses", adminA, { method: "POST", body: {
      date: "2026-10-07", concept: "Pelotas", amount: 1000, venueId: venueB.id,
    } })).status, 400);
    assert.equal((await request("/club-a/centro/admin/expenses", adminA, { method: "POST", body: {
      date: "2026-10-07", concept: "Pelotas Centro", amount: 1000,
    } })).status, 201);
    assert.equal((await request("/club-a/norte/admin/expenses", adminA, { method: "POST", body: {
      date: "2026-10-07", concept: "Pelotas Norte", amount: 2000,
    } })).status, 201);
    assert.equal((await request("/club-b/centro/admin/expenses", adminB, { method: "POST", body: {
      date: "2026-10-07", concept: "Pelotas B", amount: 3000,
    } })).status, 201);
    const financeA = (await request("/club-a/centro/admin/finance/summary", adminA)).data.summary;
    const financeA2 = (await request("/club-a/norte/admin/finance/summary", adminA)).data.summary;
    const financeB = (await request("/club-b/centro/admin/finance/summary", adminB)).data.summary;
    const consolidatedA = (await organizationRequest("/club-a/admin/finance/summary", adminA)).data;
    assert.equal(financeA.totals.collected, 10000);
    assert.equal(financeA.totals.expenses, 1000);
    assert.equal(financeA2.totals.collected, 0);
    assert.equal(financeA2.totals.expenses, 2000);
    assert.equal(financeB.totals.collected, 20000);
    assert.equal(consolidatedA.summary.totals.collected, financeA.totals.collected + financeA2.totals.collected);
    assert.equal(consolidatedA.summary.totals.expenses, financeA.totals.expenses + financeA2.totals.expenses);
    assert.equal(consolidatedA.venues.length, 2);
    assert.equal((await organizationRequest("/club-b/admin/finance/summary", adminA)).status, 404);
    assert.deepEqual((await request("/club-a/centro/admin/activity", adminA)).data.activity
      .filter((item) => item.type === "expense_created").map((item) => item.detail), ["Pelotas Centro - $1000"]);
    assert.equal((await organizationRequest("/club-a/admin/activity", adminA)).data.activity
      .filter((item) => item.type === "expense_created").length, 2);

    const courtsA = await request("/club-a/centro/courts");
    assert.equal(courtsA.status, 200);
    assert.deepEqual(courtsA.data.courts.map((court) => court.id), ["court-a"]);
    assert.deepEqual((await request("/club-a/norte/courts")).data.courts.map((court) => court.id), ["court-a2"]);
    assert.deepEqual((await request("/club-b/centro/courts")).data.courts.map((court) => court.id), ["court-b"]);
    assert.deepEqual((await request("/club-a/centro/availability?date=2026-10-20")).data.occupied.map((booking) => booking.courtId), ["court-a"]);
    assert.deepEqual((await request("/club-a/norte/availability?date=2026-10-20")).data.occupied, []);
    assert.deepEqual((await request("/club-a/centro/teachers")).data.teachers.map((teacher) => teacher.name), ["Profe A"]);
    const createdTeacher = await request("/club-a/norte/admin/teachers", adminA, { method: "POST",
      body: { name: "Profe Norte", specialty: "Clases individuales", price: 33000 } });
    assert.equal(createdTeacher.status, 201);
    assert.equal((await request("/club-a/norte/admin/teachers", receptionistA)).status, 403);
    assert.equal((await request("/club-a/norte/admin/teachers", receptionistA,
      { method: "POST", body: { name: "Otro", price: 1 } })).status, 403);
    assert.equal((await request(`/club-a/norte/admin/teachers/${teacherB.id}`, adminA,
      { method: "PATCH", body: { price: 1000 } })).status, 404);
    assert.equal((await request(`/club-a/norte/admin/teachers/${createdTeacher.data.teacher.id}`, adminA,
      { method: "PATCH", body: { price: 35000 } })).data.teacher.price, 35000);
    assert.deepEqual((await request("/club-a/norte/teachers")).data.teachers.map((teacher) => teacher.name), ["Profe Norte"]);
    assert.deepEqual((await request("/club-b/centro/teachers")).data.teachers.map((teacher) => teacher.name), ["Profe B"]);
    assert.equal((await request("/club-a/centro/settings")).data.settings.clubName, "Club A Centro");
    assert.equal((await request("/club-a/norte/admin/settings", receptionistA,
      { method: "PUT", body: { clubName: "Otra marca" } })).status, 403);
    assert.equal((await request("/club-a/norte/admin/settings", adminA,
      { method: "PUT", body: { organizationId: orgB.id } })).status, 400);
    assert.equal((await request("/club-a/norte/admin/settings", adminA,
      { method: "PUT", body: { teacherCommissionPercent: 101 } })).status, 400);
    const updatedSettings = await request("/club-a/norte/admin/settings", adminA,
      { method: "PUT", body: { clubName: "Club A Norte Renovado", address: "Av. Norte 123", courtPrice: 22000 } });
    assert.equal(updatedSettings.status, 200);
    assert.equal(updatedSettings.data.settings.clubName, "Club A Norte Renovado");
    assert.equal((await request("/club-a/norte")).data.venue.address, "Av. Norte 123");
    assert.equal((await request("/club-a/centro/settings")).data.settings.clubName, "Club A Centro");
    assert.equal((await request("/club-b/centro/settings")).data.settings.clubName, "Club B Centro");
    const publicTournaments = (await request("/club-a/centro/tournaments")).data.tournaments;
    assert.deepEqual(publicTournaments.map((tournament) => tournament.name), ["Torneo A"]);
    assert.equal("registrations" in publicTournaments[0], false);
    assert.equal((await request("/club-a/centro/admin/tournaments", receptionistA)).status, 403);
    assert.equal((await request(`/club-a/centro/admin/tournaments/${tournamentB.id}`, adminA,
      { method: "PATCH", body: { name: "Robado" } })).status, 404);
    assert.equal((await request(`/club-a/centro/tournaments/${tournamentB.id}/register`, playerA,
      { method: "POST", body: {} })).status, 404);
    const createdTournament = await request("/club-a/norte/admin/tournaments", adminA, { method: "POST", body: {
      name: "Copa Norte", date: "2099-11-01", hour: "19:00", status: "abierto", category: "Mixto",
      surface: "Césped", pricePerPlayer: 12000, seededPlayers: 0, maxPlayers: 1, prize: "Premio", description: "QA",
    } });
    assert.equal(createdTournament.status, 201);
    const newTournamentId = createdTournament.data.tournament.id;
    assert.deepEqual((await request("/club-a/norte/tournaments")).data.tournaments.map((item) => item.name), ["Copa Norte"]);
    assert.deepEqual((await request("/club-b/centro/tournaments")).data.tournaments.map((item) => item.name), ["Torneo B"]);
    assert.equal((await request(`/club-a/norte/admin/tournaments/${newTournamentId}`, receptionistA,
      { method: "DELETE" })).status, 403);
    const [signupOne, signupTwo] = await Promise.all([
      request(`/club-a/norte/tournaments/${newTournamentId}/register`, playerA, { method: "POST", body: {} }),
      request(`/club-a/norte/tournaments/${newTournamentId}/register`, playerA2, { method: "POST", body: {} }),
    ]);
    assert.deepEqual([signupOne.status, signupTwo.status].sort(), [201, 409]);
    const signedUpPlayer = signupOne.status === 201 ? playerA : playerA2;
    const registrationId = (signupOne.status === 201 ? signupOne : signupTwo).data.registration.id;
    assert.equal((await request(`/club-a/norte/tournaments/${newTournamentId}/register`, signedUpPlayer,
      { method: "POST", body: {} })).status, 409);
    assert.equal((await request("/club-a/norte/tournaments/mine", signedUpPlayer)).data.registrations.length, 1);
    assert.equal((await request("/club-b/centro/tournaments/mine", signedUpPlayer)).status, 403);
    assert.equal((await request(`/club-a/norte/admin/tournaments/${newTournamentId}`, adminA,
      { method: "DELETE" })).status, 409);
    const paidRegistration = await request(`/club-a/norte/admin/tournaments/${newTournamentId}/registrations/${registrationId}`, adminA,
      { method: "PATCH", body: { status: "confirmado", paymentStatus: "pagado" } });
    assert.equal(paidRegistration.status, 200);
    assert.equal(paidRegistration.data.tournament.registrations[0].paymentEntries[0].amount, 12000);
    assert.equal(paidRegistration.data.tournament.currentPlayers, 1);
    assert.equal((await request(`/club-a/centro/admin/tournaments/${newTournamentId}`, adminA,
      { method: "PATCH", body: { maxPlayers: 10 } })).status, 404);
    assert.equal((await request(`/club-b/centro/admin/tournaments/${tournamentA.id}`, adminB,
      { method: "DELETE" })).status, 404);
    const deletableTournament = await request("/club-a/norte/admin/tournaments", adminA, { method: "POST", body: {
      name: "Torneo descartable", date: "2099-11-02", hour: "20:00", status: "abierto", category: "Mixto",
      surface: "Césped", pricePerPlayer: 0, seededPlayers: 0, maxPlayers: 4, prize: "", description: "",
    } });
    assert.equal(deletableTournament.status, 201);
    assert.equal((await request(`/club-a/norte/admin/tournaments/${deletableTournament.data.tournament.id}`, adminA,
      { method: "DELETE" })).status, 200);
    assert.equal((await request("/club-a/centro/availability?date=2026-10-40")).status, 400);
    assert.equal((await request("/club-a/inexistente/courts")).status, 404);

    assert.equal((await request("/club-a/centro/admin/bookings")).status, 401);
    const ownBookings = await request("/club-a/centro/admin/bookings", adminA);
    assert.equal(ownBookings.status, 200);
    assert.deepEqual(ownBookings.data.bookings.map((booking) => booking.id), [bookingA.id]);
    assert.equal((await request("/club-a/centro/admin/bookings", receptionistA)).status, 200);
    assert.equal((await request("/club-a/norte/admin/bookings", receptionistA)).status, 403);
    assert.equal((await request("/club-a/norte/admin/bookings", adminA)).status, 200);
    assert.equal((await request("/club-a/centro/admin/courts", receptionistA)).status, 403);
    const newCourt = await request("/club-a/norte/admin/courts", adminA, { method: "POST", body: {
      name: "Cancha nueva", openingTime: "09:00", closingTime: "22:00", allowedDurations: [60, 90],
      basePrice: 20000, nightPrice: 27000, weekendExtra: 2000,
    } });
    assert.equal(newCourt.status, 201);
    assert.equal((await request("/club-a/norte/admin/courts", receptionistA, { method: "POST", body: {} })).status, 403);
    assert.equal((await request("/club-a/norte/admin/courts/court-b", adminA, { method: "PATCH", body: { active: false } })).status, 404);
    assert.equal((await request(`/club-a/norte/admin/courts/${newCourt.data.court.id}`, adminA,
      { method: "PATCH", body: { openingTime: "25:00" } })).status, 400);
    assert.equal((await request(`/club-a/norte/admin/courts/${newCourt.data.court.id}`, adminA,
      { method: "PATCH", body: { active: false } })).data.court.active, false);
    assert.deepEqual((await request("/club-a/norte/courts")).data.courts.map((court) => court.id), ["court-a2"]);
    assert.equal((await request("/club-b/centro/admin/bookings", adminA)).status, 403);
    assert.equal((await request("/club-a/centro/admin/bookings", adminB)).status, 403);
    assert.equal((await request(`/club-a/centro/admin/bookings/${bookingB.id}`, adminA)).status, 404);

    const slot = { date: "2099-10-20", time: "11:00", courtId: "court-a", type: "court", durationMinutes: 60, paymentOption: "cash" };
    const [raceA, raceA2] = await Promise.all([
      request("/club-a/centro/bookings", playerA, { method: "POST", body: slot }),
      request("/club-a/centro/bookings", playerA2, { method: "POST", body: slot }),
    ]);
    assert.deepEqual([raceA.status, raceA2.status].sort(), [201, 409]);
    const winner = raceA.status === 201 ? raceA : raceA2;
    const winningPlayer = raceA.status === 201 ? playerA : playerA2;
    assert.equal(String(winner.data.booking.venueId), venueA.id);
    assert.equal(winner.data.booking.price, 18000);
    assert.equal(await SlotClaim.countDocuments({ organizationId: orgA._id, venueId: venueA._id, courtId: "court-a" }), 2);
    const otherVenueBooking = await request("/club-b/centro/bookings", playerB, { method: "POST", body: { ...slot, courtId: "court-b" } });
    assert.equal(otherVenueBooking.status, 201);
    assert.equal((await request("/club-a/centro/bookings", playerA, { method: "POST", body: { ...slot, courtId: "court-b" } })).status, 400);
    assert.equal((await request("/club-a/centro/bookings", playerA, { method: "POST", body: { ...slot, organizationId: orgB.id } })).status, 400);
    const classSlot = { ...slot, time: "09:00", type: "class", teacherId: teacherB.id };
    assert.equal((await request("/club-a/centro/bookings", playerA, { method: "POST", body: classSlot })).status, 409);
    assert.equal((await request("/club-a/centro/bookings", playerA, { method: "POST", body: { ...classSlot, teacherId: teacherA.id } })).status, 201);
    const receptionBooking = await request("/club-a/centro/bookings", receptionistA, { method: "POST",
      body: { ...slot, time: "15:00", playerName: "Jugador por recepción", phone: "3511234567" } });
    assert.equal(receptionBooking.status, 201);
    assert.equal(receptionBooking.data.booking.source, "reception");
    const blockPath = "/club-a/norte/admin/blocks/batch";
    const blockBody = { blocks: [{ date: slot.date, courtId: "court-a2", hour: "12:00", durationMinutes: 60, reason: "Mantenimiento" }] };
    assert.equal((await request(blockPath, receptionistA, { method: "POST", body: blockBody })).status, 403);
    const storedBlock = await request(blockPath, adminA, { method: "POST", body: blockBody });
    assert.equal(storedBlock.status, 201);
    assert.deepEqual((await request("/club-a/norte/blocks")).data.blocks.map((block) => block.courtId), ["court-a2"]);
    assert.equal("reason" in (await request("/club-a/norte/blocks")).data.blocks[0], false);
    assert.deepEqual((await request("/club-b/centro/blocks")).data.blocks, []);
    assert.equal((await request(blockPath, adminA, { method: "POST", body: blockBody })).status, 409);
    assert.equal((await request("/club-a/centro/admin/blocks/batch", receptionistA, { method: "POST",
      body: { blocks: [{ date: slot.date, courtId: "court-a", hour: "11:00", durationMinutes: 60 }] } })).status, 409);
    assert.equal((await request("/club-a/centro/admin/blocks/batch", receptionistA, { method: "POST",
      body: { blocks: [{ date: slot.date, courtId: "court-b", hour: "12:00", durationMinutes: 60 }] } })).status, 400);
    assert.equal((await request("/club-a/norte/bookings", adminA, { method: "POST",
      body: { ...slot, courtId: "court-a2", time: "12:00" } })).status, 409);
    assert.equal((await request("/club-b/centro/admin/blocks/batch", adminA, { method: "POST", body: blockBody })).status, 403);
    assert.equal((await request(blockPath, adminA, { method: "DELETE",
      body: { keys: [{ date: slot.date, courtId: "court-a2", hour: "12:00" }] } })).data.deleted, 1);
    assert.equal((await request("/club-a/norte/bookings", adminA, { method: "POST",
      body: { ...slot, courtId: "court-a2", time: "12:00" } })).status, 201);
    const raceBlockBody = { blocks: [{ date: slot.date, courtId: "court-a2", hour: "14:00", durationMinutes: 60 }] };
    const [raceVenueBooking, raceVenueBlock] = await Promise.all([
      request("/club-a/norte/bookings", playerA, { method: "POST", body: { ...slot, courtId: "court-a2", time: "14:00" } }),
      request(blockPath, adminA, { method: "POST", body: raceBlockBody }),
    ]);
    assert.deepEqual([raceVenueBooking.status, raceVenueBlock.status].sort(), [201, 409]);
    const teacherBlockBody = { blocks: [{ date: slot.date, courtId: "court-a", hour: "10:00", durationMinutes: 60 }] };
    assert.equal((await request("/club-a/norte/admin/blocks/batch", teacherUserA, { method: "POST", body: teacherBlockBody })).status, 403);
    assert.equal((await request("/club-a/centro/admin/blocks/batch", teacherUserA, { method: "POST", body: teacherBlockBody })).status, 201);
    assert.equal((await request("/club-a/centro/bookings", playerA, { method: "POST", body: { ...slot, time: "10:00" } })).status, 409);
    assert.equal((await request("/club-a/centro/admin/blocks/batch", teacherUserA, { method: "DELETE",
      body: { keys: [{ date: slot.date, courtId: "court-a", hour: "10:00" }] } })).data.deleted, 1);
    const clubBlockBody = { blocks: [{ date: slot.date, courtId: "court-a", hour: "17:00", durationMinutes: 60 }] };
    assert.equal((await request("/club-a/centro/admin/blocks/batch", adminA, { method: "POST", body: clubBlockBody })).status, 201);
    const clubBlockKey = { keys: [{ date: slot.date, courtId: "court-a", hour: "17:00" }] };
    assert.equal((await request("/club-a/centro/admin/blocks/batch", teacherUserA,
      { method: "DELETE", body: clubBlockKey })).data.deleted, 0);
    assert.equal((await request("/club-a/centro/admin/blocks/batch", adminA,
      { method: "DELETE", body: clubBlockKey })).data.deleted, 1);
    const paymentPath = `/club-a/centro/admin/bookings/${winner.data.booking.id}/payments`;
    const payment = { amount: 5000, method: "transferencia", idempotencyKey: randomUUID() };
    const [paidOnce, paidAgain] = await Promise.all([
      request(paymentPath, receptionistA, { method: "POST", body: payment }),
      request(paymentPath, receptionistA, { method: "POST", body: payment }),
    ]);
    assert.equal(paidOnce.status, 200);
    assert.equal(paidAgain.status, 200);
    assert.equal((await Booking.findById(winner.data.booking.id)).paymentEntries.length, 1);
    assert.equal((await request(`/club-a/centro/admin/bookings/${otherVenueBooking.data.booking.id}/payments`, adminA,
      { method: "POST", body: { ...payment, idempotencyKey: randomUUID() } })).status, 404);
    assert.equal((await request(paymentPath, playerA, { method: "POST", body: { ...payment, idempotencyKey: randomUUID() } })).status, 403);
    const reversePath = `${paymentPath}/reverse`;
    const reverse = { idempotencyKey: randomUUID() };
    assert.equal((await request(reversePath, adminA, { method: "POST", body: reverse })).data.booking.amountPaid, 0);
    assert.equal((await request(reversePath, adminA, { method: "POST", body: reverse })).data.replayed, true);
    const statusPath = `/club-a/centro/admin/bookings/${winner.data.booking.id}/status`;
    assert.equal((await request(statusPath, receptionistA, { method: "PATCH", body: { status: "confirmado" } })).data.booking.status, "confirmado");
    assert.equal((await request(`/club-a/centro/admin/bookings/${otherVenueBooking.data.booking.id}/status`, adminA,
      { method: "PATCH", body: { status: "confirmado" } })).status, 404);
    assert.equal((await request(`/club-a/centro/bookings/${otherVenueBooking.data.booking.id}/cancel`, adminA, { method: "POST" })).status, 404);
    assert.equal((await request(`/club-a/centro/bookings/${winner.data.booking.id}/cancel`, playerB, { method: "POST" })).status, 403);
    assert.equal((await request(`/club-a/centro/bookings/${winner.data.booking.id}/cancel`, winningPlayer, { method: "POST" })).status, 200);
    assert.equal(await SlotClaim.countDocuments({ organizationId: orgA._id, venueId: venueA._id, courtId: "court-a", ownerId: winner.data.booking.id }), 0);
    assert.equal((await request(statusPath, adminA, { method: "PATCH", body: { status: "confirmado" } })).data.booking.status, "confirmado");
    assert.equal(await SlotClaim.countDocuments({ organizationId: orgA._id, venueId: venueA._id, courtId: "court-a", ownerId: winner.data.booking.id }), 2);
    assert.equal((await request(statusPath, adminA, { method: "PATCH", body: { status: "cancelado" } })).data.booking.status, "cancelado");
    assert.equal(await SlotClaim.countDocuments({ organizationId: orgA._id, venueId: venueA._id, courtId: "court-a", ownerId: winner.data.booking.id }), 0);
    assert.equal(await SlotClaim.countDocuments({ organizationId: orgB._id, venueId: venueB._id, courtId: "court-b" }), 2);

    await Membership.updateOne({ userId: adminA.id }, { $set: { active: false } });
    assert.equal((await request("/club-a/centro/admin/bookings", adminA)).status, 403);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
