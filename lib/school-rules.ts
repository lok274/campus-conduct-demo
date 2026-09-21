// School-wide starting scores apply equally to every student.
// These domains are separate from an entry's incident classification.
export const SCHOOL_CATEGORIES = ["守規", "勤學", "勤到"] as const;
export type SchoolCategory = (typeof SCHOOL_CATEGORIES)[number];

export const SCHOOL_BASE_SCORES: Readonly<Record<SchoolCategory, number>> = {
  守規: 80,
  勤學: 80,
  勤到: 100,
};
