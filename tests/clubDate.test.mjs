import test from "node:test";
import assert from "node:assert/strict";
import { accountingDate, shiftClubDate, startOfClubMonth, startOfClubWeek, startOfClubYear } from "../src/utils/clubDate.js";

test("la caja usa el día comercial de Argentina cerca de medianoche UTC", () => {
  const now = new Date("2026-09-17T01:15:00Z");
  assert.equal(accountingDate(now), "2026-09-16");
  assert.equal(accountingDate("2026-09-17"), "2026-09-17");
  assert.equal(shiftClubDate(1, now), "2026-09-17");
  assert.equal(startOfClubWeek(now), "2026-09-14");
  assert.equal(startOfClubMonth(now), "2026-09-01");
  assert.equal(startOfClubYear(now), "2026-01-01");
});
