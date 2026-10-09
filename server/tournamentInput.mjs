import { z } from "zod";
import { isValidDateISO } from "./dateValidation.mjs";

export const tournamentFields = z.object({
  name: z.string().trim().min(2).max(120),
  date: z.string().refine(isValidDateISO),
  hour: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  status: z.enum(["abierto", "lleno", "en_curso", "finalizado", "cancelado"]),
  category: z.string().trim().max(80),
  surface: z.string().trim().max(80),
  pricePerPlayer: z.number().int().min(0).max(100_000_000),
  seededPlayers: z.number().int().min(0),
  maxPlayers: z.number().int().min(1),
  prize: z.string().trim().max(120),
  description: z.string().trim().max(1000),
}).strict();

export const registrationStatusFields = z.object({
  status: z.enum(["pendiente", "confirmado", "cancelado"]).optional(),
  paymentStatus: z.enum(["pendiente", "pagado", "sin_cargo"]).optional(),
}).strict();

export const tournamentSignupFields = z.object({
  partnerName: z.string().trim().max(100).optional().default(""),
  partnerPhone: z.string().trim().max(40).optional().default(""),
}).strict();
