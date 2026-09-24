import type { Entry, FollowUp, Kind, Status } from "./conduct-types";
import type { CaseClosure } from "./case-workflow";
import type { ConductRule } from "./conduct-rules";
import type { SchoolCategory } from "./school-rules";

export const RECORD_EXPORT_FORMAT = "campus-conduct-records";
export const RECORD_EXPORT_VERSION = 1;
export const MAX_RECORD_IMPORT_BYTES = 5_000_000;
const MAX_RECORDS = 10_000;
const SCHOOL_CATEGORIES: readonly SchoolCategory[] = ["守規", "勤學", "勤到"];
const KINDS = new Set<Kind>(["嘉許", "提醒", "違規", ...SCHOOL_CATEGORIES]);
const STATUSES = new Set<Status>(["待跟進", "跟進中", "已結案"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type JsonObject = Record<string, unknown>;

export type RecordExport = {
  format: typeof RECORD_EXPORT_FORMAT;
  version: typeof RECORD_EXPORT_VERSION;
  exportedAt: string;
  entries: Entry[];
};

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

function requiredString(value: unknown, label: string, maxLength = 10_000) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label}缺少文字內容。`);
  if (value.length > maxLength) throw new Error(`${label}內容過長。`);
  return value;
}

function optionalString(value: unknown, label: string, maxLength = 10_000) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > maxLength) throw new Error(`${label}格式不正確。`);
  return value;
}

function requiredDate(value: unknown, label: string) {
  const date = requiredString(value, label, 10);
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (!DATE_PATTERN.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`${label}不是有效日期。`);
  return date;
}

function optionalBoolean(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${label}格式不正確。`);
  return value;
}

function optionalNumber(value: unknown, label: string) {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label}不是有效數值。`);
  return value;
}

function parseRule(value: unknown, label: string): ConductRule | undefined {
  if (value === undefined) return undefined;
  if (!isObject(value)) throw new Error(`${label}規則資料格式不正確。`);
  const category = requiredString(value.category, `${label}規則範疇`, 10);
  if (!SCHOOL_CATEGORIES.includes(category as SchoolCategory)) throw new Error(`${label}規則範疇不受支援。`);
  const score = optionalNumber(value.score, `${label}規則預設分數`);
  const minScore = optionalNumber(value.minScore, `${label}規則最低分數`);
  const maxScore = optionalNumber(value.maxScore, `${label}規則最高分數`);
  if (score === undefined || minScore === undefined || maxScore === undefined) throw new Error(`${label}規則分數資料不完整。`);
  return {
    code: requiredString(value.code, `${label}規則 Code`, 50),
    category: category as SchoolCategory,
    subCategory: requiredString(value.subCategory, `${label}規則分類`, 200),
    itemName: requiredString(value.itemName, `${label}規則事項`, 500),
    score,
    minScore,
    maxScore,
  };
}

function parseFollowUps(value: unknown, label: string): FollowUp[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${label}跟進歷史格式不正確。`);
  return value.map((item, index) => {
    const itemLabel = `${label}第 ${index + 1} 項跟進`;
    if (!isObject(item)) throw new Error(`${itemLabel}格式不正確。`);
    const type = item.type;
    if (type !== undefined && type !== "follow-up" && type !== "reopened") throw new Error(`${itemLabel}類型不受支援。`);
    const followUp: FollowUp = {
      id: requiredString(item.id, `${itemLabel} ID`, 200),
      date: requiredDate(item.date, `${itemLabel}日期`),
      author: requiredString(item.author, `${itemLabel}作者`, 200),
      note: requiredString(item.note, `${itemLabel}內容`),
    };
    const at = optionalString(item.at, `${itemLabel}時間`, 100);
    if (at !== undefined) followUp.at = at;
    if (type !== undefined) followUp.type = type;
    return followUp;
  });
}

function parseClosures(value: unknown, label: string): CaseClosure[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new Error(`${label}結案歷史格式不正確。`);
  return value.map((item, index) => {
    const itemLabel = `${label}第 ${index + 1} 項結案`;
    if (!isObject(item)) throw new Error(`${itemLabel}格式不正確。`);
    const closure: CaseClosure = {
      id: requiredString(item.id, `${itemLabel} ID`, 200),
      date: requiredDate(item.date, `${itemLabel}日期`),
      summary: requiredString(item.summary, `${itemLabel}摘要`),
    };
    const at = optionalString(item.at, `${itemLabel}時間`, 100);
    if (at !== undefined) closure.at = at;
    return closure;
  });
}

