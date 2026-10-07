function minutesFromHour(hour = "00:00") {
  const [hh = "0", mm = "0"] = String(hour).split(":");
  return Number(hh) * 60 + Number(mm);
}

function addMinutesToHour(hour, minutes) {
  const total = minutesFromHour(hour) + Number(minutes || 0);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function isClockTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

export function courtHours(court) {
  if (!isClockTime(court.openingTime) || !isClockTime(court.closingTime)) return [];
  const start = minutesFromHour(court.openingTime);
  const end = minutesFromHour(court.closingTime);
  const interval = Number(court.slotIntervalMinutes || 30);
  if (start < 0 || end > 24 * 60 || end <= start || ![30, 60].includes(interval)) return [];
  return Array.from({ length: Math.ceil((end - start) / interval) }, (_, index) => addMinutesToHour(court.openingTime, index * interval))
    .filter((hour) => minutesFromHour(hour) < end);
}

export function fitsCourtHours(court, hour, durationMinutes) {
  return courtHours(court).includes(hour) && minutesFromHour(hour) + Number(durationMinutes || 0) <= minutesFromHour(court.closingTime);
}

export function validCourtSchedule(court) {
  return isClockTime(court.openingTime) && isClockTime(court.closingTime) &&
    minutesFromHour(court.openingTime) < minutesFromHour(court.closingTime) && courtHours(court).length > 0;
}

export { addMinutesToHour };

export function publicCourt(court) {
  const item = court.toJSON ? court.toJSON() : court;
  return {
    id: item.courtId,
    name: item.name,
    description: item.description,
    tag: item.tag,
    active: item.active !== false,
    sortOrder: Number(item.sortOrder || 0),
    openingTime: item.openingTime,
    closingTime: item.closingTime,
    slotIntervalMinutes: Number(item.slotIntervalMinutes || 30),
    allowedDurations: (item.allowedDurations || []).map(Number),
    basePrice: Number(item.basePrice || 0),
    nightPrice: Number(item.nightPrice || 0),
    weekendExtra: Number(item.weekendExtra || 0),
    hours: courtHours(item),
  };
}
