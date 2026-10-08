import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createBackupFile, readBackupFile } from "../scripts/backup-lib.mjs";
import { rehearseMulticlub } from "../scripts/rehearse-multiclub-lib.mjs";

const migration = { organizationSlug: "club-cordoba", organizationName: "Club Córdoba",
  venueSlug: "sede-centro", venueName: "Sede Centro" };

test("ensayo integral: backup, restauración, datos conservados y migración aislada", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const folder = await mkdtemp(join(tmpdir(), "padelbook-multiclub-drill-"));
  const client = new mongoose.mongo.MongoClient(mongo.getUri());
  try {
    await client.connect();
    const source = client.db("padelbook_pilot_source");
    const userId = new mongoose.Types.ObjectId();
    const bookingId = new mongoose.Types.ObjectId();
    await source.collection("users").insertOne({ _id: userId, email: "owner@example.test", role: "admin", passwordHash: "test-only" });
    await source.collection("settings").insertOne({ clubName: "Club Córdoba", openingHour: "09:00" });
    await source.collection("courts").insertOne({ courtId: "court1", name: "Cancha 1", price: 21000 });
    await source.collection("bookings").insertOne({ _id: bookingId, date: "2026-10-14", courtId: "court1",
      occupiedSlots: [1140, 1170], status: "confirmado", price: 42000, amountPaid: 12000,
      paymentHistory: [{ amount: 12000, date: new Date("2026-10-01T15:00:00Z") }] });
    await source.collection("slotclaims").insertMany([1140, 1170].map((slot) => ({ date: "2026-10-14", courtId: "court1", slot, ownerId: bookingId })));
    await source.collection("expenses").insertOne({ concept: "Pelotas", amount: 8000 });
    await source.collection("activities").insertOne({ type: "booking_created", bookingId, title: "Reserva" });
    await source.collection("tournaments").insertOne({ name: "Torneo de octubre", price: 12000 });
    await source.collection("teachers").insertOne({ name: "Profesor A", userId: "" });
    await source.collection("scheduleblocks").insertOne({ date: "2026-10-15", courtId: "court1", hour: "10:00" });
    await source.collection("courts").createIndex({ courtId: 1 }, { unique: true });
    await source.collection("slotclaims").createIndex({ date: 1, courtId: 1, slot: 1 }, { unique: true });
    const output = join(folder, "pilot.pbk");
    const encryptionKey = randomBytes(32);
    await createBackupFile({ uri: mongo.getUri(), dbName: source.databaseName, output, encryptionKey });
    const payload = await readBackupFile({ input: output, encryptionKey });

    await assert.rejects(() => rehearseMulticlub({ uri: mongo.getUri(), payload,
      targetDbName: source.databaseName, productionDbName: source.databaseName, migration }), /distinta/);
    const existing = client.db("padelbook_occupied_qa");
    await existing.collection("sentinel").insertOne({ keep: true });
    await assert.rejects(() => rehearseMulticlub({ uri: mongo.getUri(), payload,
      targetDbName: "padelbook_occupied_qa", productionDbName: source.databaseName, migration }), /ya contiene/);
    assert.equal(await existing.collection("sentinel").countDocuments(), 1);

    const report = await rehearseMulticlub({ uri: mongo.getUri(), payload,
      targetDbName: "padelbook_multiclub_qa", productionDbName: source.databaseName, migration });
    assert.equal(report.verified, true);
    assert.equal(report.counts.bookings, 1);
    assert.equal(report.counts.slotclaims, 2);
    assert.equal(report.memberships, 1);
    assert.ok(report.globalIndexesRemoved >= 2);
    const restored = client.db(report.targetDatabase);
    assert.equal((await restored.collection("bookings").findOne({ _id: bookingId })).amountPaid, 12000);
    assert.equal(await source.collection("organizations").countDocuments(), 0);
    assert.equal(await source.collection("bookings").countDocuments({ organizationId: { $exists: true } }), 0);
  } finally {
    await client.close();
    await mongo.stop();
    await rm(folder, { recursive: true, force: true });
  }
});
