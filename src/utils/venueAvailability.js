import { blockOverlapsBooking, bookingsOverlap, isPastSlot, minutesFromTime } from "./bookingDomain.js";

export function venueSlots(court, date, durationMinutes, occupied = [], blocks = []) {
  const duration = Number(durationMinutes);
  if (!court?.allowedDurations?.includes(duration)) return [];
  const closing = minutesFromTime(court.closingTime);
  return (court.hours || []).filter((time) => minutesFromTime(time) + duration <= closing).map((time) => {
    const candidate = { date, time, courtId: court.id, durationMinutes: duration };
    const booked = occupied.some((item) => bookingsOverlap(item, candidate));
    const blocked = blocks.some((item) => blockOverlapsBooking(item, candidate));
    return { time, available: !booked && !blocked && !isPastSlot(date, time) };
  });
}

export function endTime(time, durationMinutes) {
  const total = minutesFromTime(time) + Number(durationMinutes);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
