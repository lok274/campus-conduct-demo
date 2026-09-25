import type { Entry } from "./conduct-types";

export type FollowUpCalendarView = "overdue" | "today" | "week";

function parseIsoDate(value: string) {
  return new Date(`${value}T12:00:00`);
}

function toIsoDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function followUpWeekDates(today: string) {
  const start = parseIsoDate(today);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toIsoDate(date);
  });
}

export function datedOpenFollowUps(entries: readonly Entry[]) {
  return entries.filter((entry) => entry.status !== "已結案" && Boolean(entry.dueDate));
}

export function followUpsForCalendarView(entries: readonly Entry[], today: string, view: FollowUpCalendarView) {
  const open = datedOpenFollowUps(entries);
  if (view === "overdue") return open.filter((entry) => entry.dueDate! < today);
  if (view === "today") return open.filter((entry) => entry.dueDate === today);
  const dates = followUpWeekDates(today);
  return open.filter((entry) => entry.dueDate! >= dates[0] && entry.dueDate! <= dates[6]);
}

export function calendarDatesForView(entries: readonly Entry[], today: string, view: FollowUpCalendarView) {
  if (view === "today") return [today];
  if (view === "week") return followUpWeekDates(today);
  return [...new Set(followUpsForCalendarView(entries, today, view).map((entry) => entry.dueDate!))].sort((left, right) => right.localeCompare(left));
}
