import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("API: permisos, perfil, reservas, bloqueos, torneos y caja compartida", async (t) => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const sentEmails = [];
  const emailServer = http.createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    sentEmails.push(JSON.parse(body));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ id: "email-qa" }));
  });
  await new Promise((resolve) => emailServer.listen(0, "127.0.0.1", resolve));
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "padelbook_qa";
  process.env.JWT_SECRET = "integration-test-secret-long-enough-to-be-private";
  process.env.PADELBOOK_DEMO_SEED = "false";
  process.env.ADMIN_NAME = "Admin QA";
  process.env.ADMIN_EMAIL = "admin-qa@club.test";
  process.env.ADMIN_PASSWORD = "admin-qa-password-123";
  process.env.PUBLIC_APP_ORIGIN = "https://padelbook.test";
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_API_URL = `http://127.0.0.1:${emailServer.address().port}/emails`;
  process.env.PASSWORD_RESET_FROM = "PadelBook <cuentas@padelbook.test>";
  const [{ app }, { connectDb }, { argentinaDateISO }] = await Promise.all([
    import("../server/index.mjs"), import("../server/db.mjs"), import("../src/utils/bookingDomain.js"),
  ]);
  let server;
  try {
    await connectDb();
    assert.equal(mongoose.connection.name, "padelbook_qa");
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = async (path, { method = "GET", token, cookie, csrf, body } = {}) => {
      const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(csrf ? { "X-CSRF-Token": csrf } : {}) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: response.status === 204 ? {} : await response.json(), headers: response.headers };
    };
    const waitFor = async (predicate, timeoutMs = 1500) => {
      const started = Date.now();
      while (!predicate()) {
        if (Date.now() - started > timeoutMs) throw new Error("Timeout esperando efecto asíncrono");
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    };
    const future = new Date();
    future.setDate(future.getDate() + 7);
    const date = argentinaDateISO(future);

    const adminLogin = await request("/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } });
    assert.equal(adminLogin.status, 200);
    assert.match(adminLogin.headers.get("content-security-policy"), /default-src 'self'/);
    const admin = adminLogin.data.token;
    const adminCookie = adminLogin.headers.get("set-cookie").split(";")[0];
    assert.match(adminLogin.headers.get("set-cookie"), /HttpOnly/i);
    assert.equal((await request("/auth/me", { cookie: adminCookie })).status, 200);
    assert.equal((await request("/auth/me", { cookie: "padelbook_session=%ZZ" })).status, 401);
    assert.equal((await request("/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: "x".repeat(73) } })).status, 400);
    assert.equal((await request("/auth/me", { method: "PATCH", cookie: adminCookie, body: { name: "Admin QA", phone: "", category: "Gestión" } })).status, 403);
    assert.equal((await request("/auth/me", { method: "PATCH", cookie: adminCookie, csrf: adminLogin.data.csrfToken, body: { name: "Admin QA", phone: "", category: "Gestión" } })).status, 200);
    const publicCourts = await request("/courts");
    assert.equal(publicCourts.status, 200);
    assert.equal(publicCourts.data.courts.length, 3);
    assert.equal((await request("/admin/courts", { token: admin })).status, 200);
    assert.equal((await request("/admin/courts", { method: "POST", token: admin, body: { name: "Cancha configurable", description: "Indoor", openingTime: "25:00", closingTime: "22:00", slotIntervalMinutes: 30, allowedDurations: [60], basePrice: 21000, nightPrice: 26000, weekendExtra: 4000 } })).status, 400);
    const createdCourt = await request("/admin/courts", { method: "POST", token: admin, body: { name: "Cancha configurable", description: "Indoor", openingTime: "10:00", closingTime: "20:00", slotIntervalMinutes: 30, allowedDurations: [60, 90], basePrice: 21000, nightPrice: 26000, weekendExtra: 4000, sortOrder: 4 } });
    assert.equal(createdCourt.status, 201);
    const configurableCourtId = createdCourt.data.court.id;
    const updatedCourt = await request(`/admin/courts/${configurableCourtId}`, { method: "PATCH", token: admin, body: { allowedDurations: [90], basePrice: 23000 } });
    assert.equal(updatedCourt.status, 200);
    assert.deepEqual(updatedCourt.data.court.allowedDurations, [90]);
    const playerSignup = await request("/auth/register", { method: "POST", body: { name: "Jugadora QA", email: "jugadora@club.test", password: "player-qa-123", phone: "3511234567" } });
    assert.equal(playerSignup.status, 201);
    const player = playerSignup.data.token;
    assert.equal((await request("/admin/tournaments", { token: player })).status, 403);

    const profile = await request("/auth/me", { method: "PATCH", token: player, body: { name: "Jugadora Actualizada", phone: "3519999999", category: "6ta" } });
    assert.equal(profile.status, 200);
    assert.equal((await request("/auth/me", { token: player })).data.user.phone, "3519999999");
    assert.equal((await request("/bookings", { method: "POST", token: player, body: { date, time: "10:00", courtId: configurableCourtId, type: "court", durationMinutes: 60, paymentOption: "cash" } })).status, 400);
    const configurableBooking = await request("/bookings", { method: "POST", token: player, body: { date, time: "10:00", courtId: configurableCourtId, type: "court", durationMinutes: 90, paymentOption: "cash" } });
    assert.equal(configurableBooking.status, 201);
    assert.equal(configurableBooking.data.booking.price, 34500);

    const teacher = await request("/admin/teachers", { method: "POST", token: admin, body: { name: "Profe QA", nickname: "Profe", specialty: "Individual", price: 32000 } });
    assert.equal(teacher.status, 201);
    const teacherId = teacher.data.teacher.id;
    const classBooking = await request("/bookings", { method: "POST", token: player, body: { date, time: "09:00", courtId: "court1", type: "class", durationMinutes: 60, paymentOption: "cash", teacherId } });
    assert.equal(classBooking.status, 201);
    assert.equal(classBooking.data.booking.price, 32000);
    await waitFor(() => sentEmails.some((email) => /reserva/i.test(email.subject || "")));
    const sameTeacher = await request("/bookings", { method: "POST", token: player, body: { date, time: "09:00", courtId: "court2", type: "class", durationMinutes: 60, paymentOption: "cash", teacherId } });
    assert.equal(sameTeacher.status, 409);
    const duplicate = await request("/bookings", { method: "POST", token: player, body: { date, time: "09:00", courtId: "court1", type: "court", durationMinutes: 60, paymentOption: "cash" } });
    assert.equal(duplicate.status, 409);
    assert.equal("booking" in duplicate.data, false);
    const bookingId = classBooking.data.booking.id;
    const overlappingBlock = await request("/blocks/batch", { method: "POST", token: admin, body: { blocks: [{ date, courtId: "court1", hour: "09:00", durationMinutes: 60 }] } });
    assert.equal(overlappingBlock.status, 409);
    assert.equal((await request(`/bookings/${bookingId}/cancel`, { method: "POST", token: player })).status, 200);
    await waitFor(() => sentEmails.some((email) => /cancelada/i.test(email.subject || "")));
    assert.equal((await request("/blocks/batch", { method: "POST", token: admin, body: { blocks: [{ date, courtId: "court1", hour: "09:00", durationMinutes: 60 }] } })).status, 200);
    assert.equal((await request(`/bookings/${bookingId}/status`, { method: "PATCH", token: admin, body: { status: "confirmado" } })).status, 409);
    assert.equal((await request("/blocks/batch", { method: "DELETE", token: admin, body: { keys: [{ date, courtId: "court1", hour: "09:00" }] } })).status, 200);
    assert.equal((await request(`/bookings/${bookingId}/status`, { method: "PATCH", token: admin, body: { status: "confirmado" } })).status, 200);
    await waitFor(() => sentEmails.some((email) => /confirmada/i.test(email.subject || "")));
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

    const secondPlayerSignup = await request("/auth/register", { method: "POST", body: { name: "Jugador concurrente", email: "concurrente@club.test", password: "concurrente-qa-123", phone: "3512223344" } });
    assert.equal(secondPlayerSignup.status, 201);
    const [racePlayerOne, racePlayerTwo] = await Promise.all([
      request("/bookings", { method: "POST", token: player, body: { date, time: "14:00", courtId: "court2", type: "court", durationMinutes: 60, paymentOption: "cash" } }),
      request("/bookings", { method: "POST", token: secondPlayerSignup.data.token, body: { date, time: "14:00", courtId: "court2", type: "court", durationMinutes: 60, paymentOption: "cash" } }),
    ]);
    assert.equal([racePlayerOne.status, racePlayerTwo.status].filter((status) => status === 201).length, 1);
    assert.equal([racePlayerOne.status, racePlayerTwo.status].filter((status) => status === 409).length, 1);

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

    const staffPath = "/admin/staff";
    assert.equal((await request(staffPath, { token: player })).status, 403);
    const createdStaff = await request(staffPath, { method: "POST", token: admin, body: { name: "Recepción QA", email: "recepcion@club.test", password: "recepcion-segura-123", phone: "3515557777" } });
    assert.equal(createdStaff.status, 201);
    assert.equal("passwordHash" in createdStaff.data.employee, false);
    const receptionistId = createdStaff.data.employee.id;
    const receptionistLogin = await request("/auth/login", { method: "POST", body: { email: "recepcion@club.test", password: "recepcion-segura-123" } });
    assert.equal(receptionistLogin.status, 200);
    const receptionist = receptionistLogin.data.token;
    assert.equal((await request("/settings", { method: "PUT", token: receptionist, body: {} })).status, 403);
    assert.equal((await request("/finance/summary", { token: receptionist })).status, 403);
    assert.equal((await request(staffPath, { token: receptionist })).status, 403);
    const walkIn = await request("/bookings", { method: "POST", token: receptionist, body: { date, time: "17:00", courtId: "court3", type: "court", durationMinutes: 60, paymentOption: "cash", playerName: "Jugador WhatsApp", phone: "3514443333", userEmail: "contacto-externo@club.test", price: 1 } });
    assert.equal(walkIn.status, 201);
    assert.equal(walkIn.data.booking.playerName, "Jugador WhatsApp");
    assert.equal(walkIn.data.booking.source, "reception");
    assert.notEqual(walkIn.data.booking.price, 1);
    assert.equal((await request("/bookings", { token: receptionist })).data.bookings.some((item) => item.id === walkIn.data.booking.id), true);
    assert.equal((await request("/bookings", { token: player })).data.bookings.some((item) => item.id === walkIn.data.booking.id), false);
    const sameEmailSignup = await request("/auth/register", { method: "POST", body: { name: "Contacto externo", email: "contacto-externo@club.test", password: "external-qa-123" } });
    assert.equal(sameEmailSignup.status, 201);
    assert.equal((await request("/bookings", { token: sameEmailSignup.data.token })).data.bookings.some((item) => item.id === walkIn.data.booking.id), false);
    assert.equal((await request(`/bookings/${walkIn.data.booking.id}/cancel`, { method: "POST", token: sameEmailSignup.data.token })).status, 403);
    const spoofed = await request("/bookings", { method: "POST", token: player, body: { date, time: "16:00", courtId: "court3", type: "court", durationMinutes: 60, paymentOption: "cash", playerName: "Otra persona", phone: "000" } });
    assert.equal(spoofed.status, 201);
    assert.equal(spoofed.data.booking.playerName, "Jugadora Actualizada");
    assert.equal(spoofed.data.booking.source, "online");
    assert.equal((await request("/blocks/batch", { method: "POST", token: receptionist, body: { blocks: [{ date, courtId: "court1", hour: "17:00", durationMinutes: 30 }] } })).status, 200);
    assert.equal((await request(`/bookings/${walkIn.data.booking.id}/status`, { method: "PATCH", token: receptionist, body: { status: "confirmado" } })).status, 200);
    assert.equal((await request(`/bookings/${walkIn.data.booking.id}/payments`, { method: "POST", token: receptionist, body: { amount: 1000, method: "efectivo", idempotencyKey: "83284a55-1976-4862-8805-8e0888a41aa7" } })).status, 200);
    assert.equal((await request(`${staffPath}/${receptionistId}`, { method: "PATCH", token: admin, body: { password: "recepcion-renovada-456" } })).status, 200);
    assert.equal((await request("/bookings", { token: receptionist })).status, 401);
    assert.equal((await request("/auth/login", { method: "POST", body: { email: "recepcion@club.test", password: "recepcion-segura-123" } })).status, 401);
    const renewedLogin = await request("/auth/login", { method: "POST", body: { email: "recepcion@club.test", password: "recepcion-renovada-456" } });
    assert.equal(renewedLogin.status, 200);
    assert.equal((await request(`${staffPath}/${receptionistId}`, { method: "PATCH", token: admin, body: { active: false } })).status, 200);
    assert.equal((await request("/bookings", { token: renewedLogin.data.token })).status, 401);
    assert.equal((await request("/auth/password", { method: "PATCH", token: admin, body: { currentPassword: "incorrecta", newPassword: "admin-password-renovada-456" } })).status, 401);
    const changedPassword = await request("/auth/password", { method: "PATCH", token: admin, body: { currentPassword: process.env.ADMIN_PASSWORD, newPassword: "admin-password-renovada-456" } });
    assert.equal(changedPassword.status, 204);
    assert.equal((await request("/auth/me", { token: admin })).status, 401);
    assert.equal((await request("/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD } })).status, 401);
    assert.equal((await request("/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: "admin-password-renovada-456" } })).status, 200);
    sentEmails.length = 0;
    const unknownRecovery = await request("/auth/password/forgot", { method: "POST", body: { email: "no-existe@club.test" } });
    assert.equal(unknownRecovery.status, 202);
    assert.equal(sentEmails.length, 0);
    const requestedRecovery = await request("/auth/password/forgot", { method: "POST", body: { email: process.env.ADMIN_EMAIL } });
    assert.equal(requestedRecovery.status, 202);
    assert.equal(sentEmails.at(-1).to[0], process.env.ADMIN_EMAIL);
    const resetUrl = sentEmails.at(-1).text.match(/https:\/\/[^\s]+/)[0];
    const resetToken = new URL(resetUrl).searchParams.get("token");
    assert.ok(resetToken.length >= 32);
    assert.equal((await request("/auth/password/reset", { method: "POST", body: { token: "invalid-token-that-is-long-enough-000", password: "final-password-qa-789" } })).status, 400);
    assert.equal((await request("/auth/password/reset", { method: "POST", body: { token: resetToken, password: "final-password-qa-789" } })).status, 204);
    assert.equal((await request("/auth/password/reset", { method: "POST", body: { token: resetToken, password: "another-password-qa-789" } })).status, 400);
    assert.equal((await request("/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: "admin-password-renovada-456" } })).status, 401);
    const finalLogin = await request("/auth/login", { method: "POST", body: { email: process.env.ADMIN_EMAIL, password: "final-password-qa-789" } });
    assert.equal(finalLogin.status, 200);
    const finalCookie = finalLogin.headers.get("set-cookie").split(";")[0];
    assert.equal((await request("/auth/logout", { method: "POST", cookie: finalCookie })).status, 403);
    assert.equal((await request("/auth/me", { cookie: finalCookie })).status, 200);
    assert.equal((await request("/auth/logout", { method: "POST", cookie: finalCookie, csrf: finalLogin.data.csrfToken })).status, 204);
    assert.equal((await request("/auth/me", { cookie: finalCookie })).status, 401);
    assert.equal((await request("/auth/me", { token: finalLogin.data.token })).status, 401);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => emailServer.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
  }
});
