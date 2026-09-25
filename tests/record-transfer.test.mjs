import test from "node:test";
import assert from "node:assert/strict";
import { MAX_RECORD_IMPORT_BYTES, RECORD_IMPORT_SIZE_ERROR, mergeRecordImports, parseRecordCsv, parseRecordImport, serializeRecordCsv, serializeRecordExport } from "../lib/record-transfer.ts";

const students = [{ id: "s1", name: "陳子晴", className: "中一甲", seat: "03", number: "S260103" }];

const entry = {
  id: "r-test",
  studentId: "s1",
  kind: "守規",
  category: "不守課室/特別室規則",
  date: "2026-09-24",
  note: "完整、含逗號與\"引號\"的\n備份測試",
  status: "已結案",
  rule: { code: "204", category: "守規", subCategory: "學習/課堂違規", itemName: "不守課室/特別室規則", score: -1, minScore: -3, maxScore: -1 },
  scoreChange: -1,
  followUps: [{ id: "f1", date: "2026-09-24", at: "2026-09-24T08:00:00.000Z", author: "訓育組", note: "已跟進" }],
  resolution: "已完成",
  closedAt: "2026-09-24",
  closureHistory: [{ id: "c1", date: "2026-09-24", summary: "已完成" }],
};

test("獎懲紀錄 CSV 可由 Excel 開啟並完整匯出再匯入", () => {
  const text = serializeRecordCsv([entry], students, new Date("2026-09-24T00:00:00.000Z"));
  assert.match(text, /^\uFEFF"備份格式","版本"/);
  assert.match(text, /"陳子晴","中一甲","03","S260103"/);
  const imported = parseRecordCsv(text, students);
  assert.deepEqual(imported, [entry]);
});

test("JSON 備份仍可匯入", () => {
  const text = serializeRecordExport([entry], new Date("2026-09-24T00:00:00.000Z"));
  const imported = parseRecordImport(text, new Set(["s1"]));
  assert.deepEqual(imported, [entry]);
});

test("匯入拒絕已移除的舊紀錄類型及事項分類", () => {
  const removedEntry = { ...entry, kind: "嘉許", category: "服務精神", rule: undefined, scoreChange: undefined };
  const text = serializeRecordExport([removedEntry], new Date("2026-09-24T00:00:00.000Z"));
  assert.throws(() => parseRecordImport(text, new Set(["s1"])), /範疇不受支援/);
});

test("CSV 會阻止 Excel 公式注入並在匯入時還原原文", () => {
  const formulaEntry = { ...entry, id: "r-formula", note: "=HYPERLINK(\"https://example.invalid\",\"測試\")" };
  const text = serializeRecordCsv([formulaEntry], students, new Date("2026-09-24T00:00:00.000Z"));
  assert.match(text, /'=HYPERLINK/);
  assert.deepEqual(parseRecordCsv(text, students), [formulaEntry]);
});

test("匯入拒絕名冊中不存在的學生", () => {
  const text = serializeRecordCsv([entry], students, new Date("2026-09-24T00:00:00.000Z"));
  assert.throws(() => parseRecordCsv(text, []), /不存在的學生/);
});

test("匯入拒絕任意 CSV 及重複紀錄 ID", () => {
  assert.throws(() => parseRecordCsv("姓名,內容\r\n測試,任意資料", students), /不是本系統匯出/);
  const text = serializeRecordCsv([entry, entry], students, new Date("2026-09-24T00:00:00.000Z"));
  assert.throws(() => parseRecordCsv(text, students), /重複的紀錄 ID/);
});

test("過大檔案會引導使用追加／合併匯入", () => {
  const oversized = "a".repeat(MAX_RECORD_IMPORT_BYTES + 1);
  const hasExactMessage = (error) => error instanceof Error && error.message === RECORD_IMPORT_SIZE_ERROR;
  assert.throws(() => parseRecordImport(oversized, new Set(["s1"])), hasExactMessage);
  assert.throws(() => parseRecordCsv(oversized, students), hasExactMessage);
  assert.doesNotMatch(RECORD_IMPORT_SIZE_ERROR, /分拆後再匯入/);
  assert.match(RECORD_IMPORT_SIZE_ERROR, /追加／合併/);
  assert.match(RECORD_IMPORT_SIZE_ERROR, /按紀錄 ID 更新或新增/);
  assert.match(RECORD_IMPORT_SIZE_ERROR, /不會重複登記/);
});

test("合併匯入會新增新 ID、更新相同 ID，並略過完全相同紀錄", () => {
  const existingSecond = { ...entry, id: "r-existing", note: "保留的舊內容" };
  const updated = { ...entry, id: "r-existing", note: "匯入後的新內容" };
  const added = { ...entry, id: "r-added", note: "新增內容" };
  const result = mergeRecordImports([entry, existingSecond], [entry, updated, added]);
  assert.deepEqual(result.entries, [entry, updated, added]);
  assert.deepEqual({ added: result.addedCount, updated: result.updatedCount, unchanged: result.unchangedCount }, { added: 1, updated: 1, unchanged: 1 });
  assert.equal(new Set(result.entries.map((item) => item.id)).size, result.entries.length);
});
