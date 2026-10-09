import { Membership, Organization, Venue } from "./db.mjs";

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function resolveVenue(organizationSlug, venueSlug) {
  if (![organizationSlug, venueSlug].every((slug) => typeof slug === "string" && slug.length <= 63 && SLUG.test(slug))) return null;
  const organization = await Organization.findOne({ slug: organizationSlug, status: "active" }).lean();
  if (!organization) return null;
  const venue = await Venue.findOne({ organizationId: organization._id, slug: venueSlug, active: true }).lean();
  if (!venue) return null;
  return { organizationId: organization._id, venueId: venue._id, organization, venue };
}

export async function membershipForVenue(userId, context) {
  if (!userId || !context?.organizationId || !context?.venueId) return null;
  const membership = await Membership.findOne({ userId, organizationId: context.organizationId, active: true }).lean();
  if (!membership) return null;
  if (membership.role === "admin" || membership.role === "player") return membership;
  return membership.venueIds?.some((id) => String(id) === String(context.venueId)) ? membership : null;
}

export function venueScope(context, filter = {}) {
  if (!context?.organizationId || !context?.venueId) throw new Error("Falta el contexto de sede validado.");
  return { ...filter, organizationId: context.organizationId, venueId: context.venueId };
}

export async function requireVenueContext(req, res, next) {
  const context = await resolveVenue(req.params.organizationSlug, req.params.venueSlug);
  if (!context) return res.status(404).json({ message: "Sede no encontrada." });
  req.venueContext = context;
  next();
}

export function requireVenueRole(...roles) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Necesitás iniciar sesión." });
    const membership = await membershipForVenue(req.user.id, req.venueContext);
    if (!membership || !roles.includes(membership.role)) return res.status(403).json({ message: "No tenés permisos para esta sede." });
    req.venueMembership = membership;
    next();
  };
}
