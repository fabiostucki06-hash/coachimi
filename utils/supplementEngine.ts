export interface SupplementRecommendation {
  id: string;
  title: string;
  dose: string;
  reason: string;
}

export interface SupplementEngineInput {
  /** Today's logged protein / daily protein goal (0-1+); undefined if nothing logged yet today. */
  proteinIntakeRatio: number | null;
  /** Distinct training days logged in the last 7 days. */
  trainingDaysLast7: number;
}

/** Simple rule-based supplement suggestions from logged macros + training frequency - not medical advice, just common, well-evidenced starting points. */
export function generateSupplementRecommendations(input: SupplementEngineInput): SupplementRecommendation[] {
  const recommendations: SupplementRecommendation[] = [];

  if (input.proteinIntakeRatio !== null && input.proteinIntakeRatio < 0.8) {
    recommendations.push({
      id: 'protein',
      title: 'Whey/Casein Protein',
      dose: '1-2 Shakes/Tag',
      reason: `Proteinziel heute nur zu ${Math.round(input.proteinIntakeRatio * 100)}% erreicht - ein Shake hilft, die Lücke einfach zu schließen.`,
    });
  }

  if (input.trainingDaysLast7 >= 3) {
    recommendations.push({
      id: 'creatine',
      title: 'Creatin Monohydrat',
      dose: '5g/Tag',
      reason: `${input.trainingDaysLast7}x Training in den letzten 7 Tagen - eines der am besten belegten Supplements für Kraft & Muskelaufbau.`,
    });
  }

  recommendations.push({
    id: 'general',
    title: 'Vitamin D3/K2 & Omega-3',
    dose: 'D3/K2 täglich, Omega-3 1-2g/Tag',
    reason: 'Grundabsicherung - besonders bei wenig Sonnenlicht bzw. seltenem Fischkonsum sinnvoll.',
  });

  return recommendations;
}
