"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { ArrowRight, ArrowUpDown, BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, Download, FilePenLine, Filter, LayoutDashboard, Menu, Plus, RotateCcw, Search, ShieldCheck, SlidersHorizontal, Sparkles, Upload, UsersRound, X } from "lucide-react";
import { SCHOOL_BASE_SCORES, SCHOOL_CATEGORIES, type SchoolCategory } from "../lib/school-rules";
import { CONDUCT_RULES, resolveRuleSelection, ruleRecordFields, type RuleInput } from "../lib/conduct-rules";
import { RuleDetails, RulePicker } from "../components/rule-picker";
import { completeCase, DIRECT_CLOSURE_REASON } from "../lib/case-workflow";
import type { Student, Entry, FollowUp, Kind, Status } from "../lib/conduct-types";
import { duplicateStudentIds, matchesStudent, normalizeSearch, recordSearchText, scoreLabel, studentSearchRank, toggleSelection } from "../lib/list-tools";
import { ListPagination, useListPage, type ListPage } from "../components/list-pagination";
import { StudentPicker } from "../components/student-picker";
import { MAX_RECORD_IMPORT_BYTES, parseRecordCsv, parseRecordImport, serializeRecordCsv } from "../lib/record-transfer";
import { applyBulkRecordUpdate, bulkRecordWouldChange, hasBulkRecordUpdate, restoreBulkRecordUpdate, type BulkRecordUpdate } from "../lib/bulk-record-update";

type Page = "dashboard" | "records";
type RecordSort = "date-desc" | "date-asc" | "updated-desc" | "student-asc" | "status-priority";
type TimelineEvent = {
  id: string; caseId: string; date: string; at?: string; order: number;
  type: "record" | "follow-up" | "closed" | "reopened";
  kind: Kind; category: string; detail: string; status: Status; author?: string;
};
type Draft = Pick<Entry, "studentId" | "date" | "note" | "status"> & RuleInput & { needsFollowUp: boolean };
type CreateDraft = Pick<Entry, "date" | "note"> & RuleInput & { needsFollowUp: boolean; assignee: string; dueDate: string };
type CreateStep = "students" | "details" | "review";
type BulkUpdateStep = "edit" | "confirm";
type RecordTransferMessage = { tone: "success" | "error" | "info"; text: string };
type BulkUpdateUndo = { before: Entry[]; count: number };
type StoredCreateDraft = {
  draft: CreateDraft;
  studentIds: string[];
  step: Exclude<CreateStep, "review">;
  classFilter: string;
  skipDuplicates: boolean;
  savedAt: string;
};
type GlobalSearchResult = {
  id: string;
  type: "student" | "record";
  title: string;
  meta: string;
  description: string;
  studentId: string;
  recordId?: string;
};
const ALL_ASSIGNEES = "__filter_all_assignees__";
const UNASSIGNED = "__filter_unassigned__";
const CREATE_DRAFT_STORAGE_KEY = "campus-conduct:create-draft:v2";
const newBulkRecordUpdate = (): BulkRecordUpdate => ({
  assigneeEnabled: false, assignee: "", dueDateEnabled: false, dueDate: "", statusEnabled: false, status: "待跟進",
});

const students: Student[] = [
  { id: "s1", name: "陳子晴", className: "中一甲", seat: "03", number: "S260103" },
  { id: "s2", name: "李浩然", className: "中一甲", seat: "12", number: "S260112" },
  { id: "s3", name: "黃思敏", className: "中一乙", seat: "08", number: "S260208" },
  { id: "s4", name: "張家朗", className: "中二甲", seat: "17", number: "S250117" },
  { id: "s5", name: "林詠欣", className: "中二乙", seat: "06", number: "S250206" },
  { id: "s6", name: "何卓謙", className: "中二乙", seat: "21", number: "S250221" },
  { id: "s7", name: "吳樂怡", className: "中三甲", seat: "09", number: "S240109" },
  { id: "s8", name: "周俊熙", className: "中三乙", seat: "15", number: "S240215" },
];
const initialRuleFields = (category: SchoolCategory, code: string) => {
  const rule = CONDUCT_RULES.find((item) => item.category === category && item.code === code);
  if (!rule) throw new Error(`找不到示範紀錄規則 ${category}:${code}`);
  return ruleRecordFields(rule);
};
const initialEntries: Entry[] = [
  { id: "r1", studentId: "s1", ...initialRuleFields("守規", "513"), date: "2026-09-18", note: "以圖書館服務生身分協助整理圖書角及帶領新生。", status: "已結案" },
  { id: "r2", studentId: "s4", ...initialRuleFields("守規", "215"), date: "2026-09-17", note: "課堂期間與同學交談，影響課堂秩序，已作口頭提醒。", status: "待跟進", assignee: "中二甲班主任", dueDate: "2026-09-18" },
  { id: "r3", studentId: "s7", ...initialRuleFields("守規", "501"), date: "2026-09-16", note: "拾獲同學遺失物品後主動交回。", status: "已結案" },
  { id: "r4", studentId: "s2", ...initialRuleFields("守規", "204"), date: "2026-09-15", note: "未遵守課室值日規則，待班主任跟進。", status: "跟進中", assignee: "班主任", dueDate: "2026-09-21", followUps: [{ id: "f1", date: "2026-09-16", author: "訓育組", note: "已通知班主任了解值日安排，約定下週檢視。" }] },
  { id: "r5", studentId: "s5", ...initialRuleFields("守規", "509"), date: "2026-09-14", note: "大型活動後協助清理場地。", status: "已結案" },
  { id: "r6", studentId: "s3", ...initialRuleFields("勤到", "1"), date: "2026-09-13", note: "早會遲到，已了解原因並提醒。", status: "已結案" },
  { id: "r7", studentId: "s6", ...initialRuleFields("守規", "531"), date: "2026-09-12", note: "參與校慶日義工服務。", status: "已結案" },
  { id: "r8", studentId: "s4", ...initialRuleFields("守規", "514"), date: "2026-09-10", note: "主動協助同學整理課堂筆記，改善學習。", status: "已結案", resolution: "已在班會上公開表揚。", closedAt: "2026-09-11", closureHistory: [{ id: "c1", date: "2026-09-11", summary: "已在班會上公開表揚。" }] },
];
const currentLocalDate = () => new Date().toLocaleDateString("sv-SE");
const newDraft = (): Draft => ({
  studentId: "", date: currentLocalDate(), note: "", status: "待跟進", needsFollowUp: true, code: "", schoolCategory: "", subCategory: "",
});
const newCreateDraft = (): CreateDraft => ({
  date: currentLocalDate(), note: "", needsFollowUp: true, assignee: "", dueDate: "", code: "", schoolCategory: "", subCategory: "",
});
function readStoredCreateDraft(validStudentIds: Set<string>): StoredCreateDraft | null {
  try {
    const value = JSON.parse(window.localStorage.getItem(CREATE_DRAFT_STORAGE_KEY) ?? "null") as Partial<StoredCreateDraft> | null;
    const draft = value?.draft as Partial<CreateDraft> | undefined;
    if (!draft || typeof draft.date !== "string" || typeof draft.note !== "string" || typeof draft.code !== "string" ||
      typeof draft.schoolCategory !== "string" || typeof draft.subCategory !== "string" || typeof draft.needsFollowUp !== "boolean" ||
      typeof draft.assignee !== "string" || typeof draft.dueDate !== "string") return null;
    const studentIds = Array.isArray(value?.studentIds) ? value.studentIds.filter((id): id is string => typeof id === "string" && validStudentIds.has(id)) : [];
    return {
      draft: { ...newCreateDraft(), ...draft },
      studentIds,
      step: value?.step === "details" && studentIds.length ? "details" : "students",
      classFilter: typeof value?.classFilter === "string" ? value.classFilter : "全部班級",
      skipDuplicates: typeof value?.skipDuplicates === "boolean" ? value.skipDuplicates : true,
      savedAt: typeof value?.savedAt === "string" ? value.savedAt : "",
    };
  } catch {
    return null;
  }
}
const dateLabel = (date: string) => date.replaceAll("-", "/");
const assigneeOptionLabel = (value: string) => value === ALL_ASSIGNEES ? "全部負責人" : value === UNASSIGNED ? "未指定" : value;
const latestActivityDate = (entry: Entry) => {
  const dates = [entry.date, entry.closedAt, ...(entry.followUps ?? []).map((item) => item.date), ...(entry.closureHistory ?? []).map((item) => item.date)].filter(Boolean) as string[];
  return dates.sort((a, b) => b.localeCompare(a))[0];
};
const addDays = (date: string, amount: number) => {
  const value = new Date(date + "T00:00:00");
  value.setDate(value.getDate() + amount);
  return value.toLocaleDateString("sv-SE");
};
const daysBetween = (from: string, to: string) => Math.max(1, Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000));
function followUpDueMeta(entry: Entry, today: string) {
  if (entry.status === "已結案") return { tone: "completed", label: "已完成", date: entry.closedAt ? dateLabel(entry.closedAt) : "未記錄結案日期" };
  if (!entry.dueDate) return { tone: "unscheduled", label: "未設定期限", date: "請安排跟進日期" };
  if (entry.dueDate < today) return { tone: "overdue", label: `逾期 ${daysBetween(entry.dueDate, today)} 日`, date: dateLabel(entry.dueDate) };
  if (entry.dueDate === today) return { tone: "today", label: "今日到期", date: dateLabel(entry.dueDate) };
  return { tone: "upcoming", label: `尚有 ${daysBetween(today, entry.dueDate)} 日`, date: dateLabel(entry.dueDate) };
}
function buildStudentTimeline(entries: Entry[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const entry of entries) {
    const shared = { caseId: entry.id, kind: entry.kind, category: entry.category, status: entry.status };
    events.push({ ...shared, id: entry.id + "-record", date: entry.date, order: 0, type: "record", detail: entry.note });
    for (const item of entry.followUps ?? []) {
      events.push({ ...shared, id: entry.id + "-" + item.id, date: item.date, at: item.at, order: item.type === "reopened" ? 3 : 1, type: item.type ?? "follow-up", detail: item.note, author: item.author });
    }
    const closures = entry.closureHistory ?? (entry.closedAt && entry.resolution ? [{ id: "current", date: entry.closedAt, summary: entry.resolution }] : []);
    for (const item of closures) {
      events.push({ ...shared, id: entry.id + "-" + item.id, date: item.date, at: item.at, order: 2, type: "closed", detail: item.summary });
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date) || (b.at ?? "").localeCompare(a.at ?? "") || b.order - a.order || a.id.localeCompare(b.id));
}
const nav: { id: Page; text: string; Icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", text: "總覽", Icon: LayoutDashboard },
  { id: "records", text: "獎懲紀錄", Icon: ClipboardList },
];

function Avatar({ student, large = false }: { student: Student; large?: boolean }) {
  const color = ["mint", "blue", "rose", "gold"][Number(student.seat) % 4];
  return <span className={"avatar " + color + (large ? " large" : "")}>{student.name.slice(-2)}</span>;
}
function KindTag({ kind }: { kind: Kind }) { return <span className={"kind-tag kind-" + kind}>{kind}</span>; }
function StatusTag({ status }: { status: Status }) { return <span className={"status-tag " + (status === "待跟進" ? "waiting" : status === "跟進中" ? "progress" : "done")}><i />{status}</span>; }

export default function Home() {
  const [fixture, setFixture] = useState<{ students: Student[]; entries: Entry[] } | null>(null);
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || new URLSearchParams(window.location.search).get("fixture") !== "large") return;
    const previousFontSize = document.documentElement.style.fontSize;
    if (new URLSearchParams(window.location.search).get("textScale") === "200") document.documentElement.style.fontSize = "200%";
    let active = true;
    void import("../tests/fixtures/large-school").then(({ createLargeSchool }) => {
      if (active) setFixture(createLargeSchool());
    });
    return () => { active = false; document.documentElement.style.fontSize = previousFontSize; };
  }, []);
  return <Workspace key={fixture ? "large" : "demo"} students={fixture?.students ?? students} initialEntries={fixture?.entries ?? initialEntries} largeFixture={!!fixture}/>;
}

