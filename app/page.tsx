"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, FilePenLine, Filter, LayoutDashboard, Menu, Plus, Search, ShieldCheck, Sparkles, UsersRound, X, ArrowRight, HeartHandshake } from "lucide-react";

type Page = "dashboard" | "todos" | "students" | "records";
type Kind = "嘉許" | "提醒" | "違規";
type Status = "待跟進" | "跟進中" | "已結案";
type TodoScope = "open" | "completed";
type TodoFilter = "all" | "overdue" | "today" | "unscheduled";
type Student = { id: string; name: string; className: string; seat: string; number: string };
type FollowUp = { id: string; date: string; at?: string; author: string; note: string; type?: "follow-up" | "reopened" };
type Closure = { id: string; date: string; at?: string; summary: string };
type TimelineEvent = {
  id: string; caseId: string; date: string; at?: string; order: number;
  type: "record" | "follow-up" | "closed" | "reopened";
  kind: Kind; category: string; detail: string; status: Status; author?: string;
};
type Entry = {
  id: string; studentId: string; kind: Kind; category: string; date: string; note: string; status: Status;
  assignee?: string; dueDate?: string; followUps?: FollowUp[]; resolution?: string; closedAt?: string; closureHistory?: Closure[];
};
type Draft = Pick<Entry, "studentId" | "kind" | "category" | "date" | "note" | "status">;

const students: Student[] = [
  { id: "s1", name: "陳子晴", className: "中一甲", seat: "03", number: "S260103" },
  { id: "s2", name: "李浩然", className: "中一甲", seat: "12", number: "S260112" },
  { id: "s3", name: "黃思敏", className: "中一乙", seat: "08", number: "S260208" },
  { id: "s4", name: "張家朗", className: "中二甲", seat: "17", number: "S250117" },
  { id: "s5", name: "林詠欣", className: "中二乙", seat: "06", number: "S250206" },
  { id: "s6", name: "何卓謙", className: "中二乙", seat: "21", number: "S250221" },
  { id: "s7", name: "吳樂怡", className: "中三甲", seat: "09", number: "S240109" },
  { id: "s8", name: "周俊熙", className: "中三乙", seat: "15", number: "S240215" },
];
const initialEntries: Entry[] = [
  { id: "r1", studentId: "s1", kind: "嘉許", category: "服務精神", date: "2026-09-18", note: "主動協助整理圖書角及帶領新生。", status: "已結案" },
  { id: "r2", studentId: "s4", kind: "提醒", category: "課堂秩序", date: "2026-09-17", note: "課堂期間與同學交談，已作口頭提醒。", status: "待跟進", assignee: "中二甲班主任", dueDate: "2026-09-18" },
  { id: "r3", studentId: "s7", kind: "嘉許", category: "熱心助人", date: "2026-09-16", note: "協助同學尋回遺失物品。", status: "已結案" },
  { id: "r4", studentId: "s2", kind: "違規", category: "校園常規", date: "2026-09-15", note: "未依規定完成值日工作，待班主任跟進。", status: "跟進中", assignee: "班主任", dueDate: "2026-09-21", followUps: [{ id: "f1", date: "2026-09-16", author: "訓育組", note: "已通知班主任了解值日安排，約定下週檢視。" }] },
  { id: "r5", studentId: "s5", kind: "嘉許", category: "服務精神", date: "2026-09-14", note: "活動後協助清理場地。", status: "已結案" },
  { id: "r6", studentId: "s3", kind: "提醒", category: "守時", date: "2026-09-13", note: "早會遲到，已了解原因並提醒。", status: "已結案" },
  { id: "r7", studentId: "s6", kind: "嘉許", category: "積極參與", date: "2026-09-12", note: "積極參與校園義工服務。", status: "已結案" },
  { id: "r8", studentId: "s4", kind: "嘉許", category: "熱心助人", date: "2026-09-10", note: "主動協助同學整理課堂筆記。", status: "已結案", resolution: "已在班會上作出嘉許。", closedAt: "2026-09-11", closureHistory: [{ id: "c1", date: "2026-09-11", summary: "已在班會上作出嘉許。" }] },
];
const categories: Record<Kind, string[]> = {
  嘉許: ["服務精神", "熱心助人", "積極參與", "其他嘉許"],
  提醒: ["課堂秩序", "守時", "校園常規", "其他提醒"],
  違規: ["校園常規", "課堂秩序", "守時", "其他違規"],
};
const newDraft = (): Draft => ({
  studentId: students[0].id, kind: "嘉許", category: "服務精神",
  date: new Date().toLocaleDateString("sv-SE"), note: "", status: "待跟進",
});
const dateLabel = (date: string) => date.replaceAll("-", "/");
const latestActivityDate = (entry: Entry) => {
  const dates = [entry.date, entry.closedAt, ...(entry.followUps ?? []).map((item) => item.date)].filter(Boolean) as string[];
  return dates.sort((a, b) => b.localeCompare(a))[0];
};
const daysBetween = (from: string, to: string) => Math.max(1, Math.round((new Date(to + "T00:00:00").getTime() - new Date(from + "T00:00:00").getTime()) / 86400000));
function todoDueMeta(entry: Entry, today: string) {
  if (entry.status === "已結案") return { tone: "completed", label: "已完成", date: entry.closedAt ? dateLabel(entry.closedAt) : "未記錄結案日期" };
  if (!entry.dueDate) return { tone: "unscheduled", label: "未設定期限", date: "請安排跟進日期" };
  if (entry.dueDate < today) return { tone: "overdue", label: `逾期 ${daysBetween(entry.dueDate, today)} 日`, date: dateLabel(entry.dueDate) };
  if (entry.dueDate === today) return { tone: "today", label: "今日到期", date: dateLabel(entry.dueDate) };
  return { tone: "upcoming", label: `尚有 ${daysBetween(today, entry.dueDate)} 日`, date: dateLabel(entry.dueDate) };
}
function buildStudentTimeline(entries: Entry[]): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  for (const entry of entries) {
    const shared = { caseId: entry.id, kind: entry.kind, category: entry.category, status: entry.status };
    events.push({ ...shared, id: entry.id + "-record", date: entry.date, order: 0, type: "record", detail: entry.note });
    for (const item of entry.followUps ?? []) {
      events.push({ ...shared, id: entry.id + "-" + item.id, date: item.date, at: item.at, order: item.type === "reopened" ? 3 : 1, type: item.type ?? "follow-up", detail: item.note, author: item.author });
    }
    const closures = entry.closureHistory ?? (entry.closedAt && entry.resolution ? [{ id: "current", date: entry.closedAt, summary: entry.resolution }] : []);
    for (const item of closures) {
      events.push({ ...shared, id: entry.id + "-" + item.id, date: item.date, at: item.at, order: 2, type: "closed", detail: item.summary });
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date) || (b.at ?? "").localeCompare(a.at ?? "") || b.order - a.order || a.id.localeCompare(b.id));
}
const nav: { id: Page; text: string; Icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", text: "總覽", Icon: LayoutDashboard },
  { id: "todos", text: "待辦中心", Icon: Clock3 },
  { id: "students", text: "學生名冊", Icon: UsersRound },
  { id: "records", text: "獎懲紀錄", Icon: ClipboardList },
];

