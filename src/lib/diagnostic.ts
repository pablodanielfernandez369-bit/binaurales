export interface SleepPlan {
  frequency_hz: number;
  duration_min: number;
  sessions_per_week: number | 'daily';
  description: string;
  wave_type: string;
}

export interface QuestionnaireResponses {
  sleep_hours: number;
  sleep_latency: string;
  wake_ups: string;
  sleep_quality: string;
  stress_level: number;
  racing_thoughts: string;
  bedtime: string;
  screen_time: string;
}

export function generateDiagnostic(responses: QuestionnaireResponses): { analysis: string; plan: SleepPlan } {
  const { stress_level, racing_thoughts, sleep_latency, wake_ups, sleep_hours } = responses;

  let frequency_hz = 6.0;
  let duration_min = 30;
  let sessions_per_week: number | 'daily' = 'daily';
  let wave_type = 'Theta';
  let analysis = '';

  // Logic based on requirements
  if (stress_level >= 7 || racing_thoughts === 'siempre' || racing_thoughts === 'frecuentemente') {
    frequency_hz = 4.5; // Theta profunda
    duration_min = 45;
    wave_type = 'Theta Profunda';
    analysis = 'Tu nivel de estrés y actividad mental nocturna es elevado. El neurólogo observa una dificultad para desconectar el sistema nervioso simpático antes de dormir.';
  } else if (sleep_latency === '30-60 min' || sleep_latency === 'más de 1 hora' || sleep_hours < 5) {
    frequency_hz = 7.0; // Theta estándar
    duration_min = 30;
    wave_type = 'Theta';
    analysis = 'Presentas una latencia de sueño prolongada. Tu cerebro necesita un estímulo que facilite la transición del estado de vigilia al sueño ligero.';
  } else if (wake_ups === '3 o más veces' || wake_ups === '1-2 veces') {
    frequency_hz = 3.5; // Delta + Theta
    duration_min = 40;
    wave_type = 'Theta + Delta';
    analysis = 'La fragmentación del sueño indica que no estás alcanzando o manteniendo las fases de sueño profundo necesarias para la restauración física.';
  } else {
    frequency_hz = 7.5; // Theta suave
    duration_min = 20;
    sessions_per_week = 4;
    wave_type = 'Theta Suave';
    analysis = 'Tu calidad de sueño es aceptable, pero hay margen para optimizar el descanso profundo y reducir la fatiga residual.';
  }

  const plan: SleepPlan = {
    frequency_hz,
    duration_min,
    sessions_per_week,
    wave_type,
    description: `Escuchar durante ${duration_min} minutos en un entorno oscuro y tranquilo usando auriculares.`
  };

  return { analysis, plan };
}
