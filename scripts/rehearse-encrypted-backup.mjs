import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { parseEncryptionKey, readBackupFile } from "./backup-lib.mjs";
import { rehearseMulticlub, rehearseRollback } from "./rehearse-multiclub-lib.mjs";
import { smokeRestoredPilot } from "./smoke-restored-pilot.mjs";

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; };
const input = value("--input");
const output = value("--report");
const migration = {
  organizationSlug: value("--organization-slug"), organizationName: value("--organization-name"),
  venueSlug: value("--venue-slug"), venueName: value("--venue-name"),
};
if (!input || !output || Object.values(migration).some((item) => !item)) {
  throw new Error("Se requieren --input, --report y los nombres y slugs de organización y sede.");
}

// El respaldo se descifra únicamente en memoria del runner. Nunca usa el URI de Atlas.
const payload = await readBackupFile({ input: resolve(input), encryptionKey: parseEncryptionKey() });
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
try {
  const report = await rehearseMulticlub({ uri: mongo.getUri(), payload,
    targetDbName: "padelbook_pilot_restore_qa", productionDbName: payload.database, migration });
  const apiSmoke = await smokeRestoredPilot({ uri: mongo.getUri(), dbName: report.targetDatabase,
    organizationSlug: migration.organizationSlug, venueSlug: migration.venueSlug });
  const rollback = await rehearseRollback({ uri: mongo.getUri(), payload,
    targetDbName: "padelbook_pilot_rollback_qa", migratedDbName: report.targetDatabase });
  await writeFile(resolve(output), `${JSON.stringify({ ...report, ...apiSmoke, ...rollback, rehearsedAt: new Date().toISOString() }, null, 2)}\n`);
  console.log(JSON.stringify({ verified: report.verified, sourceDatabase: report.sourceDatabase,
    targetDatabase: report.targetDatabase, collections: report.collections, documents: report.documents,
    memberships: report.memberships, indexesCreated: report.indexesCreated,
    globalIndexesRemoved: report.globalIndexesRemoved, ...apiSmoke, ...rollback }));
} finally {
  await mongo.stop();
}
