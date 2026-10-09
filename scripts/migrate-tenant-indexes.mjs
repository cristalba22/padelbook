import "dotenv/config";
import mongoose from "mongoose";
import { migrateTenantIndexes } from "./migrate-tenant-indexes-lib.mjs";

const values = process.argv.slice(2);
const argument = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : ""; };
const dbName = argument("--target-db");
const apply = values.includes("--apply");
if (!process.env.MONGODB_URI || !dbName || !/^[a-zA-Z0-9_-]{3,64}$/.test(dbName)) {
  throw new Error("Se requieren MONGODB_URI y --target-db válido.");
}
if (apply && argument("--confirm-db") !== dbName) {
  throw new Error("Para modificar índices, pasá --apply y --confirm-db con el nombre exacto de la base.");
}
if (apply && dbName === String(process.env.MONGODB_DB_NAME || "padelbook") && !values.includes("--allow-production")) {
  throw new Error("La base de la API está protegida. Ensayá primero con una copia y verificá el backup.");
}
const client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  console.log(JSON.stringify(await migrateTenantIndexes(client.db(dbName), { dryRun: !apply }), null, 2));
} finally {
  await client.close();
}
