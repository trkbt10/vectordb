/**
 * @file FlowWizard logic helpers and types for testability
 */
import type { WizardSchema } from "./SchemaWizard";

export type FlowAnswers = Record<string, unknown>;

export type FlowCondition =
  | { op: "equals"; field: string; value: string | number | boolean }
  | { op: "in"; field: string; values: (string | number | boolean)[] }
  | { op: "not"; cond: FlowCondition };

export type FlowTransition = { when: FlowCondition; next: string };

export type UiStepLike = {
  transitions?: FlowTransition[];
  defaultNext?: string;
};

/**
 * Evaluate a transition condition against the current answers.
 *
 * Supports equality, membership, and negation composition.
 *
 * @param cond - The condition to evaluate.
 * @param answers - The collected answers map.
 * @returns True if the condition holds.
 */
export function evalCond(cond: FlowCondition, answers: FlowAnswers): boolean {
  if (cond.op === "equals") {
    return answers[cond.field] === cond.value;
  }
  if (cond.op === "in") {
    return cond.values.includes(answers[cond.field] as never);
  }
  if (cond.op === "not") {
    return !evalCond(cond.cond, answers);
  }
  return false;
}

/**
 * Determine the next step for a UI step by testing transitions in order.
 * Falls back to `defaultNext` when no transition matches.
 *
 * @param step - A UI-like step with transitions.
 * @param answers - The collected answers map.
 * @returns The next step id, or undefined when not resolvable.
 */
export function nextForUi(step: UiStepLike, answers: FlowAnswers): string | undefined {
  for (const t of step.transitions ?? []) {
    if (evalCond(t.when, answers)) {
      return t.next;
    }
  }

  return step.defaultNext;
}

export type { WizardSchema };
