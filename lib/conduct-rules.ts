import data from "./conduct-rules.json";
import type { SchoolCategory } from "./school-rules";

export type ConductRule = {
  code: string;
  category: SchoolCategory;
  subCategory: string;
  itemName: string;
  score: number;
  minScore: number;
  maxScore: number;
};
export type RuleInput = { code: string; schoolCategory: SchoolCategory | "" };

// Source: 訓育database.xlsx, Rules!A2:G191. Code is unique only within Category.
export const CONDUCT_RULES: readonly ConductRule[] = data as ConductRule[];
export const normalizeRuleCode = (code: string) => code.normalize("NFKC").trim().toUpperCase();
export const ruleKey = (rule: ConductRule) => `${rule.category}:${rule.code}`;
export const scoreLabel = (score: number) => score > 0 ? `+${score}` : String(score);

export function resolveRule({ code, schoolCategory }: RuleInput): { rule?: ConductRule; error: string } {
  const normalized = normalizeRuleCode(code);
  if (!normalized) return { error: "" };
  const matches = CONDUCT_RULES.filter((rule) => rule.code === normalized && (!schoolCategory || rule.category === schoolCategory));
  if (matches.length > 1) return { error: `Code ${normalized} 同時用於${matches.map((rule) => rule.category).join("、")}，請選擇校本範疇或完整事項。` };
  if (!matches.length) return { error: `找不到${schoolCategory ? "「" + schoolCategory + "」的" : ""} Code ${normalized}，請核對或從下拉選單選擇。` };
  return { rule: matches[0], error: "" };
}

export function ruleRecordFields(rule: ConductRule): { kind: SchoolCategory; category: string; rule: ConductRule } {
  return { kind: rule.category, category: rule.itemName, rule };
}

export const ruleSearchText = (rule?: ConductRule) => rule ? [rule.code, rule.category, rule.subCategory, rule.itemName].join(" ") : "";
