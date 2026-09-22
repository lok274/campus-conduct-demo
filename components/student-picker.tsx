"use client";

import { useMemo, useState, type RefObject } from "react";
import { Search, UsersRound } from "lucide-react";
import type { Student } from "../lib/conduct-types";
import { ALL_CLASSES, matchesStudent, normalizeSearch, studentSearchRank } from "../lib/list-tools";
import { ListPagination, useListPage } from "./list-pagination";

type Props = {
  students: Student[];
  query: string;
  className: string;
  onQuery: (value: string) => void;
  onClass: (value: string) => void;
  onSelect: (id: string) => void;
  onDetails?: (id: string) => void;
  onViewAll?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  mode: "workbench" | "picker";
};
export function StudentSearch({ students, query, className, onQuery, onClass, onSelect, onDetails, onViewAll, inputRef, mode }: Props) {
  const classes = useMemo(() => [ALL_CLASSES, ...new Set(students.map(student => student.className))], [students]);
  const active = !!normalizeSearch(query) || className !== ALL_CLASSES;
  const matches = useMemo(() => active ? students.filter(student => matchesStudent(student, query, className))
    .sort((a, b) => studentSearchRank(a, query) - studentSearchRank(b, query) ||
      classes.indexOf(a.className) - classes.indexOf(b.className) || Number(a.seat) - Number(b.seat)) : [], [students, query, className, active, classes]);
  const pagination = useListPage(matches, JSON.stringify([query, className]));
  const shown = mode === "workbench" ? matches.slice(0, 10) : pagination.items;
  const title = mode === "workbench" ? "找學生，登記紀錄" : "搜尋並選擇學生";
  return <section className={"student-search " + mode} aria-label={title}>
    <div className="student-search-heading"><h2><UsersRound size={21}/>{title}</h2>{mode === "workbench" && <span>姓名或學號 · Ctrl / ⌘ K</span>}</div>
    <div className="student-search-controls">
      <label><span>學生姓名 / 學號</span><div><Search size={19}/><input ref={inputRef} aria-label={mode === "workbench" ? "工作台搜尋學生" : "選擇學生搜尋"} placeholder="輸入姓名或完整學號" value={query} onChange={event => onQuery(event.target.value)}/></div></label>
      <label><span>班級</span><select aria-label={mode === "workbench" ? "工作台班級" : "選擇學生班級"} value={className} onChange={event => onClass(event.target.value)}>{classes.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    {!active ? <p className="lookup-hint">輸入姓名、學號或選擇班級後，即可查看學生；不會預先選中任何人。</p> : <>
      <div className="lookup-result-head"><p role="status">找到 <strong>{matches.length}</strong> 位學生{mode === "workbench" && matches.length > 10 ? " · 先顯示 10 位" : ""}</p>{onViewAll && <button type="button" className="row-button" onClick={onViewAll}>查看全部結果</button>}</div>
      <div className="lookup-results">{shown.map(student => <div className="lookup-row" key={student.id}>
        <div><strong>{student.name}</strong><p>{student.className} · 座號 {student.seat}<span>學號 {student.number}</span></p></div>
        <div className="lookup-actions"><button type="button" className="btn primary" onClick={() => onSelect(student.id)} aria-label={(mode === "workbench" ? "登記" : "選擇") + student.name + " " + student.number}>{mode === "workbench" ? "登記紀錄" : "選擇學生"}</button>
          {onDetails && <button type="button" className="btn secondary" onClick={() => onDetails(student.id)} aria-label={"查看" + student.name + " " + student.number}>查看資料</button>}</div>
      </div>)}</div>
      {!matches.length && <p className="lookup-hint">找不到符合條件的學生。請核對學號或更改班級。</p>}
      {mode === "picker" && <ListPagination page={pagination} label="選擇學生" unit="位"/>}
    </>}
  </section>;
}
export function StudentPicker({ students, value, onChange }: { students: Student[]; value: string; onChange: (id: string) => void }) {
  const selected = students.find(student => student.id === value);
  const [query, setQuery] = useState("");
  const [className, setClassName] = useState(selected?.className ?? ALL_CLASSES);
  const [choosing, setChoosing] = useState(!selected);
  return <div className="student-picker">
    {selected && <div className="selected-student" role="status"><div><small>本次登記學生</small><strong>{selected.name}</strong><p>{selected.className} · 座號 {selected.seat} · 學號 {selected.number}</p></div><button type="button" className="btn secondary" onClick={() => setChoosing(!choosing)}>{choosing ? "收起選擇" : "更改學生"}</button></div>}
    {choosing && <StudentSearch students={students} mode="picker" query={query} className={className} onQuery={setQuery}
      onClass={next => { setClassName(next); onChange(""); }}
      onSelect={id => { onChange(id); setChoosing(false); }} />}
    {!selected && <p className="selection-required">尚未選擇學生：請點「選擇學生」，核對身分後才可儲存。</p>}
  </div>;
}
