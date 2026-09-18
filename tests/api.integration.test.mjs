import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("API: permisos, perfil, reservas, bloqueos, torneos y caja compartida", async (t) => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.JWT_SECRET = "integration-test-secret-long-enough-to-be-private";
  process.env.PADELBOOK_DEMO_SEED = "false";
  process.env.ADMIN_NAME = "Admin QA";
  process.env.ADMIN_EMAIL = "admin-qa@club.test";
  process.env.ADMIN_PASSWORD = "admin-qa-password-123";
  const [{ app }, { connectDb }, { argentinaDateISO }] = await Promise.all([
    import("../server/index.mjs"), import("../server/db.mjs"), import("../src/utils/bookingDomain.js"),
  ]);
  let server;
  try {
    await connectDb();
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, { method = "GET", token, body } = {}) => {
      const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json() };
    };
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const date = argentinaDateISO(future);

    const adminLogin = await request("/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
    assert.equal(adminLogin.status, 200);
    const admin = adminLogin.data.token;
    const playerSignup = await request("/auth/register", { method: "POST", body: { name: "Jugadora QA", email: "jugadora@club.test", password: "player-qa-123", phone: "3511234567" } });
    assert.equal(playerSignup.status, 201);
    const player = playerSignup.data.token;
    assert.equal((await request("/admin/tournaments", { token: player })).status, 403);

    const profile = await request("/auth/me", { method: "PATCH", token: player, body: { name: "Jugadora Actualizada", phone: "3519999999", category: "6ta" } });
    assert.equal(profile.status, 200);
    assert.equal((await request("/auth/me", { token: player })).data.user.phone, "3519999999");

    const teacher = await request("/admin/teachers", { method: "POST", token: admin, body: { name: "Profe QA", nickname: "Profe", specialty: "Individual", price: 32000 } });
    assert.equal(teacher.status, 201);
    const teacherId = teacher.data.teacher.id;
    const classBooking = await request("/bookings", { method: "POST", token: player, body: { date, time: "09:00", courtId: "court1", type: "class", durationMinutes: 60, paymentOption: "cash", teacherId } });
    assert.equal(classBooking.status, 201);
    assert.equal(classBooking.data.booking.price, 32000);
    const sameTeacher = await request("/bookings", { method: "POST", token: player, body: { date, time: "09:00", courtId: "court2", type: "class", durationMinutes: 60, paymentOption: "cash", teacherId } });
    assert.equal(sameTeacher.status, 409);
    const duplicate = await request("/bookings", { method: "POST", token: player, body: { date, time: "09:00", courtId: "court1", type: "court", durationMinutes: 60, paymentOption: "cash" } });
    assert.equal(duplicate.status, 409);
    assert.equal("booking" in duplicate.data, false);
    const bookingId = classBooking.data.booking.id;
    const overlappingBlock = await request("/blocks/batch", { method: "POST", token: admin, body: { blocks: [{ date, courtId: "court1", hour: "09:00", durationMinutes: 60 }] } });
    assert.equal(overlappingBlock.status, 409);
    assert.equal((await request(`/bookings/${bookingId}/cancel`, { method: "POST", token: player })).status, 200);
    assert.equal((await request("/blocks/batch", { method: "POST", token: admin, body: { blocks: [{ date, courtId: "court1", hour: "09:00", durationMinutes: 60 }] } })).status, 200);
    assert.equal((await request(`/bookings/${bookingId}/status`, { method: "PATCH", token: admin, body: { status: "confirmado" } })).status, 409);
    assert.equal((await request("/blocks/batch", { method: "DELETE", token: admin, body: { keys: [{ date, courtId: "court1", hour: "09:00" }] } })).status, 200);
    assert.equal((await request(`/bookings/${bookingId}/status`, { method: "PATCH", token: admin, body: { status: "confirmado" } })).status, 200);
    const paymentPath = `/bookings/${bookingId}/payments`;
    const paymentBody = { amount: 10000, method: "transferencia", idempotencyKey: "f76a3799-d05b-4dd9-874d-f84c8a347225" };
    const [firstPayment, duplicatePayment] = await Promise.all([
      request(paymentPath, { method: "POST", token: admin, body: paymentBody }),
      request(paymentPath, { method: "POST", token: admin, body: paymentBody }),
    ]);
    assert.deepEqual([firstPayment.status, duplicatePayment.status], [200, 200]);
    assert.equal(firstPayment.data.booking.amountPaid, 10000);
    assert.equal(duplicatePayment.data.booking.amountPaid, 10000);
    assert.equal((await request(paymentPath, { method: "POST", token: admin, body: { ...paymentBody, amount: 20000 } })).status, 409);
    const reversalBody = { idempotencyKey: "cb4a318a-4808-405e-94ec-0860b7532825" };
    const reversalPath = `${paymentPath}/reverse`;
    assert.equal((await request(reversalPath, { method: "POST", token: admin, body: reversalBody })).data.booking.amountPaid, 0);
    const repeatedReversal = await request(reversalPath, { method: "POST", token: admin, body: reversalBody });
    assert.equal(repeatedReversal.status, 200);
    assert.equal(repeatedReversal.data.booking.amountPaid, 0);
    assert.equal(repeatedReversal.data.booking.paymentEntries.length, 2);

    const [raceBooking, raceBlock] = await Promise.all([
      request("/bookings", { method: "POST", token: player, body: { date, time: "11:00", courtId: "court2", type: "court", durationMinutes: 90, paymentOption: "cash" } }),
      request("/blocks/batch", { method: "POST", token: admin, body: { blocks: [{ date, courtId: "court2", hour: "11:30", durationMinutes: 60 }] } }),
    ]);
    assert.equal([raceBooking.status, raceBlock.status].filter((status) => status === 409).length, 1);
    assert.equal([raceBooking.status, raceBlock.status].filter((status) => status === 200 || status === 201).length, 1);

    const tournament = await request("/admin/tournaments", { method: "POST", token: admin, body: { name: "Torneo QA", date, hour: "19:00", status: "abierto", category: "Mixto", surface: "Césped", pricePerPlayer: 25000, seededPlayers: 0, maxPlayers: 8, prize: "Premio", description: "Prueba" } });
    assert.equal(tournament.status, 201);
    const tournamentId = tournament.data.tournament.id;
    const registration = await request(`/tournaments/${tournamentId}/register`, { method: "POST", token: player, body: {} });
    assert.equal(registration.status, 201);
    assert.equal("registrations" in registration.data.tournament, false);
    assert.equal((await request(`/tournaments/${tournamentId}/register`, { method: "POST", token: player, body: {} })).status, 409);
    const publicList = await request("/tournaments");
    assert.equal(publicList.status, 200);
    assert.equal("registrations" in publicList.data.tournaments[0], false);
    assert.equal((await request("/tournaments/mine", { token: player })).data.registrations.length, 1);
    assert.equal((await request(`/admin/tournaments/${tournamentId}/registrations/${registration.data.registration.id}`, { method: "PATCH", token: admin, body: { status: "confirmado" } })).status, 200);
    assert.equal((await request(`/admin/tournaments/${tournamentId}/registrations/${registration.data.registration.id}`, { method: "PATCH", token: admin, body: { paymentStatus: "pagado" } })).status, 200);
    const finance = await request("/finance/summary", { token: admin });
    assert.equal(finance.status, 200);
    assert.equal(finance.data.summary.incomeByCategory.find((item) => item.label === "Torneos").amount, 25000);
    assert.equal(finance.data.summary.incomeByCategory.find((item) => item.label === "Clases").amount, 0);
    assert.equal((await request(`/admin/tournaments/${tournamentId}/registrations/${registration.data.registration.id}`, { method: "PATCH", token: admin, body: { paymentStatus: "pendiente" } })).status, 200);
    assert.equal((await request("/finance/summary", { token: admin })).data.summary.incomeByCategory.find((item) => item.label === "Torneos").amount, 0);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
