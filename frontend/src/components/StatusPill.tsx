type Tone = "neutral" | "positive" | "warning" | "critical" | "info";

// "positive" (confirmed/ready/completed) uses the success token, not the
// brand accent — semantic status color stays separate from brand color so
// the accent doesn't get overloaded with two different meanings.
const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-bg-raised text-ink-soft border-line",
  positive: "bg-success-soft text-success border-transparent",
  warning: "bg-amber-soft text-amber border-transparent",
  critical: "bg-critical-soft text-critical border-transparent",
  info: "bg-accent-soft text-accent border-transparent",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-soft",
  positive: "bg-success",
  warning: "bg-amber",
  critical: "bg-critical",
  info: "bg-accent",
};

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs uppercase tracking-wide ${TONE_STYLES[tone]}`}
    >
      <span className={`status-dot ${TONE_DOT[tone]}`} />
      {label}
    </span>
  );
}
