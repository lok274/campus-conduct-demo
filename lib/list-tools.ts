import type { Entry, Student } from "./conduct-types";

export const ALL_CLASSES = "全部班級";
export const normalizeSearch = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("zh-Hant");

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function recordDateRangeError(dateFrom: string, dateTo: string) {
  if (dateFrom && !isValidIsoDate(dateFrom)) return "「開始日期」不是有效日期，請重新選擇。";
  if (dateTo && !isValidIsoDate(dateTo)) return "「結束日期」不是有效日期，請重新選擇。";
  if (dateFrom && dateTo && dateFrom > dateTo) return "日期範圍有誤：「開始日期」不可遲於「結束日期」。";
  return "";
}
export function matchesStudent(student: Student, query: string, className = ALL_CLASSES) {
  return (className === ALL_CLASSES || student.className === className) &&
    normalizeSearch([student.name, student.className, student.number].join(" ")).includes(normalizeSearch(query));
}
export function studentSearchRank(student: Student, query: string) {
  const value = normalizeSearch(query);
  return normalizeSearch(student.number) === value ? 0 : normalizeSearch(student.name) === value ? 1 : normalizeSearch(student.name).startsWith(value) ? 2 : 3;
}
export function recordSearchText(entry: Entry, student?: Student) {
  const rule = entry.rule;
  return normalizeSearch([student?.name, student?.className, student?.number, entry.kind, entry.category,
    entry.note, entry.assignee, entry.date, entry.status, rule?.category, rule?.subCategory, rule?.code, rule?.itemName].join(" "));
}
export function pageWindow(total: number, requestedPage: number, pageSize: number) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.max(1, Math.min(requestedPage, pages));
  const start = total ? (page - 1) * pageSize + 1 : 0;
  return { page, pages, start, end: Math.min(page * pageSize, total), total, pageSize };
}
export function toggleSelection<T extends { id: string }>(current: string[], visible: T[]) {
  const ids = new Set(visible.map(item => item.id));
  const selected = new Set(current);
  return visible.length && visible.every(item => selected.has(item.id))
    ? current.filter(id => !ids.has(id)) : [...new Set([...current, ...ids])];
}
export function duplicateStudentIds(entries: Entry[], expected: Pick<Entry, "date" | "kind" | "category" | "rule" | "scoreChange" | "note">) {
  const note = (value: string) => value.trim().replace(/\s+/g, " ");
  return new Set(entries.filter(entry => entry.date === expected.date && entry.kind === expected.kind &&
    entry.category === expected.category && entry.rule?.code === expected.rule?.code &&
    entry.rule?.category === expected.rule?.category && (entry.scoreChange ?? entry.rule?.score) === expected.scoreChange &&
    note(entry.note) === note(expected.note)).map(entry => entry.studentId));
}
export function scoreLabel(entry: Entry) {
  const score = entry.scoreChange ?? entry.rule?.score;
  return score === undefined ? "未記分" : (score > 0 ? "+" : "") + score + " 分";
}

export function compareRecordUpdatedDesc(left: Entry, right: Entry) {
  return right.updatedAt.localeCompare(left.updatedAt) || right.date.localeCompare(left.date) || left.id.localeCompare(right.id);
}
