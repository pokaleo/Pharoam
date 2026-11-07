/**
 * Telling the person why an AI call didn't work, the same way on every screen.
 *
 * @packageDocumentation
 */
import type { ProviderError, TaskError } from "@pharoam/core";
import type { TFunction } from "i18next";

/**
 * Why a provider couldn't answer, in plain words (MVP S13.3, S15.6).
 *
 * @param t - The translation function.
 * @param error - What the provider reported.
 * @param provider - The provider's name, as the person knows it.
 * @returns A sentence for the person.
 */
export function providerProblem(t: TFunction, error: ProviderError, provider: string): string {
  switch (error.kind) {
    case "unauthorised":
      return t("settings.errors.unauthorised", { provider });
    case "rate-limited":
      return t("settings.errors.rateLimited", { provider });
    case "unreachable":
      return t("settings.errors.unreachable", { provider });
    case "refused":
      return t("settings.errors.refused", { provider, reason: error.reason });
    case "failed":
      return t("settings.errors.failed", { provider, message: error.message });
  }
}

/**
 * Why a task gave no usable answer, in plain words: the provider's problem, or an answer of the wrong shape.
 *
 * @param t - The translation function.
 * @param error - Why the task gave no answer.
 * @param provider - The provider's name, as the person knows it.
 * @returns A sentence for the person.
 */
export function taskProblem(t: TFunction, error: TaskError, provider: string): string {
  return error.kind === "provider"
    ? providerProblem(t, error.error, provider)
    : t("settings.errors.invalidAnswer");
}

const REASONS = [
  "unauthorised",
  "rate-limited",
  "unreachable",
  "refused",
  "failed",
  "invalid-answer",
] as const;

/**
 * Why a scan set a record or skill aside, in plain words (MVP S16.5).
 *
 * @param t - The translation function.
 * @param kind - The kind the session records, such as `unreachable`.
 * @returns A phrase for the person; a general one for a kind this version doesn't know.
 */
export function setAsideReason(t: TFunction, kind: string): string {
  const known = REASONS.find((one) => one === kind);
  return known === undefined ? t("scan.reasons.other") : t(`scan.reasons.${known}`);
}
