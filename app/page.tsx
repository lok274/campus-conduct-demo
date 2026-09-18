"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList, Clock3, FilePenLine, Filter, LayoutDashboard, Menu, Plus, Search, ShieldCheck, Sparkles, UsersRound, X, ArrowRight, HeartHandshake } from "lucide-react";

type Page = "dashboard" | "students" | "records";
type Kind = "嘉許" | "提醒" | "違規";
type Status = "待跟進" | "已結案";
type Student = { id: string; name: string; className: string; seat: string; number: string };
type Entry = { id: string; studentId: string; kind: Kind; category: string; date: string; note: string; status: Status };
type Draft = Omit<Entry, "id">;

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
  { id: "r2", studentId: "s4", kind: "提醒", category: "課堂秩序", date: "2026-09-17", note: "課堂期間與同學交談，已作口頭提醒。", status: "待跟進" },
  { id: "r3", studentId: "s7", kind: "嘉許", category: "熱心助人", date: "2026-09-16", note: "協助同學尋回遺失物品。", status: "已結案" },
  { id: "r4", studentId: "s2", kind: "違規", category: "校園常規", date: "2026-09-15", note: "未依規定完成值日工作，待班主任跟進。", status: "待跟進" },
  { id: "r5", studentId: "s5", kind: "嘉許", category: "服務精神", date: "2026-09-14", note: "活動後協助清理場地。", status: "已結案" },
  { id: "r6", studentId: "s3", kind: "提醒", category: "守時", date: "2026-09-13", note: "早會遲到，已了解原因並提醒。", status: "已結案" },
  { id: "r7", studentId: "s6", kind: "嘉許", category: "積極參與", date: "2026-09-12", note: "積極參與校園義工服務。", status: "已結案" },
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
const nav: { id: Page; text: string; Icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", text: "總覽", Icon: LayoutDashboard },
  { id: "students", text: "學生名冊", Icon: UsersRound },
  { id: "records", text: "獎懲紀錄", Icon: ClipboardList },
];

function Avatar({ student, large = false }: { student: Student; large?: boolean }) {
  const color = ["mint", "blue", "rose", "gold"][students.findIndex((s) => s.id === student.id) % 4];
  return <span className={"avatar " + color + (large ? " large" : "")}>{student.name.slice(-2)}</span>;
}
function KindTag({ kind }: { kind: Kind }) { return <span className={"kind-tag kind-" + kind}>{kind}</span>; }
function StatusTag({ status }: { status: Status }) { return <span className={"status-tag " + (status === "待跟進" ? "waiting" : "done")}><i />{status}</span>; }

