/**
 * Deterministic safety signal layer — runs BEFORE the LLM call and its
 * verdict overrides whatever the LLM later returns. Deliberately not named
 * a "triage" system: it flags phrases worth a doctor's attention, it does
 * not diagnose or independently determine medical urgency.
 *
 * Includes a lightweight negation guard so "my chest pain is gone" doesn't
 * fire the same as an active complaint — still just phrase matching, not
 * real NLP, but enough to avoid an obviously wrong flag.
 */

const RED_FLAGS = [
  "chest pain",
  "crushing pain",
  "difficulty breathing",
  "shortness of breath",
  "can't breathe",
  "cannot breathe",
  "suicidal",
  "self harm",
  "severe bleeding",
  "coughing blood",
  "blood in vomit",
  "stroke",
  "slurred speech",
  "facial drooping",
  "loss of consciousness",
  "unconscious",
  "seizure",
  "anaphylaxis",
  "severe allergic reaction",
];

const NEGATION_CUES = [
  "no ",
  "not ",
  "denies",
  "denied",
  "resolved",
  "gone",
  "none",
  "without",
  "no longer",
  "had ",
  "used to have",
  "history of",
];

const LOOKBACK_CHARS = 30;

export interface SafetySignalResult {
  flagged: boolean;
  reason: string | null;
}

export function detectSafetySignal(rawSymptoms: string): SafetySignalResult {
  const text = rawSymptoms.toLowerCase();

  for (const flag of RED_FLAGS) {
    const idx = text.indexOf(flag);
    if (idx === -1) continue;

    const windowStart = Math.max(0, idx - LOOKBACK_CHARS);
    const window = text.slice(windowStart, idx);
    const negated = NEGATION_CUES.some((cue) => window.includes(cue));

    if (!negated) {
      return {
        flagged: true,
        reason: `Symptom description contains a safety-relevant phrase ("${flag}") — flagged for doctor review regardless of AI assessment.`,
      };
    }
  }

  return { flagged: false, reason: null };
}