function parseEntry(value: unknown, index: number, validStudentIds: ReadonlySet<string>): Entry {
  const label = `第 ${index + 1} 筆紀錄`;
  if (!isObject(value)) throw new Error(`${label}格式不正確。`);
  const studentId = requiredString(value.studentId, `${label}學生 ID`, 200);
  if (!validStudentIds.has(studentId)) throw new Error(`${label}引用了名冊中不存在的學生。`);
  const kind = requiredString(value.kind, `${label}範疇`, 20);
  if (!KINDS.has(kind as Kind)) throw new Error(`${label}範疇不受支援。`);
  const status = requiredString(value.status, `${label}狀態`, 20);
  if (!STATUSES.has(status as Status)) throw new Error(`${label}狀態不受支援。`);
  const entry: Entry = {
    id: requiredString(value.id, `${label} ID`, 200),
    studentId,
    kind: kind as Kind,
    category: requiredString(value.category, `${label}事項`, 500),
    date: requiredDate(value.date, `${label}日期`),
    note: requiredString(value.note, `${label}內容`),
    status: status as Status,
  };
  const rule = parseRule(value.rule, label);
  const scoreChange = optionalNumber(value.scoreChange, `${label}實際分數`);
  const closedWithoutFollowUp = optionalBoolean(value.closedWithoutFollowUp, `${label}直接結案狀態`);
  const followUps = parseFollowUps(value.followUps, label);
  const closureHistory = parseClosures(value.closureHistory, label);
  const optionalFields = {
    batchId: optionalString(value.batchId, `${label}批次 ID`, 200),
    assignee: optionalString(value.assignee, `${label}負責人`, 200),
    dueDate: value.dueDate === undefined ? undefined : requiredDate(value.dueDate, `${label}跟進期限`),
    resolution: optionalString(value.resolution, `${label}結案摘要`),
    closedAt: value.closedAt === undefined ? undefined : requiredDate(value.closedAt, `${label}結案日期`),
  };
  if (rule) entry.rule = rule;
  if (scoreChange !== undefined) entry.scoreChange = scoreChange;
  if (closedWithoutFollowUp !== undefined) entry.closedWithoutFollowUp = closedWithoutFollowUp;
  if (followUps) entry.followUps = followUps;
  if (closureHistory) entry.closureHistory = closureHistory;
  for (const [key, item] of Object.entries(optionalFields)) {
    if (item !== undefined) (entry as unknown as JsonObject)[key] = item;
  }
  return entry;
}

export function createRecordExport(entries: Entry[], exportedAt = new Date()): RecordExport {
  return { format: RECORD_EXPORT_FORMAT, version: RECORD_EXPORT_VERSION, exportedAt: exportedAt.toISOString(), entries };
}

export function serializeRecordExport(entries: Entry[], exportedAt = new Date()) {
  return JSON.stringify(createRecordExport(entries, exportedAt), null, 2);
}

export function parseRecordImport(text: string, validStudentIds: ReadonlySet<string>): Entry[] {
  if (new TextEncoder().encode(text).length > MAX_RECORD_IMPORT_BYTES) throw new Error("檔案超過 5 MB，請分拆後再匯入。");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error("檔案不是有效的 JSON 備份。");
  }
  if (!isObject(value) || value.format !== RECORD_EXPORT_FORMAT) throw new Error("這不是本系統匯出的獎懲紀錄備份。");
  if (value.version !== RECORD_EXPORT_VERSION) throw new Error("備份版本不受支援，請使用目前版本重新匯出。");
  if (!Array.isArray(value.entries)) throw new Error("備份中找不到紀錄清單。");
  if (value.entries.length > MAX_RECORDS) throw new Error(`單次最多可匯入 ${MAX_RECORDS.toLocaleString()} 筆紀錄。`);
  const entries = value.entries.map((entry, index) => parseEntry(entry, index, validStudentIds));
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`備份內有重複的紀錄 ID：${entry.id}`);
    ids.add(entry.id);
  }
  return entries;
}

