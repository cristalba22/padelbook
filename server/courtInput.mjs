import { z } from "zod";

export const courtFields = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(160).optional().default(""),
  tag: z.string().trim().max(120).optional().default(""),
  active: z.boolean().optional().default(true),
  sortOrder: z.number().int().min(0).max(1000).optional().default(0),
  openingTime: z.string().regex(/^\d{2}:\d{2}$/),
  closingTime: z.string().regex(/^\d{2}:\d{2}$/),
  slotIntervalMinutes: z.union([z.literal(30), z.literal(60)]).optional().default(30),
  allowedDurations: z.array(z.union([z.literal(60), z.literal(90), z.literal(120), z.literal(150)])).min(1).max(4),
  basePrice: z.number().int().min(0).max(100_000_000),
  nightPrice: z.number().int().min(0).max(100_000_000),
  weekendExtra: z.number().int().min(0).max(100_000_000).optional().default(0),
}).strict();
