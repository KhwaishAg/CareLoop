/**
 * Renders a doctor's name with a "Dr." prefix, stripping any "Dr."/"Dr"
 * already present in the stored name first — so a doctor record created
 * with "Dr. Anjali Sharma" as the name never renders as "Dr. Dr. Anjali
 * Sharma" just because a display spot also prepends the title.
 */
export function doctorLabel(name: string): string {
  const stripped = name.replace(/^dr\.?\s+/i, "").trim();
  return `Dr. ${stripped}`;
}
