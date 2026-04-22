export interface SleepPlan {
  frequency_hz: number;
  duration_min: number;
  sessions_per_week: number | 'daily';
  description: string;
  wave_type: string;
  wave_category: 'delta' | 'theta' | 'alpha_theta' | 'alpha' | 'smr';
  ideal_time: string;
}

export interface QuestionnaireResponses {
  sleep_hours: number;
  sleep_latency: string;
  wake_ups: string;
  sleep_quality: string;
  stress_level: number;
  racing_thoughts: string;
  anxiety_level: string;
  physical_tension: string;
  screen_time: string;
  main_goal: string;
}

export interface DayResponses {
  energy_level: string;
  focus_quality: string;
  day_anxiety: string;
  day_stress: number;
  mental_fatigue: string;
  body_tension: string;
  day_goal: string;
}

export function generateDiagnostic(responses: QuestionnaireResponses): { analysis: string; plan: SleepPlan } {
  const { stress_level, racing_thoughts, sleep_latency, wake_ups, sleep_quality, anxiety_level, physical_tension, main_goal } = responses;

  // Sistema de puntuación clínica
  let deltaScore = 0;    // Sueño no reparador, fragmentación severa
  let thetaScore = 0;    // Estrés alto, pensamientos acelerados
  let alphaScore = 0;    // Ansiedad leve, mente activa moderada
  let alphaThetaScore = 0; // Ansiedad crónica, transición vigilia→sueño
  let smrScore = 0;      // Tensión física, inquietud corporal

  // Pensamientos acelerados → Theta
  if (racing_thoughts === 'siempre') thetaScore += 3;
  else if (racing_thoughts === 'frecuentemente') thetaScore += 2;
  else if (racing_thoughts === 'a veces') { thetaScore += 1; alphaScore += 1; }

  // Estrés → Theta
  if (stress_level >= 8) thetaScore += 3;
  else if (stress_level >= 6) thetaScore += 2;
  else if (stress_level >= 4) { alphaScore += 1; alphaThetaScore += 1; }

  // Ansiedad pre-sueño → Alpha/Theta
  if (anxiety_level === 'intensa') { alphaThetaScore += 3; thetaScore += 1; }
  else if (anxiety_level === 'moderada') { alphaThetaScore += 2; alphaScore += 1; }
  else if (anxiety_level === 'leve') alphaScore += 2;

  // Tensión física → SMR
  if (physical_tension === 'frecuentemente') { smrScore += 3; alphaScore += 1; }
  else if (physical_tension === 'a veces') smrScore += 1;

  // Latencia larga → Alpha o Theta según contexto
  if (sleep_latency === 'más de 1 hora') { thetaScore += 2; alphaThetaScore += 1; }
  else if (sleep_latency === '30-60 min') { alphaScore += 2; alphaThetaScore += 1; }
  else if (sleep_latency === '15-30 min') alphaScore += 1;

  // Fragmentación del sueño → Delta
  if (wake_ups === '3 o más veces') deltaScore += 3;
  else if (wake_ups === '1-2 veces') deltaScore += 1;

  // Calidad al despertar → Delta
  if (sleep_quality === 'agotado aunque dormí') deltaScore += 3;
  else if (sleep_quality === 'muy cansado') deltaScore += 2;
  else if (sleep_quality === 'algo cansado') deltaScore += 1;

  // Objetivo principal como desempate
  if (main_goal === 'dormir más profundo') deltaScore += 2;
  else if (main_goal === 'apagar la mente') thetaScore += 2;
  else if (main_goal === 'reducir ansiedad') alphaThetaScore += 2;
  else if (main_goal === 'descansar el cuerpo') smrScore += 2;

  // Determinar onda ganadora
  const scores = { deltaScore, thetaScore, alphaScore, alphaThetaScore, smrScore };
  const winner = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0] as keyof typeof scores;

  let frequency_hz: number;
  let duration_min: number;
  let wave_type: string;
  let wave_category: SleepPlan['wave_category'];
  let analysis: string;
  let ideal_time: string;
  let sessions_per_week: number | 'daily' = 'daily';

  switch (winner) {
    case 'deltaScore':
      frequency_hz = 2.5;
      duration_min = 45;
      wave_type = 'Delta';
      wave_category = 'delta';
      ideal_time = 'En cama, justo antes de dormir';
      analysis = 'Tu cerebro no está alcanzando las fases de sueño profundo necesarias para la restauración física y cognitiva. El protocolo Delta estimula directamente las ondas de sueño profundo (etapas 3 y 4), favoreciendo la regeneración celular y reduciendo la fatiga crónica.';
      break;

    case 'thetaScore':
      frequency_hz = 4.5;
      duration_min = 40;
      wave_type = 'Theta Profunda';
      wave_category = 'theta';
      ideal_time = 'Noche, 30–60 min antes de acostarse';
      analysis = 'Tu sistema nervioso simpático presenta dificultades para desactivarse al final del día. El protocolo Theta Profunda induce un estado de calma neuronal, reduciendo la actividad de pensamientos rumiativos y facilitando la transición al sueño.';
      break;

    case 'alphaThetaScore':
      frequency_hz = 7.5;
      duration_min = 35;
      wave_type = 'Alpha/Theta';
      wave_category = 'alpha_theta';
      ideal_time = 'En cama, al apagar la luz';
      analysis = 'Presentás un patrón de ansiedad anticipatoria pre-sueño con dificultad para soltar el control consciente. El protocolo Alpha/Theta induce el estado hipnagógico — la zona de transición entre la vigilia y el sueño — permitiendo una entrada natural y progresiva al descanso.';
      break;

    case 'smrScore':
      frequency_hz = 13.0;
      duration_min = 30;
      wave_type = 'SMR (Beta Bajo)';
      wave_category = 'smr';
      ideal_time = 'Noche temprana, antes de la rutina de dormir';
      analysis = 'Presentás un patrón de tensión motora y activación física que dificulta la relajación corporal. El protocolo SMR entrena el ritmo sensoriomotor, promoviendo una calma física activa que prepara el cuerpo para el sueño sin generar somnolencia prematura.';
      sessions_per_week = 5;
      break;

    default: // alphaScore
      frequency_hz = 10.0;
      duration_min = 30;
      wave_type = 'Alpha';
      wave_category = 'alpha';
      ideal_time = 'Noche, al desconectarse del día';
      analysis = 'Tu mente mantiene un nivel moderado de activación al acostarte. El protocolo Alpha favorece un estado de relajación consciente y calma mental, reduciendo la tensión acumulada del día y preparando el sistema nervioso para el descanso.';
      break;
  }

  return {
    analysis,
    plan: {
      frequency_hz,
      duration_min,
      sessions_per_week,
      wave_type,
      wave_category,
      ideal_time,
      description: `Escuchar durante ${duration_min} minutos en un entorno oscuro y tranquilo usando auriculares. ${ideal_time}.`
    }
  };
}

