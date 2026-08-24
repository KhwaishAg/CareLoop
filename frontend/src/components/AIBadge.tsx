/** Subtle, trustworthy AI marker — never a giant "AI" badge or glow.
 *  Every AI-generated clinical output pairs this with a "doctor review
 *  required" note nearby, per the design direction: assist, never diagnose. */
export function AIBadge({ text = "AI ASSISTED" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[0.68rem] uppercase tracking-wider text-accent">
      <span aria-hidden>✦</span>
      {text}
    </span>
  );
}
