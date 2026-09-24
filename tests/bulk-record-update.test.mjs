import test from "node:test";
import assert from "node:assert/strict";
import { applyBulkRecordUpdate, bulkRecordWouldChange, restoreBulkRecordUpdate } from "../lib/bulk-record-update.ts";

const entries = [
  { id: "r1", studentId: "s1", kind: "守規", category: "事項", date: "2026-09-20", note: "甲", status: "待跟進", assignee: "舊負責人" },
  { id: "r2", studentId: "s2", kind: "勤學", category: "事項", date: "2026-09-21", note: "乙", status: "已結案", resolution: "原有結案", closedAt: "2026-09-22", closureHistory: [{ id: "c-old", date: "2026-09-22", summary: "原有結案" }] },
  { id: "r3", studentId: "s3", kind: "勤到", category: "事項", date: "2026-09-22", note: "丙", status: "跟進中" },
];

test("bulk update only changes selected records and restores exact snapshots", () => {
  const update = { assigneeEnabled: true, assignee: "  訓育主任  ", dueDateEnabled: true, dueDate: "2026-10-01", statusEnabled: false, status: "待跟進" };
  const result = applyBulkRecordUpdate(entries, new Set(["r1", "r3"]), update, new Date("2026-09-24T08:00:00.000Z"));
  assert.equal(result.changedCount, 2);
  assert.equal(result.entries[0].assignee, "訓育主任");
  assert.equal(result.entries[0].dueDate, "2026-10-01");
  assert.equal(result.entries[1], entries[1]);
  assert.deepEqual(restoreBulkRecordUpdate(result.entries, result.before), entries);
});

test("bulk close appends closure history; reopening preserves that history", () => {
  const now = new Date("2026-09-24T08:00:00.000Z");
  const closed = applyBulkRecordUpdate(entries, new Set(["r1"]), { assigneeEnabled: false, assignee: "", dueDateEnabled: false, dueDate: "", statusEnabled: true, status: "已結案" }, now).entries[0];
  assert.equal(closed.status, "已結案");
  assert.equal(closed.resolution, "由批次操作標記為已結案。");
  assert.equal(closed.closureHistory.length, 1);

  const reopened = applyBulkRecordUpdate(entries, new Set(["r2"]), { assigneeEnabled: false, assignee: "", dueDateEnabled: false, dueDate: "", statusEnabled: true, status: "跟進中" }, now).entries[1];
  assert.equal(reopened.status, "跟進中");
  assert.equal(reopened.resolution, undefined);
  assert.equal(reopened.closureHistory.length, 1);
  assert.equal(reopened.followUps.at(-1).type, "reopened");
});

test("preview ignores no-op fields and supports clearing owner or deadline", () => {
  const noOp = { assigneeEnabled: true, assignee: "舊負責人", dueDateEnabled: false, dueDate: "", statusEnabled: true, status: "待跟進" };
  assert.equal(bulkRecordWouldChange(entries[0], noOp), false);
  const clear = { ...noOp, assignee: "" };
  assert.equal(bulkRecordWouldChange(entries[0], clear), true);
  assert.equal(applyBulkRecordUpdate(entries, new Set(["r1"]), clear).entries[0].assignee, undefined);
});
