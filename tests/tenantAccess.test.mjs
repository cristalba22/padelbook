import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("el contexto de sede y las membresías aíslan organizaciones; la API anterior rechaza una base compartida", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "padelbook_tenant_access_qa";
  process.env.JWT_SECRET = "tenant-access-test-secret-long-enough-to-be-private";
  const [{ Organization, Venue, Membership, assertLegacySingleVenue, connectDb }, { resolveVenue, membershipForVenue, venueScope }] = await Promise.all([
    import("../server/db.mjs"), import("../server/tenantAccess.mjs"),
  ]);
  try {
    await mongoose.connect(mongo.getUri(), { dbName: process.env.MONGODB_DB_NAME });
    await assertLegacySingleVenue();
    const organizationA = await Organization.create({ slug: "club-a", name: "Club A" });
    const venueA = await Venue.create({ organizationId: organizationA.id, slug: "centro", name: "Centro" });
    await assertLegacySingleVenue();

    const contextA = await resolveVenue("club-a", "centro");
    assert.equal(String(contextA.organizationId), organizationA.id);
    assert.equal(String(contextA.venueId), venueA.id);
    assert.equal(await resolveVenue("club-a", "../../admin"), null);

    const adminId = new mongoose.Types.ObjectId();
    const receptionistId = new mongoose.Types.ObjectId();
    const playerId = new mongoose.Types.ObjectId();
    await Membership.create([
      { userId: adminId, organizationId: organizationA.id, role: "admin", venueIds: [venueA.id] },
      { userId: receptionistId, organizationId: organizationA.id, role: "receptionist", venueIds: [venueA.id] },
      { userId: playerId, organizationId: organizationA.id, role: "player", venueIds: [] },
    ]);
    assert.equal((await membershipForVenue(adminId, contextA)).role, "admin");
    assert.equal((await membershipForVenue(receptionistId, contextA)).role, "receptionist");
    assert.equal((await membershipForVenue(playerId, contextA)).role, "player");
    assert.equal(await membershipForVenue(new mongoose.Types.ObjectId(), contextA), null);

    const organizationB = await Organization.create({ slug: "club-b", name: "Club B" });
    const venueB = await Venue.create({ organizationId: organizationB.id, slug: "centro", name: "Centro B" });
    const contextB = await resolveVenue("club-b", "centro");
    assert.equal(String(contextB.venueId), venueB.id);
    assert.equal(await resolveVenue("club-a", "sede-inexistente"), null);
    assert.equal(await membershipForVenue(adminId, contextB), null);
    assert.equal(await membershipForVenue(receptionistId, contextB), null);
    assert.deepEqual(venueScope(contextA, { date: "2026-10-14", organizationId: organizationB._id, venueId: venueB._id }), {
      date: "2026-10-14", organizationId: organizationA._id, venueId: venueA._id,
    });
    await assert.rejects(() => assertLegacySingleVenue(), /solo admite una organización y una sede/);
    await assert.rejects(() => connectDb(), /solo admite una organización y una sede/);

    await Membership.updateOne({ userId: adminId, organizationId: organizationA.id }, { $set: { active: false } });
    assert.equal(await membershipForVenue(adminId, contextA), null);
  } finally {
    await mongoose.disconnect();
    await mongo.stop();
  }
});
