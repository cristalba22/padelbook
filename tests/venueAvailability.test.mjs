import test from "node:test";
import assert from "node:assert/strict";
import { endTime, venueSlots } from "../src/utils/venueAvailability.js";

test("la agenda por sede respeta cierre, duración y cruces con reservas y bloqueos", () => {
  const court = { id: "court-a", closingTime: "22:00", allowedDurations: [60, 90, 120, 150],
    hours: ["18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30"] };
  const date = "2099-10-20";
  const occupied = [{ date, courtId: "court-a", time: "19:00", durationMinutes: 90, status: "pendiente" }];
  const blocks = [{ date, courtId: "court-a", hour: "21:00", durationMinutes: 30 }];
  const slots = venueSlots(court, date, 120, occupied, blocks);
  assert.deepEqual(slots.map((slot) => [slot.time, slot.available]), [
    ["18:00", false], ["18:30", false], ["19:00", false], ["19:30", false],
    ["20:00", false],
  ]);
  assert.equal(endTime("19:30", 150), "22:00");
  assert.deepEqual(venueSlots(court, date, 150, [], []).map((slot) => slot.time),
    ["18:00", "18:30", "19:00", "19:30"]);
});
