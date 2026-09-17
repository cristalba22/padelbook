import { argentinaDateISO } from "./bookingDomain.js";

export function accountingDate(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : argentinaDateISO(date);
}

export function shiftClubDate(days, now = new Date()) {
  const date = new Date(`${argentinaDateISO(now)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function startOfClubWeek(now = new Date()) {
  const date = new Date(`${argentinaDateISO(now)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function startOfClubMonth(now = new Date()) { return `${argentinaDateISO(now).slice(0, 7)}-01`; }
export function startOfClubYear(now = new Date()) { return `${argentinaDateISO(now).slice(0, 4)}-01-01`; }
