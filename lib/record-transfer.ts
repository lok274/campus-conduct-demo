import type { Entry, FollowUp, Kind, Status, Student } from "./conduct-types";
import type { CaseClosure } from "./case-workflow";
import type { ConductRule } from "./conduct-rules";
import type { SchoolCategory } from "./school-rules";

export const RECORD_EXPORT_FORMAT = "campus-conduct-records";
export const RECORD_EXPORT_VERSION = 1;
export const MAX_RECORD_IMPORT_BYTES = 5_000_000;
const MAX_RECORDS = 10_000;
const SCHOOL_CATEGORIES: readonly SchoolCategory[] = ["守規", "勤學", "勤到"];
const KINDS = new Set<Kind>(SCHOOL_CATEGORIES);
const STATUSES = new Set<Status>(["待跟進", "跟進中", "已結案"]);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const CSV_COLUMNS = [
  "備份格式", "版本", "匯出時間", "紀錄ID", "學生ID", "學生姓名", "班別", "座號", "學號",
  "日期", "範疇", "事項", "內容", "狀態", "規則Code", "規則範疇", "規則分類", "規則事項",
  "規則預設分數", "規則最低分數", "規則最高分數", "實際加減分", "直接結案", "批次ID",
  "負責人", "跟進期限", "跟進歷史JSON", "結案摘要", "結案日期", "結案歷史JSON",
] as const;

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
  if (!rule) throw new Error(`${label}沒有校本規則 Code；舊紀錄類型及事項分類已不再支援。`);
  if (rule.category !== kind) throw new Error(`${label}範疇與規則範疇不一致。`);
  if (rule.itemName !== entry.category) throw new Error(`${label}事項與規則事項不一致。`);
  const scoreChange = optionalNumber(value.scoreChange, `${label}實際分數`);
  if (scoreChange === undefined) throw new Error(`${label}沒有實際加減分。`);
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
  entry.rule = rule;
  entry.scoreChange = scoreChange;
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

const FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;
const csvCell = (value: unknown) => {
  let text = String(value ?? "");
  if (typeof value === "string" && (text.startsWith("'") || FORMULA_PREFIX.test(text))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
const restoreCsvText = (value: string) => value.startsWith("'") && (value.slice(1).startsWith("'") || FORMULA_PREFIX.test(value.slice(1))) ? value.slice(1) : value;

function parseCsvRows(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
      continue;
    }
    if (character === '"') {
      if (cell) throw new Error("CSV 引號格式不正確。");
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (quoted) throw new Error("CSV 有未關閉的引號。");
  if (row.length || cell) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parseJsonCell(value: string, label: string) {
  if (!value) return undefined;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`${label}不是有效的 JSON 內容。`);
  }
}

function csvOptionalNumber(value: string, label: string) {
  if (!value) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label}不是有效數值。`);
  return number;
}

function csvOptionalBoolean(value: string, label: string) {
  if (!value) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new Error(`${label}必須是 true 或 false。`);
}

function assertUniqueEntryIds(entries: Entry[]) {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error(`備份內有重複的紀錄 ID：${entry.id}`);
    ids.add(entry.id);
  }
}

export function serializeRecordCsv(entries: Entry[], students: readonly Student[], exportedAt = new Date()) {
  const studentMap = new Map(students.map((student) => [student.id, student]));
  const exportedAtValue = exportedAt.toISOString();
  const rows = entries.map((entry) => {
    const student = studentMap.get(entry.studentId);
    if (!student) throw new Error(`紀錄 ${entry.id} 引用了名冊中不存在的學生，無法匯出。`);
    return [
      RECORD_EXPORT_FORMAT, RECORD_EXPORT_VERSION, exportedAtValue, entry.id, entry.studentId, student.name,
      student.className, student.seat, student.number, entry.date, entry.kind, entry.category, entry.note, entry.status,
      entry.rule?.code, entry.rule?.category, entry.rule?.subCategory, entry.rule?.itemName, entry.rule?.score,
      entry.rule?.minScore, entry.rule?.maxScore, entry.scoreChange, entry.closedWithoutFollowUp, entry.batchId,
      entry.assignee, entry.dueDate, entry.followUps ? JSON.stringify(entry.followUps) : "", entry.resolution,
      entry.closedAt, entry.closureHistory ? JSON.stringify(entry.closureHistory) : "",
    ].map(csvCell).join(",");
  });
  return `\uFEFF${CSV_COLUMNS.map(csvCell).join(",")}\r\n${rows.join("\r\n")}${rows.length ? "\r\n" : ""}`;
}

export function parseRecordCsv(text: string, students: readonly Student[]): Entry[] {
  if (new TextEncoder().encode(text).length > MAX_RECORD_IMPORT_BYTES) throw new Error("檔案超過 5 MB，請分拆後再匯入。");
  const rows = parseCsvRows(text);
  const header = rows.shift();
  if (!header || header.length !== CSV_COLUMNS.length || header.some((column, index) => column !== CSV_COLUMNS[index])) {
    throw new Error("這不是本系統匯出的獎懲紀錄 CSV，或欄位標題已被更改。");
  }
  if (rows.length > MAX_RECORDS) throw new Error(`單次最多可匯入 ${MAX_RECORDS.toLocaleString()} 筆紀錄。`);
  const validStudentIds = new Set(students.map((student) => student.id));
  const entries = rows.map((rawRow, index) => {
    const row = rawRow.map(restoreCsvText);
    const label = `第 ${index + 1} 筆紀錄`;
    if (row.length !== CSV_COLUMNS.length) throw new Error(`${label}的 CSV 欄位數目不正確。`);
    if (row[0] !== RECORD_EXPORT_FORMAT || row[1] !== String(RECORD_EXPORT_VERSION)) throw new Error(`${label}的備份格式或版本不受支援。`);
    const raw: JsonObject = {
      id: row[3], studentId: row[4], date: row[9], kind: row[10], category: row[11], note: row[12], status: row[13],
    };
    if (row[14]) {
      raw.rule = {
        code: row[14], category: row[15], subCategory: row[16], itemName: row[17],
        score: csvOptionalNumber(row[18], `${label}規則預設分數`),
        minScore: csvOptionalNumber(row[19], `${label}規則最低分數`),
        maxScore: csvOptionalNumber(row[20], `${label}規則最高分數`),
      };
    }
    const scoreChange = csvOptionalNumber(row[21], `${label}實際分數`);
    const closedWithoutFollowUp = csvOptionalBoolean(row[22], `${label}直接結案狀態`);
    if (scoreChange !== undefined) raw.scoreChange = scoreChange;
    if (closedWithoutFollowUp !== undefined) raw.closedWithoutFollowUp = closedWithoutFollowUp;
    if (row[23]) raw.batchId = row[23];
    if (row[24]) raw.assignee = row[24];
    if (row[25]) raw.dueDate = row[25];
    const followUps = parseJsonCell(row[26], `${label}跟進歷史`);
    if (followUps !== undefined) raw.followUps = followUps;
    if (row[27]) raw.resolution = row[27];
    if (row[28]) raw.closedAt = row[28];
    const closureHistory = parseJsonCell(row[29], `${label}結案歷史`);
    if (closureHistory !== undefined) raw.closureHistory = closureHistory;
    return parseEntry(raw, index, validStudentIds);
  });
  assertUniqueEntryIds(entries);
  return entries;
}

