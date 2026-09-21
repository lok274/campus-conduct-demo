"use client";

import { CONDUCT_RULES, normalizeRuleCode, resolveRule, ruleKey, scoreLabel, type ConductRule, type RuleInput } from "../lib/conduct-rules";
import { SCHOOL_CATEGORIES, type SchoolCategory } from "../lib/school-rules";

export function RuleDetails({ rule }: { rule: ConductRule }) {
  return <div className="rule-details">
    <strong>{rule.itemName}</strong>
    <dl>
      <div><dt>Code</dt><dd>{rule.code}</dd></div>
      <div><dt>校本範疇</dt><dd>{rule.category}</dd></div>
      <div><dt>分類</dt><dd>{rule.subCategory}</dd></div>
      <div><dt>預設分數</dt><dd>{scoreLabel(rule.score)} 分</dd></div>
      <div><dt>分數範圍</dt><dd>{rule.minScore === rule.maxScore ? `${scoreLabel(rule.minScore)} 分（固定）` : `${scoreLabel(rule.minScore)} 至 ${scoreLabel(rule.maxScore)} 分`}</dd></div>
    </dl>
    <p>分數按校本規則顯示，尚未計入學生分數。</p>
  </div>;
}

export function RulePicker({ value, onChange, id, required = true }: {
  value: RuleInput;
  onChange: (value: RuleInput) => void;
  id: string;
  required?: boolean;
}) {
  const { rule, error } = resolveRule(value);
  const categories = value.schoolCategory ? [value.schoolCategory] : SCHOOL_CATEGORIES;
  return <fieldset className="rule-picker">
    <legend>校本事項 Code{required ? " *" : "（選填）"}</legend>
    <p id={id + "-help"}>可從清單選擇，或在下方直接輸入 Code；兩個欄位會同步。</p>
    <label className="field"><span>校本範疇</span><select value={value.schoolCategory} onChange={(event) => onChange({ ...value, schoolCategory: event.target.value as SchoolCategory | "" })}>
      <option value="">全部範疇</option>{SCHOOL_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
    </select></label>
    <label className="field"><span>Code 下拉選單</span><select value={rule ? ruleKey(rule) : ""} aria-describedby={id + "-help"} onChange={(event) => {
      const selected = CONDUCT_RULES.find((item) => ruleKey(item) === event.target.value);
      onChange(selected ? { code: selected.code, schoolCategory: selected.category } : { ...value, code: "" });
    }}>
      <option value="">請選擇 Code 及事項</option>
      {categories.map((category) => <optgroup key={category} label={category}>{CONDUCT_RULES.filter((item) => item.category === category).map((item) =>
        <option key={ruleKey(item)} value={ruleKey(item)}>{item.code} · {item.itemName}</option>
      )}</optgroup>)}
    </select></label>
    <label className="field"><span>直接輸入 Code</span><input type="text" value={value.code} required={required} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="例如：101 或 HW" aria-invalid={!!error} aria-describedby={error ? id + "-error" : id + "-help"} onChange={(event) => onChange({ ...value, code: normalizeRuleCode(event.target.value) })}/></label>
    {error && <p id={id + "-error"} className="rule-error" role="alert">{error}</p>}
    <div aria-live="polite">{rule && <RuleDetails rule={rule}/>}</div>
  </fieldset>;
}
