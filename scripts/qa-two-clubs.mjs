import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { migrateTenantIndexes } from "./migrate-tenant-indexes-lib.mjs";

if (process.env.NODE_ENV === "production") throw new Error("Este servidor de QA no funciona en producción.");
const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
process.env.MONGODB_URI = mongo.getUri();
process.env.MONGODB_DB_NAME = "padelbook_two_clubs_qa";
process.env.JWT_SECRET = "qa-two-clubs-only-never-use-this-secret-in-production";
process.env.PADELBOOK_OPERATING_MODE = "multiclub";
process.env.CLIENT_ORIGIN = "http://127.0.0.1:5173";
process.env.PUBLIC_APP_ORIGIN = process.env.CLIENT_ORIGIN;
const client = new mongoose.mongo.MongoClient(mongo.getUri());
let server;
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME);
  const oid = () => new mongoose.Types.ObjectId();
  const orgA = oid(), orgB = oid(), venueA = oid(), venueA2 = oid(), venueB = oid();
  const [adminA, receptionA, player, adminB] = [oid(), oid(), oid(), oid()];
  await db.collection("organizations").insertMany([
    { _id: orgA, slug: "club-cordoba", name: "Club Córdoba", status: "active" },
    { _id: orgB, slug: "club-sierras", name: "Club Sierras", status: "active" },
  ]);
  await db.collection("venues").insertMany([
    { _id: venueA, organizationId: orgA, slug: "centro", name: "Centro", address: "Centro, Córdoba", active: true },
    { _id: venueA2, organizationId: orgA, slug: "norte", name: "Norte", address: "Zona norte, Córdoba", active: true },
    { _id: venueB, organizationId: orgB, slug: "villa-allende", name: "Villa Allende", address: "Villa Allende, Córdoba", active: true },
  ]);
  await db.collection("courts").insertMany([
    { organizationId: orgA, venueId: venueA, courtId: "court1", name: "Cancha Centro", active: true, basePrice: 18000, nightPrice: 24000 },
    { organizationId: orgA, venueId: venueA2, courtId: "court1", name: "Cancha Norte", active: true, basePrice: 21000, nightPrice: 27000 },
    { organizationId: orgB, venueId: venueB, courtId: "court1", name: "Cancha Sierras", active: true, basePrice: 25000, nightPrice: 30000 },
  ]);
  await db.collection("settings").insertMany([
    { organizationId: orgA, venueId: venueA, clubName: "Club Córdoba · Centro", address: "Centro, Córdoba" },
    { organizationId: orgA, venueId: venueA2, clubName: "Club Córdoba · Norte", address: "Zona norte, Córdoba" },
    { organizationId: orgB, venueId: venueB, clubName: "Club Sierras · Villa Allende", address: "Villa Allende, Córdoba" },
  ]);
  const passwordHash = await bcrypt.hash("PadelQa2026!", 12);
  await db.collection("users").insertMany([
    { _id: adminA, name: "Dueño Córdoba", email: "dueno-cordoba@qa.invalid", passwordHash, role: "player", active: true },
    { _id: receptionA, name: "Recepción Centro", email: "recepcion-centro@qa.invalid", passwordHash, role: "player", active: true },
    { _id: player, name: "Jugador QA", email: "jugador@qa.invalid", passwordHash, role: "player", active: true },
    { _id: adminB, name: "Dueña Sierras", email: "duena-sierras@qa.invalid", passwordHash, role: "player", active: true },
  ]);
  await db.collection("memberships").insertMany([
    { userId: adminA, organizationId: orgA, role: "admin", venueIds: [venueA, venueA2], active: true },
    { userId: receptionA, organizationId: orgA, role: "receptionist", venueIds: [venueA], active: true },
    { userId: player, organizationId: orgA, role: "player", venueIds: [], active: true },
    { userId: player, organizationId: orgB, role: "player", venueIds: [], active: true },
    { userId: adminB, organizationId: orgB, role: "admin", venueIds: [venueB], active: true },
  ]);
  await migrateTenantIndexes(db, { dryRun: false });
  const [{ connectDb }, { app }] = await Promise.all([import("../server/db.mjs"), import("../server/index.mjs")]);
  await connectDb();
  server = app.listen(4000, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  console.log("QA multiclub listo en http://127.0.0.1:4000/api (MongoDB temporal; contraseña de prueba: PadelQa2026!)");
  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  await client.close();
  await mongo.stop();
}
