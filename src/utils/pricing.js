// src/utils/pricing.js
import { safeRead, safeWrite } from "./storage.js";

export const PRICING_KEY = "padel_pricing";
export const LEGACY_PRICING_KEYS = ["clubPricing", "padel_pricing_v1"];
export const TEACHERS_KEY = "padel_teacher_prices";
export const PRICING_VERSION = 2;

export const DEFAULT_PRICING = Object.freeze({
  courtPrice: Number(import.meta.env.VITE_DEFAULT_COURT_PRICE || 18000),
  classPrice: Number(import.meta.env.VITE_DEFAULT_CLASS_PRICE || 30000),
  tournamentPrice: Number(import.meta.env.VITE_DEFAULT_TOURNAMENT_PRICE || 25000),
  nightPrice: Number(import.meta.env.VITE_DEFAULT_NIGHT_PRICE || 24000),
  weekendExtra: Number(import.meta.env.VITE_DEFAULT_WEEKEND_EXTRA || 3000),
  teacherCommissionPercent: Number(import.meta.env.VITE_DEFAULT_TEACHER_COMMISSION || 50),
  pricingVersion: PRICING_VERSION,
});

function normalizePricing(input = {}) {
  return {
    courtPrice: Number(input.courtPrice ?? input.courtBase ?? DEFAULT_PRICING.courtPrice),
    classPrice: Number(input.classPrice ?? input.teacherBasePrice ?? input.teacherPrice ?? DEFAULT_PRICING.classPrice),
    tournamentPrice: Number(input.tournamentPrice ?? input.tournamentPlayerPrice ?? DEFAULT_PRICING.tournamentPrice),
    nightPrice: Number(input.nightPrice ?? DEFAULT_PRICING.nightPrice),
    weekendExtra: Number(input.weekendExtra ?? DEFAULT_PRICING.weekendExtra),
    teacherCommissionPercent: Number(input.teacherCommissionPercent ?? DEFAULT_PRICING.teacherCommissionPercent),
    pricingVersion: Number(input.pricingVersion ?? 1),
  };
}

function shouldRefreshOldDefaults(pricing) {
  return Number(pricing.pricingVersion || 1) < PRICING_VERSION &&
    Number(pricing.courtPrice || 0) <= 6000 &&
    Number(pricing.nightPrice || 0) <= 7000 &&
    Number(pricing.classPrice || 0) <= 13000;
}

export function loadPricing() {
  const current = safeRead(PRICING_KEY, null);
  if (current) {
    const normalized = normalizePricing(current);
    if (shouldRefreshOldDefaults(normalized)) {
      safeWrite(PRICING_KEY, { ...DEFAULT_PRICING });
      return { ...DEFAULT_PRICING };
    }
    if (normalized.pricingVersion !== PRICING_VERSION) {
      const versioned = { ...normalized, pricingVersion: PRICING_VERSION };
      safeWrite(PRICING_KEY, versioned);
      return versioned;
    }
    return normalized;
  }

  for (const legacyKey of LEGACY_PRICING_KEYS) {
    const legacy = safeRead(legacyKey, null);
    if (legacy) {
      const migrated = normalizePricing(legacy);
      safeWrite(PRICING_KEY, migrated);
      return migrated;
    }
  }

  return { ...DEFAULT_PRICING };
}

export function savePricing(newPricing) {
  const cleaned = normalizePricing(newPricing);
  safeWrite(PRICING_KEY, cleaned);
  return cleaned;
}

export function getCourtPrice(hour, date = new Date(), pricing = loadPricing()) {
  const numericHour = Number(String(hour).split(":")[0]);
  const isNight = Number.isFinite(numericHour) && numericHour >= 19;
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  const isWeekend = d instanceof Date && !Number.isNaN(d.getTime()) && [0, 6].includes(d.getDay());

  let price = Number(pricing.courtPrice || DEFAULT_PRICING.courtPrice);
  if (isNight) price = Number(pricing.nightPrice || price);
  if (isWeekend) price += Number(pricing.weekendExtra || 0);
  return price;
}

function addMinutesToHour(hour, minutes) {
  const [hh = "0", mm = "0"] = String(hour).split(":");
  const total = Number(hh) * 60 + Number(mm) + Number(minutes || 0);
  const normalized = ((total % 1440) + 1440) % 1440;
  const nextHour = String(Math.floor(normalized / 60)).padStart(2, "0");
  const nextMinute = String(normalized % 60).padStart(2, "0");
  return `${nextHour}:${nextMinute}`;
}

export function getCourtPriceForDuration(hour, date = new Date(), durationMinutes = 60, pricing = loadPricing()) {
  const duration = Math.max(60, Number(durationMinutes || 60));
  let total = 0;

  for (let elapsed = 0; elapsed < duration; elapsed += 30) {
    const segmentHour = addMinutesToHour(hour, elapsed);
    total += getCourtPrice(segmentHour, date, pricing) / 2;
  }

  return Math.round(total);
}

export function getClassPrice(pricing = loadPricing()) {
  return Number(pricing.classPrice || DEFAULT_PRICING.classPrice);
}

export function loadTeacherPrices() {
  return safeRead(TEACHERS_KEY, {});
}

export function saveTeacherPrices(map) {
  safeWrite(TEACHERS_KEY, map || {});
}
