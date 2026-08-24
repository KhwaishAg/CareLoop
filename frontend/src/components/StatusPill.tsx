type Tone = "neutral" | "positive" | "warning" | "critical" | "info";

const TONE_STYLES: Record<Tone, string> = {
  neutral: "bg-bg-raised text-ink-soft border-line",
  positive: "bg-accent-soft text-accent border-transparent",
  warning: "bg-amber-soft text-amber border-transparent",
  critical: "bg-critical-soft text-critical border-transparent",
  info: "bg-bg-raised text-ink border-line",
};

const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ink-soft",
  positive: "bg-accent",
  warning: "bg-amber",
  critical: "bg-critical",
  info: "bg-ink-soft",
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