export default function Home() {
  const [page, setPage] = useState<Page>("dashboard");
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("全部班級");
  const [kindFilter, setKindFilter] = useState("全部類型");
  const [statusFilter, setStatusFilter] = useState("全部狀態");
  const [menuOpen, setMenuOpen] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
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
    if (!formOpen && !studentId) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setFormOpen(false); setStudentId(null); }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [formOpen, studentId]);

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), []);
  const pending = entries.filter((e) => e.status === "待跟進");
  const praise = entries.filter((e) => e.kind === "嘉許");
  const closed = entries.filter((e) => e.status === "已結案");
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
  const selected = studentId ? studentMap.get(studentId) : undefined;
  const selectedEntries = selected ? entries.filter((e) => e.studentId === selected.id) : [];

  function navigate(next: Page) { setPage(next); setSearch(""); setMenuOpen(false); }
  function addEntry(id?: string) {
    setEditingId(null); setDraft({ ...newDraft(), studentId: id || students[0].id });
    setStudentId(null); setFormOpen(true);
  }
  function editEntry(entry: Entry) {
    setEditingId(entry.id);
    setDraft({ studentId: entry.studentId, kind: entry.kind, category: entry.category, date: entry.date, note: entry.note, status: entry.status });
    setStudentId(null); setFormOpen(true);
  }
  function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.studentId || !draft.date || !draft.category || !draft.note.trim()) return;
    if (editingId) {
      setEntries((current) => current.map((e) => e.id === editingId ? { ...e, ...draft, note: draft.note.trim() } : e));
      setNotice("紀錄已更新");
    } else {
      setEntries((current) => [{ ...draft, id: "r" + Date.now(), note: draft.note.trim() }, ...current]);
      setNotice("新紀錄已加入");
    }
    setFormOpen(false); navigate("records");
  }
  function resolveEntry(id: string) {
    setEntries((current) => current.map((e) => e.id === id ? { ...e, status: "已結案" } : e));
    setNotice("紀錄已標記為結案");
  }
  const title = page === "dashboard" ? "訓育工作台" : page === "students" ? "學生名冊" : "獎懲紀錄";
  const subtitle = page === "dashboard" ? "掌握需要處理的學生事務與最新紀錄。" : page === "students" ? "查看學生資料與個別訓育紀錄。" : "集中查閱、篩選及更新訓育事項。";

  return <div className="app">
    <aside className={"sidebar" + (menuOpen ? " open" : "")}>
      <div className="brand"><div className="brand-icon"><BookOpenCheck size={22}/></div><div><strong>校園訓育系統</strong><small>STUDENT AFFAIRS</small></div></div>
      <div className="side-label">工作空間</div>
      <nav aria-label="主要導覽">{nav.map(({ id, text, Icon }) => <button key={id} type="button" className={"nav-item" + (page === id ? " active" : "")} onClick={() => navigate(id)}><Icon size={19}/>{text}{page === id && <i/>}</button>)}</nav>
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
          <section className="card follow-card"><div className="card-heading"><div><small>待辦清單</small><h2>需要跟進</h2></div><b>{pending.length} 項</b></div>{pending.length ? pending.map((e) => { const s = studentMap.get(e.studentId)!; return <div className="follow" key={e.id}><span className={e.kind === "違規" ? "warn red" : "warn"}><Clock3 size={17}/></span><div><strong>{s.name} <span>· {s.className}</span></strong><p>{e.category}</p></div><button type="button" aria-label={"編輯" + s.name + "的紀錄"} onClick={() => editEntry(e)}><ChevronRight size={18}/></button></div>; }) : <p className="empty-inline">目前沒有待跟進事項。</p>}<button type="button" className="follow-all" onClick={() => navigate("records")}>管理所有事項 <ArrowRight size={15}/></button></section></div>
        </>}
        {page === "students" && <section className="card table-card"><div className="table-heading"><div><small>STUDENT DIRECTORY</small><h2>學生資料 <b>{shownStudents.length}</b></h2></div><div className="filters"><label className="search"><Search size={16}/><input aria-label="搜尋學生" placeholder="搜尋姓名或學號" value={search} onChange={(e) => setSearch(e.target.value)}/></label><label className="select"><Filter size={15}/><select aria-label="篩選班級" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>{classes.map((c) => <option key={c}>{c}</option>)}</select></label></div></div><div className="table-scroll"><table><thead><tr><th>學生</th><th>班級 / 學號</th><th>紀錄數</th><th>待跟進</th><th>操作</th></tr></thead><tbody>{shownStudents.map((s) => { const total = entries.filter((e) => e.studentId === s.id).length; const todo = pending.filter((e) => e.studentId === s.id).length; return <tr key={s.id}><td><div className="person"><Avatar student={s}/><div><strong>{s.name}</strong><small>座號 {s.seat}</small></div></div></td><td><strong>{s.className}</strong><small className="cell-sub">{s.number}</small></td><td><span className="count">{total}</span></td><td>{todo ? <span className="todo-count">● {todo} 項</span> : <span className="muted">—</span>}</td><td><button type="button" className="row-button" onClick={() => setStudentId(s.id)}>查看資料 <ChevronRight size={15}/></button></td></tr>; })}</tbody></table>{!shownStudents.length && <Empty text="找不到符合條件的學生" hint="請更改搜尋字詞或班級。"/>}</div><div className="table-foot">顯示 {shownStudents.length} 位學生 <span>資料僅供介面示範</span></div></section>}
        {page === "records" && <section className="card table-card"><div className="table-heading"><div><small>CONDUCT RECORDS</small><h2>全部紀錄 <b>{shownEntries.length}</b></h2></div><div className="filters"><label className="search"><Search size={16}/><input aria-label="搜尋紀錄" placeholder="搜尋學生或事項" value={search} onChange={(e) => setSearch(e.target.value)}/></label><label className="select"><select aria-label="篩選類型" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}><option>全部類型</option><option>嘉許</option><option>提醒</option><option>違規</option></select></label><label className="select"><select aria-label="篩選狀態" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option>全部狀態</option><option>待跟進</option><option>已結案</option></select></label></div></div><div className="table-scroll"><table className="records-table"><thead><tr><th>日期 / 學生</th><th>類型</th><th>事項</th><th>狀態</th><th>操作</th></tr></thead><tbody>{shownEntries.map((e) => { const s = studentMap.get(e.studentId)!; return <tr key={e.id}><td><div className="person"><Avatar student={s}/><div><strong>{s.name} <span>· {s.className}</span></strong><small>{dateLabel(e.date)}</small></div></div></td><td><KindTag kind={e.kind}/></td><td><strong>{e.category}</strong><small className="entry-note">{e.note}</small></td><td><StatusTag status={e.status}/></td><td><div className="actions"><button type="button" className="row-button" onClick={() => editEntry(e)}><FilePenLine size={15}/>編輯</button>{e.status === "待跟進" && <button type="button" className="resolve" aria-label={"將" + s.name + "的紀錄標記為結案"} onClick={() => resolveEntry(e.id)}><Check size={15}/></button>}</div></td></tr>; })}</tbody></table>{!shownEntries.length && <Empty text="沒有符合條件的紀錄" hint="請調整搜尋字詞或篩選條件。"/>}</div><div className="table-foot">顯示 {shownEntries.length} 筆紀錄 <span>資料僅供介面示範</span></div></section>}
        <footer>校園訓育系統 · 前端介面示範 <span>所有學生及紀錄均為虛構資料</span></footer>
      </main>
    </div>
    {selected && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setStudentId(null); }}><section className="panel" role="dialog" aria-modal="true" aria-labelledby="student-title"><div className="panel-head"><div><small>STUDENT PROFILE</small><h2 id="student-title">學生資料</h2></div><button type="button" aria-label="關閉學生資料" onClick={() => setStudentId(null)}><X size={20}/></button></div><div className="panel-body"><div className="profile"><Avatar student={selected} large/><div><h3>{selected.name}</h3><p>{selected.className} · 座號 {selected.seat}</p></div></div><div className="profile-facts"><div><span>學號</span><strong>{selected.number}</strong></div><div><span>班級</span><strong>{selected.className}</strong></div><div><span>紀錄總數</span><strong>{selectedEntries.length} 筆</strong></div></div><h3 className="block-title">訓育紀錄 <span>{selectedEntries.length} 筆</span></h3>{selectedEntries.length ? selectedEntries.map((e) => <article className="profile-entry" key={e.id}><div><KindTag kind={e.kind}/><small>{dateLabel(e.date)}</small></div><strong>{e.category}</strong><p>{e.note}</p><StatusTag status={e.status}/></article>) : <p className="empty-inline">目前沒有訓育紀錄。</p>}</div><div className="panel-foot"><button type="button" className="btn primary wide" onClick={() => addEntry(selected.id)}><Plus size={17}/>為此學生新增紀錄</button></div></section></div>}
    {formOpen && <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setFormOpen(false); }}><section className="panel" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="panel-head"><div><small>CONDUCT RECORD</small><h2 id="form-title">{editingId ? "編輯訓育紀錄" : "新增訓育紀錄"}</h2></div><button type="button" aria-label="關閉表單" onClick={() => setFormOpen(false)}><X size={20}/></button></div><form className="entry-form" onSubmit={saveEntry}><div className="panel-body"><p className="form-intro">記下學生的正向表現或需要跟進的事項，讓處理過程更清晰。</p><label className="field"><span>學生 *</span><select value={draft.studentId} onChange={(e) => setDraft({ ...draft, studentId: e.target.value })} required>{students.map((s) => <option value={s.id} key={s.id}>{s.name} · {s.className} · {s.number}</option>)}</select></label><div className="field-row"><label className="field"><span>紀錄類型 *</span><select value={draft.kind} onChange={(e) => { const kind = e.target.value as Kind; setDraft({ ...draft, kind, category: categories[kind][0] }); }}><option>嘉許</option><option>提醒</option><option>違規</option></select></label><label className="field"><span>日期 *</span><input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} required/></label></div><label className="field"><span>事項分類 *</span><select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>{categories[draft.kind].map((c) => <option key={c}>{c}</option>)}</select></label><label className="field"><span>內容說明 *</span><textarea rows={5} maxLength={300} placeholder="簡述事件、已採取的行動或後續安排…" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} required/><small>{draft.note.length}/300 字</small></label><label className="field"><span>處理狀態</span><select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as Status })}><option>待跟進</option><option>已結案</option></select></label><p className="form-warning"><ShieldCheck size={16}/> 這是前端示範版。資料只會在目前頁面暫時顯示。</p></div><div className="panel-foot"><button type="button" className="btn secondary" onClick={() => setFormOpen(false)}>取消</button><button type="submit" className="btn primary"><Check size={17}/>{editingId ? "儲存變更" : "建立紀錄"}</button></div></form></section></div>}
    {notice && <div className="toast" role="status"><CheckCircle2 size={18}/>{notice}<button type="button" aria-label="關閉通知" onClick={() => setNotice("")}><X size={14}/></button></div>}
  </div>;
}
function Stat({ icon: Icon, color, value, label, hint }: { icon: typeof UsersRound; color: string; value: number; label: string; hint: string }) {
  return <section className="stat"><div className="stat-top"><span className={"stat-icon " + color}><Icon size={20}/></span><small>{hint}</small></div><strong>{String(value).padStart(2, "0")}</strong><p>{label}</p></section>;
}
function Empty({ text, hint }: { text: string; hint: string }) { return <div className="empty"><Search size={23}/><strong>{text}</strong><p>{hint}</p></div>; }