function Avatar({ student, large = false }: { student: Student; large?: boolean }) {
  const color = ["mint", "blue", "rose", "gold"][students.findIndex((s) => s.id === student.id) % 4];
  return <span className={"avatar " + color + (large ? " large" : "")}>{student.name.slice(-2)}</span>;
}
function KindTag({ kind }: { kind: Kind }) { return <span className={"kind-tag kind-" + kind}>{kind}</span>; }
function StatusTag({ status }: { status: Status }) { return <span className={"status-tag " + (status === "待跟進" ? "waiting" : status === "跟進中" ? "progress" : "done")}><i />{status}</span>; }

export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("全部班級");
  const [kindFilter, setKindFilter] = useState("全部類型");
  const [statusFilter, setStatusFilter] = useState("全部狀態");
  const [todoScope, setTodoScope] = useState<TodoScope>("open");
  const [todoFilter, setTodoFilter] = useState<TodoFilter>("all");
  const [menuOpen, setMenuOpen] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [caseReturnStudentId, setCaseReturnStudentId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(newDraft);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!formOpen && !studentId && !caseId) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (formOpen) setFormOpen(false);
        else if (caseId) { setCaseId(null); setStudentId(caseReturnStudentId); setCaseReturnStudentId(null); }
        else setStudentId(null);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [formOpen, studentId, caseId, caseReturnStudentId]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), []);
  const today = new Date().toLocaleDateString("sv-SE");
  const pending = entries.filter((e) => e.status !== "已結案");
  const praise = entries.filter((e) => e.kind === "嘉許");
  const closed = entries.filter((e) => e.status === "已結案");
  const overdueTodos = pending.filter((e) => e.dueDate && e.dueDate < today);
  const todayTodos = pending.filter((e) => e.dueDate === today);
  const unscheduledTodos = pending.filter((e) => !e.dueDate);
  const classes = ["全部班級", ...new Set(students.map((s) => s.className))];
  const shownStudents = students.filter((s) =>
    (s.name + s.className + s.number).toLowerCase().includes(search.toLowerCase().trim()) &&
    (classFilter === "全部班級" || s.className === classFilter)
  );
  const shownEntries = entries.filter((e) => {
    const student = studentMap.get(e.studentId);
    return ((student?.name ?? "") + (student?.className ?? "") + e.category + e.note).toLowerCase().includes(search.toLowerCase().trim()) &&
      (kindFilter === "全部類型" || e.kind === kindFilter) &&
      (statusFilter === "全部狀態" || e.status === statusFilter);
  }).sort((a, b) => b.date.localeCompare(a.date));
  const shownTodos = (todoScope === "open" ? pending : closed).filter((entry) => {
    const student = studentMap.get(entry.studentId);
    const matchesSearch = ((student?.name ?? "") + (student?.className ?? "") + (student?.number ?? "") + entry.category + entry.note + (entry.assignee ?? "")).toLowerCase().includes(search.toLowerCase().trim());
    if (!matchesSearch || todoScope === "completed") return matchesSearch;
    if (todoFilter === "overdue") return Boolean(entry.dueDate && entry.dueDate < today);
    if (todoFilter === "today") return entry.dueDate === today;
    if (todoFilter === "unscheduled") return !entry.dueDate;
    return true;
  }).sort((a, b) => {
    if (todoScope === "completed") return (b.closedAt ?? latestActivityDate(b)).localeCompare(a.closedAt ?? latestActivityDate(a));
    const rank = (entry: Entry) => !entry.dueDate ? 3 : entry.dueDate < today ? 0 : entry.dueDate === today ? 1 : 2;
    return rank(a) - rank(b) || (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || b.date.localeCompare(a.date);
  });
  const selected = studentId ? studentMap.get(studentId) : undefined;
  const selectedEntries = selected ? entries.filter((e) => e.studentId === selected.id) : [];
  const selectedTimeline = buildStudentTimeline(selectedEntries);
  const draftStudent = studentMap.get(draft.studentId) ?? students[0];
  const draftClassStudents = students.filter((s) => s.className === draftStudent.className);
  const selectedCase = caseId ? entries.find((e) => e.id === caseId) : undefined;
  const caseStudent = selectedCase ? studentMap.get(selectedCase.studentId) : undefined;

  function navigate(next: Page) { setPage(next); setSearch(""); setMenuOpen(false); }
  function addEntry(id?: string) {
    setEditingId(null); setDraft({ ...newDraft(), studentId: id || students[0].id });
    setStudentId(null); setCaseId(null); setCaseReturnStudentId(null); setFormOpen(true);
  }
  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    setDraft({ studentId: entry.studentId, kind: entry.kind, category: entry.category, date: entry.date, note: entry.note, status: entry.status });
    setStudentId(null); setCaseId(null); setCaseReturnStudentId(null); setFormOpen(true);
  }
  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.studentId || !draft.date || !draft.category || !draft.note.trim()) return;
    if (editingId) {
      setEntries((current) => current.map((e) => e.id === editingId ? { ...e, ...draft, note: draft.note.trim() } : e));
      setNotice("紀錄已更新");
    } else {
      const id = "r" + Date.now();
      setEntries((current) => [{ ...draft, id, note: draft.note.trim() }, ...current]);
      setCaseId(id);
      setNotice("新紀錄已加入");
    }
    setFormOpen(false); navigate("records");
  }
  function openCase(id: string) {
    setCaseReturnStudentId(studentId);
    setStudentId(null); setFormOpen(false); setCaseId(id);
  }
  function closeCaseView() {
    setCaseId(null); setStudentId(caseReturnStudentId); setCaseReturnStudentId(null);
  }
  function saveCasePlan(id: string, assignee: string, dueDate: string) {
    setEntries((current) => current.map((e) => e.id === id ? { ...e, assignee: assignee.trim(), dueDate } : e));
    setNotice("跟進安排已儲存");
  }
  function startCase(id: string) {
    setEntries((current) => current.map((e) => e.id === id && e.status === "待跟進" ? { ...e, status: "跟進中" } : e));
    setNotice("個案已開始跟進");
  }
  function addFollowUp(id: string, note: string) {
    const trimmed = note.trim(); if (!trimmed) return;
    const now = new Date();
    const item: FollowUp = { id: "f" + now.getTime(), date: now.toLocaleDateString("sv-SE"), at: now.toISOString(), author: "訓育組", note: trimmed };
    setEntries((current) => current.map((e) => e.id === id && e.status !== "已結案" ? { ...e, status: "跟進中", followUps: [...(e.followUps ?? []), item] } : e));
    setNotice("跟進記錄已加入");
  }
  function closeCase(id: string, summary: string) {
    const trimmed = summary.trim(); if (!trimmed) return;
    const now = new Date();
    const closure: Closure = { id: "c" + now.getTime(), date: now.toLocaleDateString("sv-SE"), at: now.toISOString(), summary: trimmed };
    setEntries((current) => current.map((e) => e.id === id && e.status !== "已結案" ? { ...e, status: "已結案", resolution: trimmed, closedAt: closure.date, closureHistory: [...(e.closureHistory ?? []), closure] } : e));
    setNotice("個案已結案");
  }
  function reopenCase(id: string) {
    const now = new Date();
    setEntries((current) => current.map((e) => e.id === id && e.status === "已結案" ? {
      ...e, status: "跟進中", resolution: undefined, closedAt: undefined,
      followUps: [...(e.followUps ?? []), {
        id: "f" + now.getTime(), date: now.toLocaleDateString("sv-SE"), at: now.toISOString(), type: "reopened",
        author: "訓育組", note: "重新開啟個案。前次結案摘要：" + (e.resolution ?? "未提供"),
      }],
    } : e));
    setNotice("個案已重新開啟");
  }
  const titles: Record<Page, string> = { dashboard: "訓育工作台", todos: "待辦中心", students: "學生名冊", records: "獎懲紀錄" };
  const subtitles: Record<Page, string> = {
    dashboard: "掌握需要處理的學生事務與最新紀錄。",
    todos: "按期限處理未結案個案，並追蹤每項跟進安排。",
    students: "查看學生資料與個別訓育紀錄。",
    records: "集中查閱、篩選及更新訓育事項。",
  };
  const title = titles[page];
  const subtitle = subtitles[page];

  return <div className="app">
    <aside className={"sidebar" + (menuOpen ? " open" : "")}>
      <div className="brand"><div className="brand-icon"><BookOpenCheck size={22}/></div><div><strong>校園訓育系統</strong><small>STUDENT AFFAIRS</small></div></div>
      <div className="side-label">工作空間</div>
      <nav aria-label="主要導覽">{nav.map(({ id, text, Icon }) => <button key={id} type="button" className={"nav-item" + (page === id ? " active" : "")} onClick={() => navigate(id)}><Icon size={19}/>{text}{id === "todos" && <span className="nav-count">{pending.length}</span>}{page === id && <i/>}</button>)}</nav>
      <div className="side-fill"/>
      <div className="demo-note"><ShieldCheck size={20}/><strong>前端示範版</strong><p>目前使用虛構資料。新增與編輯的內容會在重新整理後重置。</p></div>
      <div className="side-user"><span>訓</span><div><strong>訓育組</strong><small>管理介面示範</small></div><ChevronDown size={15}/></div>
    </aside>
    {menuOpen && <button type="button" className="scrim" aria-label="關閉選單" onClick={() => setMenuOpen(false)}/>}
    <div className="main">
      <header className="topbar"><button type="button" className="mobile-menu" aria-label="開啟選單" onClick={() => setMenuOpen(true)}><Menu size={21}/></button><div className="crumb">校園管理 <ChevronRight size={14}/> <strong>{title}</strong></div><div className="top-meta"><span><CalendarDays size={15}/> 2026–27 學年</span><b><i/> 示範版</b></div></header>
      <main className="content">
        <div className="page-heading"><div><small>STUDENT AFFAIRS / 訓育管理</small><h1>{title}</h1><p>{subtitle}</p></div><button type="button" className="btn primary" onClick={() => addEntry()}><Plus size={17}/>新增紀錄</button></div>
        {page === "dashboard" && <>
          <section className="hero"><div className="hero-copy"><span><Sparkles size={15}/> 2026–27 學年 · 訓育概況</span><h2>讓每一份關注，<br/><em>都有清楚的紀錄。</em></h2><p>從嘉許到跟進事項，在同一處掌握學生的校園成長。</p><button type="button" onClick={() => navigate("records")}>查看所有紀錄 <ArrowRight size={16}/></button></div><div className="hero-art" aria-hidden="true"><div className="orbit"/><div className="paper behind"/><div className="paper front"><ShieldCheck size={28}/><i/><i/><i/></div><span>✦</span></div></section>
          <div className="stats">
            <Stat icon={UsersRound} color="mint" value={students.length} label="學生人數" hint="示範名冊"/>
            <Stat icon={Clock3} color="gold" value={pending.length} label="待跟進事項" hint="優先處理"/>
            <Stat icon={HeartHandshake} color="blue" value={praise.length} label="嘉許紀錄" hint="本期累計"/>
            <Stat icon={CheckCircle2} color="rose" value={closed.length} label="已結案事項" hint="本期累計"/>
          </div>
          <div className="dashboard-grid"><section className="card list-card"><div className="card-heading"><div><small>最新動態</small><h2>近期訓育紀錄</h2></div><button type="button" onClick={() => navigate("records")}>查看全部 <ArrowRight size={15}/></button></div>{[...entries].sort((a,b) => b.date.localeCompare(a.date)).slice(0,4).map((e) => { const s = studentMap.get(e.studentId)!; return <div className="activity" key={e.id}><Avatar student={s}/><div><strong>{s.name} <span>· {s.className}</span></strong><p>{e.category} · {e.note}</p></div><section><KindTag kind={e.kind}/><small>{dateLabel(e.date)}</small></section></div>; })}</section>
          <section className="card follow-card"><div className="card-heading"><div><small>待辦清單</small><h2>需要跟進</h2></div><b>{pending.length} 項</b></div>{pending.length ? pending.map((e) => { const s = studentMap.get(e.studentId)!; return <div className="follow" key={e.id}><span className={e.kind === "違規" ? "warn red" : "warn"}><Clock3 size={17}/></span><div><strong>{s.name} <span>· {s.className}</span></strong><p>{e.category}</p></div><button type="button" aria-label={"查看" + s.name + "的個案詳情"} onClick={() => openCase(e.id)}><ChevronRight size={18}/></button></div>; }) : <p className="empty-inline">目前沒有待跟進事項。</p>}<button type="button" className="follow-all" onClick={() => navigate("todos")}>前往待辦中心 <ArrowRight size={15}/></button></section></div>
        </>}
        {page === "todos" && <TodoCenter
          todos={shownTodos}
          studentMap={studentMap}
          today={today}
          scope={todoScope}
          filter={todoFilter}
          search={search}
          openCount={pending.length}
          completedCount={closed.length}
          overdueCount={overdueTodos.length}
          todayCount={todayTodos.length}
          unscheduledCount={unscheduledTodos.length}
          onSearch={setSearch}
          onScopeChange={setTodoScope}
          onFilterChange={(next) => { setTodoScope("open"); setTodoFilter(next); }}
          onOpenCase={openCase}
          onStart={startCase}
        />}
        {page === "students" && <section className="card table-card"><div className="table-heading"><div><small>STUDENT DIRECTORY</small><h2>學生資料 <b>{shownStudents.length}</b></h2></div><div className="filters"><label className="search"><Search size={16}/><input aria-label="搜尋學生" placeholder="搜尋姓名或學號" value={search} onChange={(e) => setSearch(e.target.value)}/></label><label className="select"><Filter size={15}/><select aria-label="篩選班級" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>{classes.map((c) => <option key={c}>{c}</option>)}</select></label></div></div><div className="table-scroll"><table><thead><tr><th>學生</th><th>班級 / 學號</th><th>紀錄數</th><th>待跟進</th><th>操作</th></tr></thead><tbody>{shownStudents.map((s) => { const total = entries.filter((e) => e.studentId === s.id).length; const todo = pending.filter((e) => e.studentId === s.id).length; return <tr key={s.id}><td><div className="person"><Avatar student={s}/><div><strong>{s.name}</strong><small>座號 {s.seat}</small></div></div></td><td><strong>{s.className}</strong><small className="cell-sub">{s.number}</small></td><td><span className="count">{total}</span></td><td>{todo ? <span className="todo-count">● {todo} 項</span> : <span className="muted">—</span>}</td><td><button type="button" className="row-button" onClick={() => setStudentId(s.id)}>查看資料 <ChevronRight size={15}/></button></td></tr>; })}</tbody></table>{!shownStudents.length && <Empty text="找不到符合條件的學生" hint="請更改搜尋字詞或班級。"/>}</div><div className="table-foot">顯示 {shownStudents.length} 位學生 <span>資料僅供介面示範</span></div></section>}
        {page === "records" && <section className="card table-card"><div className="table-heading"><div><small>CONDUCT RECORDS</small><h2>全部紀錄 <b>{shownEntries.length}</b></h2></div><div className="filters"><label className="search"><Search size={16}/><input aria-label="搜尋紀錄" placeholder="搜尋學生或事項" value={search} onChange={(e) => setSearch(e.target.value)}/></label><label className="select"><select aria-label="篩選類型" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}><option>全部類型</option><option>嘉許</option><option>提醒</option><option>違規</option></select></label><label className="select"><select aria-label="篩選狀態" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>全部狀態</option><option>待跟進</option><option>跟進中</option><option>已結案</option></select></label></div></div><div className="table-scroll"><table className="records-table"><thead><tr><th>日期 / 學生</th><th>類型</th><th>事項</th><th>狀態</th><th>操作</th></tr></thead><tbody>{shownEntries.map((e) => { const s = studentMap.get(e.studentId)!; return <tr key={e.id}><td><div className="person"><Avatar student={s}/><div><strong>{s.name} <span>· {s.className}</span></strong><small>{dateLabel(e.date)}</small></div></div></td><td><KindTag kind={e.kind}/></td><td><strong>{e.category}</strong><small className="entry-note">{e.note}</small></td><td><StatusTag status={e.status}/></td><td><div className="actions"><button type="button" className="row-button" onClick={() => openCase(e.id)}><ChevronRight size={15}/>詳情</button><button type="button" className="row-button" onClick={() => editEntry(e)}><FilePenLine size={15}/>編輯</button></div></td></tr>; })}</tbody></table>{!shownEntries.length && <Empty text="沒有符合條件的紀錄" hint="請調整搜尋字詞或篩選條件。"/>}</div><div className="table-foot">顯示 {shownEntries.length} 筆紀錄 <span>資料僅供介面示範</span></div></section>}
        <footer>校園訓育系統 · 前端介面示範 <span>所有學生及紀錄均為虛構資料</span></footer>
      </main>
    </div>
    {selected && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setStudentId(null); }}><section className="panel" role="dialog" aria-modal="true" aria-labelledby="student-title"><div className="panel-head"><div><small>STUDENT PROFILE</small><h2 id="student-title">學生資料</h2></div><button type="button" aria-label="關閉學生資料" onClick={() => setStudentId(null)}><X size={20}/></button></div><div className="panel-body"><div className="profile"><Avatar student={selected} large/><div><h3>{selected.name}</h3><p>{selected.className} · 座號 {selected.seat}</p></div></div><div className="profile-facts"><div><span>學號</span><strong>{selected.number}</strong></div><div><span>班級</span><strong>{selected.className}</strong></div><div><span>紀錄總數</span><strong>{selectedEntries.length} 筆</strong></div></div><h3 className="block-title">個人紀錄時間線 <span>{selectedTimeline.length} 項事件</span></h3><p className="timeline-intro">按日期查看紀錄、跟進與結案；紀錄總數指個案數目。</p><StudentTimeline events={selectedTimeline} onOpenCase={openCase}/></div><div className="panel-foot"><button type="button" className="btn primary wide" onClick={() => addEntry(selected.id)}><Plus size={17}/>為此學生新增紀錄</button></div></section></div>}
    {formOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}><section className="panel" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="panel-head"><div><small>CONDUCT RECORD</small><h2 id="form-title">{editingId ? "編輯訓育紀錄" : "新增訓育紀錄"}</h2></div><button type="button" aria-label="關閉表單" onClick={() => setFormOpen(false)}><X size={20}/></button></div><form className="entry-form" onSubmit={saveEntry}><div className="panel-body"><p className="form-intro">記下學生的正向表現或需要跟進的事項，讓處理過程更清晰。</p><div className="field-row"><label className="field"><span>班別 *</span><select value={draftStudent.className} onChange={(e) => { const first = students.find((s) => s.className === e.target.value); if (first) setDraft({ ...draft, studentId: first.id }); }} required>{classes.slice(1).map((className) => <option key={className}>{className}</option>)}</select></label><label className="field"><span>學生姓名 *</span><select value={draft.studentId} onChange={(e) => setDraft({ ...draft, studentId: e.target.value })} required>{draftClassStudents.map((s) => <option value={s.id} key={s.id}>{s.name}</option>)}</select></label></div><label className="field"><span>學號</span><input value={draftStudent.number} readOnly aria-describedby="student-number-help"/><small id="student-number-help">由學生名冊自動帶入</small></label><div className="field-row"><label className="field"><span>紀錄類型 *</span><select value={draft.kind} onChange={(e) => { const kind = e.target.value as Kind; setDraft({ ...draft, kind, category: categories[kind][0] }); }}><option>嘉許</option><option>提醒</option><option>違規</option></select></label><label className="field"><span>日期 *</span><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required/></label></div><label className="field"><span>事項分類 *</span><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{categories[draft.kind].map((c) => <option key={c}>{c}</option>)}</select></label><label className="field"><span>內容說明 *</span><textarea rows={5} maxLength={300} placeholder="簡述事件、已採取的行動或後續安排…" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} required/><small>{draft.note.length}/300 字</small></label><p className="form-warning"><ShieldCheck size={16}/> 這是前端示範版。資料只會在目前頁面暫時顯示。</p></div><div className="panel-foot"><button type="button" className="btn secondary" onClick={() => setFormOpen(false)}>取消</button><button type="submit" className="btn primary"><Check size={17}/>{editingId ? "儲存變更" : "建立紀錄"}</button></div></form></section></div>}
    {selectedCase && caseStudent && <CasePanel key={selectedCase.id} entry={selectedCase} student={caseStudent} onClose={closeCaseView} onEdit={() => editEntry(selectedCase)} onSavePlan={saveCasePlan} onStart={startCase} onAddFollowUp={addFollowUp} onCloseCase={closeCase} onReopen={reopenCase}/>}
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button type="button" aria-label="關閉通知" onClick={() => setNotice("")}><X size={14}/></button></div>}
  </div>;
}
function TodoCenter({ todos, studentMap, today, scope, filter, search, openCount, completedCount, overdueCount, todayCount, unscheduledCount, onSearch, onScopeChange, onFilterChange, onOpenCase, onStart }: {
  todos: Entry[];
  studentMap: Map<string, Student>;
  today: string;
  scope: TodoScope;
  filter: TodoFilter;
  search: string;
  openCount: number;
  completedCount: number;
  overdueCount: number;
  todayCount: number;
  unscheduledCount: number;
  onSearch: (value: string) => void;
  onScopeChange: (scope: TodoScope) => void;
  onFilterChange: (filter: TodoFilter) => void;
  onOpenCase: (id: string) => void;
  onStart: (id: string) => void;
}) {
  const filterLabels: Record<TodoFilter, string> = { all: "全部", overdue: "已逾期", today: "今日到期", unscheduled: "未設期限" };
  const emptyHint = search ? "請更改搜尋字詞。" : scope === "completed" ? "完成個案結案後，會在這裡保留記錄。" : filter === "all" ? "目前沒有需要處理的個案。" : `目前沒有「${filterLabels[filter]}」的待辦。`;

  return <>
    <section className="todo-summary" aria-label="待辦摘要">
      <TodoMetric label="全部待辦" hint="尚未結案" value={openCount} Icon={ClipboardList} tone="teal" active={scope === "open" && filter === "all"} onClick={() => onFilterChange("all")}/>
      <TodoMetric label="已逾期" hint="需要優先處理" value={overdueCount} Icon={Clock3} tone="red" active={scope === "open" && filter === "overdue"} onClick={() => onFilterChange("overdue")}/>
      <TodoMetric label="今日到期" hint={dateLabel(today)} value={todayCount} Icon={CalendarDays} tone="gold" active={scope === "open" && filter === "today"} onClick={() => onFilterChange("today")}/>
      <TodoMetric label="未設期限" hint="尚待安排" value={unscheduledCount} Icon={CalendarDays} tone="blue" active={scope === "open" && filter === "unscheduled"} onClick={() => onFilterChange("unscheduled")}/>
    </section>
    <section className="card todo-board">
      <div className="todo-board-head">
        <div className="todo-tabs" role="tablist" aria-label="待辦狀態">
          <button type="button" role="tab" aria-selected={scope === "open"} className={scope === "open" ? "active" : ""} onClick={() => onScopeChange("open")}>進行中 <b>{openCount}</b></button>
          <button type="button" role="tab" aria-selected={scope === "completed"} className={scope === "completed" ? "active" : ""} onClick={() => onScopeChange("completed")}>已完成 <b>{completedCount}</b></button>
        </div>
        <label className="search todo-search"><Search size={16}/><input aria-label="搜尋待辦" placeholder="搜尋學生、學號或事項" value={search} onChange={(event) => onSearch(event.target.value)}/></label>
      </div>
      {scope === "open" && <div className="todo-filterbar" aria-label="期限篩選">
        {(Object.keys(filterLabels) as TodoFilter[]).map((key) => <button type="button" key={key} className={filter === key ? "active" : ""} aria-pressed={filter === key} onClick={() => onFilterChange(key)}>{filterLabels[key]}</button>)}
        <span>按期限排序，逾期項目置頂。</span>
      </div>}
      <div className="todo-list">
        {todos.map((entry) => {
          const student = studentMap.get(entry.studentId);
          if (!student) return null;
          const due = todoDueMeta(entry, today);
          const needsPlan = entry.status !== "已結案" && (!entry.assignee || !entry.dueDate);
          return <article className={"todo-item " + due.tone} key={entry.id}>
            <div className="todo-due"><span><Clock3 size={18}/></span><div><strong>{due.label}</strong><small>{due.date}</small></div></div>
            <div className="todo-student"><Avatar student={student}/><div><strong>{student.name}</strong><span>{student.className}</span><small>學號 {student.number}</small></div></div>
            <div className="todo-content"><div><KindTag kind={entry.kind}/><StatusTag status={entry.status}/></div><h3>{entry.category}</h3><p>{entry.note}</p></div>
            <div className="todo-owner"><span>負責人</span><strong className={!entry.assignee ? "missing" : ""}>{entry.assignee || "未指定"}</strong><small>最近更新 {dateLabel(latestActivityDate(entry))}</small></div>
            <div className="todo-actions">
              {entry.status === "待跟進" && <button type="button" className="btn secondary" onClick={() => onStart(entry.id)}>開始跟進</button>}
              <button type="button" className="btn primary" onClick={() => onOpenCase(entry.id)}>{entry.status === "已結案" ? "查看個案" : needsPlan ? "安排跟進" : "處理個案"}<ChevronRight size={15}/></button>
            </div>
          </article>;
        })}
        {!todos.length && <div className="todo-empty"><CheckCircle2 size={27}/><strong>{scope === "completed" ? "沒有已完成個案" : "這個清單已清空"}</strong><p>{emptyHint}</p></div>}
      </div>
      <div className="todo-board-foot"><ShieldCheck size={15}/><span>完成待辦時需在個案詳情填寫結案摘要，處理結果會保留在學生時間線。</span><b>顯示 {todos.length} 項</b></div>
    </section>
  </>;
}
function TodoMetric({ label, hint, value, Icon, tone, active, onClick }: { label: string; hint: string; value: number; Icon: typeof Clock3; tone: string; active: boolean; onClick: () => void }) {
  return <button type="button" className={"todo-metric " + tone + (active ? " active" : "")} aria-pressed={active} onClick={onClick}><span className="todo-metric-icon"><Icon size={20}/></span><span><small>{label}</small><strong>{String(value).padStart(2, "0")}</strong><em>{hint}</em></span><ChevronRight size={17}/></button>;
}
function StudentTimeline({ events, onOpenCase }: { events: TimelineEvent[]; onOpenCase: (id: string) => void }) {
  if (!events.length) return <p className="timeline-empty">目前沒有訓育紀錄或跟進事件。</p>;
  return <ol className="student-timeline">
    {events.map((event) => {
      const Icon = event.type === "record" ? ClipboardList : event.type === "closed" ? CheckCircle2 : event.type === "reopened" ? ArrowRight : Clock3;
      const title = event.type === "record" ? "建立訓育紀錄" : event.type === "closed" ? "完成結案" : event.type === "reopened" ? "重新開啟個案" : "加入跟進記錄";
      return <li key={event.id} className={"timeline-item " + event.type}>
        <span className="timeline-dot" aria-hidden="true"><Icon size={14}/></span>
        <article className="timeline-card">
          <div className="timeline-card-head"><strong>{title}</strong><time dateTime={event.date}>{dateLabel(event.date)}</time></div>
          <div className="timeline-card-category">{event.category}{event.type === "record" && <KindTag kind={event.kind}/>}</div>
          <p>{event.detail}</p>
          <div className="timeline-card-foot">
            {event.type === "record" ? <StatusTag status={event.status}/> : <span>{event.author ?? (event.type === "closed" ? "結案結果" : "訓育組")}</span>}
            <button type="button" className="row-button" onClick={() => onOpenCase(event.caseId)}>查看個案 <ChevronRight size={14}/></button>
          </div>
        </article>
      </li>;
    })}
  </ol>;
}
function CasePanel({ entry, student, onClose, onEdit, onSavePlan, onStart, onAddFollowUp, onCloseCase, onReopen }: {
  entry: Entry; student: Student; onClose: () => void; onEdit: () => void;
  onSavePlan: (id: string, assignee: string, dueDate: string) => void;
  onStart: (id: string) => void; onAddFollowUp: (id: string, note: string) => void;
  onCloseCase: (id: string, summary: string) => void; onReopen: (id: string) => void;
}) {
  const [assignee, setAssignee] = useState(entry.assignee ?? "");
  const [dueDate, setDueDate] = useState(entry.dueDate ?? "");
  const [followUpNote, setFollowUpNote] = useState("");
  const [resolution, setResolution] = useState("");
  const isClosed = entry.status === "已結案";
  const followUps = entry.followUps ?? [];

  function submitFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!followUpNote.trim()) return;
    onAddFollowUp(entry.id, followUpNote);
    setFollowUpNote("");
  }
  function submitClosure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolution.trim()) return;
    onCloseCase(entry.id, resolution);
    setResolution("");
  }

  return <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="panel case-panel" role="dialog" aria-modal="true" aria-labelledby="case-title">
      <div className="panel-head"><div><small>CASE DETAILS / 個案跟進</small><h2 id="case-title">個案詳情</h2></div><button type="button" aria-label="關閉個案詳情" onClick={onClose}><X size={20}/></button></div>
      <div className="panel-body case-body">
        <div className="case-person"><Avatar student={student} large/><div><h3>{student.name}</h3><p>{student.className} · 學號 {student.number}</p></div><StatusTag status={entry.status}/></div>
        <div className="case-steps" aria-label="個案流程">
          <span className="active">1 建立紀錄</span><span className={entry.status !== "待跟進" ? "active" : ""}>2 跟進處理</span><span className={isClosed ? "active" : ""}>3 結案</span>
        </div>
        <section className="case-section"><div className="case-section-head"><h3>事項資料</h3><button type="button" className="row-button" onClick={onEdit}><FilePenLine size={14}/>編輯紀錄</button></div>
          <div className="case-facts"><div><span>紀錄日期</span><strong>{dateLabel(entry.date)}</strong></div><div><span>類型</span><KindTag kind={entry.kind}/></div><div><span>事項分類</span><strong>{entry.category}</strong></div></div>
          <p className="case-description">{entry.note}</p>
        </section>
        <section className="case-section"><div className="case-section-head"><h3>跟進安排</h3></div>
          {isClosed ? <div className="case-facts"><div><span>負責人</span><strong>{entry.assignee || "未指定"}</strong></div><div><span>跟進期限</span><strong>{entry.dueDate ? dateLabel(entry.dueDate) : "未設定"}</strong></div></div> : <form className="case-plan" onSubmit={(event) => { event.preventDefault(); onSavePlan(entry.id, assignee, dueDate); }}>
            <div className="field-row"><label className="field"><span>負責人</span><input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="例如：班主任" maxLength={60}/></label><label className="field"><span>跟進期限</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)}/></label></div>
            <button type="submit" className="btn secondary">儲存安排</button>
          </form>}
        </section>
        <section className="case-section"><div className="case-section-head"><h3>跟進記錄</h3><span>{followUps.length} 則</span></div>
          {followUps.length ? <ol className="case-timeline">{followUps.map((item) => <li key={item.id}><div><strong>{item.author}</strong><time dateTime={item.date}>{dateLabel(item.date)}</time></div><p>{item.note}</p></li>)}</ol> : <p className="case-empty">尚未加入跟進記錄。</p>}
          {!isClosed && <form className="case-follow-form" onSubmit={submitFollowUp}><label className="field"><span>新增跟進記錄</span><textarea rows={3} maxLength={500} placeholder="記下聯絡、面談、觀察或下一步…" value={followUpNote} onChange={(event) => setFollowUpNote(event.target.value)} required/></label><button type="submit" className="btn secondary"><Plus size={15}/>加入記錄</button></form>}
        </section>
        <section className="case-section case-closing"><div className="case-section-head"><h3>結案處理</h3></div>
          {isClosed ? <><p className="case-closed-date">結案日期：{entry.closedAt ? dateLabel(entry.closedAt) : "示範舊紀錄未有日期"}</p><p className="case-description">{entry.resolution || "此示範舊紀錄沒有結案摘要。"}</p><button type="button" className="btn secondary" onClick={() => onReopen(entry.id)}>重新開啟個案</button></> : <form onSubmit={submitClosure}><label className="field"><span>處理結果及結案摘要 *</span><textarea rows={3} maxLength={500} placeholder="說明已採取的行動、結果，以及為何可以結案…" value={resolution} onChange={(event) => setResolution(event.target.value)} required/></label><button type="submit" className="btn primary"><Check size={16}/>完成結案</button></form>}
        </section>
      </div>
      {!isClosed && entry.status === "待跟進" && <div className="panel-foot"><button type="button" className="btn secondary" onClick={() => onStart(entry.id)}>開始跟進</button></div>}
    </section>
  </div>;
}
function Stat({ icon: Icon, color, value, label, hint }: { icon: typeof UsersRound; color: string; value: number; label: string; hint: string }) {
  return <section className="stat"><div className="stat-top"><span className={"stat-icon " + color}><Icon size={20}/></span><small>{hint}</small></div><strong>{String(value).padStart(2, "0")}</strong><p>{label}</p></section>;
}
function Empty({ text, hint }: { text: string; hint: string }) { return <div className="empty"><Search size={23}/><strong>{text}</strong><p>{hint}</p></div>; }
