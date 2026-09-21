import data from "./conduct-rules.json";
import { SCHOOL_CATEGORIES, type SchoolCategory } from "./school-rules";

export type ConductRule = {
  code: string;
  category: SchoolCategory;
  subCategory: string;
  itemName: string;
  score: number;
  minScore: number;
  maxScore: number;
};
export type RuleInput = { code: string; schoolCategory: SchoolCategory | ""; subCategory?: string; scoreChange?: number };

// Source: 訓育database.xlsx, Rules!A2:G191. Code is unique only within Category.
export const CONDUCT_RULES: readonly ConductRule[] = data as ConductRule[];
export const normalizeRuleCode = (code: string) => code.normalize("NFKC").trim().toUpperCase();
export const ruleKey = (rule: ConductRule) => `${rule.category}:${rule.code}`;
export const scoreLabel = (score: number) => score > 0 ? `+${score}` : String(score);
export const scoreActionLabel = (score: number) => score > 0 ? `加 ${score} 分` : score < 0 ? `減 ${Math.abs(score)} 分` : "不加不減（0 分）";

export function getScoreOptions(rule: ConductRule): number[] {
  // Use the precision present in the source rule, including fixed half-point scores.
  const precision = Math.max(...[rule.minScore, rule.maxScore, rule.score].map((score) => String(score).split(".")[1]?.length ?? 0));
  const scale = 10 ** precision;
  const min = Math.round(rule.minScore * scale);
  const max = Math.round(rule.maxScore * scale);
  const options = Array.from({ length: max - min + 1 }, (_, index) => (min + index) / scale);
  // Show deductions from the smallest to the largest amount deducted.
  return rule.maxScore <= 0 ? options.reverse() : options;
}

export function selectRuleInput(rule: ConductRule, previous?: RuleInput): RuleInput {
  const previousRule = previous ? resolveRule(previous).rule : undefined;
  return {
    code: rule.code, schoolCategory: rule.category, subCategory: rule.subCategory,
    scoreChange: previousRule && ruleKey(previousRule) === ruleKey(rule) ? previous?.scoreChange ?? rule.score : rule.score,
  };
}

export function getRuleGroups(schoolCategory: SchoolCategory | "" = "", subCategory = "") {
  const categories = schoolCategory ? [schoolCategory] : SCHOOL_CATEGORIES;
  return categories.flatMap((category) => {
    const rules = CONDUCT_RULES.filter((rule) => rule.category === category);
    return [...new Set(rules.map((rule) => rule.subCategory))]
      .filter((name) => !subCategory || name === subCategory)
      .map((name) => ({ category, subCategory: name, rules: rules.filter((rule) => rule.subCategory === name) }));
  });
}

export function resolveRule({ code, schoolCategory }: RuleInput): { rule?: ConductRule; error: string } {
  const normalized = normalizeRuleCode(code);
  if (!normalized) return { error: "" };
  const matches = CONDUCT_RULES.filter((rule) => rule.code === normalized && (!schoolCategory || rule.category === schoolCategory));
  if (matches.length > 1) return { error: `Code ${normalized} 同時用於${matches.map((rule) => rule.category).join("、")}，請選擇校本範疇或完整事項。` };
  if (!matches.length) return { error: `找不到${schoolCategory ? "「" + schoolCategory + "」的" : ""} Code ${normalized}，請核對或從下拉選單選擇。` };
  return { rule: matches[0], error: "" };
}

export function resolveRuleSelection(value: RuleInput): { rule?: ConductRule; scoreChange?: number; error: string } {
  const result = resolveRule(value);
  if (!result.rule || result.error) return result;
  const scoreChange = value.scoreChange ?? result.rule.score;
  if (!Number.isFinite(scoreChange) || !getScoreOptions(result.rule).includes(scoreChange)) {
    return { ...result, scoreChange, error: `請從允許範圍 ${scoreLabel(result.rule.minScore)} 至 ${scoreLabel(result.rule.maxScore)} 分內選擇本次加減分數。` };
  }
  return { ...result, scoreChange };
}

export function ruleRecordFields(rule: ConductRule, scoreChange = rule.score): { kind: SchoolCategory; category: string; rule: ConductRule; scoreChange: number } {
  return { kind: rule.category, category: rule.itemName, rule, scoreChange };
}

export const ruleSearchText = (rule?: ConductRule) => rule ? [rule.code, rule.category, rule.subCategory, rule.itemName].join(" ") : "";
