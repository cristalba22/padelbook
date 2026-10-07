import { ObjectId } from "bson";

const SCOPED_COLLECTIONS = [
  "courts", "bookings", "tournaments", "settings", "activities",
  "expenses", "scheduleblocks", "teachers", "slotclaims",
];

function validSlug(value) {
  return typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 63;
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 120;
}

function missing(field) {
  return { [field]: null };
}

function otherThan(field, id) {
  return { [field]: { $exists: true, $nin: [null, id] } };
}

export async function migrateLegacyClub(db, { organizationSlug, organizationName, venueSlug, venueName, dryRun = true } = {}) {
  if (!validSlug(organizationSlug) || !validSlug(venueSlug) || !nonEmpty(organizationName) || !nonEmpty(venueName)) {
    throw new Error("Nombre o slug de organización/sede inválido.");
  }
  const organizations = db.collection("organizations");
  const venues = db.collection("venues");
  const memberships = db.collection("memberships");
  const existingOrganization = await organizations.findOne({ slug: organizationSlug });
  const foreignOrganizations = await organizations.countDocuments({ slug: { $ne: organizationSlug } });
  if (foreignOrganizations) throw new Error("La base contiene otras organizaciones; esta migración es exclusiva del club heredado.");
  const existingVenue = existingOrganization
    ? await venues.findOne({ organizationId: existingOrganization._id, slug: venueSlug })
    : null;
  if (await venues.countDocuments(existingVenue ? { _id: { $ne: existingVenue._id } } : {})) {
    throw new Error("La base contiene otras sedes; esta migración es exclusiva de la sede heredada.");
  }

  const organizationId = existingOrganization?._id || new ObjectId();
  const venueId = existingVenue?._id || new ObjectId();
  const collectionCounts = {};
  for (const name of SCOPED_COLLECTIONS) {
    const collection = db.collection(name);
    const [total, unscoped, foreignOrganization, foreignVenue] = await Promise.all([
      collection.countDocuments(),
      collection.countDocuments({ $or: [missing("organizationId"), missing("venueId")] }),
      collection.countDocuments(otherThan("organizationId", organizationId)),
      collection.countDocuments(otherThan("venueId", venueId)),
    ]);
    if (foreignOrganization || foreignVenue) throw new Error(`${name}: hay documentos asignados a otra organización o sede.`);
    collectionCounts[name] = { total, unscoped };
  }
  const users = await db.collection("users").find({}, { projection: { _id: 1, role: 1 } }).toArray();
  const unknownRole = users.find((user) => !["admin", "receptionist", "teacher", "player"].includes(user.role));
  if (unknownRole) throw new Error(`El usuario ${unknownRole._id} tiene un rol heredado desconocido.`);
  const missingMemberships = await memberships.countDocuments({ organizationId: { $ne: organizationId } });
  if (missingMemberships) throw new Error("Hay membresías ajenas al club heredado.");
  const report = {
    dryRun,
    organizationSlug,
    venueSlug,
    organizationId: String(organizationId),
    venueId: String(venueId),
    collections: collectionCounts,
    users: users.length,
  };
  if (dryRun) return report;

  await organizations.createIndex({ slug: 1 }, { unique: true });
  await organizations.updateOne({ slug: organizationSlug }, {
    $setOnInsert: { _id: organizationId, slug: organizationSlug, name: organizationName, status: "active", createdAt: new Date(), updatedAt: new Date() },
  }, { upsert: true });
  await venues.createIndex({ organizationId: 1, slug: 1 }, { unique: true });
  await venues.updateOne({ organizationId, slug: venueSlug }, {
    $setOnInsert: { _id: venueId, organizationId, slug: venueSlug, name: venueName, address: "", timeZone: "America/Argentina/Cordoba", active: true, createdAt: new Date(), updatedAt: new Date() },
  }, { upsert: true });

  for (const name of SCOPED_COLLECTIONS) {
    const collection = db.collection(name);
    await collection.updateMany(missing("organizationId"), { $set: { organizationId } });
    await collection.updateMany(missing("venueId"), { $set: { venueId } });
  }

  await memberships.createIndex({ organizationId: 1, userId: 1 }, { unique: true });
  for (const user of users) {
    await memberships.updateOne({ organizationId, userId: user._id }, {
      $setOnInsert: { organizationId, userId: user._id, role: user.role, venueIds: [venueId], active: true, createdAt: new Date(), updatedAt: new Date() },
    }, { upsert: true });
  }

  await db.collection("slotclaims").createIndex(
    { organizationId: 1, venueId: 1, date: 1, courtId: 1, slot: 1 },
    { unique: true, partialFilterExpression: { organizationId: { $exists: true }, venueId: { $exists: true } }, name: "venue_slot_unique" },
  );
  await db.collection("bookings").createIndex({ organizationId: 1, venueId: 1, date: 1, courtId: 1 }, { name: "venue_bookings_by_date" });
  await db.collection("scheduleblocks").createIndex({ organizationId: 1, venueId: 1, date: 1, courtId: 1 }, { name: "venue_blocks_by_date" });
  await db.collection("courts").createIndex({ organizationId: 1, venueId: 1, active: 1 }, { name: "venue_courts" });

  for (const name of SCOPED_COLLECTIONS) {
    const collection = db.collection(name);
    const [after, unscoped] = await Promise.all([
      collection.countDocuments(),
      collection.countDocuments({ $or: [missing("organizationId"), missing("venueId")] }),
    ]);
    if (after !== collectionCounts[name].total || unscoped) throw new Error(`${name}: verificación de migración fallida.`);
  }
  if (await memberships.countDocuments({ organizationId }) !== users.length) {
    throw new Error("La cantidad de membresías no coincide con la de usuarios.");
  }
  return { ...report, dryRun: false, migrated: true };
}
