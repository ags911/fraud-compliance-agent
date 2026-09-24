/** Radar's pill class for each final recommendation (PASS green, HOLD red, CHALLENGE amber). */
export function recommendationPillClass(recommendation: "PASS" | "CHALLENGE" | "HOLD"): string {
  if (recommendation === "PASS") return "risk-low"
  if (recommendation === "HOLD") return "risk-high"
  return "risk-flagged"
}
