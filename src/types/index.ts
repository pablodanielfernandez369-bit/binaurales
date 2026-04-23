export type WaveCategory = 'delta' | 'theta' | 'alpha_theta' | 'alpha' | 'smr';
export type QuestionnaireMode = 'night' | 'day' | 'both';
export type ProtocolMode = 'night' | 'day';

export interface SleepPlanBase {
  frequency_hz: number;
  duration_min: number;
  sessions_per_week: number | 'daily';
  description: string;
  wave_type: string;
  wave_category: WaveCategory;
  ideal_time: string;
}

export interface UserPlan extends SleepPlanBase {
  master_gain?: number;
  theta_gain?: number;
  fade_in_ms?: number;
  fade_out_ms?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  answers: Record<string, string | number>;
  plan: UserPlan;
  plan_day?: UserPlan;
  questionnaire_mode: QuestionnaireMode;
  created_at: string;
}

export interface Session {
  id: string;
  user_id: string;
  duration_min: number;
  frequency_hz: number;
  noise_volume?: number;
  completed: boolean;
  completed_at: string;
  created_at?: string;
  wave_category?: WaveCategory;
  protocol_mode: ProtocolMode;
}

export interface StoredTreatmentPlan {
  id?: string;
  user_id?: string;
  duration_min: number;
  master_gain: number;
  beat_hz?: number;
  frequency_hz?: number;
  theta_beat_hz?: number;
  theta_gain: number;
  fade_in_ms: number;
  fade_out_ms: number;
  wave_category?: WaveCategory;
  wave_type?: string;
  is_active?: boolean;
  change_reason?: string;
  changed_field?: string;
}

export interface DailyCheckin {
  id: string;
  user_id: string;
  checkin_date: string;
  answers: Record<string, string>;
  checkin_mode: ProtocolMode;
  session_id?: string | null;
  suggestion_dismissed?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface DiagnosticMetric {
  label: string;
  value: string;
  color: string;
}

export interface DailyDiagnostic {
  status: 'improving' | 'stable' | 'warning';
  statusLabel: string;
  analysis: string;
  recommendation: string;
  metrics: DiagnosticMetric[];
  score: number;
}
