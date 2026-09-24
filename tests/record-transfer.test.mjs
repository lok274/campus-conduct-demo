import test from "node:test";
import assert from "node:assert/strict";
import { parseRecordImport, serializeRecordExport } from "../lib/record-transfer.ts";

const entry = {
  id: "r-test",
  studentId: "s1",
  kind: "守規",
  category: "準時上課",
  date: "2026-09-24",
  note: "完整備份測試",
  status: "已結案",
  rule: { code: "101", category: "守規", subCategory: "課堂常規", itemName: "準時上課", score: 1, minScore: 1, maxScore: 2 },
  scoreChange: 2,
  followUps: [{ id: "f1", date: "2026-09-24", at: "2026-09-24T08:00:00.000Z", author: "訓育組", note: "已跟進" }],
  resolution: "已完成",
  closedAt: "2026-09-24",
  closureHistory: [{ id: "c1", date: "2026-09-24", summary: "已完成" }],
};

test("獎懲紀錄 JSON 可完整匯出再匯入", () => {
  const text = serializeRecordExport([entry], new Date("2026-09-24T00:00:00.000Z"));
  const imported = parseRecordImport(text, new Set(["s1"]));
  assert.deepEqual(imported, [entry]);
});

test("匯入拒絕名冊中不存在的學生", () => {
  const text = serializeRecordExport([{ ...entry, studentId: "missing" }], new Date("2026-09-24T00:00:00.000Z"));
  assert.throws(() => parseRecordImport(text, new Set(["s1"])), /不存在的學生/);
});

test("匯入拒絕任意 JSON 及重複紀錄 ID", () => {
  assert.throws(() => parseRecordImport("{}", new Set(["s1"])), /不是本系統匯出/);
  const text = serializeRecordExport([entry, entry], new Date("2026-09-24T00:00:00.000Z"));
  assert.throws(() => parseRecordImport(text, new Set(["s1"])), /重複的紀錄 ID/);
});

