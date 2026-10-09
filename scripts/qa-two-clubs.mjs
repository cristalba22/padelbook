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
  const orgA = oid(), venueA = oid(), venueA2 = oid();
  const [adminA, receptionA, player, adminB] = [oid(), oid(), oid(), oid()];
  await db.collection("organizations").insertOne(
    { _id: orgA, slug: "club-cordoba", name: "Club Córdoba", status: "active" },
  );
  await db.collection("venues").insertMany([
    { _id: venueA, organizationId: orgA, slug: "centro", name: "Centro", address: "Centro, Córdoba", active: true },
    { _id: venueA2, organizationId: orgA, slug: "norte", name: "Norte", address: "Zona norte, Córdoba", active: true },
  ]);
  await db.collection("courts").insertMany([
    { organizationId: orgA, venueId: venueA, courtId: "court1", name: "Cancha Centro", active: true, basePrice: 18000, nightPrice: 24000 },
    { organizationId: orgA, venueId: venueA2, courtId: "court1", name: "Cancha Norte", active: true, basePrice: 21000, nightPrice: 27000 },
  ]);
  await db.collection("settings").insertMany([
    { organizationId: orgA, venueId: venueA, clubName: "Club Córdoba · Centro", address: "Centro, Córdoba" },
    { organizationId: orgA, venueId: venueA2, clubName: "Club Córdoba · Norte", address: "Zona norte, Córdoba" },
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
  ]);
  const { provisionClub } = await import("./provision-club.mjs");
  const secondClub = { organizationSlug: "club-sierras", organizationName: "Club Sierras",
    venueSlug: "villa-allende", venueName: "Villa Allende", venueAddress: "Villa Allende, Córdoba",
    ownerEmail: "duena-sierras@qa.invalid" };
  if (!(await provisionClub({ ...secondClub, dryRun: true })).ready) throw new Error("El alta del segundo club no pasó la prevalidación.");
  if (!(await provisionClub({ ...secondClub, confirm: secondClub.organizationSlug })).created) throw new Error("No se creó el segundo club.");
  const organizationB = await db.collection("organizations").findOne({ slug: secondClub.organizationSlug });
  const venueB = await db.collection("venues").findOne({ organizationId: organizationB._id, slug: secondClub.venueSlug });
  await db.collection("courts").insertOne({ organizationId: organizationB._id, venueId: venueB._id,
    courtId: "court1", name: "Cancha Sierras", active: true, basePrice: 25000, nightPrice: 30000 });
  await db.collection("memberships").insertOne({ userId: player, organizationId: organizationB._id,
    role: "player", venueIds: [], active: true });
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
