import "dotenv/config";
import mongoose from "mongoose";
import { pathToFileURL } from "node:url";
import { MONGODB_DB_NAME, MONGODB_URI, PADELBOOK_OPERATING_MODE } from "../server/config.mjs";
import { Membership, Organization, Setting, User, Venue } from "../server/db.mjs";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function provisionClub({ organizationSlug, organizationName, venueSlug, venueName,
  venueAddress = "", ownerEmail, confirm = "", dryRun = false }) {
  if (PADELBOOK_OPERATING_MODE !== "multiclub") throw new Error("El alta exige PADELBOOK_OPERATING_MODE=multiclub.");
  if (!MONGODB_URI) throw new Error("Falta MONGODB_URI.");
  if (![organizationSlug, venueSlug].every((slug) => slugPattern.test(slug || "") && slug.length <= 63) ||
    !organizationName?.trim() || organizationName.length > 100 || !venueName?.trim() || venueName.length > 100 ||
    venueAddress.length > 200 || !emailPattern.test(ownerEmail || "")) throw new Error("Datos de alta inválidos.");
  if (!dryRun && confirm !== organizationSlug) throw new Error("Confirmá con --confirm y el slug exacto del club.");
  await mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB_NAME, serverSelectionTimeoutMS: 10000 });
  try {
    const email = ownerEmail.trim().toLowerCase();
    const owner = await User.findOne({ email, active: true }).select("_id").lean();
    if (!owner) throw new Error("El propietario debe registrar primero su cuenta activa con ese email.");
    if (await Organization.exists({ slug: organizationSlug })) throw new Error("El slug del club ya existe.");
    if (dryRun) return { ready: true, organizationSlug, venueSlug, ownerAccountFound: true };
    await Promise.all([Organization.init(), Venue.init(), Membership.init(), Setting.init()]);
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        const [organization] = await Organization.create([{ slug: organizationSlug, name: organizationName.trim(), status: "active" }], { session });
        const [venue] = await Venue.create([{ organizationId: organization._id, slug: venueSlug,
          name: venueName.trim(), address: venueAddress.trim() }], { session });
        await Setting.create([{ organizationId: organization._id, venueId: venue._id,
          clubName: venueName.trim(), address: venueAddress.trim() }], { session });
        await Membership.create([{ userId: owner._id, organizationId: organization._id,
          role: "admin", venueIds: [], active: true }], { session });
      });
    } finally { await session.endSession(); }
    return { created: true, organizationSlug, venueSlug, ownerAccountFound: true };
  } finally { await mongoose.disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const value = (name) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : ""; };
  const result = await provisionClub({
    organizationSlug: value("--organization-slug"), organizationName: value("--organization-name"),
    venueSlug: value("--venue-slug"), venueName: value("--venue-name"), venueAddress: value("--venue-address"),
    ownerEmail: value("--owner-email"), confirm: value("--confirm"), dryRun: args.includes("--dry-run"),
  });
  console.log(JSON.stringify(result));
}
