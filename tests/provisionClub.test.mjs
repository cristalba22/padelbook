import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

test("alta controlada de club crea sede y propietario sin tocar otras organizaciones", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new mongoose.mongo.MongoClient(mongo.getUri());
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB_NAME = "padelbook_provision_qa";
  process.env.PADELBOOK_OPERATING_MODE = "multiclub";
  process.env.JWT_SECRET = "club-provision-test-secret-long-enough-to-be-private";
  try {
    await client.connect();
    const db = client.db(process.env.MONGODB_DB_NAME);
    const ownerId = new mongoose.Types.ObjectId();
    const firstOwnerId = new mongoose.Types.ObjectId();
    const firstOrganizationId = new mongoose.Types.ObjectId();
    const firstVenueId = new mongoose.Types.ObjectId();
    await db.collection("users").insertMany([
      { _id: ownerId, name: "Propietaria", email: "owner@example.test", passwordHash: "test", role: "player", active: true },
      { _id: firstOwnerId, name: "Primer propietario", email: "first@example.test", passwordHash: "test", role: "player", active: true },
    ]);
    await db.collection("organizations").insertOne({ _id: firstOrganizationId, slug: "club-cordoba", name: "Club Córdoba", status: "active" });
    await db.collection("venues").insertOne({ _id: firstVenueId, organizationId: firstOrganizationId,
      slug: "centro", name: "Centro", address: "Córdoba", active: true });
    await db.collection("memberships").insertOne({ userId: firstOwnerId, organizationId: firstOrganizationId,
      role: "admin", venueIds: [firstVenueId], active: true });
    const { provisionClub } = await import("../scripts/provision-club.mjs");
    const input = { organizationSlug: "club-sierras", organizationName: "Club Sierras",
      venueSlug: "sede-norte", venueName: "Sede Norte", venueAddress: "Ruta 1", ownerEmail: "OWNER@example.test" };
    assert.equal((await provisionClub({ ...input, dryRun: true })).ready, true);
    assert.equal(await db.collection("organizations").countDocuments(), 1);
    await assert.rejects(() => provisionClub(input), /Confirmá/);
    assert.equal((await provisionClub({ ...input, confirm: "club-sierras" })).created, true);
    const organization = await db.collection("organizations").findOne({ slug: "club-sierras" });
    const venue = await db.collection("venues").findOne({ organizationId: organization._id, slug: "sede-norte" });
    assert.equal(venue.address, "Ruta 1");
    assert.equal(await db.collection("settings").countDocuments({ organizationId: organization._id, venueId: venue._id }), 1);
    assert.equal((await db.collection("memberships").findOne({ organizationId: organization._id, userId: ownerId })).role, "admin");
    assert.equal(await db.collection("memberships").countDocuments({ organizationId: firstOrganizationId }), 1);
    assert.equal(await db.collection("memberships").countDocuments({ organizationId: organization._id, userId: firstOwnerId }), 0);
    assert.equal((await db.collection("venues").findOne({ _id: firstVenueId })).address, "Córdoba");
    await assert.rejects(() => provisionClub({ ...input, confirm: "club-sierras" }), /ya existe/);
    assert.equal(await db.collection("organizations").countDocuments(), 2);
  } finally {
    await client.close();
    await mongo.stop();
  }
});
