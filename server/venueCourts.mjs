import { randomBytes } from "node:crypto";
import { Court, addActivity } from "./db.mjs";
import { courtFields } from "./courtInput.mjs";
import { publicCourt, validCourtSchedule } from "./courtView.mjs";
import { venueScope } from "./tenantAccess.mjs";

async function auditCourt(req, type, title, court) {
  try {
    await addActivity({ organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId,
      type, title, detail: court.name, actor: req.user.name });
  } catch {
    console.error("VenueCourtActivityError");
  }
}

export async function createVenueCourt(req, res) {
  const parsed = courtFields.safeParse(req.body);
  if (!parsed.success || !validCourtSchedule(parsed.data)) {
    return res.status(400).json({ message: "Revisá los datos, horarios y duraciones de la cancha." });
  }
  const court = await Court.create({ ...parsed.data, organizationId: req.venueContext.organizationId, venueId: req.venueContext.venueId,
    courtId: `court-${randomBytes(8).toString("hex")}`,
    allowedDurations: [...new Set(parsed.data.allowedDurations)].sort((a, b) => a - b) });
  await auditCourt(req, "court_created", "Cancha creada", court);
  res.status(201).json({ court: publicCourt(court) });
}

export async function updateVenueCourt(req, res) {
  const parsed = courtFields.partial().safeParse(req.body);
  if (!parsed.success || !Object.keys(parsed.data).length) return res.status(400).json({ message: "Datos de cancha inválidos." });
  const court = await Court.findOne(venueScope(req.venueContext, { courtId: req.params.courtId }));
  if (!court) return res.status(404).json({ message: "Cancha no encontrada." });
  if (!validCourtSchedule({ ...court.toObject(), ...parsed.data })) {
    return res.status(400).json({ message: "El horario de cierre debe ser posterior a la apertura." });
  }
  if (parsed.data.allowedDurations) parsed.data.allowedDurations = [...new Set(parsed.data.allowedDurations)].sort((a, b) => a - b);
  Object.assign(court, parsed.data);
  await court.save();
  await auditCourt(req, "court_updated", "Cancha actualizada", court);
  res.json({ court: publicCourt(court) });
}
