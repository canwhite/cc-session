import type { TodoItem, UsageSummary } from "./types";

/** Subset of Session state that is transferred on continuation. */
export interface SessionContext {
  summary?: string;
  todos: TodoItem[];
  tools: string[];
  usageData: UsageSummary;
}

/**
 * Transfer session context from one session to another.
 *
 * - `summary`, `usageData`: copied by reference (immutable string/number)
 * - `todos`, `tools`: **deep-copied** via spread to avoid shared array references
 *
 * The source session is typically the one approaching maxTurns and being abandoned.
 * The target session is the newly created one that will continue the conversation.
 */
export function transferSessionContext(
  source: SessionContext,
  target: SessionContext
): void {
  if (source.summary) {
    target.summary = source.summary;
  }
  if (source.todos.length > 0) {
    target.todos = [...source.todos];
  }
  if (source.tools.length > 0) {
    target.tools = [...source.tools];
  }
  target.usageData = { ...source.usageData };
}
