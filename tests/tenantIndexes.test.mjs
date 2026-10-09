import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { migrateTenantIndexes } from "../scripts/migrate-tenant-indexes-lib.mjs";

test("migra índices globales sin perder unicidad dentro de cada sede", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const client = new mongoose.mongo.MongoClient(mongo.getUri());
  try {
    await client.connect();
    const db = client.db("padelbook_tenant_indexes_qa");
    const orgA = new mongoose.Types.ObjectId();
    const venueA = new mongoose.Types.ObjectId();
    const orgB = new mongoose.Types.ObjectId();
    const venueB = new mongoose.Types.ObjectId();
    const venueA2 = new mongoose.Types.ObjectId();
    await db.collection("organizations").insertOne({ _id: orgA, slug: "club-a" });
    await db.collection("venues").insertOne({ _id: venueA, organizationId: orgA, slug: "centro" });

    const courts = db.collection("courts");
    const bookings = db.collection("bookings");
    const blocks = db.collection("scheduleblocks");
    const claims = db.collection("slotclaims");
    const teachers = db.collection("teachers");
    await courts.createIndex({ courtId: 1 }, { unique: true });
    await bookings.createIndex({ date: 1, courtId: 1, occupiedSlots: 1 }, { unique: true,
      partialFilterExpression: { occupiedSlots: { $exists: true }, status: { $in: ["pendiente", "confirmado"] } } });
    await bookings.createIndex({ date: 1, teacherId: 1, occupiedSlots: 1 }, { unique: true,
      partialFilterExpression: { type: "class", status: { $in: ["pendiente", "confirmado"] }, teacherId: { $type: "string" }, occupiedSlots: { $exists: true } } });
    await blocks.createIndex({ date: 1, courtId: 1, hour: 1 }, { unique: true });
    await claims.createIndex({ date: 1, courtId: 1, slot: 1 }, { unique: true });
    await claims.createIndex({ organizationId: 1, venueId: 1, date: 1, courtId: 1, slot: 1 }, { unique: true,
      partialFilterExpression: { organizationId: { $exists: true }, venueId: { $exists: true } }, name: "venue_slot_unique" });
    const scopeA = { organizationId: orgA, venueId: venueA };
    await courts.insertOne({ ...scopeA, courtId: "cancha-1" });
    await bookings.insertOne({ ...scopeA, date: "2026-10-20", courtId: "cancha-1", occupiedSlots: [1140], status: "confirmado" });
    await blocks.insertOne({ ...scopeA, date: "2026-10-20", courtId: "cancha-1", hour: "20:00" });
    await claims.insertOne({ ...scopeA, date: "2026-10-20", courtId: "cancha-1", slot: 1140 });
    await db.collection("activities").insertMany([
      { organizationId: orgA, type: "staff_created", title: "Equipo" },
      { type: "user_registered", title: "Cuenta de la plataforma" },
    ]);

    const unscoped = await db.collection("expenses").insertOne({ concept: "Sin sede" });
    await assert.rejects(() => migrateTenantIndexes(db, { dryRun: false }), /expenses: hay documentos sin organización o sede/);
    assert.ok((await courts.indexes()).some((index) => index.name === "courtId_1"));
    await db.collection("expenses").deleteOne({ _id: unscoped.insertedId });

    const preview = await migrateTenantIndexes(db);
    assert.equal(preview.dryRun, true);
    assert.ok(preview.plannedDrops.includes("courts.courtId_1"));
    assert.ok(preview.plannedCreates.includes("teachers.venue_teacher_user_unique"));
    assert.ok((await courts.indexes()).some((index) => index.name === "courtId_1"));
    const applied = await migrateTenantIndexes(db, { dryRun: false });
    assert.equal(applied.removed.length, 5);
    assert.equal((await migrateTenantIndexes(db, { dryRun: false })).removed.length, 0);
    assert.ok(!(await courts.indexes()).some((index) => index.name === "courtId_1"));

    await db.collection("organizations").insertOne({ _id: orgB, slug: "club-b" });
    await db.collection("venues").insertOne({ _id: venueB, organizationId: orgB, slug: "centro" });
    await db.collection("venues").insertOne({ _id: venueA2, organizationId: orgA, slug: "norte" });
    const scopeB = { organizationId: orgB, venueId: venueB };
    const scopeA2 = { organizationId: orgA, venueId: venueA2 };
    await courts.insertOne({ ...scopeA2, courtId: "cancha-1" });
    await bookings.insertOne({ ...scopeA2, date: "2026-10-20", courtId: "cancha-1", occupiedSlots: [1140], status: "confirmado" });
    await blocks.insertOne({ ...scopeA2, date: "2026-10-20", courtId: "cancha-1", hour: "20:00" });
    await claims.insertOne({ ...scopeA2, date: "2026-10-20", courtId: "cancha-1", slot: 1140 });
    await courts.insertOne({ ...scopeB, courtId: "cancha-1" });
    await bookings.insertOne({ ...scopeB, date: "2026-10-20", courtId: "cancha-1", occupiedSlots: [1140], status: "confirmado" });
    await blocks.insertOne({ ...scopeB, date: "2026-10-20", courtId: "cancha-1", hour: "20:00" });
    await claims.insertOne({ ...scopeB, date: "2026-10-20", courtId: "cancha-1", slot: 1140 });
    await teachers.insertMany([{ ...scopeA, name: "Profe A", userId: "user-1" },
      { ...scopeA2, name: "Profe Norte", userId: "user-1" },
      { ...scopeB, name: "Profe B", userId: "user-1" },
      { ...scopeA, name: "Perfil sin cuenta", userId: "" }]);
    await assert.rejects(() => teachers.insertOne({ ...scopeA, name: "Duplicado", userId: "user-1" }), { code: 11000 });
    await bookings.insertOne({ ...scopeA, date: "2026-10-20", courtId: "clase-a", teacherId: "profe-1", type: "class", occupiedSlots: [1080], status: "confirmado" });
    await bookings.insertOne({ ...scopeB, date: "2026-10-20", courtId: "clase-b", teacherId: "profe-1", type: "class", occupiedSlots: [1080], status: "confirmado" });
    await assert.rejects(() => courts.insertOne({ ...scopeB, courtId: "cancha-1" }), { code: 11000 });
    await assert.rejects(() => bookings.insertOne({ ...scopeB, date: "2026-10-20", courtId: "cancha-1", occupiedSlots: [1140], status: "pendiente" }), { code: 11000 });
    await assert.rejects(() => bookings.insertOne({ ...scopeB, date: "2026-10-20", courtId: "clase-c", teacherId: "profe-1", type: "class", occupiedSlots: [1080], status: "pendiente" }), { code: 11000 });
    await assert.rejects(() => blocks.insertOne({ ...scopeB, date: "2026-10-20", courtId: "cancha-1", hour: "20:00" }), { code: 11000 });
    await assert.rejects(() => claims.insertOne({ ...scopeB, date: "2026-10-20", courtId: "cancha-1", slot: 1140 }), { code: 11000 });
  } finally {
    await client.close();
    await mongo.stop();
  }
});
