import test from "node:test";
import assert from "node:assert/strict";
import { calendarDatesForView, datedOpenFollowUps, followUpsForCalendarView, followUpWeekDates } from "../lib/follow-up-calendar.ts";

const entries = [
  { id: "overdue", status: "待跟進", dueDate: "2026-09-23" },
  { id: "today", status: "跟進中", dueDate: "2026-09-25" },
  { id: "weekend", status: "待跟進", dueDate: "2026-09-27" },
  { id: "later", status: "待跟進", dueDate: "2026-09-28" },
  { id: "closed", status: "已結案", dueDate: "2026-09-25" },
  { id: "unscheduled", status: "待跟進" },
];

test("calendar only includes open cases with a deadline", () => {
  assert.deepEqual(datedOpenFollowUps(entries).map((entry) => entry.id), ["overdue", "today", "weekend", "later"]);
});

test("calendar views use overdue, today and Monday-to-Sunday scopes", () => {
  assert.deepEqual(followUpWeekDates("2026-09-25"), ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  assert.deepEqual(followUpsForCalendarView(entries, "2026-09-25", "overdue").map((entry) => entry.id), ["overdue"]);
  assert.deepEqual(followUpsForCalendarView(entries, "2026-09-25", "today").map((entry) => entry.id), ["today"]);
  assert.deepEqual(followUpsForCalendarView(entries, "2026-09-25", "week").map((entry) => entry.id), ["overdue", "today", "weekend"]);
  assert.deepEqual(calendarDatesForView(entries, "2026-09-25", "overdue"), ["2026-09-23"]);
});
