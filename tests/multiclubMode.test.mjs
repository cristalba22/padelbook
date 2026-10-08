import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { migrateTenantIndexes, assertTenantIndexesReady } from "../scripts/migrate-tenant-indexes-lib.mjs";

test("el modo multiclub abre rutas acotadas y cierra la API heredada", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "padelbook_multiclub_mode_qa";
  process.env.JWT_SECRET = "multiclub-mode-test-secret-long-enough-to-be-private";
  process.env.PADELBOOK_OPERATING_MODE = "multiclub";
  const client = new mongoose.mongo.MongoClient(mongo.getUri());
  let server;
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME);
    const orgA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();
    const venueA = new mongoose.Types.ObjectId();
    const venueB = new mongoose.Types.ObjectId();
    const userId = new mongoose.Types.ObjectId();
    await db.collection("organizations").insertMany([{ _id: orgA, slug: "club-a", name: "Club A", status: "active" },
      { _id: orgB, slug: "club-b", name: "Club B", status: "active" }]);
    await db.collection("venues").insertMany([{ _id: venueA, organizationId: orgA, slug: "centro", name: "Centro A", active: true },
      { _id: venueB, organizationId: orgB, slug: "centro", name: "Centro B", active: true }]);
    await db.collection("courts").insertMany([{ organizationId: orgA, venueId: venueA, courtId: "cancha-1", name: "Cancha A" },
      { organizationId: orgB, venueId: venueB, courtId: "cancha-1", name: "Cancha B" }]);
    await db.collection("users").insertOne({ _id: userId, name: "Dueña A", email: "duena-a@test.local",
      passwordHash: await bcrypt.hash("clave-segura-12345", 12), role: "player", active: true });
    await db.collection("memberships").insertOne({ userId, organizationId: orgA, role: "admin", venueIds: [venueA], active: true });
    await assert.rejects(() => assertTenantIndexesReady(db), /falta verificar el índice por sede/);
    await migrateTenantIndexes(db, { dryRun: false });
    await assertTenantIndexesReady(db);

    const [{ connectDb, User }, { app }] = await Promise.all([import("../server/db.mjs"), import("../server/index.mjs")]);
    await connectDb();
    assert.equal(await User.countDocuments(), 1);
    server = app.listen(0);
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const health = await fetch(`${base}/health`).then((response) => response.json());
    assert.equal(health.mode, "multiclub");
    for (const path of ["/courts", "/settings", "/bookings", "/admin/staff", "/finance/summary"]) {
      assert.equal((await fetch(`${base}${path}`)).status, 404, path);
    }
    const courtsA = await fetch(`${base}/venues/club-a/centro/courts`).then((response) => response.json());
    const courtsB = await fetch(`${base}/venues/club-b/centro/courts`).then((response) => response.json());
    assert.deepEqual(courtsA.courts.map((item) => item.name), ["Cancha A"]);
    assert.deepEqual(courtsB.courts.map((item) => item.name), ["Cancha B"]);
    const login = await fetch(`${base}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "duena-a@test.local", password: "clave-segura-12345" }) });
    assert.equal(login.status, 200);
    const { token } = await login.json();
    const headers = { Authorization: `Bearer ${token}` };
    const portfolio = await fetch(`${base}/auth/organizations`, { headers }).then((response) => response.json());
    assert.deepEqual(portfolio.organizations.map((item) => item.slug), ["club-a"]);
    assert.equal((await fetch(`${base}/organizations/club-b/admin/staff`, { headers })).status, 404);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await client.close();
    await mongo.stop();
    delete process.env.PADELBOOK_OPERATING_MODE;
  }
});
