"use client";

import { CONDUCT_RULES, getRuleGroups, normalizeRuleCode, resolveRule, ruleKey, scoreLabel, type ConductRule, type RuleInput } from "../lib/conduct-rules";
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
  const subCategory = value.schoolCategory ? value.subCategory ?? rule?.subCategory ?? "" : "";
  const subCategories = value.schoolCategory ? getRuleGroups(value.schoolCategory) : [];
  const groups = getRuleGroups(value.schoolCategory, subCategory);
  const selectRule = (selected: ConductRule) => onChange({ code: selected.code, schoolCategory: selected.category, subCategory: selected.subCategory });
  return <fieldset className="rule-picker">
    <legend>校本事項 Code{required ? " *" : "（選填）"}</legend>
    <p id={id + "-help"}>可先選範疇及分類，再選 Code；也可直接輸入 Code，自動帶出分類。</p>
    <label className="field"><span>校本範疇</span><select value={value.schoolCategory} onChange={(event) => {
      const schoolCategory = event.target.value as SchoolCategory | "";
      const code = rule && schoolCategory && rule.category !== schoolCategory ? "" : value.code;
      const next = { code, schoolCategory };
      onChange({ ...next, subCategory: schoolCategory ? resolveRule(next).rule?.subCategory ?? "" : "" });
    }}>
      <option value="">全部範疇</option>{SCHOOL_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
    </select></label>
    <label className="field"><span>{value.schoolCategory ? `${value.schoolCategory}分類` : "分類"}</span><select value={subCategory} disabled={!value.schoolCategory} onChange={(event) => {
      const selected = event.target.value;
      onChange({ ...value, subCategory: selected, code: !selected || rule?.subCategory === selected ? value.code : "" });
    }}>
      <option value="">{value.schoolCategory ? "全部分類" : "請先選擇校本範疇"}</option>
      {subCategories.map((group) => <option key={group.subCategory} value={group.subCategory}>{group.subCategory}（{group.rules.length} 項）</option>)}
    </select></label>
    <label className="field"><span>Code 下拉選單</span><select value={rule ? ruleKey(rule) : ""} aria-describedby={id + "-help"} onChange={(event) => {
      const selected = CONDUCT_RULES.find((item) => ruleKey(item) === event.target.value);
      if (selected) selectRule(selected);
      else onChange({ ...value, code: "" });
    }}>
      <option value="">請選擇 Code 及事項</option>
      {groups.map((group) => <optgroup key={`${group.category}:${group.subCategory}`} label={`${group.category} · ${group.subCategory}`}>{group.rules.map((item) =>
        <option key={ruleKey(item)} value={ruleKey(item)}>{item.code} · {item.itemName}</option>
      )}</optgroup>)}
    </select></label>
    <label className="field"><span>直接輸入 Code</span><input type="text" value={value.code} required={required} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="例如：101 或 HW" aria-invalid={!!error} aria-describedby={error ? id + "-error" : id + "-help"} onChange={(event) => {
      const next = { ...value, code: normalizeRuleCode(event.target.value) };
      const matched = resolveRule(next).rule;
      if (matched) selectRule(matched);
      else onChange(next);
    }}/></label>
    {error && <p id={id + "-error"} className="rule-error" role="alert">{error}</p>}
    <div aria-live="polite">{rule && <RuleDetails rule={rule}/>}</div>
  </fieldset>;
}
