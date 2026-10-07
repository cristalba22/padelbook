import mongoose from "mongoose";
import { Setting, Venue, addActivity } from "./db.mjs";
import { parseSettingsPatch } from "./settingsInput.mjs";
import { venueScope } from "./tenantAccess.mjs";

export async function updateVenueSettings(req, res) {
  const patch = parseSettingsPatch(req.body);
  if (!patch) return res.status(400).json({ message: "Datos de configuración inválidos." });
  const context = req.venueContext;
  const session = await mongoose.startSession();
  let settings;
  try {
    settings = await session.withTransaction(async () => {
      const updated = await Setting.findOneAndUpdate(venueScope(context), { $set: patch },
        { returnDocument: "after", upsert: true, setDefaultsOnInsert: true, session });
      if (patch.address !== undefined) {
        const result = await Venue.updateOne({ _id: context.venueId, organizationId: context.organizationId }, { $set: { address: patch.address } }, { session });
        if (result.matchedCount !== 1) throw new Error("La sede dejó de estar disponible.");
      }
      return updated;
    });
  } finally {
    await session.endSession();
  }
  try {
    await addActivity({ organizationId: context.organizationId, venueId: context.venueId, type: "settings_updated",
      title: "Configuración actualizada", detail: "Ajustes de la sede", actor: req.user.name });
  } catch {
    console.error("VenueSettingsActivityError");
  }
  const item = settings.toJSON();
  delete item.organizationId;
  delete item.venueId;
  res.json({ settings: item });
}
