const activeBooking = { occupiedSlots: { $exists: true }, status: { $in: ["pendiente", "confirmado"] } };
const activeTeacherBooking = { type: "class", status: { $in: ["pendiente", "confirmado"] },
  teacherId: { $type: "string" }, occupiedSlots: { $exists: true } };

const specs = [
  { collection: "organizations", name: "slug_1", key: { slug: 1 } },
  { collection: "venues", name: "organizationId_1_slug_1", key: { organizationId: 1, slug: 1 } },
  { collection: "memberships", name: "organizationId_1_userId_1", key: { organizationId: 1, userId: 1 } },
  { collection: "users", name: "email_1", key: { email: 1 } },
  { collection: "settings", name: "organizationId_1_venueId_1", key: { organizationId: 1, venueId: 1 },
    partialFilterExpression: { organizationId: { $exists: true }, venueId: { $exists: true } } },
  { collection: "courts", name: "venue_court_id_unique", key: { organizationId: 1, venueId: 1, courtId: 1 },
    oldKey: { courtId: 1 } },
  { collection: "teachers", name: "venue_teacher_user_unique", key: { organizationId: 1, venueId: 1, userId: 1 },
    partialFilterExpression: { userId: { $gt: "" } } },
  { collection: "bookings", name: "venue_booking_slot_unique", key: { organizationId: 1, venueId: 1, date: 1, courtId: 1, occupiedSlots: 1 },
    oldKey: { date: 1, courtId: 1, occupiedSlots: 1 }, partialFilterExpression: activeBooking },
  { collection: "bookings", name: "venue_teacher_slot_unique", key: { organizationId: 1, venueId: 1, date: 1, teacherId: 1, occupiedSlots: 1 },
    oldKey: { date: 1, teacherId: 1, occupiedSlots: 1 }, partialFilterExpression: activeTeacherBooking },
  { collection: "scheduleblocks", name: "venue_block_hour_unique", key: { organizationId: 1, venueId: 1, date: 1, courtId: 1, hour: 1 },
    oldKey: { date: 1, courtId: 1, hour: 1 } },
  { collection: "slotclaims", name: "venue_slot_all_unique", key: { organizationId: 1, venueId: 1, date: 1, courtId: 1, slot: 1 },
    oldKey: { date: 1, courtId: 1, slot: 1 } },
];

const scopedCollections = ["courts", "bookings", "tournaments", "settings", "expenses", "scheduleblocks", "teachers", "slotclaims"];
const sameKey = (left, right) => JSON.stringify(left) === JSON.stringify(right);
async function indexesOrEmpty(collection) {
  try { return await collection.indexes(); } catch (error) { if (error.code === 26) return []; throw error; }
}

async function assertScopedData(db) {
  const [organizations, venues] = await Promise.all([
    db.collection("organizations").find({}, { projection: { _id: 1 } }).toArray(),
    db.collection("venues").find({}, { projection: { _id: 1, organizationId: 1 } }).toArray(),
  ]);
  if (!organizations.length || !venues.length) throw new Error("Primero migrá y verificá la organización y sus sedes.");
  const organizationIds = new Set(organizations.map((item) => String(item._id)));
  const venueOrganizations = new Map(venues.map((item) => [String(item._id), String(item.organizationId)]));
  if (venues.some((venue) => !organizationIds.has(String(venue.organizationId)))) {
    throw new Error("Hay sedes sin una organización válida.");
  }
  for (const name of scopedCollections) {
    const collection = db.collection(name);
    const orphan = await collection.findOne({ $or: [{ organizationId: null }, { venueId: null }] }, { projection: { _id: 1 } });
    if (orphan) throw new Error(`${name}: hay documentos sin organización o sede.`);
    const pairs = await collection.aggregate([{ $group: { _id: { organizationId: "$organizationId", venueId: "$venueId" } } }]).toArray();
    if (pairs.some(({ _id }) => venueOrganizations.get(String(_id.venueId)) !== String(_id.organizationId))) {
      throw new Error(`${name}: hay documentos asignados a una sede de otra organización.`);
    }
  }
  const activities = db.collection("activities");
  const unscopedActivity = await activities.findOne({ organizationId: null,
    type: { $nin: ["user_registered", "password_reset"] } }, { projection: { _id: 1 } });
  if (unscopedActivity) throw new Error("activities: hay actividad de club sin organización.");
  const activityPairs = await activities.aggregate([{ $match: { organizationId: { $ne: null } } },
    { $group: { _id: { organizationId: "$organizationId", venueId: "$venueId" } } }]).toArray();
  if (activityPairs.some(({ _id }) => !organizationIds.has(String(_id.organizationId)) ||
    (_id.venueId != null && venueOrganizations.get(String(_id.venueId)) !== String(_id.organizationId)))) {
    throw new Error("activities: hay actividad asignada a otra organización o sede.");
  }
}

export async function migrateTenantIndexes(db, { dryRun = true } = {}) {
  await assertScopedData(db);
  const report = { dryRun, existing: [], plannedCreates: [], plannedDrops: [], created: [], removed: [] };
  for (const spec of specs) {
    const collection = db.collection(spec.collection);
    const before = await indexesOrEmpty(collection);
    const existing = before.find((item) => item.name === spec.name);
    if (existing && (!existing.unique || !sameKey(existing.key, spec.key) ||
      !sameKey(existing.partialFilterExpression || null, spec.partialFilterExpression || null))) {
      throw new Error(`${spec.collection}: el índice ${spec.name} tiene una definición inesperada.`);
    }
    if (existing) report.existing.push(`${spec.collection}.${spec.name}`);
    else {
      if (!dryRun) await collection.createIndex(spec.key, { name: spec.name, unique: true,
        ...(spec.partialFilterExpression ? { partialFilterExpression: spec.partialFilterExpression } : {}) });
      report[dryRun ? "plannedCreates" : "created"].push(`${spec.collection}.${spec.name}`);
    }
    const after = dryRun ? before : await indexesOrEmpty(collection);
    const replacement = after.find((item) => item.name === spec.name);
    if (!dryRun && (!replacement?.unique || !sameKey(replacement.key, spec.key))) {
      throw new Error(`${spec.collection}: no se verificó el índice nuevo ${spec.name}.`);
    }
    const old = spec.oldKey && before.find((item) => item.unique && sameKey(item.key, spec.oldKey));
    if (old) {
      if (!dryRun) await collection.dropIndex(old.name);
      report[dryRun ? "plannedDrops" : "removed"].push(`${spec.collection}.${old.name}`);
    }
  }
  return report;
}

export async function assertTenantIndexesReady(db) {
  await assertScopedData(db);
  for (const spec of specs) {
    const indexes = await indexesOrEmpty(db.collection(spec.collection));
    const current = indexes.find((item) => item.name === spec.name);
    if (!current?.unique || !sameKey(current.key, spec.key) ||
      !sameKey(current.partialFilterExpression || null, spec.partialFilterExpression || null)) {
      throw new Error(`${spec.collection}: falta verificar el índice por sede ${spec.name}.`);
    }
    if (spec.oldKey && indexes.some((item) => item.unique && sameKey(item.key, spec.oldKey))) {
      throw new Error(`${spec.collection}: permanece un índice único global; ejecutá la migración de índices en una copia.`);
    }
  }
}
