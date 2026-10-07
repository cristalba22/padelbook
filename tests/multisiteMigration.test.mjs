import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { migrateLegacyClub } from "../scripts/migrate-legacy-club-lib.mjs";

const options = {
  organizationSlug: "club-cordoba",
  organizationName: "Club Córdoba",
  venueSlug: "sede-centro",
  venueName: "Sede Centro",
};

test("la migración multisedes conserva datos, se puede repetir y se detiene ante otro club", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new mongoose.mongo.MongoClient(mongo.getUri());
  try {
    await client.connect();
    const db = client.db("padelbook_multisite_qa");
    const userId = new mongoose.Types.ObjectId();
    await db.collection("users").insertOne({ _id: userId, name: "Dueña", role: "admin" });
    await db.collection("settings").insertOne({ clubName: "Club Córdoba", courtPrice: 18000 });
    await db.collection("courts").insertOne({ courtId: "court1", name: "Cancha 1" });
    const bookingId = new mongoose.Types.ObjectId();
    await db.collection("bookings").insertOne({ _id: bookingId, date: "2026-10-14", time: "19:00", courtId: "court1", price: 24000, amountPaid: 10000 });
    await db.collection("slotclaims").insertOne({ date: "2026-10-14", courtId: "court1", slot: 1140, ownerType: "booking", ownerId: String(bookingId) });

    const preview = await migrateLegacyClub(db, options);
    assert.equal(preview.dryRun, true);
    assert.equal(preview.collections.bookings.unscoped, 1);
    assert.equal(await db.collection("organizations").countDocuments(), 0);
    assert.equal(await db.collection("bookings").countDocuments({ organizationId: { $exists: true } }), 0);

    const first = await migrateLegacyClub(db, { ...options, dryRun: false });
    assert.equal(first.migrated, true);
    const booking = await db.collection("bookings").findOne({ _id: bookingId });
    assert.equal(booking.amountPaid, 10000);
    assert.equal(String(booking.organizationId), first.organizationId);
    assert.equal(String(booking.venueId), first.venueId);
    assert.equal((await db.collection("settings").findOne()).clubName, "Club Córdoba");
    assert.equal(await db.collection("memberships").countDocuments({ userId, role: "admin" }), 1);
    assert.ok((await db.collection("slotclaims").indexes()).some((index) => index.name === "venue_slot_unique" && index.unique));

    const second = await migrateLegacyClub(db, { ...options, dryRun: false });
    assert.equal(second.organizationId, first.organizationId);
    assert.equal(second.venueId, first.venueId);
    assert.equal(second.collections.bookings.unscoped, 0);
    assert.equal(await db.collection("memberships").countDocuments(), 1);
    assert.equal(await db.collection("organizations").countDocuments(), 1);
    assert.equal(await db.collection("venues").countDocuments(), 1);

    await db.collection("organizations").insertOne({ slug: "otro-club", name: "Otro club" });
    await assert.rejects(() => migrateLegacyClub(db, { ...options, dryRun: false }), /otras organizaciones/);
    assert.equal(await db.collection("bookings").countDocuments(), 1);
  } finally {
    await client.close();
    await mongo.stop();
  }
});
