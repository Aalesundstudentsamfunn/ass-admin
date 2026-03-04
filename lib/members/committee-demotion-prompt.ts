"use client";

import { PRIVILEGE_LEVELS } from "@/lib/privilege-config";

/**
 * True when a privilege change crosses from voluntary-or-higher to below voluntary.
 */
export function isDemotionBelowVoluntary(
  currentPrivilege: number | null | undefined,
  nextPrivilege: number,
) {
  const current = Number.isFinite(currentPrivilege) ? Number(currentPrivilege) : 0;
  return current >= PRIVILEGE_LEVELS.VOLUNTARY && nextPrivilege < PRIVILEGE_LEVELS.VOLUNTARY;
}

export type CommitteeDemotionDecision = true | null;

export type CommitteeDemotionPromptRequest = {
  targetLabel: string;
  resolve: (decision: CommitteeDemotionDecision) => void;
};

type CommitteeDemotionPromptHandler = (
  request: CommitteeDemotionPromptRequest,
) => void;

let promptHandler: CommitteeDemotionPromptHandler | null = null;

/**
 * Registers global handler used to render the custom demotion prompt dialog.
 */
export function registerCommitteeDemotionPromptHandler(
  handler: CommitteeDemotionPromptHandler,
) {
  promptHandler = handler;
  return () => {
    if (promptHandler === handler) {
      promptHandler = null;
    }
  };
}

/**
 * Prompts user to choose how committee should be handled on demotion.
 *
 * Returns:
 * - `true` => clear committee
 * - `null` => cancel operation
 */
export function askCommitteeDemotionDecision(
  targetLabel: string,
): Promise<CommitteeDemotionDecision> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  if (!promptHandler) {
    // Fallback only if provider is not mounted.
    const clearCommittee = window.confirm(
      `Denne endringen senker tilgangsnivået under Frivillig for ${targetLabel}.\n\n` +
        "Trykk OK for å fjerne komité.\n" +
        "Trykk Avbryt for å avbryte hele endringen.",
    );
    return Promise.resolve(clearCommittee ? true : null);
  }

  return new Promise((resolve) => {
    promptHandler?.({ targetLabel, resolve });
  });
}
