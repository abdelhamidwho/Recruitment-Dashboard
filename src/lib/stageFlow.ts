import { STAGES, type Stage } from "@/lib/auth/constants";

/**
 * The forward-progression sequence a candidate normally moves through.
 * "Rejected" is deliberately excluded — it can happen from any stage, it
 * isn't something a candidate "advances" into, so it has no place after any
 * particular stage in a one-click "next" action.
 */
export const FORWARD_STAGES: readonly Stage[] = STAGES.filter((s) => s !== "Rejected");

/**
 * The next stage in the forward sequence after `current`, or null when
 * there is nowhere further to advance to (already "Hired", or "Rejected" —
 * both terminal). Pure so the "Advance" button's enabled/label state is
 * unit-testable without rendering anything.
 */
export function nextStage(current: Stage): Stage | null {
  const idx = FORWARD_STAGES.indexOf(current);
  if (idx === -1) return null; // e.g. "Rejected" — terminal, no forward move
  if (idx === FORWARD_STAGES.length - 1) return null; // already "Hired"
  return FORWARD_STAGES[idx + 1];
}

/** Whether a stage is one of the two terminal states. */
export function isTerminalStage(stage: Stage): boolean {
  return stage === "Hired" || stage === "Rejected";
}
