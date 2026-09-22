import "dotenv/config";
import { resolve } from "node:path";
import { parseEncryptionKey, readBackupFile, restoreBackup } from "./backup-lib.mjs";

const values = process.argv.slice(2);
const get = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : ""; };
const input = get("--input");
const targetDbName = get("--target-db");
const productionDb = String(process.env.MONGODB_DB_NAME || "padelbook");
if (!input || !targetDbName) throw new Error("Uso: npm run db:restore -- --input backup.pbk --target-db padelbook_restore_drill");
if (!process.env.MONGODB_URI) throw new Error("Falta MONGODB_URI.");
if (targetDbName === productionDb && (!values.includes("--allow-production") || process.env.RESTORE_CONFIRM_DATABASE !== productionDb)) throw new Error("Restauración sobre producción bloqueada. Usá --allow-production y RESTORE_CONFIRM_DATABASE con el nombre exacto.");
const payload = await readBackupFile({ input: resolve(input), encryptionKey: parseEncryptionKey() });
const counts = await restoreBackup({ uri: process.env.MONGODB_URI, targetDbName, payload });
console.log(JSON.stringify({ restored: true, sourceDatabase: payload.database, targetDatabase: targetDbName, counts }));
