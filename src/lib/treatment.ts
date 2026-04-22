/**
 * Management logic for automatic conservative treatment adjustments.
 */

export interface TreatmentPlan {
  duration_min: number;
  master_gain: number;
  theta_beat_hz: number;
  theta_gain: number;
  fade_in_ms: number;
  fade_out_ms: number;
}

export const HARD_LIMITS = {
  duration_min: { min: 10, max: 30 },
  master_gain: { min: 0.25, max: 0.60 },
  theta_beat_hz: { min: 2, max: 7 },
  theta_gain: { min: 0.05, max: 0.25 },
  fade_in_ms: { min: 50, max: 300 },
  fade_out_ms: { min: 50, max: 400 },
};

export const BASELINE_PLAN: TreatmentPlan = {
  duration_min: 20,
  master_gain: 0.45,
  theta_beat_hz: 4,
  theta_gain: 0.12,
  fade_in_ms: 150,
  fade_out_ms: 200,
};

export interface CheckinAnswers {
  q1d?: string; // Latency
  q2: string;   // Awakenings
  q3: string;   // Comparison
}

/**
 * Calculates a score based on check-in answers.
 */
export function calculateSleepScore(answers: CheckinAnswers): number {
  let score = 0;

  // 1. Comparison (q3)
  const comparisonMap: Record<string, number> = {
    'much_better': 2,
    'better': 1,
    'same': 0,
    'worse': -2
  };
  score += comparisonMap[answers.q3] || 0;

  // 2. Awakenings (q2)
  const awakeningsMap: Record<string, number> = {
    '0': 2,
    '1': 1,
    '2-3': 0,
    '4+': -2
  };
  score += awakeningsMap[answers.q2] || 0;

  // 3. Latency (q1d)
  if (answers.q1d) {
    const latencyMap: Record<string, number> = {
      '<15': 1,
      '15-30': 0,
      '30-60': -1,
      '>60': -2
    };
    score += latencyMap[answers.q1d] || 0;
  }

  return score;
}

/**
 * Generates a suggestion based on the score and current plan.
 * Follows the "one variable change" rule.
 */
export function generateTreatmentSuggestion(
  currentPlan: TreatmentPlan,
  score: number
): { suggestedPlan: TreatmentPlan; reason: string; changedField: string } | null {
  
  const suggestedPlan = { ...currentPlan };
  let reason = '';
  let changedField = '';

  if (score >= 2) {
    // Improve: Duration +5 or Master Gain +5%
    // We alternate based on which one is further from the limit, or just pick one.
    if (currentPlan.duration_min < HARD_LIMITS.duration_min.max) {
      suggestedPlan.duration_min = Math.min(HARD_LIMITS.duration_min.max, currentPlan.duration_min + 5);
      reason = 'Mejoría detectada: aumento gradual de duración.';
      changedField = 'duration_min';
    } else if (currentPlan.master_gain < HARD_LIMITS.master_gain.max) {
      suggestedPlan.master_gain = Number((Math.min(HARD_LIMITS.master_gain.max, currentPlan.master_gain + 0.05)).toFixed(2));
      reason = 'Mejoría detectada: aumento leve de intensidad.';
      changedField = 'master_gain';
    } else {
      return null; // Already at limits
    }
  } else if (score <= -1) {
    // Reduce load: Duration -5 or Theta Gain -10% + Ramp up
    if (score <= -3 && currentPlan.theta_gain > HARD_LIMITS.theta_gain.min) {
      // Very bad night: reduce sensory load
      suggestedPlan.theta_gain = Number((Math.max(HARD_LIMITS.theta_gain.min, currentPlan.theta_gain - 0.02)).toFixed(2));
      reason = 'Noche difícil: reducción de carga sensorial.';
      changedField = 'theta_gain';
    } else if (currentPlan.duration_min > HARD_LIMITS.duration_min.min) {
      suggestedPlan.duration_min = Math.max(HARD_LIMITS.duration_min.min, currentPlan.duration_min - 5);
      reason = 'Noche inquieta: reducción de tiempo de exposición.';
      changedField = 'duration_min';
    } else {
      return null; // Already at floor
    }
  } else {
    // Score between 0 and 1 -> Maintain
    return null;
  }

  // Ensure deep equality check to avoid redundant suggestions
  if (JSON.stringify(suggestedPlan) === JSON.stringify(currentPlan)) return null;

  return { suggestedPlan, reason, changedField };
}
