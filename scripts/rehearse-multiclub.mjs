import "dotenv/config";
import { resolve } from "node:path";
import { parseEncryptionKey, readBackupFile } from "./backup-lib.mjs";
import { rehearseMulticlub } from "./rehearse-multiclub-lib.mjs";

const args = process.argv.slice(2);
const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; };
const input = value("--input");
const targetDbName = value("--target-db");
const migration = {
  organizationSlug: value("--organization-slug"), organizationName: value("--organization-name"),
  venueSlug: value("--venue-slug"), venueName: value("--venue-name"),
};
if (!input || !targetDbName || value("--confirm-db") !== targetDbName ||
    Object.values(migration).some((item) => !item)) {
  throw new Error("Uso: npm run db:rehearse:multiclub -- --input backup.pbk --target-db padelbook_multiclub_qa --confirm-db padelbook_multiclub_qa --organization-slug club-cordoba --organization-name 'Club Córdoba' --venue-slug sede-centro --venue-name 'Sede Centro'");
}
const payload = await readBackupFile({ input: resolve(input), encryptionKey: parseEncryptionKey() });
const report = await rehearseMulticlub({ uri: process.env.MONGODB_URI, payload, targetDbName,
  productionDbName: String(process.env.MONGODB_DB_NAME || "padelbook"), migration });
console.log(JSON.stringify(report, null, 2));
