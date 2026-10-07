import { Membership, Organization, Venue } from "./db.mjs";

export async function listMyOrganizations(req, res) {
  const memberships = await Membership.find({ userId: req.user.id, active: true }).lean();
  if (!memberships.length) return res.json({ organizations: [] });
  const organizations = await Organization.find({ _id: { $in: memberships.map((item) => item.organizationId) }, status: "active" })
    .select("slug name").lean();
  const venues = await Venue.find({ organizationId: { $in: organizations.map((item) => item._id) }, active: true })
    .select("organizationId slug name address").sort({ name: 1 }).lean();
  const venuesByOrg = new Map();
  for (const venue of venues) {
    const key = String(venue.organizationId);
    venuesByOrg.set(key, [...(venuesByOrg.get(key) || []), venue]);
  }
  const byOrg = new Map(organizations.map((organization) => [String(organization._id), organization]));
  const result = memberships.flatMap((membership) => {
    const organization = byOrg.get(String(membership.organizationId));
    if (!organization) return [];
    const permittedVenues = (venuesByOrg.get(String(organization._id)) || [])
      .filter((venue) => membership.role === "admin" || membership.role === "player"
        || membership.venueIds.some((id) => String(id) === String(venue._id)));
    return [{ slug: organization.slug, name: organization.name, role: membership.role,
      venues: permittedVenues.map((venue) => ({ id: String(venue._id), slug: venue.slug,
        name: venue.name, address: venue.address })) }];
  });
  res.json({ organizations: result.sort((left, right) => left.name.localeCompare(right.name, "es")) });
}