function Workspace({ students, initialEntries, largeFixture }: { students: Student[]; initialEntries: Entry[]; largeFixture: boolean }) {
  const [page, setPage] = useState<Page>("dashboard");
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [recordSearch, setRecordSearch] = useState("");
  const [recordClassFilter, setRecordClassFilter] = useState("全部班級");
  const [recordKindFilter, setRecordKindFilter] = useState("全部範疇");
  const [recordCategoryFilter, setRecordCategoryFilter] = useState("全部事項");
  const [recordStatusFilter, setRecordStatusFilter] = useState("全部狀態");
  const [recordAssigneeFilter, setRecordAssigneeFilter] = useState(ALL_ASSIGNEES);
  const [recordDateFrom, setRecordDateFrom] = useState("");
  const [recordDateTo, setRecordDateTo] = useState("");
  const [recordSort, setRecordSort] = useState<RecordSort>("date-desc");
  const [recordFiltersOpen, setRecordFiltersOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalSearchActiveIndex, setGlobalSearchActiveIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseReturnStudentId, setCaseReturnStudentId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [entryError, setEntryError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formReturnCaseId, setFormReturnCaseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [batchFormOpen, setBatchFormOpen] = useState(false);
  const [batchStep, setBatchStep] = useState<CreateStep>("students");
  const [batchDraft, setBatchDraft] = useState<CreateDraft>(newCreateDraft);
  const [batchStudentIds, setBatchStudentIds] = useState<string[]>([]);
  const [batchClassFilter, setBatchClassFilter] = useState("全部班級");
  const [batchSearch, setBatchSearch] = useState("");
  const [batchSkipDuplicates, setBatchSkipDuplicates] = useState(true);
  const [batchError, setBatchError] = useState("");
  const [batchDraftStatus, setBatchDraftStatus] = useState("");
  const [undoBatch, setUndoBatch] = useState<{ id: string; count: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [recordTransferMessage, setRecordTransferMessage] = useState<RecordTransferMessage | null>(null);
  const [recordSelectedIds, setRecordSelectedIds] = useState<string[]>([]);
  const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
  const [bulkUpdateStep, setBulkUpdateStep] = useState<BulkUpdateStep>("edit");
  const [bulkUpdateDraft, setBulkUpdateDraft] = useState<BulkRecordUpdate>(newBulkRecordUpdate);
  const [bulkUpdateError, setBulkUpdateError] = useState("");
  const [bulkUpdateUndo, setBulkUpdateUndo] = useState<BulkUpdateUndo | null>(null);
  const [today, setToday] = useState(currentLocalDate);
  const createButtonRef = useRef<HTMLButtonElement>(null);
  const recordImportInputRef = useRef<HTMLInputElement>(null);
  const globalSearchRef = useRef<HTMLDivElement>(null);
  const globalSearchInputRef = useRef<HTMLInputElement>(null);
  const batchHasChanges = batchStudentIds.length > 0 || !!batchDraft.code || !!batchDraft.schoolCategory || batchDraft.note.trim() !== "" ||
    batchDraft.date !== today || !batchDraft.needsFollowUp ||
    batchDraft.assignee.trim() !== "" || batchDraft.dueDate !== "";

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => { setNotice(""); setUndoBatch(null); }, 5200);
    return () => window.clearTimeout(timer);
  }, [notice, undoBatch?.id]);
  useEffect(() => {
    if (!batchFormOpen) return;
    if (!batchHasChanges) {
      window.localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
      setBatchDraftStatus("");
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        const stored: StoredCreateDraft = {
          draft: batchDraft,
          studentIds: batchStudentIds,
          step: batchStep === "students" ? "students" : "details",
          classFilter: batchClassFilter,
          skipDuplicates: batchSkipDuplicates,
          savedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(CREATE_DRAFT_STORAGE_KEY, JSON.stringify(stored));
        setBatchDraftStatus("草稿已自動儲存 · 只限這個瀏覽器");
      } catch {
        setBatchDraftStatus("無法自動儲存草稿，請保持此頁開啟");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [batchFormOpen, batchHasChanges, batchDraft, batchStudentIds, batchStep, batchClassFilter, batchSkipDuplicates]);
  useEffect(() => {
    let timer = 0;
    const scheduleNextDay = () => {
      const now = new Date();
      const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = window.setTimeout(() => { setToday(currentLocalDate()); scheduleNextDay(); }, nextDay.getTime() - now.getTime() + 1000);
    };
    scheduleNextDay();
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (!formOpen && !batchFormOpen && !bulkUpdateOpen && !studentId && !caseId) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (bulkUpdateOpen) {
          setBulkUpdateOpen(false); setBulkUpdateStep("edit"); setBulkUpdateError("");
        }
        else if (batchFormOpen) {
          setBatchFormOpen(false); setBatchStep("students"); setBatchError("");
          window.setTimeout(() => createButtonRef.current?.focus(), 0);
        }
        else if (formOpen) { setFormOpen(false); if (formReturnCaseId) setCaseId(formReturnCaseId); setFormReturnCaseId(null); }
        else if (caseId) { setCaseId(null); setStudentId(caseReturnStudentId); setCaseReturnStudentId(null); }
        else setStudentId(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [formOpen, formReturnCaseId, batchFormOpen, batchHasChanges, bulkUpdateOpen, studentId, caseId, caseReturnStudentId]);
  useEffect(() => {
    const openWithShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (formOpen || batchFormOpen || bulkUpdateOpen || studentId || caseId) return;
        setGlobalSearchOpen(true); globalSearchInputRef.current?.focus();
      }
    };
    const closeWhenOutside = (event: PointerEvent) => {
      if (globalSearchRef.current && !globalSearchRef.current.contains(event.target as Node)) setGlobalSearchOpen(false);
    };
    window.addEventListener("keydown", openWithShortcut);
    window.addEventListener("pointerdown", closeWhenOutside);
    return () => {
      window.removeEventListener("keydown", openWithShortcut);
      window.removeEventListener("pointerdown", closeWhenOutside);
    };
  }, [formOpen, batchFormOpen, bulkUpdateOpen, studentId, caseId]);

  const modalOpen = formOpen || batchFormOpen || bulkUpdateOpen || !!studentId || !!caseId;
  useEffect(() => {
    if (!modalOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const dialog = document.querySelector<HTMLElement>('.overlay [role="dialog"]');
      const items = Array.from(dialog?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]') ?? []).filter(item => item.getClientRects().length);
      const first = items[0], last = items.at(-1);
      if (!first || !last) return;
      if (!dialog?.contains(document.activeElement) || (!event.shiftKey && document.activeElement === last)) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => { document.body.style.overflow = oldOverflow; document.removeEventListener("keydown", trap); if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, [modalOpen]);
  useEffect(() => {
    if (!modalOpen) return;
    document.querySelector<HTMLElement>('.overlay [role="dialog"] button')?.focus({ preventScroll: true });
  }, [modalOpen, formOpen, batchFormOpen, bulkUpdateOpen, studentId, caseId]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const classes = ["全部班級", ...new Set(students.map((s) => s.className))];
  const classOrder = useMemo(() => new Map([...new Set(students.map((student) => student.className))].map((className, index) => [className, index])), [students]);
  const assignees = [ALL_ASSIGNEES, UNASSIGNED, ...new Set(entries.map((entry) => entry.assignee?.trim()).filter((value): value is string => Boolean(value) && value !== ALL_ASSIGNEES && value !== UNASSIGNED))];
  const recordCategories = ["全部事項", ...new Set(entries.map((entry) => entry.category))];
  const studentStats = useMemo(() => {
    const stats = new Map(students.map((student) => [student.id, { total: 0, pending: 0 }]));
    for (const entry of entries) {
      const item = stats.get(entry.studentId);
      if (!item) continue;
      item.total += 1;
      if (entry.status !== "已結案") item.pending += 1;
    }
    return stats;
  }, [entries, students]);
  const compareStudentClass = (a: Student, b: Student) =>
    (classOrder.get(a.className) ?? 999) - (classOrder.get(b.className) ?? 999) || Number(a.seat) - Number(b.seat) || a.name.localeCompare(b.name, "zh-Hant");
  const recordQuery = normalizeSearch(recordSearch);
  const recordDateRangeInvalid = Boolean(recordDateFrom && recordDateTo && recordDateFrom > recordDateTo);
  const shownEntries = entries.filter((e) => {
    const student = studentMap.get(e.studentId);
    const searchable = recordSearchText(e, student);
    const matchesAssignee = recordAssigneeFilter === ALL_ASSIGNEES || (recordAssigneeFilter === UNASSIGNED ? !e.assignee?.trim() : e.assignee?.trim() === recordAssigneeFilter);
    const matchesDate = recordDateRangeInvalid || ((!recordDateFrom || e.date >= recordDateFrom) && (!recordDateTo || e.date <= recordDateTo));
    return searchable.includes(recordQuery) &&
      (recordClassFilter === "全部班級" || student?.className === recordClassFilter) &&
      (recordKindFilter === "全部範疇" || e.kind === recordKindFilter) &&
      (recordCategoryFilter === "全部事項" || e.category === recordCategoryFilter) &&
      (recordStatusFilter === "全部狀態" || e.status === recordStatusFilter) && matchesAssignee && matchesDate;
  }).sort((a, b) => {
    const aStudent = studentMap.get(a.studentId)!;
    const bStudent = studentMap.get(b.studentId)!;
    if (recordSort === "date-asc") return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    if (recordSort === "updated-desc") return latestActivityDate(b).localeCompare(latestActivityDate(a)) || b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    if (recordSort === "student-asc") return compareStudentClass(aStudent, bStudent) || b.date.localeCompare(a.date);
    if (recordSort === "status-priority") {
      const rank: Record<Status, number> = { "待跟進": 0, "跟進中": 1, "已結案": 2 };
      return rank[a.status] - rank[b.status] || b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
    }
    return b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
  });
  const recordPage = useListPage(shownEntries, JSON.stringify([recordSearch, recordClassFilter, recordKindFilter, recordCategoryFilter, recordStatusFilter, recordAssigneeFilter, recordDateFrom, recordDateTo, recordSort]));
  const recordSelectedIdSet = new Set(recordSelectedIds);
  const selectedRecordEntries = entries.filter((entry) => recordSelectedIdSet.has(entry.id));
  const recordPageAllSelected = recordPage.items.length > 0 && recordPage.items.every((entry) => recordSelectedIdSet.has(entry.id));
  const bulkUpdateAffectedEntries = selectedRecordEntries.filter((entry) => bulkRecordWouldChange(entry, bulkUpdateDraft));
  const globalQuery = normalizeSearch(globalSearch);
  const allGlobalResults = useMemo(() => {
    if (!globalQuery) return [];
    const studentResults = students.filter(student => matchesStudent(student, globalQuery)).map(student => {
      const stats = studentStats.get(student.id)!;
      return { id: `student-${student.id}`, type: "student" as const, title: student.name,
        meta: `${student.className} · 座號 ${student.seat} · ${student.number}`,
        description: `${stats.total} 筆紀錄 · ${stats.pending} 項待跟進`,
        studentId: student.id, score: studentSearchRank(student, globalQuery), date: "" };
    });
    const recordResults = entries.filter(entry => recordSearchText(entry, studentMap.get(entry.studentId)).includes(globalQuery)).map(entry => {
      const student = studentMap.get(entry.studentId)!;
      return { id: `record-${entry.id}`, type: "record" as const, title: `${student.name} · ${entry.category}`,
        meta: `${student.className} · 座號 ${student.seat} · ${student.number} · ${dateLabel(entry.date)} · ${entry.status}`,
        description: entry.note, studentId: student.id, recordId: entry.id, score: 4 + studentSearchRank(student, globalQuery), date: entry.date };
    });
    return [...studentResults, ...recordResults].sort((a,b) => a.score - b.score || b.date.localeCompare(a.date) || a.title.localeCompare(b.title, "zh-Hant"));
  }, [entries, globalQuery, studentMap, studentStats, students]);
  const globalResults: GlobalSearchResult[] = allGlobalResults.slice(0, 8);
  const recordActiveFilters = [
    recordSearch && `搜尋「${recordSearch}」`,
    recordClassFilter !== "全部班級" && recordClassFilter,
    recordKindFilter !== "全部範疇" && recordKindFilter,
    recordCategoryFilter !== "全部事項" && recordCategoryFilter,
    recordStatusFilter !== "全部狀態" && recordStatusFilter,
    recordAssigneeFilter !== ALL_ASSIGNEES && (recordAssigneeFilter === UNASSIGNED ? "未指定負責人" : recordAssigneeFilter),
    recordDateFrom && `由 ${dateLabel(recordDateFrom)}`,
    recordDateTo && `至 ${dateLabel(recordDateTo)}`,
  ].filter(Boolean) as string[];
  const batchSelectedIdSet = new Set(batchStudentIds);
  const batchVisibleStudents = students.filter(student => matchesStudent(student, batchSearch, batchClassFilter)).sort(compareStudentClass);
  const batchPage = useListPage(batchVisibleStudents, JSON.stringify([batchSearch, batchClassFilter, batchFormOpen]));
  const batchSelectedStudents = students.filter((student) => batchSelectedIdSet.has(student.id)).sort(compareStudentClass);
  const batchAllVisibleSelected = batchPage.items.length > 0 && batchPage.items.every((student) => batchSelectedIdSet.has(student.id));
  const batchRule = resolveRuleSelection(batchDraft);
  const batchDuplicateStudentIds = batchRule.rule ? duplicateStudentIds(entries, {
    date: batchDraft.date, ...ruleRecordFields(batchRule.rule, batchRule.scoreChange), note: batchDraft.note,
  }) : new Set<string>();
  const batchStudentsToCreate = batchSelectedStudents.filter((student) => !batchSkipDuplicates || !batchDuplicateStudentIds.has(student.id));
  const selected = studentId ? studentMap.get(studentId) : undefined;
  const selectedEntries = selected ? entries.filter((e) => e.studentId === selected.id) : [];
  const selectedTimeline = buildStudentTimeline(selectedEntries);
  const draftStudent = studentMap.get(draft.studentId);
  const draftRule = resolveRuleSelection(draft);
  const selectedCase = caseId ? entries.find((e) => e.id === caseId) : undefined;
  const caseStudent = selectedCase ? studentMap.get(selectedCase.studentId) : undefined;

  function resetRecordFilters() {
    setRecordSearch(""); setRecordClassFilter("全部班級"); setRecordKindFilter("全部範疇"); setRecordCategoryFilter("全部事項");
    setRecordStatusFilter("全部狀態"); setRecordAssigneeFilter(ALL_ASSIGNEES); setRecordDateFrom(""); setRecordDateTo("");
  }
  function toggleRecordSelection(id: string) {
    setRecordSelectedIds((current) => current.includes(id) ? current.filter((entryId) => entryId !== id) : [...current, id]);
  }
  function toggleVisibleRecords() {
    setRecordSelectedIds((current) => toggleSelection(current, recordPage.items));
  }
  function openBulkUpdate() {
    if (!selectedRecordEntries.length) return;
    setBulkUpdateDraft(newBulkRecordUpdate());
    setBulkUpdateError("");
    setBulkUpdateStep("edit");
    setBulkUpdateOpen(true);
  }
  function closeBulkUpdate() {
    setBulkUpdateOpen(false); setBulkUpdateStep("edit"); setBulkUpdateError("");
  }
  function reviewBulkUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedRecordEntries.length) { setBulkUpdateError("所選紀錄已不存在，請返回清單重新選擇。"); return; }
    if (!hasBulkRecordUpdate(bulkUpdateDraft)) { setBulkUpdateError("請至少選擇一個要統一更新的欄位。"); return; }
    if (!bulkUpdateAffectedEntries.length) { setBulkUpdateError("所選紀錄已經是相同設定，沒有需要更新的內容。"); return; }
    setBulkUpdateError(""); setBulkUpdateStep("confirm");
  }
  function confirmBulkUpdate() {
    const result = applyBulkRecordUpdate(entries, recordSelectedIdSet, bulkUpdateDraft);
    if (!result.changedCount) { setBulkUpdateError("沒有可套用的變更，請返回修改設定。"); setBulkUpdateStep("edit"); return; }
    setEntries(result.entries);
    setBulkUpdateUndo({ before: result.before, count: result.changedCount });
    setRecordSelectedIds([]);
    closeBulkUpdate();
    setNotice(`已批次更新 ${result.changedCount} 筆紀錄`);
  }
  function undoBulkRecordUpdate() {
    if (!bulkUpdateUndo) return;
    setEntries((current) => restoreBulkRecordUpdate(current, bulkUpdateUndo.before));
    setRecordSelectedIds([]);
    setNotice(`已復原 ${bulkUpdateUndo.count} 筆批次變更`);
    setBulkUpdateUndo(null);
  }
  function exportRecords() {
    const blob = new Blob([serializeRecordCsv(entries, students)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `campus-conduct-records-${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setRecordTransferMessage({ tone: "success", text: `已匯出全部 ${entries.length.toLocaleString()} 筆紀錄為 CSV；檔案包含跟進及結案歷史。` });
  }
  async function importRecords(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (file.size > MAX_RECORD_IMPORT_BYTES) throw new Error("檔案超過 5 MB，請分拆後再匯入。");
      const text = await file.text();
      const imported = file.name.toLocaleLowerCase().endsWith(".json")
        ? parseRecordImport(text, new Set(students.map((student) => student.id)))
        : parseRecordCsv(text, students);
      const confirmed = window.confirm(`將以「${file.name}」內的 ${imported.length.toLocaleString()} 筆紀錄，取代目前 ${entries.length.toLocaleString()} 筆紀錄。\n\n學生名冊不會變更；重新整理頁面後仍會回到示範資料。是否繼續？`);
      if (!confirmed) {
        setRecordTransferMessage({ tone: "info", text: "已取消匯入，目前紀錄沒有變更。" });
        return;
      }
      setEntries(imported);
      setRecordSelectedIds([]);
      setBulkUpdateUndo(null);
      resetRecordFilters();
      setRecordSort("date-desc");
      recordPage.onPage(1);
      setRecordTransferMessage({ tone: "success", text: `已從「${file.name}」匯入 ${imported.length.toLocaleString()} 筆紀錄並取代目前清單。` });
    } catch (error) {
      setRecordTransferMessage({ tone: "error", text: error instanceof Error ? error.message : "無法讀取這個備份檔案。" });
    } finally {
      input.value = "";
    }
  }
  function navigate(next: Page) { setPage(next); setMenuOpen(false); if (next !== page) window.scrollTo({ top: 0 }); }
  function showRecordResults() {
    resetRecordFilters(); setRecordSearch(globalSearch); setRecordSort("date-desc"); recordPage.onPage(1);
    closeGlobalSearch(); navigate("records");
  }
  function closeGlobalSearch() {
    setGlobalSearchOpen(false);
    setGlobalSearchActiveIndex(0);
  }
  function selectGlobalSearchResult(result: GlobalSearchResult) {
    closeGlobalSearch();
    setGlobalSearch("");
    if (result.type === "student") {
      setStudentId(result.studentId);
      return;
    }
    if (result.recordId) openCase(result.recordId);
  }
  function handleGlobalSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setGlobalSearchActiveIndex((index) => globalResults.length ? (index + 1) % globalResults.length : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setGlobalSearchActiveIndex((index) => globalResults.length ? (index - 1 + globalResults.length) % globalResults.length : 0);
    } else if (event.key === "Enter" && globalResults[globalSearchActiveIndex]) {
      event.preventDefault();
      selectGlobalSearchResult(globalResults[globalSearchActiveIndex]);
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeGlobalSearch();
    }
  }
  function openCreateForm() {
    const stored = readStoredCreateDraft(new Set(students.map((student) => student.id)));
    setFormReturnCaseId(null);
    setBatchDraft(stored?.draft ?? newCreateDraft()); setBatchStudentIds(stored?.studentIds ?? []);
    setBatchClassFilter(stored && classes.includes(stored.classFilter) ? stored.classFilter : "全部班級"); setBatchSearch("");
    setBatchSkipDuplicates(stored?.skipDuplicates ?? true); setBatchError(""); setBatchStep(stored?.step ?? "students");
    setBatchDraftStatus(stored ? "已恢復上次草稿 · 只限這個瀏覽器" : "");
    setStudentId(null); setCaseId(null); setCaseReturnStudentId(null); setFormOpen(false); setBatchFormOpen(true);
  }
  function closeCreateForm() {
    setBatchFormOpen(false); setBatchStep("students"); setBatchError("");
    window.setTimeout(() => createButtonRef.current?.focus(), 0);
  }
  function toggleCreateStudent(id: string) {
    setBatchStudentIds((current) => current.includes(id) ? current.filter((studentId) => studentId !== id) : [...current, id]);
    setBatchError("");
  }
  function toggleVisibleCreateStudents() {
    setBatchStudentIds(current => toggleSelection(current, batchPage.items));
    setBatchError("");
  }
  function goToCreateDetails() {
    if (!batchSelectedStudents.length) { setBatchError("請至少選擇 1 位學生。"); return; }
    setBatchError(""); setBatchStep("details");
  }
  function reviewCreateEntries(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!batchSelectedStudents.length) { setBatchError("學生名單已失效，請返回重新選擇。"); setBatchStep("students"); return; }
    if (batchRule.error || !batchRule.rule) { setBatchError(batchRule.error || "請選擇或輸入有效的 Code。"); return; }
    if (!batchDraft.date || batchDraft.date > today) { setBatchError("紀錄日期不可遲於今天。"); return; }
    if (!batchDraft.note.trim()) { setBatchError("請填寫內容說明。"); return; }
    if (batchDraft.needsFollowUp && batchDraft.dueDate && batchDraft.dueDate < batchDraft.date) { setBatchError("跟進期限不可早於紀錄日期。"); return; }
    setBatchError(""); setBatchStep("review");
  }
  function confirmCreateEntries() {
    const { rule, scoreChange, error } = resolveRuleSelection(batchDraft);
    if (error || !rule) { setBatchError(error || "請選擇或輸入有效的 Code。"); setBatchStep("details"); return; }
    if (!batchStudentsToCreate.length) { setBatchError("所選學生已有完全相同的紀錄；請返回修改，或取消略過重複紀錄。"); return; }
    const createdAt = Date.now();
    const createdAtIso = new Date(createdAt).toISOString();
    const batchId = "b" + createdAt;
    const note = batchDraft.note.trim();
    const closureSummary = "此紀錄建立時標記為不需跟進。";
    const createdEntries: Entry[] = batchStudentsToCreate.map((student, index) => ({
      id: `${batchId}-${index + 1}`,
      batchId,
      studentId: student.id,
      ...ruleRecordFields(rule, scoreChange),
      date: batchDraft.date,
      note,
      status: batchDraft.needsFollowUp ? "待跟進" : "已結案",
      ...(batchDraft.needsFollowUp ? {
        assignee: batchDraft.assignee.trim() || undefined,
        dueDate: batchDraft.dueDate || undefined,
      } : {
        closedWithoutFollowUp: true,
        resolution: closureSummary,
        closedAt: today,
        closureHistory: [{ id: `${batchId}-c-${index + 1}`, date: today, at: createdAtIso, summary: closureSummary }],
      }),
    }));
    setEntries((current) => [...createdEntries, ...current]);
    window.localStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
    setBatchDraftStatus("");
    setUndoBatch({ id: batchId, count: createdEntries.length });
    setNotice(`已建立 ${createdEntries.length} 筆訓育紀錄`);
    closeCreateForm(); resetRecordFilters(); setRecordSort("date-desc"); navigate("records");
  }
  function undoLastBatch() {
    if (!undoBatch) return;
    setEntries((current) => current.filter((entry) => entry.batchId !== undoBatch.id));
    setNotice(`已復原 ${undoBatch.count} 筆訓育紀錄`); setUndoBatch(null);
  }
  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    const returnToCase = caseId === entry.id;
    setFormReturnCaseId(returnToCase ? entry.id : null);
    setDraft({ studentId: entry.studentId, date: entry.date, note: entry.note, status: entry.status, needsFollowUp: entry.status !== "已結案", code: entry.rule?.code ?? "", schoolCategory: entry.rule?.category ?? "", subCategory: entry.rule?.subCategory ?? "", scoreChange: entry.scoreChange ?? entry.rule?.score });
    setEntryError("");
    setStudentId(null); setCaseId(null); if (!returnToCase) setCaseReturnStudentId(null); setFormOpen(true);
  }
  function closeEntryForm() {
    setFormOpen(false);
    if (formReturnCaseId) setCaseId(formReturnCaseId);
    setFormReturnCaseId(null);
  }
  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingId) return;
    if (!studentMap.has(draft.studentId)) { setEntryError("請先明確選擇學生並核對身分。"); return; }
    if (!draft.date || !draft.note.trim()) return;
    if (draft.date > today) { setEntryError("紀錄日期不可遲於今天。"); return; }
    const { rule, scoreChange, error } = resolveRuleSelection(draft);
    if (error || !rule) { setEntryError(error || "請選擇或輸入有效的 Code。"); return; }
    const savedDraft = {
      studentId: draft.studentId,
      date: draft.date, note: draft.note.trim(), status: draft.status,
      ...ruleRecordFields(rule, scoreChange),
    };
    const now = new Date();
    setBulkUpdateUndo(null);
    setEntries((current) => current.map((e) => {
      if (e.id !== editingId) return e;
      const corrected = { ...e, ...savedDraft, status: e.status };
      return draft.needsFollowUp ? corrected : completeCase(corrected, DIRECT_CLOSURE_REASON, now, true);
    }));
    setRecordSelectedIds((current) => current.filter((id) => id !== editingId));
    setNotice(!draft.needsFollowUp && draft.status !== "已結案" ? "紀錄已更正並直接完結" : "紀錄已更新，原有跟進記錄已保留");
    if (formReturnCaseId) setCaseId(formReturnCaseId);
    setFormOpen(false); setFormReturnCaseId(null);
  }
  function openCase(id: string) {
    setCaseReturnStudentId(studentId);
    setStudentId(null); setFormOpen(false); setCaseId(id);
  }
  function closeCaseView() {
    setCaseId(null); setStudentId(caseReturnStudentId); setCaseReturnStudentId(null);
  }
  function saveCasePlan(id: string, assignee: string, dueDate: string) {
    setBulkUpdateUndo(null);
    setEntries((current) => current.map((e) => e.id === id ? { ...e, assignee: assignee.trim(), dueDate } : e));
    setNotice("跟進安排已儲存");
  }
  function startCase(id: string) {
    setBulkUpdateUndo(null);
    setEntries((current) => current.map((e) => e.id === id && e.status === "待跟進" ? { ...e, status: "跟進中" } : e));
    setNotice("個案已開始跟進");
  }
  function addFollowUp(id: string, note: string) {
    const trimmed = note.trim(); if (!trimmed) return;
    const now = new Date();
    const item: FollowUp = { id: "f" + now.getTime(), date: now.toLocaleDateString("sv-SE"), at: now.toISOString(), author: "訓育組", note: trimmed };
    setBulkUpdateUndo(null);
    setEntries((current) => current.map((e) => e.id === id && e.status !== "已結案" ? { ...e, status: "跟進中", followUps: [...(e.followUps ?? []), item] } : e));
    setNotice("跟進記錄已加入");
  }
  function closeCase(id: string, summary: string, direct = false) {
    const trimmed = summary.trim(); if (!trimmed) return;
    const now = new Date();
    setBulkUpdateUndo(null);
    setEntries((current) => current.map((e) => e.id === id ? completeCase(e, trimmed, now, direct) : e));
    setNotice(direct ? "個案已直接完結，原有跟進記錄已保留" : "個案已結案");
  }
  function reopenCase(id: string) {
    const now = new Date();
    setBulkUpdateUndo(null);
    setEntries((current) => current.map((e) => e.id === id && e.status === "已結案" ? {
      ...e, status: "跟進中", resolution: undefined, closedAt: undefined, closedWithoutFollowUp: false,
      followUps: [...(e.followUps ?? []), {
        id: "f" + now.getTime(), date: now.toLocaleDateString("sv-SE"), at: now.toISOString(), type: "reopened",
        author: "訓育組", note: "重新開啟個案。前次結案摘要：" + (e.resolution ?? "未提供"),
      }],
    } : e));
    setNotice("個案已重新開啟");
  }
  const titles: Record<Page, string> = { dashboard: "訓育工作台", records: "獎懲紀錄" };
  const subtitles: Record<Page, string> = {
    dashboard: "建立及管理學生訓育紀錄。所有操作只使用虛構示範資料。",
    records: "集中查閱、篩選及更新訓育事項。",
  };
  const title = titles[page];
  const subtitle = subtitles[page];

  return <div className="app">
    <aside inert={modalOpen} className={"sidebar" + (menuOpen ? " open" : "")}>
      <div className="brand"><div className="brand-icon"><BookOpenCheck size={22}/></div><div><strong>校園訓育系統</strong><small>STUDENT AFFAIRS</small></div></div>
      <div className="side-label">工作空間</div>
      <nav aria-label="主要導覽">{nav.map(({ id, text, Icon }) => <button key={id} type="button" aria-current={page === id ? "page" : undefined} className={"nav-item" + (page === id ? " active" : "")} onClick={() => navigate(id)}><Icon size={19}/>{text}{page === id && <i/>}</button>)}</nav>
      <div className="side-fill"/>
      <div className="demo-note"><ShieldCheck size={20}/><strong>前端示範版</strong><p>目前使用虛構資料。新增與編輯的內容會在重新整理後重置。</p></div>
      <div className="side-user"><span>訓</span><div><strong>訓育組</strong><small>管理介面示範</small></div><ChevronDown size={15}/></div>
    </aside>
    {menuOpen && <button type="button" className="scrim" aria-label="關閉選單" onClick={() => setMenuOpen(false)}/>}
    <div className="main" inert={modalOpen}>
      <header className="topbar"><button type="button" className="mobile-menu" aria-label="開啟選單" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><div className="crumb">校園管理 <ChevronRight size={14}/> <strong>{title}</strong></div><GlobalSearch
        query={globalSearch}
        open={globalSearchOpen}
        results={globalResults}
        recordCount={allGlobalResults.filter(result => result.type === "record").length}
        onAllRecords={showRecordResults}
        activeIndex={globalSearchActiveIndex}
        inputRef={globalSearchInputRef}
        containerRef={globalSearchRef}
        onOpen={() => setGlobalSearchOpen(true)}
        onClose={closeGlobalSearch}
        onQueryChange={(value) => { setGlobalSearch(value); setGlobalSearchActiveIndex(0); setGlobalSearchOpen(true); }}
        onActiveIndexChange={setGlobalSearchActiveIndex}
        onSelect={selectGlobalSearchResult}
        onKeyDown={handleGlobalSearchKeyDown}
      /><div className="top-meta"><span><CalendarDays size={15}/> 2026–27 學年</span><b><i/> 示範版</b></div></header>
      <main className="content">
        {largeFixture && <p className="fixture-banner" role="status">大量資料測試 · 840 位虛構學生 / 5,000 筆初始紀錄 · 班級配置只供測試 · 重新整理重置</p>}
        <div className="page-heading">
          <div><small>STUDENT AFFAIRS / 訓育管理</small><h1>{title}</h1><p>{subtitle}</p></div>
          {page === "dashboard" && <div className="page-actions">
            <button ref={createButtonRef} type="button" className="btn primary" onClick={openCreateForm}><Plus size={17}/>登記訓導紀錄</button>
          </div>}
          {page === "records" && <div className="page-actions record-transfer-actions">
            <input ref={recordImportInputRef} className="sr-only" type="file" accept=".csv,text/csv,.json,application/json" aria-label="選擇獎懲紀錄 CSV 備份檔案" onChange={importRecords}/>
            <button type="button" className="btn secondary" onClick={exportRecords}><Download size={17}/>匯出 CSV</button>
            <button type="button" className="btn secondary" onClick={() => recordImportInputRef.current?.click()}><Upload size={17}/>匯入 CSV</button>
          </div>}
        </div>
        {page === "records" && recordTransferMessage && <p className={`record-transfer-message ${recordTransferMessage.tone}`} role={recordTransferMessage.tone === "error" ? "alert" : "status"}>{recordTransferMessage.text}<button type="button" aria-label="關閉匯入匯出提示" onClick={() => setRecordTransferMessage(null)}><X size={14}/></button></p>}
        {page === "records" && bulkUpdateUndo && <div className="bulk-undo-banner" role="status"><span><CheckCircle2 size={17}/><strong>已批次更新 {bulkUpdateUndo.count} 筆紀錄</strong><small>進行其他紀錄修改前，可復原最近一次批次變更。</small></span><button type="button" className="btn secondary" onClick={undoBulkRecordUpdate}><RotateCcw size={15}/>復原批次變更</button></div>}
        {page === "records" && <RecordsDirectory
          entries={recordPage.items}
          pagination={recordPage}
          totalCount={entries.length}
          studentMap={studentMap}
          search={recordSearch}
          classFilter={recordClassFilter}
          kindFilter={recordKindFilter}
          categoryFilter={recordCategoryFilter}
          statusFilter={recordStatusFilter}
          assigneeFilter={recordAssigneeFilter}
          dateFrom={recordDateFrom}
          dateTo={recordDateTo}
          dateRangeInvalid={recordDateRangeInvalid}
          sort={recordSort}
          filtersOpen={recordFiltersOpen}
          activeFilters={recordActiveFilters}
          classes={classes}
          categories={recordCategories}
          assignees={assignees}
          selectedIds={recordSelectedIdSet}
          allVisibleSelected={recordPageAllSelected}
          onSearch={setRecordSearch}
          onClassFilterChange={setRecordClassFilter}
          onKindFilterChange={setRecordKindFilter}
          onCategoryFilterChange={setRecordCategoryFilter}
          onStatusFilterChange={setRecordStatusFilter}
          onAssigneeFilterChange={setRecordAssigneeFilter}
          onDateFromChange={setRecordDateFrom}
          onDateToChange={setRecordDateTo}
          onSortChange={setRecordSort}
          onFiltersOpenChange={setRecordFiltersOpen}
          onReset={resetRecordFilters}
          onOpenCase={openCase}
          onToggleSelection={toggleRecordSelection}
          onToggleVisible={toggleVisibleRecords}
          onClearSelection={() => setRecordSelectedIds([])}
          onBulkUpdate={openBulkUpdate}
        />}
        <footer>校園訓育系統 · 前端介面示範 <span>所有學生及紀錄均為虛構資料</span></footer>
      </main>
    </div>
    {selected && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setStudentId(null); }}><section className="panel" role="dialog" aria-modal="true" aria-labelledby="student-title"><div className="panel-head"><div><small>STUDENT PROFILE</small><h2 id="student-title">學生資料</h2></div><button type="button" aria-label="關閉學生資料" onClick={() => setStudentId(null)}><X size={20}/></button></div><div className="panel-body"><div className="profile"><Avatar student={selected} large/><div><h3>{selected.name}</h3><p>{selected.className} · 座號 {selected.seat}</p></div></div><div className="profile-facts"><div><span>學號</span><strong>{selected.number}</strong></div><div><span>班級</span><strong>{selected.className}</strong></div><div><span>紀錄總數</span><strong>{selectedEntries.length} 筆</strong></div></div><StudentOverview entries={selectedEntries} today={today} onOpenCase={openCase}/><h3 className="block-title">個人紀錄時間線 <span>{selectedTimeline.length} 項事件</span></h3><p className="timeline-intro">按日期查看紀錄、跟進與結案；紀錄總數指個案數目。</p><StudentTimeline events={selectedTimeline} onOpenCase={openCase}/></div></section></div>}
    {formOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeEntryForm(); }}>
      <section className="panel" role="dialog" aria-modal="true" aria-labelledby="form-title">
        <div className="panel-head"><div><small>CONDUCT RECORD</small><h2 id="form-title">{formReturnCaseId ? "1 建立紀錄 · 更正資料" : "編輯訓育紀錄"}</h2></div><button type="button" aria-label="關閉表單" onClick={closeEntryForm}><X size={20}/></button></div>
        <form className="entry-form" onSubmit={saveEntry}><div className="panel-body">
          <p className="form-intro">選擇校本事項 Code，再填寫事件內容及日期。</p>
          {formReturnCaseId && <p className="case-edit-hint">儲存後會返回原個案；已有的跟進安排及記錄會保留。</p>}
          <StudentPicker students={students} value={draft.studentId} onChange={id => { setDraft(current => ({ ...current, studentId: id })); setEntryError(""); }}/>
          <RulePicker id="entry-rule" value={draft} required onChange={(value) => { setDraft((current) => ({ ...current, ...value })); setEntryError(""); }}/>
          <label className="field"><span>日期 *</span><input type="date" max={today} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required/></label>
          <label className="field"><span>內容說明 *</span><textarea rows={5} maxLength={300} placeholder="簡述事件、已採取的行動或後續安排…" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} required/><small>{draft.note.length}/300 字</small></label>
          {draft.status !== "已結案" ? <fieldset className="entry-follow-field batch-follow-field"><legend>儲存後是否需要跟進？</legend><div className="batch-follow-options">
            <label className={draft.needsFollowUp ? "active" : ""}><input type="radio" name="entry-follow-up" checked={draft.needsFollowUp} onChange={() => setDraft({ ...draft, needsFollowUp: true })}/><span><strong>需要跟進</strong><small>{draft.status === "跟進中" ? "保留目前跟進中的狀態" : "保持未結案，之後安排跟進"}</small></span></label>
            <label className={!draft.needsFollowUp ? "active" : ""}><input type="radio" name="entry-follow-up" checked={!draft.needsFollowUp} onChange={() => setDraft({ ...draft, needsFollowUp: false })}/><span><strong>不需跟進</strong><small>保留紀錄及結案時間，不建立跟進事項</small></span></label>
          </div></fieldset> : <p className="case-edit-hint">此個案已結案，更正資料不會重新開啟跟進。</p>}
          {entryError && <p className="rule-error" role="alert">{entryError}</p>}
          <p className="form-warning"><ShieldCheck size={16}/>這是前端示範版。資料只會在目前頁面暫時顯示。</p>
        </div><div className="panel-foot entry-form-actions"><button type="button" className="btn secondary" onClick={closeEntryForm}>{formReturnCaseId ? "取消並返回個案" : "取消"}</button><button type="submit" className="btn primary" disabled={!draftStudent || !!draftRule.error || !draftRule.rule}><Check size={17}/>{!draft.needsFollowUp && draft.status !== "已結案" ? "儲存並完結" : formReturnCaseId ? "儲存更正並返回" : "儲存變更"}</button></div></form>
      </section>
    </div>}
    {batchFormOpen && <CreateRecordPanel
      step={batchStep}
      draft={batchDraft}
      visibleStudents={batchPage.items}
      pagination={batchPage}
      selectedStudents={batchSelectedStudents}
      selectedIds={batchSelectedIdSet}
      duplicateIds={new Set(batchSelectedStudents.filter(student => batchDuplicateStudentIds.has(student.id)).map(student => student.id))}
      allVisibleSelected={batchAllVisibleSelected}
      classFilter={batchClassFilter}
      search={batchSearch}
      classes={classes}
      skipDuplicates={batchSkipDuplicates}
      createCount={batchStudentsToCreate.length}
      error={batchError}
      draftStatus={batchDraftStatus}
      today={today}
      onClose={() => closeCreateForm()}
      onStepChange={(next) => { setBatchError(""); setBatchStep(next); }}
      onClassFilterChange={setBatchClassFilter}
      onSearch={setBatchSearch}
      onToggleStudent={toggleCreateStudent}
      onToggleVisible={toggleVisibleCreateStudents}
      onClearSelection={() => { setBatchStudentIds([]); setBatchError(""); }}
      onDraftChange={(patch) => { setBatchDraft((current) => ({ ...current, ...patch })); setBatchError(""); }}
      onSkipDuplicatesChange={setBatchSkipDuplicates}
      onNextStudents={goToCreateDetails}
      onSubmitDetails={reviewCreateEntries}
      onConfirm={confirmCreateEntries}
    />}
    {bulkUpdateOpen && <BulkRecordUpdatePanel
      step={bulkUpdateStep}
      draft={bulkUpdateDraft}
      selectedCount={selectedRecordEntries.length}
      affectedCount={bulkUpdateAffectedEntries.length}
      error={bulkUpdateError}
      onClose={closeBulkUpdate}
      onDraftChange={(patch) => { setBulkUpdateDraft((current) => ({ ...current, ...patch })); setBulkUpdateError(""); }}
      onSubmit={reviewBulkUpdate}
      onBack={() => { setBulkUpdateStep("edit"); setBulkUpdateError(""); }}
      onConfirm={confirmBulkUpdate}
    />}
    {selectedCase && caseStudent && <CasePanel key={selectedCase.id} entry={selectedCase} student={caseStudent} onClose={closeCaseView} onEdit={() => editEntry(selectedCase)} onSavePlan={saveCasePlan} onStart={startCase} onAddFollowUp={addFollowUp} onCloseCase={closeCase} onReopen={reopenCase}/>}
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}{undoBatch && notice === `已建立 ${undoBatch.count} 筆訓育紀錄` && <button type="button" className="toast-action" onClick={undoLastBatch}>復原</button>}<button type="button" aria-label="關閉通知" onClick={() => { setNotice(""); setUndoBatch(null); }}><X size={14}/></button></div>}
  </div>;
}

type GlobalSearchProps = {
  recordCount: number;
  onAllRecords: () => void;
  query: string;
  open: boolean;
  results: GlobalSearchResult[];
  activeIndex: number;
  inputRef: RefObject<HTMLInputElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  onOpen: () => void;
  onClose: () => void;
  onQueryChange: (value: string) => void;
  onActiveIndexChange: (index: number) => void;
  onSelect: (result: GlobalSearchResult) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
};

function GlobalSearch({
  query, open, results, activeIndex, inputRef, containerRef, onOpen, onClose, onQueryChange, recordCount, onAllRecords,
  onActiveIndexChange, onSelect, onKeyDown,
}: GlobalSearchProps) {
  return <div className="global-search" ref={containerRef}>
    <div className={"global-search-control" + (open ? " open" : "")}>
      <Search size={16} aria-hidden="true" />
      <input
        ref={inputRef}
        value={query}
        placeholder="全域搜尋…"
        aria-label="全域搜尋"
        aria-expanded={open}
        aria-controls="global-search-results"
        role="combobox"
        aria-autocomplete="list"
        aria-activedescendant={open && results[activeIndex] ? "global-" + results[activeIndex].id : undefined}
        onFocus={onOpen}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
      />
      {query ? <button type="button" className="global-search-clear" aria-label="清除全域搜尋" onClick={() => { onQueryChange(""); inputRef.current?.focus(); }}><X size={14}/></button> : <kbd>Ctrl K</kbd>}
    </div>
    {open && <div className="global-search-panel">
      {!query && <div className="global-search-hint"><Sparkles size={18}/><strong>快速搜尋</strong><p>搜尋學生姓名、班別、學號、事項或內容。</p><span>按 <kbd>Ctrl K</kbd> 可隨時開啟</span></div>}
      {query && results.length > 0 && <>
        <div className="global-search-heading"><span>搜尋結果</span><small>顯示最相關的 {results.length} 項</small></div>
        <div className="global-search-results" id="global-search-results" role="listbox" aria-label="全域搜尋結果">{results.map((result, index) => <button
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          className={"global-search-result" + (index === activeIndex ? " active" : "")}
          key={result.id}
          id={"global-" + result.id}
          onMouseEnter={() => onActiveIndexChange(index)}
          onClick={() => onSelect(result)}
        >
          <span className={"global-search-result-icon " + result.type}>{result.type === "student" ? <UsersRound size={16}/> : <ClipboardList size={16}/>}</span>
          <span className="global-search-result-copy"><strong>{result.title}</strong><small>{result.meta}</small><em>{result.description}</em></span>
          <ChevronRight size={15} className="global-search-result-arrow" />
        </button>)}</div>
      </>}
      {query && !results.length && <div className="global-search-empty"><Search size={20}/><strong>找不到相符內容</strong><p>請試試學生姓名、學號、校本事項或內容關鍵字。</p></div>}
      {query && <div className="global-search-links"><button type="button" onClick={onAllRecords}>完整紀錄結果（{recordCount}）</button></div>}
      {query && <div className="global-search-footer"><span><kbd>↑</kbd><kbd>↓</kbd> 選擇</span><span><kbd>Enter</kbd> 開啟</span><button type="button" onClick={onClose}>關閉</button></div>}
    </div>}
  </div>;
}

type CreateRecordPanelProps = {
  step: CreateStep;
  draft: CreateDraft;
  visibleStudents: Student[];
  pagination: ListPage;
  selectedStudents: Student[];
  selectedIds: Set<string>;
  duplicateIds: Set<string>;
  allVisibleSelected: boolean;
  classFilter: string;
  search: string;
  classes: string[];
  skipDuplicates: boolean;
  createCount: number;
  error: string;
  draftStatus: string;
  today: string;
  onClose: () => void;
  onStepChange: (step: CreateStep) => void;
  onClassFilterChange: (value: string) => void;
  onSearch: (value: string) => void;
  onToggleStudent: (id: string) => void;
  onToggleVisible: () => void;
  onClearSelection: () => void;
  onDraftChange: (patch: Partial<CreateDraft>) => void;
  onSkipDuplicatesChange: (value: boolean) => void;
  onNextStudents: () => void;
  onSubmitDetails: (event: FormEvent<HTMLFormElement>) => void;
  onConfirm: () => void;
};

function CreateRecordPanel({
  step, draft, visibleStudents, selectedStudents, selectedIds, duplicateIds, allVisibleSelected, pagination,
  classFilter, search, classes, skipDuplicates, createCount, error, draftStatus, today, onClose, onStepChange,
  onClassFilterChange, onSearch, onToggleStudent, onToggleVisible, onClearSelection, onDraftChange,
  onSkipDuplicatesChange, onNextStudents, onSubmitDetails, onConfirm,
}: CreateRecordPanelProps) {
  const stepContentRef = useRef<HTMLDivElement>(null);
  const steps: { id: CreateStep; label: string }[] = [
    { id: "students", label: "選擇學生" },
    { id: "details", label: "填寫內容" },
    { id: "review", label: "核對建立" },
  ];
  const stepIndex = steps.findIndex((item) => item.id === step);
  const reviewPage = useListPage(selectedStudents, selectedStudents.map(student => student.id).join(","));
  const duplicateCount = duplicateIds.size;
  const displayedSelected = selectedStudents.slice(0, 6);
  const selectedRule = resolveRuleSelection(draft);
  const visibleGroups = [...visibleStudents.reduce((groups, student) => {
    const group = groups.get(student.className) ?? [];
    group.push(student);
    groups.set(student.className, group);
    return groups;
  }, new Map<string, Student[]>())];
  useEffect(() => {
    if (step !== "students") stepContentRef.current?.focus();
  }, [step]);
  function trapDialogFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel batch-panel" role="dialog" aria-modal="true" aria-labelledby="batch-form-title" onKeyDown={trapDialogFocus}>
      <div className="panel-head"><div><small>CONDUCT RECORD</small><h2 id="batch-form-title">新增訓育紀錄</h2></div><button type="button" aria-label="關閉新增訓育紀錄" onClick={onClose}><X size={20}/></button></div>
      <div className="batch-steps" aria-label="新增訓育紀錄步驟">{steps.map((item, index) => <div key={item.id} className={(index === stepIndex ? "active" : "") + (index < stepIndex ? " done" : "")}><b>{index < stepIndex ? <Check size={13}/> : index + 1}</b><span>{item.label}</span></div>)}</div>
      {draftStatus && <p className="draft-save-status" role="status"><CheckCircle2 size={15}/>{draftStatus}</p>}

      {step === "students" && <div className="entry-form">
        <div className="panel-body batch-body" ref={stepContentRef}>
          <p className="form-intro">可選擇 1 位或多位學生。切換班級、搜尋或翻頁時，已選名單會保留。</p>
          <div className="batch-student-toolbar">
            <label className="field"><span>班別</span><select value={classFilter} onChange={(event) => onClassFilterChange(event.target.value)}>{classes.map((className) => <option key={className}>{className}</option>)}</select></label>
            <label className="batch-search"><Search size={16}/><input autoFocus aria-label="搜尋學生" placeholder="搜尋姓名或學號" value={search} onChange={(event) => onSearch(event.target.value)}/></label>
          </div>
          <div className="batch-picker-head"><div><strong>學生名單</strong><span aria-live="polite">目前顯示 {visibleStudents.length} 位</span></div><div><button type="button" onClick={onToggleVisible} disabled={!visibleStudents.length}>{allVisibleSelected ? "取消本頁選取" : "全選本頁"}</button><button type="button" onClick={onClearSelection} disabled={!selectedStudents.length}>清除已選</button></div></div>
          <div className="batch-student-list" aria-label="可選學生">
            {visibleGroups.map(([groupClass, groupStudents]) => <section className="batch-class-group" key={groupClass} aria-labelledby={`create-student-group-${groupClass}`}>
              <h3 id={`create-student-group-${groupClass}`}>{groupClass}</h3>
              {groupStudents.map((student) => <label key={student.id} className={"batch-student-row" + (selectedIds.has(student.id) ? " selected" : "")}>
                <input type="checkbox" checked={selectedIds.has(student.id)} onChange={() => onToggleStudent(student.id)}/>
                <strong>{student.name}</strong>
              </label>)}
            </section>)}
            {!visibleStudents.length && <div className="batch-empty"><Search size={20}/><strong>找不到學生</strong><span>請更改班別或搜尋字詞。</span></div>}
          </div>
          <ListPagination page={pagination} label="選擇學生" unit="位"/>
          <div className="batch-selected-summary" aria-live="polite"><div><strong>已選 {selectedStudents.length} 位學生</strong><span>可單選、多選或跨班選擇</span></div>{selectedStudents.length > 0 && <section>{displayedSelected.map((student) => <span key={student.id}>{student.className} · {student.name}</span>)}{selectedStudents.length > displayedSelected.length && <b>另有 {selectedStudents.length - displayedSelected.length} 位</b>}</section>}</div>
          {error && <p className="batch-error" role="alert">{error}</p>}
        </div>
        <div className="panel-foot"><button type="button" className="btn secondary" onClick={onClose}>取消</button><button type="button" className="btn primary" onClick={onNextStudents}>下一步：填寫內容 <ArrowRight size={16}/></button></div>
      </div>}

      {step === "details" && <form className="entry-form" onSubmit={onSubmitDetails}>
        <div className="panel-body batch-body" ref={stepContentRef} tabIndex={-1} aria-label="新增訓育紀錄第 2 步：填寫內容">
          <p className="form-intro">以下內容會分別加入 {selectedStudents.length} 位學生的個人紀錄；每筆紀錄之後可獨立修改及跟進。</p>
          <RulePicker id="create-rule" value={draft} onChange={onDraftChange}/>
          <label className="field"><span>日期 *</span><input type="date" max={today} value={draft.date} onChange={(event) => onDraftChange({ date: event.target.value })} required/></label>
          <label className="field"><span>內容說明 *</span><textarea rows={5} maxLength={300} placeholder="輸入所有已選學生共用的事項內容…" value={draft.note} onChange={(event) => onDraftChange({ note: event.target.value })} required/><small>{draft.note.length}/300 字</small></label>
          <fieldset className="batch-follow-field"><legend>建立後是否需要跟進？</legend><div className="batch-follow-options">
            <label className={!draft.needsFollowUp ? "active" : ""}><input type="radio" name="create-follow-up" checked={!draft.needsFollowUp} onChange={() => onDraftChange({ needsFollowUp: false })}/><span><strong>不需跟進</strong><small>建立後直接結案，不建立跟進事項</small></span></label>
            <label className={draft.needsFollowUp ? "active" : ""}><input type="radio" name="create-follow-up" checked={draft.needsFollowUp} onChange={() => onDraftChange({ needsFollowUp: true })}/><span><strong>需要跟進</strong><small>每位學生各自建立一項待辦</small></span></label>
          </div></fieldset>
          {draft.needsFollowUp && <div className="batch-follow-fields"><div className="field-row"><label className="field"><span>負責人</span><input maxLength={40} placeholder="例如：中一級班主任" value={draft.assignee} onChange={(event) => onDraftChange({ assignee: event.target.value })}/></label><label className="field"><span>跟進期限</span><input type="date" min={draft.date} value={draft.dueDate} onChange={(event) => onDraftChange({ dueDate: event.target.value })}/></label></div><small>兩項均可留空，之後可在個案詳情逐筆安排。</small></div>}
          {error && <p className="batch-error" role="alert">{error}</p>}
          <p className="form-warning"><ShieldCheck size={16}/> 草稿會儲存在這個瀏覽器；正式建立後會自動清除。不要在共用電腦輸入真實學生資料。</p>
        </div>
        <div className="panel-foot"><button type="button" className="btn secondary" onClick={() => onStepChange("students")}>返回選擇</button><button type="submit" className="btn primary" disabled={!selectedRule.rule || !!selectedRule.error}>下一步：核對紀錄 <ArrowRight size={16}/></button></div>
      </form>}

      {step === "review" && <div className="entry-form">
        <div className="panel-body batch-body" ref={stepContentRef} tabIndex={-1} aria-label="新增訓育紀錄第 3 步：核對建立">
          <div className="batch-review-hero"><span><ClipboardList size={23}/></span><div><small>準備建立</small><strong>{createCount} 筆獨立紀錄</strong><p>建立後，每位學生的時間線及個案會分開顯示。</p></div></div>
          {selectedRule.rule && <RuleDetails rule={selectedRule.rule} scoreChange={selectedRule.scoreChange}/>}
          <div className="batch-review-grid"><div><span>日期</span><strong>{dateLabel(draft.date)}</strong></div><div><span>跟進狀態</span><strong>{draft.needsFollowUp ? "待跟進" : "不需跟進（已結案）"}</strong></div>{draft.needsFollowUp && <><div><span>負責人</span><strong>{draft.assignee.trim() || "未指定"}</strong></div><div><span>跟進期限</span><strong>{draft.dueDate ? dateLabel(draft.dueDate) : "未設定"}</strong></div></>}</div>
          <div className="batch-review-note"><span>內容說明</span><p>{draft.note.trim()}</p></div>
          <div className="batch-review-list-head"><div><strong>學生名單</strong><span>{selectedStudents.length} 位</span></div>{duplicateCount > 0 && <b>{duplicateCount} 筆可能重複</b>}</div>
          <div className="batch-review-list">{reviewPage.items.map((student) => <div key={student.id} className={duplicateIds.has(student.id) ? "duplicate" : ""}><Avatar student={student}/><span><strong>{student.name}</strong><small>{student.className} · 座號 {student.seat} · {student.number}</small></span>{duplicateIds.has(student.id) ? <em>{skipDuplicates ? "將略過" : "仍會建立"}</em> : <CheckCircle2 size={17}/>}</div>)}</div>
          <ListPagination page={reviewPage} label="核對名單" unit="位"/>
          {duplicateCount > 0 && <label className="batch-duplicate-option"><input type="checkbox" checked={skipDuplicates} onChange={(event) => onSkipDuplicatesChange(event.target.checked)}/><span><strong>略過 {duplicateCount} 筆完全重複紀錄</strong><small>同一學生、日期、校本範疇、Code、加減分數及內容完全相同。</small></span></label>}
          {createCount === 0 && <p className="batch-error" role="alert">全部所選學生已有相同紀錄。請取消「略過重複紀錄」，或返回修改內容。</p>}
          {error && <p className="batch-error" role="alert">{error}</p>}
        </div>
        <div className="panel-foot"><button type="button" className="btn secondary" onClick={() => onStepChange("details")}>返回修改</button><button type="button" className="btn primary" onClick={onConfirm} disabled={createCount === 0}><Check size={17}/>建立 {createCount} 筆紀錄</button></div>
      </div>}
    </section>
  </div>;
}

function BulkRecordUpdatePanel({ step, draft, selectedCount, affectedCount, error, onClose, onDraftChange, onSubmit, onBack, onConfirm }: {
  step: BulkUpdateStep;
  draft: BulkRecordUpdate;
  selectedCount: number;
  affectedCount: number;
  error: string;
  onClose: () => void;
  onDraftChange: (patch: Partial<BulkRecordUpdate>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const unchangedCount = selectedCount - affectedCount;
  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel bulk-update-panel" role="dialog" aria-modal="true" aria-labelledby="bulk-update-title">
      <div className="panel-head"><div><small>BULK UPDATE</small><h2 id="bulk-update-title">批次更新訓育紀錄</h2></div><button type="button" aria-label="關閉批次更新" onClick={onClose}><X size={20}/></button></div>
      {step === "edit" ? <form className="entry-form" onSubmit={onSubmit}>
        <div className="panel-body">
          <div className="bulk-update-count"><ClipboardList size={20}/><span><strong>已選 {selectedCount.toLocaleString()} 筆紀錄</strong><small>勾選要統一修改的欄位；未勾選的內容會保持不變。</small></span></div>
          <div className="bulk-update-options">
            <section className={draft.assigneeEnabled ? "active" : ""}>
              <label><input type="checkbox" checked={draft.assigneeEnabled} onChange={(event) => onDraftChange({ assigneeEnabled: event.target.checked })}/><span><strong>統一指定負責人</strong><small>留空可清除原有負責人</small></span></label>
              {draft.assigneeEnabled && <input aria-label="批次指定負責人" autoFocus value={draft.assignee} maxLength={60} placeholder="例如：訓育主任" onChange={(event) => onDraftChange({ assignee: event.target.value })}/>}
            </section>
            <section className={draft.dueDateEnabled ? "active" : ""}>
              <label><input type="checkbox" checked={draft.dueDateEnabled} onChange={(event) => onDraftChange({ dueDateEnabled: event.target.checked })}/><span><strong>統一指定跟進期限</strong><small>留空可清除原有期限</small></span></label>
              {draft.dueDateEnabled && <input aria-label="批次指定跟進期限" type="date" value={draft.dueDate} onChange={(event) => onDraftChange({ dueDate: event.target.value })}/>}
            </section>
            <section className={draft.statusEnabled ? "active" : ""}>
              <label><input type="checkbox" checked={draft.statusEnabled} onChange={(event) => onDraftChange({ statusEnabled: event.target.checked })}/><span><strong>統一指定個案狀態</strong><small>結案或重新開啟都會保留歷史</small></span></label>
              {draft.statusEnabled && <select aria-label="批次指定個案狀態" value={draft.status} onChange={(event) => onDraftChange({ status: event.target.value as Status })}><option>待跟進</option><option>跟進中</option><option>已結案</option></select>}
            </section>
          </div>
          {error && <p className="batch-error" role="alert">{error}</p>}
          <p className="form-warning"><ShieldCheck size={16}/>下一步會先顯示實際影響筆數及變更內容；確認前不會修改紀錄。</p>
        </div>
        <div className="panel-foot"><button type="button" className="btn secondary" onClick={onClose}>取消</button><button type="submit" className="btn primary">預覽影響筆數 <ArrowRight size={16}/></button></div>
      </form> : <div className="entry-form">
        <div className="panel-body">
          <div className="batch-review-hero"><span><ClipboardList size={23}/></span><div><small>確認批次變更</small><strong>即將更新 {affectedCount.toLocaleString()} 筆紀錄</strong><p>原先選取 {selectedCount.toLocaleString()} 筆{unchangedCount > 0 ? `，其中 ${unchangedCount.toLocaleString()} 筆設定相同，不會重寫` : "，全部都會受影響"}。</p></div></div>
          <dl className="bulk-update-summary">
            {draft.assigneeEnabled && <div><dt>負責人</dt><dd>{draft.assignee.trim() || "清除負責人"}</dd></div>}
            {draft.dueDateEnabled && <div><dt>跟進期限</dt><dd>{draft.dueDate ? dateLabel(draft.dueDate) : "清除跟進期限"}</dd></div>}
            {draft.statusEnabled && <div><dt>個案狀態</dt><dd>{draft.status}</dd></div>}
          </dl>
          {draft.statusEnabled && draft.status === "已結案" && <p className="bulk-update-impact-note">改為「已結案」會加入一筆批次結案歷史；原有跟進資料不會刪除。</p>}
          {draft.statusEnabled && draft.status !== "已結案" && <p className="bulk-update-impact-note">已結案個案會重新開啟，保留舊結案歷史並加入一筆重新開啟記錄。</p>}
          <p className="form-warning"><RotateCcw size={16}/>完成後可在紀錄頁復原最近一次批次變更，還原這 {affectedCount.toLocaleString()} 筆紀錄的完整內容。</p>
          {error && <p className="batch-error" role="alert">{error}</p>}
        </div>
        <div className="panel-foot"><button type="button" className="btn secondary" onClick={onBack}>返回修改</button><button type="button" className="btn primary" onClick={onConfirm} disabled={!affectedCount}><Check size={17}/>確認更新 {affectedCount.toLocaleString()} 筆</button></div>
      </div>}
    </section>
  </div>;
}

function FilterSummary({ labels, onReset }: { labels: string[]; onReset: () => void }) {
  if (!labels.length) return null;
  return <div className="active-filters" aria-label="已套用條件">
    <span className="filter-summary-label"><Filter size={13}/>已套用</span>
    {labels.map((label, index) => <span className="filter-chip" key={index + "-" + label}>{label}</span>)}
    <button type="button" onClick={onReset}><RotateCcw size={13}/>清除全部</button>
  </div>;
}

function RecordsDirectory({ entries, totalCount, pagination, studentMap, search, classFilter, kindFilter, categoryFilter, statusFilter, assigneeFilter, dateFrom, dateTo, dateRangeInvalid, sort, filtersOpen, activeFilters, classes, categories: recordCategories, assignees, selectedIds, allVisibleSelected, onSearch, onClassFilterChange, onKindFilterChange, onCategoryFilterChange, onStatusFilterChange, onAssigneeFilterChange, onDateFromChange, onDateToChange, onSortChange, onFiltersOpenChange, onReset, onOpenCase, onToggleSelection, onToggleVisible, onClearSelection, onBulkUpdate }: {
  entries: Entry[];
  pagination: ListPage;
  totalCount: number;
  studentMap: Map<string, Student>;
  search: string;
  classFilter: string;
  kindFilter: string;
  categoryFilter: string;
  statusFilter: string;
  assigneeFilter: string;
  dateFrom: string;
  dateTo: string;
  dateRangeInvalid: boolean;
  sort: RecordSort;
  filtersOpen: boolean;
  activeFilters: string[];
  classes: string[];
  categories: string[];
  assignees: string[];
  selectedIds: ReadonlySet<string>;
  allVisibleSelected: boolean;
  onSearch: (value: string) => void;
  onClassFilterChange: (value: string) => void;
  onKindFilterChange: (value: string) => void;
  onCategoryFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onAssigneeFilterChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onSortChange: (value: RecordSort) => void;
  onFiltersOpenChange: (value: boolean) => void;
  onReset: () => void;
  onOpenCase: (id: string) => void;
  onToggleSelection: (id: string) => void;
  onToggleVisible: () => void;
  onClearSelection: () => void;
  onBulkUpdate: () => void;
}) {
  const advancedCount = Number(categoryFilter !== "全部事項") + Number(assigneeFilter !== ALL_ASSIGNEES) + Number(Boolean(dateFrom)) + Number(Boolean(dateTo));
  return <section className="card table-card">
    <div className="table-heading">
      <div><small>CONDUCT RECORDS</small><h2>符合條件的紀錄 <b>{pagination.total}</b></h2></div>
      <div className="filters list-toolbar">
        <label className="search"><Search size={16}/><input aria-label="搜尋紀錄" placeholder="搜尋學生、學號或事項" value={search} onChange={(event) => onSearch(event.target.value)}/></label>
        <label className="select toolbar-select"><ArrowUpDown size={15}/><select aria-label="紀錄排序" value={sort} onChange={(event) => onSortChange(event.target.value as RecordSort)}>
          <option value="date-desc">日期：最新</option><option value="date-asc">日期：最舊</option><option value="updated-desc">最近活動</option><option value="student-asc">班級及座號</option><option value="status-priority">跟進狀態</option>
        </select></label>
        <button type="button" className={"advanced-toggle" + (filtersOpen ? " active" : "")} aria-expanded={filtersOpen} aria-controls="record-advanced-filters" onClick={() => onFiltersOpenChange(!filtersOpen)}><SlidersHorizontal size={15}/>進階篩選{advancedCount > 0 && <b>{advancedCount}</b>}</button>
      </div>
      {selectedIds.size > 0 && <div className="record-selection-toolbar" role="status"><span><strong>已選 {selectedIds.size.toLocaleString()} 筆紀錄</strong><small>可跨頁及篩選保留選取</small></span><div><button type="button" className="btn secondary" onClick={onClearSelection}>清除選取</button><button type="button" className="btn primary" onClick={onBulkUpdate}>批次更新</button></div></div>}
    </div>
    {filtersOpen && <div className="advanced-filter-panel" id="record-advanced-filters">
      <div className="advanced-filter-head"><div><strong>篩選訓育紀錄</strong><span>所有條件會同時套用</span></div><button type="button" onClick={onReset}><RotateCcw size={14}/>重設</button></div>
      <div className="advanced-filter-grid">


        <label className="filter-field"><span>校本事項</span><select value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value)}>{recordCategories.map((item) => <option key={item}>{item}</option>)}</select></label>

        <label className="filter-field"><span>負責人</span><select value={assigneeFilter} onChange={(event) => onAssigneeFilterChange(event.target.value)}>{assignees.map((item) => <option value={item} key={item}>{assigneeOptionLabel(item)}</option>)}</select></label>
        <div className="date-range-group"><span>紀錄日期</span><div><label><span className="sr-only">開始日期</span><input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => onDateFromChange(event.target.value)}/></label><i>至</i><label><span className="sr-only">結束日期</span><input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => onDateToChange(event.target.value)}/></label></div></div>
      </div>
      {dateRangeInvalid && <p className="filter-error" role="alert">開始日期不可遲於結束日期；修正前暫不套用日期條件。</p>}
    </div>}
    <div className="persistent-filters"><label className="filter-field"><span>班級</span><select value={classFilter} onChange={(event) => onClassFilterChange(event.target.value)}>{classes.map((item) => <option key={item}>{item}</option>)}</select></label><label className="filter-field"><span>校本範疇</span><select value={kindFilter} onChange={(event) => onKindFilterChange(event.target.value)}><option>全部範疇</option>{SCHOOL_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label><label className="filter-field"><span>個案狀態</span><select value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}><option>全部狀態</option><option>待跟進</option><option>跟進中</option><option>已結案</option></select></label></div>
    <FilterSummary labels={activeFilters} onReset={onReset}/>
    <div className="table-scroll"><table className="records-table"><thead><tr><th className="record-select-col"><input type="checkbox" aria-label={allVisibleSelected ? "取消選取本頁紀錄" : "選取本頁紀錄"} checked={allVisibleSelected} onChange={onToggleVisible}/></th><th>日期 / 學生</th><th>範疇</th><th>事項</th><th>實際加減分</th><th>狀態</th></tr></thead><tbody>{entries.map((entry) => {
      const student = studentMap.get(entry.studentId)!;
      const selected = selectedIds.has(entry.id);
      const openRecord = () => onOpenCase(entry.id);
      return <tr key={entry.id} className={`record-row${selected ? " selected" : ""}`} tabIndex={0} aria-label={`查看 ${student.name} 的 ${entry.category} 紀錄詳情`} onClick={openRecord} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openRecord(); } }}><td className="record-select-col" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}><input type="checkbox" aria-label={`選取 ${student.name} 的 ${entry.category} 紀錄`} checked={selected} onChange={() => onToggleSelection(entry.id)}/></td><td><div className="person"><Avatar student={student}/><div><strong>{student.name} <span>· {student.className}</span></strong><small>座號 {student.seat} · {student.number}</small><small>{dateLabel(entry.date)}</small></div></div></td><td data-label="範疇"><KindTag kind={entry.kind}/></td><td className="record-item"><strong>{entry.category}</strong><small className="entry-note">{entry.note}</small></td><td data-label="本次加減分"><strong className="actual-score">{scoreLabel(entry)}</strong></td><td data-label="狀態"><StatusTag status={entry.status}/></td></tr>;
    })}</tbody></table>{!entries.length && <Empty text="沒有符合條件的紀錄" hint="可清除條件後重新查看全部紀錄。" onReset={activeFilters.length ? onReset : undefined}/>}</div>
    <ListPagination page={pagination} label="獎懲紀錄"/>
    <div className="list-total-note">全部 {totalCount.toLocaleString()} 筆紀錄 · 每筆均使用校本 Code 及實際加減分</div>
  </section>;
}

function StudentOverview({ entries, today, onOpenCase }: { entries: Entry[]; today: string; onOpenCase: (id: string) => void }) {
  const [period, setPeriod] = useState("all");
  const start = addDays(today, -29);
  const scoped = entries.filter((entry) => period === "all" || (entry.date >= start && entry.date <= today));
  const open = entries.filter((entry) => entry.status !== "已結案").sort((a, b) =>
    (a.dueDate || "9999").localeCompare(b.dueDate || "9999") || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const overdue = open.filter((entry) => entry.dueDate && entry.dueDate < today).length;
  const dueToday = open.filter((entry) => entry.dueDate === today).length;
  const unscheduled = open.filter((entry) => !entry.dueDate).length;
  const closed = scoped.filter((entry) => entry.status === "已結案").length;
  const latest = buildStudentTimeline(entries)[0];
  return <section className="student-overview" aria-labelledby="student-overview-title">
    <div className="overview-heading"><h3 id="student-overview-title"><BookOpenCheck size={17}/>學生概況摘要</h3><label><span className="sr-only">摘要紀錄期間</span><select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="all">全部紀錄</option><option value="30">近 30 日</option></select></label></div>
    <section className="school-base-scores" aria-labelledby="school-base-scores-title">
      <h4 id="school-base-scores-title">校本基礎分 <span>BaseScore</span></h4>
      <dl className="school-score-grid">
        {SCHOOL_CATEGORIES.map((category) => <div key={category}>
          <dt>{category}</dt>
          <dd>{SCHOOL_BASE_SCORES[category]}<span> 分</span></dd>
        </div>)}
      </dl>
      <p>每位學生均採用以上起始分，不受紀錄期間影響。目前尚未套用獎懲加減分。</p>
    </section>
    <p className="overview-period">{period === "all" ? "全部已登記紀錄" : `${dateLabel(start)} — ${dateLabel(today)} · 按事件日期`}</p>
    <p className="overview-description" aria-live="polite">{!entries.length ? "尚未登記任何紀錄，暫無足夠資料整理學生概況。" : !scoped.length ? "此期間沒有新增紀錄，可切換「全部紀錄」查看其他日期的資料。" : `此期間共有 ${scoped.length} 筆紀錄，其中 ${closed} 筆目前已結案、${scoped.length - closed} 筆仍需跟進。`}</p>
    <div className="overview-followup-heading"><h4>目前跟進事項</h4><span>所有日期 · {open.length} 項未結案</span></div>
    {open.length > 0 ? <>
      <div className="overview-alerts"><span className={overdue ? "is-overdue" : ""}>逾期 {overdue}</span><span>今日到期 {dueToday}</span><span>未設期限 {unscheduled}</span></div>
      <div className="overview-cases">{open.map((entry) => {
        const due = followUpDueMeta(entry, today);
        return <button type="button" key={entry.id} onClick={() => onOpenCase(entry.id)} aria-label={`查看${entry.category}個案`}>
          <span><strong>{entry.category}</strong><small>{entry.assignee || "未指定負責人"} · {entry.status}</small><small className={due.tone === "overdue" ? "is-overdue" : ""}>{due.label}{entry.dueDate ? ` · ${dateLabel(entry.dueDate)}` : ""}</small></span><ChevronRight size={16}/>
        </button>;
      })}</div>
    </> : <p className="overview-clear"><CheckCircle2 size={16}/>{entries.length ? "目前沒有未結案事項。" : "尚無跟進事項。"}</p>}
    {latest && <button type="button" className="overview-latest" onClick={() => onOpenCase(latest.caseId)}><span><small>最近活動 · {dateLabel(latest.date)}</small><strong>{latest.category} · {latest.type === "record" ? "新增紀錄" : latest.type === "closed" ? "結案" : latest.type === "reopened" ? "重新開啟" : "跟進"}</strong><span>{latest.detail}</span></span><ChevronRight size={16}/></button>}
    <p className="overview-note">摘要按已登記紀錄整理，不代表學生的整體表現。修改紀錄或跟進狀態後會同步更新。</p>
  </section>;
}

function StudentTimeline({ events, onOpenCase }: { events: TimelineEvent[]; onOpenCase: (id: string) => void }) {
  if (!events.length) return <p className="timeline-empty">目前沒有訓育紀錄或跟進事件。</p>;
  return <ol className="student-timeline">
    {events.map((event) => {
      const Icon = event.type === "record" ? ClipboardList : event.type === "closed" ? CheckCircle2 : event.type === "reopened" ? ArrowRight : Clock3;
      const title = event.type === "record" ? "建立訓育紀錄" : event.type === "closed" ? "完成結案" : event.type === "reopened" ? "重新開啟個案" : "加入跟進記錄";
      return <li key={event.id} className={"timeline-item " + event.type}>
        <span className="timeline-dot" aria-hidden="true"><Icon size={14}/></span>
        <article className="timeline-card">
          <div className="timeline-card-head"><strong>{title}</strong><time dateTime={event.date}>{dateLabel(event.date)}</time></div>
          <div className="timeline-card-category">{event.category}{event.type === "record" && <KindTag kind={event.kind}/>}</div>
          <p>{event.detail}</p>
          <div className="timeline-card-foot">
            {event.type === "record" ? <StatusTag status={event.status}/> : <span>{event.author ?? (event.type === "closed" ? "結案結果" : "訓育組")}</span>}
            <button type="button" className="row-button" onClick={() => onOpenCase(event.caseId)}>查看個案 <ChevronRight size={14}/></button>
          </div>
        </article>
      </li>;
    })}
  </ol>;
}
function CasePanel({ entry, student, onClose, onEdit, onSavePlan, onStart, onAddFollowUp, onCloseCase, onReopen }: {
  entry: Entry; student: Student; onClose: () => void; onEdit: () => void;
  onSavePlan: (id: string, assignee: string, dueDate: string) => void;
  onStart: (id: string) => void; onAddFollowUp: (id: string, note: string) => void;
  onCloseCase: (id: string, summary: string, direct?: boolean) => void; onReopen: (id: string) => void;
}) {
  const [assignee, setAssignee] = useState(entry.assignee ?? "");
  const [dueDate, setDueDate] = useState(entry.dueDate ?? "");
  const [followUpNote, setFollowUpNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [directCloseOpen, setDirectCloseOpen] = useState(false);
  const [directCloseReason, setDirectCloseReason] = useState("");
  const isClosed = entry.status === "已結案";
  const followUps = entry.followUps ?? [];
  const followUpSkipped = isClosed && entry.closedWithoutFollowUp && !followUps.length;
  const hasUnsavedFollowUp = assignee !== (entry.assignee ?? "") || dueDate !== (entry.dueDate ?? "") || !!followUpNote.trim() || !!resolution.trim();

  function returnToRecord() {
    if ((hasUnsavedFollowUp || directCloseReason.trim()) && !window.confirm("尚未儲存的跟進內容會被捨棄；已儲存的記錄不受影響。確定返回更正？")) return;
    onEdit();
  }
  function submitDirectClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasUnsavedFollowUp && !window.confirm("尚未儲存的跟進內容不會保存。確定直接完結？")) return;
    onCloseCase(entry.id, directCloseReason.trim() || DIRECT_CLOSURE_REASON, true);
    setDirectCloseOpen(false); setDirectCloseReason("");
    setFollowUpNote(""); setResolution("");
    setAssignee(entry.assignee ?? ""); setDueDate(entry.dueDate ?? "");
  }

  function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!followUpNote.trim()) return;
    onAddFollowUp(entry.id, followUpNote);
    setFollowUpNote("");
  }
  function submitClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolution.trim()) return;
    onCloseCase(entry.id, resolution);
    setResolution("");
  }

  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel case-panel" role="dialog" aria-modal="true" aria-labelledby="case-title">
      <div className="panel-head"><div><small>CASE DETAILS / 個案跟進</small><h2 id="case-title">個案詳情</h2></div><button type="button" aria-label="關閉個案詳情" onClick={onClose}><X size={20}/></button></div>
      <div className="panel-body case-body">
        <div className="case-person"><Avatar student={student} large/><div><h3>{student.name}</h3><p>{student.className} · 座號 {student.seat} · 學號 {student.number}</p></div><StatusTag status={entry.status}/></div>
        <div className="case-steps" aria-label="個案流程">
          <button type="button" className="active" onClick={returnToRecord} title="返回建立紀錄，更正資料" aria-label="1 建立紀錄：返回更正">1 建立紀錄<FilePenLine size={14}/></button><span className={followUpSkipped ? "skipped" : entry.status !== "待跟進" ? "active" : ""} aria-current={entry.status === "跟進中" ? "step" : undefined}>{followUpSkipped ? "2 不需跟進" : "2 跟進處理"}</span><span className={isClosed ? "active" : ""} aria-current={isClosed ? "step" : undefined}>3 結案</span>
        </div>
        <p className="case-flow-hint">按「1 建立紀錄」可返回更正，已儲存的跟進記錄會保留。</p>
        {!isClosed && <div className="case-direct-close">
          {!directCloseOpen ? <button type="button" className="btn secondary" onClick={() => setDirectCloseOpen(true)}><CheckCircle2 size={16}/>不需跟進，直接完結</button> : <form onSubmit={submitDirectClosure}>
            <strong>確認直接完結此個案？</strong>
            <p>將標記為已結案，不再列為未結案事項；已儲存的跟進記錄及安排會保留。</p>
            <label className="field"><span>完結原因（選填）</span><textarea rows={2} maxLength={500} value={directCloseReason} placeholder={DIRECT_CLOSURE_REASON} onChange={(event) => setDirectCloseReason(event.target.value)}/></label>
            <div className="case-direct-actions"><button type="button" className="btn secondary" onClick={() => setDirectCloseOpen(false)}>繼續跟進</button><button type="submit" className="btn primary"><Check size={16}/>確認直接完結</button></div>
          </form>}
        </div>}
        <section className="case-section"><div className="case-section-head"><h3>事項資料</h3><button type="button" className="row-button" onClick={returnToRecord}><FilePenLine size={14}/>編輯紀錄</button></div>
          <div className="case-facts"><div><span>紀錄日期</span><strong>{dateLabel(entry.date)}</strong></div><div><span>校本範疇</span><KindTag kind={entry.kind}/></div><div><span>校本事項</span><strong>{entry.category}</strong></div></div>
          {entry.rule && <RuleDetails rule={entry.rule} scoreChange={entry.scoreChange}/>}
          <p className="case-description">{entry.note}</p>
        </section>
        <section className="case-section"><div className="case-section-head"><h3>跟進安排</h3></div>
          {isClosed ? <div className="case-facts"><div><span>負責人</span><strong>{entry.assignee || "未指定"}</strong></div><div><span>跟進期限</span><strong>{entry.dueDate ? dateLabel(entry.dueDate) : "未設定"}</strong></div></div> : <form className="case-plan" onSubmit={(event) => { event.preventDefault(); onSavePlan(entry.id, assignee, dueDate); }}>
            <div className="field-row"><label className="field"><span>負責人</span><input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="例如：班主任" maxLength={60}/></label><label className="field"><span>跟進期限</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label></div>
            <button type="submit" className="btn secondary">儲存安排</button>
          </form>}
        </section>
        <section className="case-section"><div className="case-section-head"><h3>跟進記錄</h3><span>{followUps.length} 則</span></div>
          {followUps.length ? <ol className="case-timeline">{followUps.map((item) => <li key={item.id}><div><strong>{item.author}</strong><time dateTime={item.date}>{dateLabel(item.date)}</time></div><p>{item.note}</p></li>)}</ol> : <p className="case-empty">尚未加入跟進記錄。</p>}
          {!isClosed && <form className="case-follow-form" onSubmit={submitFollowUp}><label className="field"><span>新增跟進記錄</span><textarea rows={3} maxLength={500} placeholder="記下聯絡、面談、觀察或下一步…" value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} required/></label><button type="submit" className="btn secondary"><Plus size={15}/>加入記錄</button></form>}
        </section>
        <section className="case-section case-closing"><div className="case-section-head"><h3>結案處理</h3></div>
          {isClosed ? <><p className="case-closed-date">結案日期：{entry.closedAt ? dateLabel(entry.closedAt) : "未有結案日期"}</p><p className="case-description">{entry.resolution || "這筆紀錄沒有結案摘要。"}</p><div className="case-closed-actions"><button type="button" className="btn secondary" onClick={() => onReopen(entry.id)}>重新開啟個案</button><button type="button" className="btn primary" onClick={onClose}>確定</button></div></> : <form onSubmit={submitClosure}><label className="field"><span>處理結果及結案摘要 *</span><textarea rows={3} maxLength={500} placeholder="說明已採取的行動、結果，以及為何可以結案…" value={resolution} onChange={(event) => setResolution(event.target.value)} required/></label><button type="submit" className="btn primary"><Check size={16}/>完成結案</button></form>}
        </section>
      </div>
      {!isClosed && entry.status === "待跟進" && <div className="panel-foot"><button type="button" className="btn secondary" onClick={() => onStart(entry.id)}>開始跟進</button></div>}
    </section>
  </div>;
}
function Empty({ text, hint, onReset }: { text: string; hint: string; onReset?: () => void }) { return <div className="empty"><Search size={23}/><strong>{text}</strong><p>{hint}</p>{onReset && <button type="button" className="btn secondary" onClick={onReset}><RotateCcw size={14}/>清除條件</button>}</div>; }
