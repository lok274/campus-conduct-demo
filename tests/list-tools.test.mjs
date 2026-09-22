import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { createLargeSchool } from "./fixtures/large-school.ts";
import { matchesStudent, normalizeSearch, recordSearchText, compareTodoPriority, pageWindow, toggleSelection, duplicateStudentIds, scoreLabel, studentSearchRank } from "../lib/list-tools.ts";
import { completeCase } from "../lib/case-workflow.ts";

const { students, entries } = createLargeSchool();
test("independent fixture: 840 unique students / 5,000 linked records", () => {
  assert.equal(students.length,840); assert.equal(entries.length,5000);
  assert.equal(new Set(students.map(s=>s.id)).size,840);
  assert.equal(new Set(students.map(s=>s.number)).size,840);
  assert.ok(entries.every(e=>students.some(s=>s.id===e.studentId)));
});
test("same names remain distinct; exact student number / width / case normalization", () => {
  const same=students.filter(s=>matchesStudent(s,"同名測試生"));
  assert.equal(same.length,2); assert.notEqual(same[0].className,same[1].className);
  assert.deepEqual(students.filter(s=>matchesStudent(s," ｔｅｓｔ０００１ ")).map(s=>s.id),["test-s1"]);
  assert.equal(studentSearchRank(students[0],"TEST0001"),0);
});
test("cross-class filtering and empty results", () => {
  assert.equal(students.filter(s=>matchesStudent(s,"","測試1A")).length,35);
  assert.equal(students.filter(s=>matchesStudent(s,"同名測試生","測試1B")).length,1);
  assert.equal(students.filter(s=>matchesStudent(s,"TEST9999")).length,0);
});
test("filter and sort all results before taking a page", () => {
  const matches=students.filter(s=>matchesStudent(s,"","測試6D")).sort((a,b)=>Number(b.seat)-Number(a.seat));
  const page=pageWindow(matches.length,2,25);
  assert.equal(matches.slice(page.start-1,page.end).length,10);
  assert.equal(matches[0].seat,"35"); assert.equal(matches.at(-1).seat,"01");
});
test("pagination boundaries, size choices and zero results", () => {
  assert.deepEqual(pageWindow(840,34,25),{page:34,pages:34,start:826,end:840,total:840,pageSize:25});
  assert.equal(pageWindow(840,99,25).page,34);
  assert.equal(pageWindow(0,5,25).start,0); assert.equal(pageWindow(0,5,25).end,0);
  for(const size of [25,50,100])assert.equal(pageWindow(5000,1,size).end,size);
});
test("cross-page/class selection does not erase previous selections", () => {
  let ids=toggleSelection([],students.slice(0,25));
  ids=toggleSelection(ids,students.slice(25,50));
  ids=toggleSelection(ids,students.slice(140,165));
  assert.equal(ids.length,75);
  ids=toggleSelection(ids,students.slice(25,50));
  assert.equal(ids.length,50); assert.ok(ids.includes("test-s1")); assert.ok(ids.includes("test-s165"));
  assert.ok(!ids.includes("test-s26"));
  assert.ok(!ids.includes("test-s840"));
});
test("duplicate detection checks whole dataset, preserves zero and rule scope", () => {
  const expected={date:"2026-09-22",kind:"守規",category:"測試事項",note:"相同  內容",scoreChange:0,rule:{code:"1",category:"守規"}};
  const all=[...entries,{...expected,id:"duplicate",studentId:students[839].id,status:"已結案"}];
  const found=duplicateStudentIds(all,{...expected,note:" 相同 內容 "});
  assert.deepEqual([...found],[students[839].id]);
  assert.equal(duplicateStudentIds(all,{...expected,scoreChange:-1}).size,0);
  assert.equal(duplicateStudentIds(all,{...expected,rule:{...expected.rule,category:"勤學"}}).size,0);
});
test("todo order: overdue, today, unscheduled, future", () => {
  const cases=[{id:"future",dueDate:"2026-09-25"},{id:"unscheduled"},{id:"today",dueDate:"2026-09-22"},{id:"overdue",dueDate:"2026-09-20"}].map(e=>({...e,date:"2026-09-18"}));
  assert.deepEqual(cases.sort((a,b)=>compareTodoPriority(a,b,"2026-09-22")).map(e=>e.id),["overdue","today","unscheduled","future"]);
});
test("global and full record search use the same fields", () => {
  const entry=entries[0], student=students[0];
  for(const query of [student.number,student.name,entry.status,entry.kind,entry.date])assert.ok(recordSearchText(entry,student).includes(normalizeSearch(query)));
});
test("actual score preserves zero / decimals and missing score is not zero", () => {
  assert.equal(scoreLabel({scoreChange:0,rule:{score:-3}}),"0 分");
  assert.equal(scoreLabel({scoreChange:-0.5}),"-0.5 分");
  assert.equal(scoreLabel({scoreChange:2}),"+2 分");
  assert.equal(scoreLabel({}),"未記分");
});
test("direct closure keeps existing history; editing closed records does not add closure", () => {
  const source={status:"跟進中",followUps:[{note:"已跟進"}],closureHistory:[{id:"old",summary:"上次結案"}]};
  const closed=completeCase(source,"不需跟進",new Date("2026-09-22T08:00:00Z"),true);
  assert.equal(closed.status,"已結案"); assert.equal(closed.closedWithoutFollowUp,true);
  assert.equal(closed.followUps.length,1); assert.equal(closed.closureHistory.length,2);
  assert.equal(completeCase(closed,"更正",new Date()),closed);
});
test("840 / 5,000 repeated search+pagination remains bounded", () => {
  const map=new Map(students.map(s=>[s.id,s]));
  const start=performance.now();
  for(let i=0;i<40;i++){
    const matches=entries.filter(e=>recordSearchText(e,map.get(e.studentId)).includes("test0001"));
    const page=pageWindow(matches.length,1,25);
    assert.ok(matches.slice(page.start-1,page.end).length<=25);
  }
  const ms=performance.now()-start;
  console.log("40 complete 5,000-record searches:",Math.round(ms),"ms");
  assert.ok(ms<5000,"unexpected search regression");
});
