import "dotenv/config";
import mongoose from "mongoose";
import { migrateLegacyClub } from "./migrate-legacy-club-lib.mjs";

const values = process.argv.slice(2);
const argument = (name) => { const index = values.indexOf(name); return index >= 0 ? values[index + 1] : ""; };
const dbName = argument("--target-db");
const confirmDb = argument("--confirm-db");
const apply = values.includes("--apply");
if (!process.env.MONGODB_URI || !dbName || !/^[a-zA-Z0-9_-]{3,64}$/.test(dbName)) {
  throw new Error("Se requieren MONGODB_URI y --target-db válido.");
}
if (apply && confirmDb !== dbName) {
  throw new Error("Para escribir datos, pasá --apply y --confirm-db con el nombre exacto de la base.");
}
if (apply && dbName === String(process.env.MONGODB_DB_NAME || "padelbook") && !values.includes("--allow-production")) {
  throw new Error("La base configurada para la API está protegida. Probá primero con una copia y usá --allow-production solo en la ventana de migración aprobada.");
}
const client = new mongoose.mongo.MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const result = await migrateLegacyClub(client.db(dbName), {
    organizationSlug: argument("--organization-slug"),
    organizationName: argument("--organization-name"),
    venueSlug: argument("--venue-slug"),
    venueName: argument("--venue-name"),
    dryRun: !apply,
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await client.close();
}
