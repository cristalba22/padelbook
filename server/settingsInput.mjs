import { z } from "zod";

const settingsFields = z.object({
  clubName: z.string().trim().min(2).max(120).optional(),
  clubShortName: z.string().trim().min(2).max(40).optional(),
  address: z.string().trim().max(200).optional(),
  mapsQuery: z.string().trim().max(200).optional(),
  whatsapp: z.string().trim().max(40).optional(),
  instagram: z.string().trim().max(80).optional(),
  openingHours: z.string().trim().max(100).optional(),
  clubStatus: z.string().trim().max(160).optional(),
  homeHeadline: z.string().trim().max(180).optional(),
  homeSubtitle: z.string().trim().max(500).optional(),
  promoText: z.string().trim().max(160).optional(),
  courtPrice: z.number().or(z.string()).transform(Number).optional(),
  nightPrice: z.number().or(z.string()).transform(Number).optional(),
  weekendExtra: z.number().or(z.string()).transform(Number).optional(),
  classPrice: z.number().or(z.string()).transform(Number).optional(),
  tournamentPrice: z.number().or(z.string()).transform(Number).optional(),
  teacherCommissionPercent: z.number().or(z.string()).transform(Number).optional(),
}).strict();

export function parseSettingsPatch(body) {
  const parsed = settingsFields.safeParse(body);
  if (!parsed.success) return null;
  const numericKeys = ["courtPrice", "nightPrice", "weekendExtra", "classPrice", "tournamentPrice", "teacherCommissionPercent"];
  for (const key of numericKeys) {
    const value = parsed.data[key];
    if (value !== undefined && (!Number.isFinite(value) || value < 0 || value > (key === "teacherCommissionPercent" ? 100 : 100_000_000))) return null;
  }
  const patch = {
    ...parsed.data,
    whatsapp: parsed.data.whatsapp ? String(parsed.data.whatsapp).replace(/\D/g, "") : parsed.data.whatsapp,
    instagram: parsed.data.instagram ? String(parsed.data.instagram).replace(/^@/, "").trim() : parsed.data.instagram,
  };
  Object.keys(patch).forEach((key) => patch[key] === undefined && delete patch[key]);
  return patch;
}
