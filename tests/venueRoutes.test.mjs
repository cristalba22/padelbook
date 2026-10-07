import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("las rutas de sede aíslan agenda y reservas de dos clubes y usan la membresía, no el rol global", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "padelbook_venue_routes_qa";
  process.env.JWT_SECRET = "venue-routes-test-secret-long-enough-to-be-private";
  const [{ app }, { Organization, Venue, Membership, User, Court, Booking, Setting, Teacher, Tournament }, { createSession }] = await Promise.all([
    import("../server/index.mjs"), import("../server/db.mjs"), import("../server/auth.mjs"),
  ]);
  let server;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: process.env.MONGODB_DB_NAME });
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
    await Teacher.create([
      { organizationId: orgA.id, venueId: venueA.id, name: "Profe A" },
      { organizationId: orgB.id, venueId: venueB.id, name: "Profe B" },
    ]);
    await Tournament.create([
      { organizationId: orgA.id, venueId: venueA.id, name: "Torneo A", date: "2026-11-01", registrations: [{ name: "Privado A", email: "a@test.local" }] },
      { organizationId: orgB.id, venueId: venueB.id, name: "Torneo B", date: "2026-11-02", registrations: [{ name: "Privado B", email: "b@test.local" }] },
    ]);
    const [bookingA, bookingB] = await Booking.create([
      { organizationId: orgA.id, venueId: venueA.id, date: "2026-10-20", time: "19:00", courtId: "court-a", courtName: "Cancha A", playerName: "Jugadora A" },
      { organizationId: orgB.id, venueId: venueB.id, date: "2026-10-20", time: "20:00", courtId: "court-b", courtName: "Cancha B", playerName: "Jugador B" },
    ]);
    const [adminA, adminB, receptionistA] = await User.create([
      { name: "Admin A", email: "admin-a@test.local", passwordHash: "test-hash", role: "player" },
      { name: "Admin B", email: "admin-b@test.local", passwordHash: "test-hash", role: "admin" },
      { name: "Recepción A", email: "recepcion-a@test.local", passwordHash: "test-hash", role: "player" },
    ]);
    await Membership.create([
      { userId: adminA.id, organizationId: orgA.id, role: "admin", venueIds: [venueA.id] },
      { userId: adminB.id, organizationId: orgB.id, role: "admin", venueIds: [venueB.id] },
      { userId: receptionistA.id, organizationId: orgA.id, role: "receptionist", venueIds: [venueA.id] },
    ]);

    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api/venues`;
    const request = async (path, user) => {
      const token = user ? createSession(user).token : "";
      const response = await fetch(`${base}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      return { status: response.status, data: await response.json() };
    };

    const courtsA = await request("/club-a/centro/courts");
    assert.equal(courtsA.status, 200);
    assert.deepEqual(courtsA.data.courts.map((court) => court.id), ["court-a"]);
    assert.deepEqual((await request("/club-a/norte/courts")).data.courts.map((court) => court.id), ["court-a2"]);
    assert.deepEqual((await request("/club-b/centro/courts")).data.courts.map((court) => court.id), ["court-b"]);
    assert.deepEqual((await request("/club-a/centro/availability?date=2026-10-20")).data.occupied.map((booking) => booking.courtId), ["court-a"]);
    assert.deepEqual((await request("/club-a/norte/availability?date=2026-10-20")).data.occupied, []);
    assert.deepEqual((await request("/club-a/centro/teachers")).data.teachers.map((teacher) => teacher.name), ["Profe A"]);
    assert.equal((await request("/club-a/centro/settings")).data.settings.clubName, "Club A Centro");
    const publicTournaments = (await request("/club-a/centro/tournaments")).data.tournaments;
    assert.deepEqual(publicTournaments.map((tournament) => tournament.name), ["Torneo A"]);
    assert.equal("registrations" in publicTournaments[0], false);
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
    assert.equal((await request("/club-b/centro/admin/bookings", adminA)).status, 403);
    assert.equal((await request("/club-a/centro/admin/bookings", adminB)).status, 403);
    assert.equal((await request(`/club-a/centro/admin/bookings/${bookingB.id}`, adminA)).status, 404);
    await Membership.updateOne({ userId: adminA.id }, { $set: { active: false } });
    assert.equal((await request("/club-a/centro/admin/bookings", adminA)).status, 403);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
