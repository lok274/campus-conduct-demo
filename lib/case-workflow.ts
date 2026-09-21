export type CaseStatus = "待跟進" | "跟進中" | "已結案";
export type CaseClosure = { id: string; date: string; at?: string; summary: string };
type WorkflowRecord = {
  status: CaseStatus;
  resolution?: string;
  closedAt?: string;
  closureHistory?: CaseClosure[];
  closedWithoutFollowUp?: boolean;
};

export const DIRECT_CLOSURE_REASON = "毋須進一步跟進，直接完結。";

export function completeCase<T extends WorkflowRecord>(record: T, summary: string, now: Date, direct = false): T {
  const trimmed = summary.trim();
  if (record.status === "已結案" || !trimmed) return record;
  const closure: CaseClosure = {
    id: "c" + now.getTime(), date: now.toLocaleDateString("sv-SE"), at: now.toISOString(), summary: trimmed,
  };
  return {
    ...record, status: "已結案", resolution: trimmed, closedAt: closure.date,
    closedWithoutFollowUp: direct, closureHistory: [...(record.closureHistory ?? []), closure],
  };
}
