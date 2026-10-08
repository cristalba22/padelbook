import { isDeepStrictEqual } from "node:util";
import mongoose from "mongoose";
import { EJSON } from "bson";
import { restoreBackup } from "./backup-lib.mjs";
import { migrateLegacyClub } from "./migrate-legacy-club-lib.mjs";
import { assertTenantIndexesReady, migrateTenantIndexes } from "./migrate-tenant-indexes-lib.mjs";

const validDbName = (name) => /^padelbook_[A-Za-z0-9_-]{1,50}_qa$/.test(name || "");

async function verifyDocuments(db, payload, { verifyIndexes = true } = {}) {
  const counts = {};
  for (const { name, documents, indexes = [] } of payload.collections) {
    const collection = db.collection(name);
    const actual = await collection.find({}).toArray();
    counts[name] = actual.length;
    if (actual.length !== documents.length) throw new Error(`${name}: cambió la cantidad de documentos.`);
    const byId = new Map(actual.map((document) => [String(document._id), document]));
    for (const original of documents) {
      const restored = byId.get(String(original._id));
      if (!restored || !isDeepStrictEqual(
        EJSON.serialize(Object.fromEntries(Object.keys(original).map((key) => [key, restored[key]])), { relaxed: false }),
        EJSON.serialize(original, { relaxed: false }),
      )) throw new Error(`${name}: un documento original cambió o desapareció.`);
    }
    if (verifyIndexes) {
      const actualIndexes = await collection.indexes();
      for (const index of indexes) {
        const found = actualIndexes.find((candidate) => candidate.name === index.name);
        if (!found || !isDeepStrictEqual(found.key, index.key) || Boolean(found.unique) !== Boolean(index.unique)) {
          throw new Error(`${name}: no se restauró el índice ${index.name}.`);
        }
      }
    }
  }
  return counts;
}

export async function rehearseMulticlub({ uri, payload, targetDbName, productionDbName, migration }) {
  if (!uri) throw new Error("Falta MONGODB_URI.");
  if (!validDbName(targetDbName) || targetDbName === productionDbName || targetDbName === payload?.database) {
    throw new Error("La base de ensayo debe llamarse padelbook_*_qa y ser distinta de producción y del respaldo.");
  }
  if (!Array.isArray(payload?.collections) || !payload.collections.length) {
    throw new Error("El respaldo no contiene colecciones para ensayar.");
  }
  const client = new mongoose.mongo.MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  await client.connect();
  try {
    const db = client.db(targetDbName);
    const existing = await db.listCollections({}, { nameOnly: true }).toArray();
    if (existing.length) throw new Error(`La base de ensayo ${targetDbName} ya contiene colecciones. Elegí un nombre nuevo.`);
    const restored = await restoreBackup({ uri, targetDbName, payload });
    const before = await verifyDocuments(db, payload);
    if (!isDeepStrictEqual(restored, before)) throw new Error("Los conteos restaurados no coinciden con el respaldo.");
    const preview = await migrateLegacyClub(db, { ...migration, dryRun: true });
    const migrated = await migrateLegacyClub(db, { ...migration, dryRun: false });
    const indexPreview = await migrateTenantIndexes(db, { dryRun: true });
    const indexes = await migrateTenantIndexes(db, { dryRun: false });
    await assertTenantIndexesReady(db);
    const after = await verifyDocuments(db, payload, { verifyIndexes: false });
    if (!isDeepStrictEqual(before, after)) throw new Error("Los conteos cambiaron durante la migración.");
    const organization = await db.collection("organizations").findOne({ slug: migration.organizationSlug });
    const memberships = await db.collection("memberships").countDocuments({ organizationId: organization?._id });
    if (memberships !== preview.users) throw new Error("No se conservaron las membresías de usuarios.");
    return {
      verified: true, sourceDatabase: payload.database, targetDatabase: targetDbName,
      collections: payload.collections.length, documents: Object.values(after).reduce((sum, count) => sum + count, 0),
      counts: after, organizationSlug: migration.organizationSlug, venueSlug: migration.venueSlug,
      users: preview.users, memberships, indexesCreated: indexes.created.length,
      globalIndexesRemoved: indexes.removed.length, plannedIndexes: indexPreview.plannedCreates.length,
      restoredCountsVerified: true,
    };
  } finally {
    await client.close();
  }
}
