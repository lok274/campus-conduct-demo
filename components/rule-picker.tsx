"use client";

import { CONDUCT_RULES, getRuleGroups, getScoreOptions, normalizeRuleCode, resolveRule, resolveRuleSelection, ruleKey, scoreActionLabel, scoreLabel, selectRuleInput, type ConductRule, type RuleInput } from "../lib/conduct-rules";
import { SCHOOL_CATEGORIES, type SchoolCategory } from "../lib/school-rules";

export type RulePickerErrors = { code?: string; score?: string };

export function RuleDetails({ rule, scoreChange, showSelectedScore = true }: { rule: ConductRule; scoreChange?: number; showSelectedScore?: boolean }) {
  return <div className="rule-details">
    <strong>{rule.itemName}</strong>
    <dl>
      <div><dt>Code</dt><dd>{rule.code}</dd></div>
      <div><dt>校本範疇</dt><dd>{rule.category}</dd></div>
      <div><dt>分類</dt><dd>{rule.subCategory}</dd></div>
      {showSelectedScore && <div className="rule-selected-score"><dt>本次加減分數</dt><dd>{scoreActionLabel(scoreChange ?? rule.score)}（{scoreLabel(scoreChange ?? rule.score)}）</dd></div>}
    </dl>
    <p>本次加減分數會隨紀錄保留，尚未計入學生總分。</p>
  </div>;
}

export function RulePicker({ value, onChange, id, required = true, errors = {} }: {
  value: RuleInput;
  onChange: (value: RuleInput) => void;
  id: string;
  required?: boolean;
  errors?: RulePickerErrors;
}) {
  const resolvedCode = resolveRule(value);
  const selection = resolveRuleSelection(value);
  const { rule, scoreChange } = selection;
  const codeError = errors.code || resolvedCode.error;
  const scoreError = errors.score || (resolvedCode.rule ? selection.error : "");
  const subCategory = value.schoolCategory ? value.subCategory ?? rule?.subCategory ?? "" : "";
  const subCategories = value.schoolCategory ? getRuleGroups(value.schoolCategory) : [];
  const groups = getRuleGroups(value.schoolCategory, subCategory);
  const selectRule = (selected: ConductRule) => onChange(selectRuleInput(selected, value));
  return <fieldset className="rule-picker">
    <legend>校本事項 Code{required ? " *" : "（選填）"}</legend>
    <p id={id + "-help"}>可先選範疇及分類，再選 Code；也可直接輸入 Code，自動帶出分類。</p>
    <label className="field"><span>校本範疇</span><select value={value.schoolCategory} onChange={(event) => {
      const schoolCategory = event.target.value as SchoolCategory | "";
      const code = rule && schoolCategory && rule.category !== schoolCategory ? "" : value.code;
      const next = { code, schoolCategory };
      const matched = resolveRule(next).rule;
      onChange({ ...next, subCategory: schoolCategory ? matched?.subCategory ?? "" : "", scoreChange: matched ? selectRuleInput(matched, value).scoreChange : undefined });
    }}>
      <option value="">全部範疇</option>{SCHOOL_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
    </select></label>
    <label className="field"><span>{value.schoolCategory ? `${value.schoolCategory}分類` : "分類"}</span><select value={subCategory} disabled={!value.schoolCategory} onChange={(event) => {
      const selected = event.target.value;
      const keepCode = !selected || rule?.subCategory === selected;
      onChange({ ...value, subCategory: selected, code: keepCode ? value.code : "", scoreChange: keepCode ? value.scoreChange : undefined });
    }}>
      <option value="">{value.schoolCategory ? "全部分類" : "請先選擇校本範疇"}</option>
      {subCategories.map((group) => <option key={group.subCategory} value={group.subCategory}>{group.subCategory}（{group.rules.length} 項）</option>)}
    </select></label>
    <label className="field"><span>Code 下拉選單</span><select value={rule ? ruleKey(rule) : ""} aria-describedby={id + "-help"} onChange={(event) => {
      const selected = CONDUCT_RULES.find((item) => ruleKey(item) === event.target.value);
      if (selected) selectRule(selected);
      else onChange({ ...value, code: "", scoreChange: undefined });
    }}>
      <option value="">請選擇 Code 及事項</option>
      {groups.map((group) => <optgroup key={`${group.category}:${group.subCategory}`} label={`${group.category} · ${group.subCategory}`}>{group.rules.map((item) =>
        <option key={ruleKey(item)} value={ruleKey(item)}>{item.code} · {item.itemName}</option>
      )}</optgroup>)}
    </select></label>
    <label className="field"><span>直接輸入 Code</span><input id={id + "-code"} type="text" value={value.code} required={required} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="例如：101 或 HW" aria-invalid={!!codeError} aria-describedby={codeError ? id + "-code-error" : id + "-help"} onChange={(event) => {
      const next = { ...value, code: normalizeRuleCode(event.target.value), scoreChange: undefined };
      const matched = resolveRule(next).rule;
      if (matched) selectRule(matched);
      else onChange(next);
    }}/></label>
    {codeError && <p id={id + "-code-error"} className="field-error" role="alert">{codeError}</p>}
    {rule && <div className="rule-score-picker">
      <label className="field"><span>本次加減分數 *</span><select id={id + "-score"} value={scoreChange} disabled={rule.minScore === rule.maxScore} aria-invalid={!!scoreError} aria-describedby={scoreError ? `${id}-score-error ${id}-score-help` : `${id}-score-help`} onChange={(event) => onChange({ ...value, scoreChange: Number(event.target.value) })}>
        {getScoreOptions(rule).map((score) => <option key={score} value={score}>{scoreActionLabel(score)}{score === rule.score ? "（預設）" : ""}</option>)}
      </select></label>
      {scoreError && <p id={`${id}-score-error`} className="field-error" role="alert">{scoreError}</p>}
      <p id={`${id}-score-help`}>{rule.minScore === rule.maxScore ? "此項目為固定分數，不能調整。" : `可選 ${scoreLabel(rule.minScore)} 至 ${scoreLabel(rule.maxScore)} 分，預設為 ${scoreLabel(rule.score)} 分。切換 Code 會使用新項目的預設分數。`}</p>
    </div>}
    <div aria-live="polite">{rule && <RuleDetails rule={rule} scoreChange={scoreChange}/>}</div>
  </fieldset>;
}
