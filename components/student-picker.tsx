"use client";

import { useMemo, useState } from "react";
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
};
function StudentSearch({ students, query, className, onQuery, onClass, onSelect }: Props) {
  const classes = useMemo(() => [ALL_CLASSES, ...new Set(students.map(student => student.className))], [students]);
  const active = !!normalizeSearch(query) || className !== ALL_CLASSES;
  const matches = useMemo(() => active ? students.filter(student => matchesStudent(student, query, className))
    .sort((a, b) => studentSearchRank(a, query) - studentSearchRank(b, query) ||
      classes.indexOf(a.className) - classes.indexOf(b.className) || Number(a.seat) - Number(b.seat)) : [], [students, query, className, active, classes]);
  const pagination = useListPage(matches, JSON.stringify([query, className]));
  const pageGroups = [...pagination.items.reduce((groups, student) => {
    const group = groups.get(student.className) ?? [];
    group.push(student);
    groups.set(student.className, group);
    return groups;
  }, new Map<string, Student[]>())];
  return <section className="student-search" aria-label="搜尋並選擇學生">
    <div className="student-search-heading"><h2><UsersRound size={21}/>搜尋並選擇學生</h2></div>
    <div className="student-search-controls">
      <label><span>學生姓名 / 學號</span><div><Search size={19}/><input aria-label="選擇學生搜尋" placeholder="輸入姓名或完整學號" value={query} onChange={event => onQuery(event.target.value)}/></div></label>
      <label><span>班級</span><select aria-label="選擇學生班級" value={className} onChange={event => onClass(event.target.value)}>{classes.map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    {!active ? <p className="lookup-hint">輸入姓名、學號或選擇班級後，即可查看學生；不會預先選中任何人。</p> : <>
      <div className="lookup-result-head"><p role="status">找到 <strong>{matches.length}</strong> 位學生</p></div>
      <div className="lookup-results">{pageGroups.map(([groupClass, groupStudents]) => <section className="lookup-class-group" key={groupClass} aria-labelledby={`student-group-${groupClass}`}>
        <h3 id={`student-group-${groupClass}`}>{groupClass}</h3>
        <ul className="lookup-name-list">{groupStudents.map(student => <li key={student.id}>
          <button type="button" className="lookup-name-item" onClick={() => onSelect(student.id)} aria-label={`選擇 ${student.name}，${student.className}，學號 ${student.number}`}>{student.name}</button>
        </li>)}</ul>
      </section>)}</div>
      {!matches.length && <p className="lookup-hint">找不到符合條件的學生。請核對學號或更改班級。</p>}
      <ListPagination page={pagination} label="選擇學生" unit="位"/>
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
    {choosing && <StudentSearch students={students} query={query} className={className} onQuery={setQuery}
      onClass={next => { setClassName(next); onChange(""); }}
      onSelect={id => { onChange(id); setChoosing(false); }} />}
    {!selected && <p className="selection-required">尚未選擇學生：請點選名單內的學生姓名，核對身分後才可儲存。</p>}
  </div>;
}
