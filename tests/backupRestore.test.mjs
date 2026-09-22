import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { createBackupFile, parseEncryptionKey, readBackupFile, restoreBackup } from "../scripts/backup-lib.mjs";

test("backup cifrado se verifica y restaura con documentos e índices", async () => {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const folder = await mkdtemp(join(tmpdir(), "padelbook-backup-"));
  const output = join(folder, "drill.pbk");
  const key = parseEncryptionKey("11".repeat(32));
  const client = new mongoose.mongo.MongoClient(mongo.getUri());
  try {
    await client.connect();
    const source = client.db("padelbook_source");
    await source.collection("bookings").insertMany([{ player: "Ana", at: new Date("2026-09-22T10:00:00Z") }, { player: "Juan", at: new Date("2026-09-22T11:00:00Z") }]);
    await source.collection("bookings").createIndex({ player: 1 }, { unique: true, name: "player_unique" });
    await createBackupFile({ uri: mongo.getUri(), dbName: "padelbook_source", output, encryptionKey: key });
    const payload = await readBackupFile({ input: output, encryptionKey: key });
    assert.equal(payload.collections.find((item) => item.name === "bookings").documents.length, 2);
    const counts = await restoreBackup({ uri: mongo.getUri(), targetDbName: "padelbook_restore_drill", payload });
    assert.equal(counts.bookings, 2);
    const restored = client.db("padelbook_restore_drill");
    assert.equal((await restored.collection("bookings").findOne({ player: "Ana" })).at.toISOString(), "2026-09-22T10:00:00.000Z");
    assert.ok((await restored.collection("bookings").indexes()).some((index) => index.name === "player_unique" && index.unique));
  } finally {
    await client.close();
    await mongo.stop();
    await rm(folder, { recursive: true, force: true });
  }
});
