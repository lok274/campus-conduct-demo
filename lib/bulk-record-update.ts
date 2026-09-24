import { completeCase } from "./case-workflow.ts";
import type { Entry, Status } from "./conduct-types";

export const BULK_CLOSURE_SUMMARY = "由批次操作標記為已結案。";

export type BulkRecordUpdate = {
  assigneeEnabled: boolean;
  assignee: string;
  dueDateEnabled: boolean;
  dueDate: string;
  statusEnabled: boolean;
  status: Status;
};

export function hasBulkRecordUpdate(update: BulkRecordUpdate) {
  return update.assigneeEnabled || update.dueDateEnabled || update.statusEnabled;
}

export function bulkRecordWouldChange(entry: Entry, update: BulkRecordUpdate) {
  const assignee = update.assignee.trim();
  return (update.assigneeEnabled && (entry.assignee ?? "") !== assignee) ||
    (update.dueDateEnabled && (entry.dueDate ?? "") !== update.dueDate) ||
    (update.statusEnabled && entry.status !== update.status);
}

function applyStatus(entry: Entry, status: Status, now: Date): Entry {
  if (entry.status === status) return entry;
  if (status === "已結案") return completeCase(entry, BULK_CLOSURE_SUMMARY, now);
  if (entry.status !== "已結案") return { ...entry, status };

  const previousResolution = entry.resolution ?? "未提供";
  return {
    ...entry,
    status,
    resolution: undefined,
    closedAt: undefined,
    closedWithoutFollowUp: false,
    followUps: [...(entry.followUps ?? []), {
      id: `f${now.getTime()}-${entry.id}`,
      date: now.toLocaleDateString("sv-SE"),
      at: now.toISOString(),
      type: "reopened",
      author: "訓育組",
      note: `批次操作重新開啟個案。前次結案摘要：${previousResolution}`,
    }],
  };
}

export function applyBulkRecordUpdate(entries: Entry[], selectedIds: ReadonlySet<string>, update: BulkRecordUpdate, now = new Date()) {
  const before: Entry[] = [];
  const updatedEntries = entries.map((entry) => {
    if (!selectedIds.has(entry.id) || !bulkRecordWouldChange(entry, update)) return entry;
    before.push(entry);
    let updated = update.statusEnabled ? applyStatus(entry, update.status, now) : entry;
    if (update.assigneeEnabled) updated = { ...updated, assignee: update.assignee.trim() || undefined };
    if (update.dueDateEnabled) updated = { ...updated, dueDate: update.dueDate || undefined };
    return updated;
  });
  return { entries: updatedEntries, before, changedCount: before.length };
}

export function restoreBulkRecordUpdate(entries: Entry[], before: readonly Entry[]) {
  const snapshots = new Map(before.map((entry) => [entry.id, entry]));
  return entries.map((entry) => snapshots.get(entry.id) ?? entry);
}
