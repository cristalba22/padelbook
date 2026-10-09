import { randomBytes } from "node:crypto";
import { access, readFile, writeFile } from "node:fs/promises";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { migrateTenantIndexes } from "./migrate-tenant-indexes-lib.mjs";

const { MongoClient, ObjectId } = mongoose.mongo;

const databaseName = "padelbook_multiclub_staging";
const value = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : ""; };
const uriFile = value("--uri-file");
const uri = uriFile ? (await readFile(uriFile, "utf8")).trim() : "";
const output = value("--credentials-file");
const expectedHost = "cluster0.yl9iyq0.mongodb.net";
if (!uri || !output) throw new Error("El alta exige conexión y archivo privado explícitos.");
const parsed = new URL(uri);
if (parsed.protocol !== "mongodb+srv:" || parsed.hostname !== expectedHost ||
  decodeURIComponent(parsed.username) !== "padelbook_staging") {
  throw new Error("La conexión debe usar el usuario restringido padelbook_staging en Cluster0.");
}
if (!/[/\\]padelbook-staging-credentials\.json$/i.test(output)) {
  throw new Error("El archivo de credenciales debe llamarse padelbook-staging-credentials.json.");
}
try {
  await access(output);
  throw new Error("El archivo de credenciales ya existe; se cancela el alta.");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const accounts = [
  { key: "cordoba", name: "Propietario Córdoba QA", email: "dueno-cordoba@qa.invalid" },
  { key: "sierras", name: "Propietaria Sierras QA", email: "duena-sierras@qa.invalid" },
  { key: "player", name: "Jugador QA", email: "jugador@qa.invalid" },
  { key: "reception", name: "Recepción Centro QA", email: "recepcion-centro@qa.invalid" },
].map((account) => ({ ...account, id: new ObjectId(), password: randomBytes(24).toString("base64url") }));

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
await client.connect();
try {
  const db = client.db(databaseName);
  const existing = await db.listCollections({}, { nameOnly: true }).toArray();
  const counts = await Promise.all(existing.map(async ({ name }) => ({ name, count: await db.collection(name).countDocuments({}) })));
  const nonEmpty = counts.filter(({ count }) => count);
  if (nonEmpty.length) throw new Error(`La base de staging contiene datos (${nonEmpty.map(({ name, count }) => `${name}:${count}`).join(", ")}); se cancela el alta.`);
  const orgCordoba = new ObjectId(), orgSierras = new ObjectId();
  const centro = new ObjectId(), norte = new ObjectId(), villaAllende = new ObjectId();
  const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      await db.collection("organizations").insertMany([
        { _id: orgCordoba, slug: "club-cordoba", name: "Club Córdoba QA", status: "active" },
        { _id: orgSierras, slug: "club-sierras", name: "Club Sierras QA", status: "active" },
      ], { session });
      await db.collection("venues").insertMany([
        { _id: centro, organizationId: orgCordoba, slug: "centro", name: "Centro", address: "Córdoba, Argentina", active: true },
        { _id: norte, organizationId: orgCordoba, slug: "norte", name: "Norte", address: "Córdoba, Argentina", active: true },
        { _id: villaAllende, organizationId: orgSierras, slug: "villa-allende", name: "Villa Allende", address: "Córdoba, Argentina", active: true },
      ], { session });
      await db.collection("settings").insertMany([
        { organizationId: orgCordoba, venueId: centro, clubName: "Club Córdoba QA · Centro" },
        { organizationId: orgCordoba, venueId: norte, clubName: "Club Córdoba QA · Norte" },
        { organizationId: orgSierras, venueId: villaAllende, clubName: "Club Sierras QA · Villa Allende" },
      ], { session });
      await db.collection("courts").insertMany([
        { organizationId: orgCordoba, venueId: centro, courtId: "court1", name: "Cancha Centro", active: true, basePrice: 18000, nightPrice: 24000 },
        { organizationId: orgCordoba, venueId: norte, courtId: "court1", name: "Cancha Norte", active: true, basePrice: 21000, nightPrice: 27000 },
        { organizationId: orgSierras, venueId: villaAllende, courtId: "court1", name: "Cancha Sierras", active: true, basePrice: 25000, nightPrice: 30000 },
      ], { session });
      await db.collection("users").insertMany(await Promise.all(accounts.map(async ({ id, name, email, password }) => ({
        _id: id, name, email, passwordHash: await bcrypt.hash(password, 12), role: "player", active: true, sessionVersion: 0,
      }))), { session });
      const id = (key) => accounts.find((account) => account.key === key).id;
      await db.collection("memberships").insertMany([
        { userId: id("cordoba"), organizationId: orgCordoba, role: "admin", venueIds: [centro, norte], active: true },
        { userId: id("sierras"), organizationId: orgSierras, role: "admin", venueIds: [villaAllende], active: true },
        { userId: id("player"), organizationId: orgCordoba, role: "player", venueIds: [], active: true },
        { userId: id("player"), organizationId: orgSierras, role: "player", venueIds: [], active: true },
        { userId: id("reception"), organizationId: orgCordoba, role: "receptionist", venueIds: [centro], active: true },
      ], { session });
    });
  } finally { await session.endSession(); }
  const indexes = await migrateTenantIndexes(db, { dryRun: false });
  await writeFile(output, JSON.stringify(Object.fromEntries(accounts.map(({ key, email, password }) =>
    [key, { email, password }])), null, 2), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ staging: true, organizations: 2, venues: 3, courts: 3,
    accounts: accounts.length, indexesCreated: indexes.created.length, credentialsFile: output }));
} finally { await client.close(); }
