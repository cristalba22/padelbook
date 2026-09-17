export function canonicalCourtId(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = /^(?:court|cancha[\s-]*)?([1-9]\d*)$/.exec(raw);
  return match ? `court${match[1]}` : raw;
}

export function argentinaDateISO(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function isPastSlot(date, time, now = new Date()) {
  const today = argentinaDateISO(now);
  if (date < today) return true;
  if (date > today) return false;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (type) => Number(parts.find((part) => part.type === type)?.value);
  return minutesFromTime(time) <= get("hour") * 60 + get("minute");
}

export function minutesFromTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? ""));
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return hours < 24 && minutes < 60 ? hours * 60 + minutes : NaN;
}

export function bookingsOverlap(existing, incoming) {
  if (String(existing?.status ?? "").toLowerCase().startsWith("cancelad")) return false;
  if (existing?.date !== incoming?.date) return false;
  if (canonicalCourtId(existing?.courtId) !== canonicalCourtId(incoming?.courtId)) return false;
  const firstStart = minutesFromTime(existing?.time ?? existing?.hour);
  const secondStart = minutesFromTime(incoming?.time ?? incoming?.hour);
  const firstDuration = Number(existing?.durationMinutes || 60);
  const secondDuration = Number(incoming?.durationMinutes || 60);
  return Number.isFinite(firstStart) && Number.isFinite(secondStart) &&
    firstStart < secondStart + secondDuration && secondStart < firstStart + firstDuration;
}

export function intervalOverlaps(aStart, aDuration, bStart, bDuration) {
  const first = minutesFromTime(aStart);
  const second = minutesFromTime(bStart);
  return Number.isFinite(first) && Number.isFinite(second) && first < second + Number(bDuration) && second < first + Number(aDuration);
}

export function blockOverlapsBooking(block, booking) {
  return block?.date === booking?.date &&
    canonicalCourtId(block?.courtId) === canonicalCourtId(booking?.courtId) &&
    intervalOverlaps(block?.hour ?? block?.time, block?.durationMinutes || 60, booking?.time ?? booking?.hour, booking?.durationMinutes || 60);
}

export function fitsOperatingHours(time, durationMinutes) {
  const start = minutesFromTime(time);
  const duration = Number(durationMinutes);
  return Number.isFinite(start) && Number.isInteger(duration) && start >= 9 * 60 && start % 30 === 0 &&
    [60, 90, 120, 150].includes(duration) && start + duration <= 22 * 60;
}

export function fitsBlockHours(time, durationMinutes) {
  const start = minutesFromTime(time);
  const duration = Number(durationMinutes);
  return Number.isFinite(start) && start >= 9 * 60 && start % 30 === 0 &&
    Number.isInteger(duration) && duration >= 30 && duration <= 150 && duration % 30 === 0 && start + duration <= 22 * 60;
}

export function calculateBookingPrice({ date, time, type, durationMinutes }, settings) {
  if (type === "class") return Number(settings.classPrice);
  const day = new Date(`${date}T00:00:00`).getDay();
  const weekendExtra = [0, 6].includes(day) ? Number(settings.weekendExtra || 0) : 0;
  const start = minutesFromTime(time);
  let total = 0;
  for (let offset = 0; offset < durationMinutes; offset += 30) {
    const price = start + offset >= 19 * 60 ? Number(settings.nightPrice) : Number(settings.courtPrice);
    total += (price + weekendExtra) / 2;
  }
  return Math.round(total);
}

export function bookingSlotStarts(time, durationMinutes) {
  const start = minutesFromTime(time);
  const duration = Number(durationMinutes);
  if (!Number.isFinite(start) || !Number.isInteger(duration) || duration < 30 || duration % 30 !== 0 || start % 30 !== 0) return [];
  return Array.from({ length: duration / 30 }, (_, index) => start + index * 30);
}
