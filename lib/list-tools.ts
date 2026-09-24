import type { Entry, Student } from "./conduct-types";

export const ALL_CLASSES = "全部班級";
export const normalizeSearch = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("zh-Hant");
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
