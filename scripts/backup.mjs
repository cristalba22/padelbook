import "dotenv/config";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createBackupFile, parseEncryptionKey, readBackupFile } from "./backup-lib.mjs";

const values = process.argv.slice(2);
const get = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : ""; };
const dbName = String(process.env.MONGODB_DB_NAME || "padelbook");
const output = resolve(get("--output") || `backups/padelbook-${new Date().toISOString().replace(/[:.]/g, "-")}.pbk`);
if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI.");
const encryptionKey = parseEncryptionKey();

if (values.includes("--verify-only")) {
  const payload = await readBackupFile({ input: resolve(get("--verify-only")), encryptionKey });
  console.log(JSON.stringify({ verified: true, database: payload.database, collections: payload.collections.length, documents: payload.collections.reduce((sum, item) => sum + item.documents.length, 0), createdAt: payload.createdAt }));
} else {
  await mkdir(dirname(output), { recursive: true });
  console.log(JSON.stringify({ ok: true, ...(await createBackupFile({ uri: process.env.MONGODB_URI, dbName, output, encryptionKey })) }));
}
