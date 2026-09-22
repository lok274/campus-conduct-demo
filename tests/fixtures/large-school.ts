import type { Entry, Student } from "../../lib/conduct-types";

// Deliberately fictional: 24 test classes × 35 students, not a school roster.
export function createLargeSchool() {
  const students: Student[] = Array.from({ length: 840 }, (_, index) => ({
    id: `test-s${index + 1}`,
    name: index === 0 || index === 36 ? "同名測試生" : `測試學生${String(index + 1).padStart(3, "0")}`,
    className: `測試${Math.floor(index / 140) + 1}${"ABCD"[Math.floor(index / 35) % 4]}`,
    seat: String(index % 35 + 1).padStart(2, "0"),
    number: `TEST${String(index + 1).padStart(4, "0")}`,
  }));
  const entries: Entry[] = Array.from({ length: 5000 }, (_, index) => {
    const student = students[index % students.length];
    const closed = index % 5 < 3;
    return {
      id: `test-r${index + 1}`, studentId: student.id,
      kind: (["守規", "勤學", "勤到"] as const)[index % 3],
      category: "虛構測試事項 " + (index % 12 + 1),
      date: `2026-09-${String(index % 20 + 1).padStart(2, "0")}`,
      note: `獨立測試資料 ${index + 1}，不代表任何真實學生事件。`,
      scoreChange: [-3, -0.5, 0, 2][index % 4],
      status: closed ? "已結案" : index % 2 ? "跟進中" : "待跟進",
      assignee: index % 7 ? `${student.className}測試負責人` : undefined,
      dueDate: index % 4 ? ["2026-09-18", "2026-09-22", "2026-09-28"][index % 3] : undefined,
      ...(closed ? { closedAt: "2026-09-21", resolution: "虛構測試結案。" } : {}),
    };
  });
  return { students, entries };
}
