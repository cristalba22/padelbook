import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("la invitación por correo une una cuenta existente a un solo club y vence al usarse", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const sent = [];
  const mailServer = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const message = JSON.parse(body);
    sent.push(message);
    res.writeHead(message.to[0] === "fail@example.test" ? 500 : 200, { "Content-Type": "application/json" });
    res.end('{"id":"qa-mail"}');
  });
  await new Promise((resolve) => mailServer.listen(0, "127.0.0.1", resolve));
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "padelbook_invitations_qa";
  process.env.JWT_SECRET = "invitation-test-secret-long-enough-to-be-private";
  process.env.PADELBOOK_OPERATING_MODE = "multiclub";
  process.env.RESEND_API_KEY = "qa-mail-key";
  process.env.PASSWORD_RESET_FROM = "PadelBook <qa@example.test>";
  process.env.RESEND_API_URL = `http://127.0.0.1:${mailServer.address().port}/emails`;
  process.env.PUBLIC_APP_ORIGIN = "http://127.0.0.1:5173";
  const [{ app }, { Organization, Venue, Membership, User, Invitation }, { createSession }] = await Promise.all([
    import("../server/index.mjs"), import("../server/db.mjs"), import("../server/auth.mjs"),
  ]);
  let api;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: process.env.MONGODB_DB_NAME });
    await Promise.all([Organization.init(), Membership.init(), User.init(), Invitation.init()]);
    const [clubA, clubB] = await Organization.create([{ slug: "club-a", name: "Club A" }, { slug: "club-b", name: "Club B" }]);
    const [venueA, venueB] = await Venue.create([{ organizationId: clubA.id, slug: "centro", name: "Centro" },
      { organizationId: clubB.id, slug: "norte", name: "Norte" }]);
    const [adminA, adminB, player, other] = await User.create([
      { name: "Dueña A", email: "admin-a@example.test", passwordHash: "qa", role: "player" },
      { name: "Dueña B", email: "admin-b@example.test", passwordHash: "qa", role: "player" },
      { name: "Recepcionista", email: "staff@example.test", passwordHash: "qa", role: "player" },
      { name: "Otra persona", email: "other@example.test", passwordHash: "qa", role: "player" },
    ]);
    await Membership.create([{ userId: adminA.id, organizationId: clubA.id, role: "admin" },
      { userId: adminB.id, organizationId: clubB.id, role: "admin" }]);
    api = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => api.once("listening", resolve));
    const base = `http://127.0.0.1:${api.address().port}/api`;
    const request = async (path, user, body, method = "POST") => {
      const response = await fetch(`${base}${path}`, { method,
        headers: { "Content-Type": "application/json", ...(user ? { Authorization: `Bearer ${createSession(user).token}` } : {}) },
        body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, data: response.status === 204 ? null : await response.json() };
    };
    const path = "/organizations/club-a/admin/invitations";
    const body = { email: "STAFF@example.test", role: "receptionist", venueIds: [venueA.id] };
    assert.equal((await request(path, adminB, body)).status, 404);
    assert.equal((await request(path, adminA, { ...body, venueIds: [venueB.id] })).status, 400);
    const invited = await request(path, adminA, body);
    assert.equal(invited.status, 201);
    assert.equal(invited.data.invitation.email, "staff@example.test");
    assert.equal(JSON.stringify(invited.data).includes("token"), false);
    assert.equal(sent.length, 1);
    const token = sent[0].text.match(/#token=([^\s]+)/)?.[1];
    assert.ok(token);
    const preview = await request("/invitations/preview", null, { token });
    assert.equal(preview.status, 200);
    assert.equal(preview.data.invitation.clubName, "Club A");
    assert.equal((await request("/invitations/accept", other, { token })).status, 400);
    assert.equal((await request("/invitations/accept", player, { token })).status, 200);
    assert.equal((await Membership.findOne({ userId: player.id, organizationId: clubA.id })).role, "receptionist");
    assert.equal(await Membership.countDocuments({ userId: player.id, organizationId: clubB.id }), 0);
    assert.equal((await request("/invitations/accept", player, { token })).status, 400);
    assert.equal((await request("/invitations/preview", null, { token })).status, 400);
    assert.equal((await request(path, adminA, body)).status, 409);
    const second = await request(path, adminA, { email: "other@example.test", role: "teacher", venueIds: [venueA.id] });
    assert.equal(second.status, 201);
    assert.equal((await request(`${path}/${second.data.invitation.id}`, adminA, undefined, "DELETE")).status, 204);
    const revokedToken = sent[1].text.match(/#token=([^\s]+)/)?.[1];
    assert.equal((await request("/invitations/accept", other, { token: revokedToken })).status, 400);
    const ownerInvite = await request(path, adminA, { email: "new-admin@example.test", role: "admin", venueIds: [] });
    assert.equal(ownerInvite.status, 201);
    const ownerToken = sent[2].text.match(/#token=([^\s]+)/)?.[1];
    assert.equal((await request("/invitations/accept", null, { token: ownerToken })).status, 401);
    const registered = await request("/auth/register", null, { name: "Nueva administradora",
      email: "new-admin@example.test", password: "clave-segura-nueva-123" });
    assert.equal(registered.status, 201);
    const newAdmin = await User.findOne({ email: "new-admin@example.test" });
    assert.equal((await request("/invitations/accept", newAdmin, { token: ownerToken })).status, 200);
    assert.equal((await Membership.findOne({ userId: newAdmin.id, organizationId: clubA.id })).role, "admin");
    assert.equal((await request("/organizations/club-a/admin/staff", newAdmin, undefined, "GET")).status, 200);
    assert.equal((await request("/organizations/club-b/admin/staff", newAdmin, undefined, "GET")).status, 404);
    assert.equal((await request(path, adminA, { email: "fail@example.test", role: "teacher",
      venueIds: [venueA.id] })).status, 503);
    assert.equal(await Invitation.countDocuments({ organizationId: clubA.id, email: "fail@example.test" }), 0);
    const raceUser = await User.create({ name: "Recepción simultánea", email: "race@example.test", passwordHash: "qa", role: "player" });
    assert.equal((await request(path, adminA, { email: "race@example.test", role: "receptionist",
      venueIds: [venueA.id] })).status, 201);
    const raceToken = sent.at(-1).text.match(/#token=([^\s]+)/)?.[1];
    const attempts = await Promise.all([request("/invitations/accept", raceUser, { token: raceToken }),
      request("/invitations/accept", raceUser, { token: raceToken })]);
    assert.deepEqual(attempts.map((attempt) => attempt.status).sort(), [200, 400]);
    assert.equal(await Membership.countDocuments({ userId: raceUser.id, organizationId: clubA.id }), 1);
  } finally {
    if (api) await new Promise((resolve) => api.close(resolve));
    await mongoose.disconnect();
    await mongo.stop();
    await new Promise((resolve) => mailServer.close(resolve));
  }
});