export function generateDayDiagnostic(responses: DayResponses): { analysis: string; plan: SleepPlan } {
  const { day_anxiety, day_stress, mental_fatigue, body_tension, focus_quality, day_goal } = responses;

  let alphaScore = 0;
  let smrScore = 0;
  let thetaScore = 0;

  // Ansiedad diurna → Alpha o Alpha/Theta
  if (day_anxiety === 'intensa') { alphaScore += 3; thetaScore += 1; }
  else if (day_anxiety === 'moderada, me afecta') alphaScore += 2;
  else if (day_anxiety === 'leve, manejable') alphaScore += 1;

  // Estrés → Alpha
  if (day_stress >= 8) alphaScore += 3;
  else if (day_stress >= 5) alphaScore += 1;

  // Tensión física → SMR
  if (body_tension === 'intensa') smrScore += 3;
  else if (body_tension === 'moderada') smrScore += 2;
  else if (body_tension === 'leve') smrScore += 1;

  // Fatiga mental → Theta suave
  if (mental_fatigue === 'casi siempre') thetaScore += 2;
  else if (mental_fatigue === 'frecuentemente') thetaScore += 1;

  // Foco → SMR
  if (focus_quality === 'muy difícil mantener el foco') smrScore += 2;
  else if (focus_quality === 'me distraigo con facilidad') smrScore += 1;

  // Objetivo como desempate
  if (day_goal === 'reducir ansiedad ahora') alphaScore += 2;
  else if (day_goal === 'mejorar concentración') smrScore += 2;
  else if (day_goal === 'calmar el cuerpo') smrScore += 2;
  else if (day_goal === 'recuperar energía mental') thetaScore += 2;
  else if (day_goal === 'desconectarme un momento') alphaScore += 1;

  const scores = { alphaScore, smrScore, thetaScore };
  const winner = Object.entries(scores).reduce((a, b) => (a[1] > b[1] ? a : b))[0] as keyof typeof scores;

  let frequency_hz: number;
  let duration_min: number;
  let wave_type: string;
  let wave_category: SleepPlan['wave_category'];
  let analysis: string;
  let ideal_time: string;

  switch (winner) {
    case 'smrScore':
      frequency_hz = 13.0;
      duration_min = 20;
      wave_type = 'SMR (Beta Bajo)';
      wave_category = 'smr';
      ideal_time = 'Cualquier momento del día, idealmente sentado';
      analysis = 'Tu sistema nervioso presenta activación física sin foco mental claro. El protocolo SMR entrena el ritmo sensoriomotor: calma el cuerpo sin generar somnolencia, mejorando la atención sostenida y reduciendo la inquietud física.';
      break;

    case 'thetaScore':
      frequency_hz = 6.0;
      duration_min = 25;
      wave_type = 'Theta Suave';
      wave_category = 'theta';
      ideal_time = 'Tarde, en un momento de pausa o descanso';
      analysis = 'Presentás señales de fatiga mental acumulada. El protocolo Theta Suave induce un estado de relajación profunda con conciencia activa, permitiendo que el cerebro procese y descargue la carga cognitiva del día.';
      break;

    default: // alphaScore
      frequency_hz = 10.0;
      duration_min = 20;
      wave_type = 'Alpha';
      wave_category = 'alpha';
      ideal_time = 'Mañana, tarde o ante un momento de estrés agudo';
      analysis = 'Tu sistema nervioso presenta activación ansiosa que interfiere con tu funcionamiento diario. El protocolo Alpha reduce la hiperactividad cortical, induciendo un estado de calma alerta — relajado pero presente — sin afectar tu rendimiento.';
      break;
  }

  return {
    analysis,
    plan: {
      frequency_hz,
      duration_min,
      sessions_per_week: 'daily',
      wave_type,
      wave_category,
      ideal_time,
      description: `Escuchar durante ${duration_min} minutos con auriculares. ${ideal_time}.`
    }
  };
}
