import type { SchoolCategory } from "./school-rules";
import type { ConductRule } from "./conduct-rules";
import type { CaseClosure, CaseStatus } from "./case-workflow";

export type Kind = SchoolCategory;
export type Status = CaseStatus;
export type Student = { id: string; name: string; className: string; seat: string; number: string };
export type FollowUp = { id: string; date: string; at?: string; author: string; note: string; type?: "follow-up" | "reopened" };
export type Entry = {
  id: string; studentId: string; kind: Kind; category: string; date: string; note: string; status: Status;
  rule?: ConductRule; scoreChange?: number; closedWithoutFollowUp?: boolean;
  batchId?: string; assignee?: string; dueDate?: string; followUps?: FollowUp[]; resolution?: string; closedAt?: string; closureHistory?: CaseClosure[];
};
