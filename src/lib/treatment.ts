/**
 * treatment.ts v2.0
 * Sistema único de ajuste clínico — sin lógica duplicada.
 * Soporta planes nocturnos y diurnos por separado.
 */

export interface TreatmentPlan {
  duration_min: number;
  master_gain: number;
  frequency_hz: number;
  theta_gain: number;
  fade_in_ms: number;
  fade_out_ms: number;
  wave_category?: string;
  wave_type?: string;
  ideal_time?: string;
  description?: string;
  beat_hz?: number;
}

export const HARD_LIMITS = {
  duration_min: { min: 10, max: 45 },
  master_gain:  { min: 0.25, max: 0.60 },
  frequency_hz: { min: 1, max: 15 },
  theta_gain:   { min: 0.05, max: 0.25 },
  fade_in_ms:   { min: 50, max: 300 },
  fade_out_ms:  { min: 50, max: 400 },
};

export const BASELINE_PLAN: TreatmentPlan = {
  duration_min: 20,
  master_gain: 0.45,
  frequency_hz: 4.5,
  theta_gain: 0.12,
  fade_in_ms: 150,
  fade_out_ms: 200,
  wave_category: 'theta',
  wave_type: 'Theta Profunda',
};

export function normalizePlan(raw: any): TreatmentPlan {
  return {
    ...raw,
    frequency_hz: raw.frequency_hz ?? raw.beat_hz ?? BASELINE_PLAN.frequency_hz,
  };
}

export function calculateNightScore(answers: Record<string, string>): number {
  let score = 0;
  const compMap: Record<string, number> = { much_better: 3, better: 1, same: 0, worse: -2 };
  score += compMap[answers.q3] ?? 0;
  const wakeMap: Record<string, number> = { '0': 2, '1': 1, '2-3': 0, '4+': -2 };
  score += wakeMap[answers.q2] ?? 0;
  const qualMap: Record<string, number> = { '5': 2, '4': 1, '3': 0, '2': -1, '1': -2 };
  score += qualMap[answers.q_quality_score] ?? 0;
  const hoursMap: Record<string, number> = { more_8: 1, '7_8': 1, '6_7': 0, '5_6': -1, less_5: -2 };
  score += hoursMap[answers.q_total_hours] ?? 0;
  if (answers.q1b === 'yes') score += 1;
  return score;
}

export function calculateDayScore(answers: Record<string, string>): number {
  let score = 0;
  const effectMap: Record<string, number> = { much_better: 3, better: 1, same: 0, worse: -2 };
  score += effectMap[answers.q3] ?? 0;
  const disconnectMap: Record<string, number> = { yes: 2, partial: 0, no: -1 };
  score += disconnectMap[answers.qd2] ?? 0;
  const anxMap: Record<string, number> = { low: 1, moderate: 0, high: -1 };
  score += anxMap[answers.qd3] ?? 0;
  const energyMap: Record<string, number> = { '5': 1, '4': 1, '3': 0, '2': -1, '1': -1 };
  score += energyMap[answers.qd_energy] ?? 0;
  const focusMap: Record<string, number> = { yes: 1, partial: 0, no: -1 };
  score += focusMap[answers.qd_focus] ?? 0;
  return score;
}

export type AdjustmentResult =
  | { action: 'maintain'; reason: string }
  | { action: 'adjust'; reason: string; changedField: string; suggestedPlan: TreatmentPlan };

export function evaluateAdjustment(
  currentPlan: TreatmentPlan,
  score: number,
  mode: 'night' | 'day'
): AdjustmentResult {
  const plan = normalizePlan(currentPlan);
  const upThreshold   = mode === 'night' ? 4 : 3;
  const downThreshold = mode === 'night' ? -3 : -2;

  if (score >= upThreshold) {
    if (plan.duration_min < HARD_LIMITS.duration_min.max) {
      const newDuration = Math.min(HARD_LIMITS.duration_min.max, plan.duration_min + 5);
      if (newDuration === plan.duration_min)
        return { action: 'maintain', reason: 'Ya estás en la duración máxima recomendada.' };
      return {
        action: 'adjust',
        reason: mode === 'night'
          ? 'Tu sueño mejoró consistentemente. Aumentamos la duración gradualmente.'
          : 'La sesión diurna está funcionando. Aumentamos el tiempo de exposición.',
        changedField: 'duration_min',
        suggestedPlan: { ...plan, duration_min: newDuration },
      };
    }
    if (plan.master_gain < HARD_LIMITS.master_gain.max) {
      const newGain = Number(Math.min(HARD_LIMITS.master_gain.max, plan.master_gain + 0.05).toFixed(2));
      if (newGain === plan.master_gain)
        return { action: 'maintain', reason: 'El protocolo está optimizado. Mantené la constancia.' };
      return {
        action: 'adjust',
        reason: 'Excelente respuesta. Ajuste fino de intensidad.',
        changedField: 'master_gain',
        suggestedPlan: { ...plan, master_gain: newGain },
      };
    }
    return { action: 'maintain', reason: 'Tu protocolo está en su punto óptimo. ¡Seguí así!' };
  }

  if (score <= downThreshold) {
    if (score <= -4 && plan.theta_gain > HARD_LIMITS.theta_gain.min) {
      const newTheta = Number(Math.max(HARD_LIMITS.theta_gain.min, plan.theta_gain - 0.02).toFixed(2));
      if (newTheta === plan.theta_gain)
        return { action: 'maintain', reason: 'Seguimos observando tu respuesta.' };
      return {
        action: 'adjust',
        reason: 'Respuesta intensa detectada. Reducimos la carga sensorial.',
        changedField: 'theta_gain',
        suggestedPlan: { ...plan, theta_gain: newTheta },
      };
    }
    if (plan.duration_min > HARD_LIMITS.duration_min.min) {
      const newDuration = Math.max(HARD_LIMITS.duration_min.min, plan.duration_min - 5);
      if (newDuration === plan.duration_min)
        return { action: 'maintain', reason: 'Ya estás en la duración mínima recomendada.' };
      return {
        action: 'adjust',
        reason: mode === 'night'
          ? 'Noche difícil. Reducimos el tiempo para darle espacio al cuerpo.'
          : 'La sesión fue muy larga para este momento. Reducimos para mayor efectividad.',
        changedField: 'duration_min',
        suggestedPlan: { ...plan, duration_min: newDuration },
      };
    }
    return { action: 'maintain', reason: 'Protocolo en mínimos. Consultá si los síntomas persisten.' };
  }

  return {
    action: 'maintain',
    reason: mode === 'night'
      ? 'Tu progreso es estable. Seguimos con el mismo protocolo.'
      : 'Sesión dentro de parámetros normales. Sin cambios necesarios.',
  };
}
