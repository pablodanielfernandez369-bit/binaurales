'use client';
// SleepCheckin v2.0 — sistema único de ajuste, sin lógica duplicada
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { CheckCircle2, Edit3, Sparkles, ArrowRight, CheckSquare, Moon, Sun } from 'lucide-react';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  normalizePlan,
  calculateNightScore,
  calculateDayScore,
  evaluateAdjustment,
  BASELINE_PLAN,
  TreatmentPlan,
  AdjustmentResult,
} from '@/lib/treatment';

interface SleepCheckinProps {
  onComplete?: () => void;
}

const nightQuestions = [
  { id: 'q_bedtime', label: '¿A qué hora te fuiste a dormir?', options: [{ id: 'before_22', label: 'Antes de las 22hs' }, { id: '22_23', label: 'Entre 22 y 23hs' }, { id: '23_00', label: 'Entre 23 y 00hs' }, { id: 'after_00', label: 'Después de las 00hs' }] },
  { id: 'q_total_hours', label: '¿Cuántas horas dormiste en total?', options: [{ id: 'less_5', label: 'Menos de 5hs' }, { id: '5_6', label: '5 a 6hs' }, { id: '6_7', label: '6 a 7hs' }, { id: '7_8', label: '7 a 8hs' }, { id: 'more_8', label: 'Más de 8hs' }] },
  { id: 'q1b', label: '¿Te dormiste mientras sonaba la sesión?', options: [{ id: 'yes', label: 'Sí' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'No sé' }] },
  { id: 'q2', label: '¿Cuántas veces te despertaste?', options: [{ id: '0', label: '0' }, { id: '1', label: '1' }, { id: '2-3', label: '2-3' }, { id: '4+', label: '4 o más' }] },
  { id: 'q_dream', label: '¿Soñaste?', options: [{ id: 'yes_vivid', label: 'Sí, vívidamente' }, { id: 'yes_vague', label: 'Sí, algo' }, { id: 'no', label: 'No recuerdo' }] },
  { id: 'q_quality_score', label: '¿Cómo calificarías tu descanso del 1 al 5?', options: [{ id: '1', label: '1 — Muy malo' }, { id: '2', label: '2 — Malo' }, { id: '3', label: '3 — Regular' }, { id: '4', label: '4 — Bueno' }, { id: '5', label: '5 — Excelente' }] },
  { id: 'q3', label: '¿Cómo dormiste comparado con antes del tratamiento?', options: [{ id: 'much_better', label: 'Mucho mejor' }, { id: 'better', label: 'Mejor' }, { id: 'same', label: 'Igual' }, { id: 'worse', label: 'Peor' }] },
];

const dayQuestions = [
  { id: 'qd_energy', label: '¿Cómo está tu energía ahora del 1 al 5?', options: [{ id: '1', label: '1 — Sin energía' }, { id: '2', label: '2 — Baja' }, { id: '3', label: '3 — Normal' }, { id: '4', label: '4 — Buena' }, { id: '5', label: '5 — Alta' }] },
  { id: 'qd1', label: '¿Cómo te sentís comparado con antes de la sesión?', options: [{ id: 'much_better', label: 'Mucho más tranquilo' }, { id: 'better', label: 'Algo mejor' }, { id: 'same', label: 'Igual' }, { id: 'worse', label: 'Peor' }] },
  { id: 'qd2', label: '¿Lograste desconectarte durante la sesión?', options: [{ id: 'yes', label: 'Sí, completamente' }, { id: 'partial', label: 'Parcialmente' }, { id: 'no', label: 'No, me costó' }] },
  { id: 'qd_focus', label: '¿Pudiste concentrarte en tareas largas hoy?', options: [{ id: 'yes', label: 'Sí, sin problema' }, { id: 'partial', label: 'Con algo de esfuerzo' }, { id: 'no', label: 'Me costó mucho' }] },
  { id: 'qd3', label: '¿Cómo está tu ansiedad ahora?', options: [{ id: 'low', label: 'Baja' }, { id: 'moderate', label: 'Moderada' }, { id: 'high', label: 'Alta' }] },
  { id: 'q3', label: '¿Sentís el efecto de la sesión?', options: [{ id: 'much_better', label: 'Sí, claramente' }, { id: 'better', label: 'Algo' }, { id: 'same', label: 'No todavía' }, { id: 'worse', label: 'Me afectó negativamente' }] },
];

export default function SleepCheckin({ onComplete }: SleepCheckinProps) {
  const [loading, setLoading]                     = useState(true);
  const [currentUser, setCurrentUser]             = useState<any>(null);
  const { toasts, toast, dismiss }                = useToast();
  const [lastSession, setLastSession]             = useState<any>(null);
  const [existingCheckin, setExistingCheckin]     = useState<any>(null);
  const [isEditing, setIsEditing]                 = useState(false);
  const [submitting, setSubmitting]               = useState(false);
  const [activePlan, setActivePlan]               = useState<TreatmentPlan | null>(null);
  const [questionnaireMode, setQuestionnaireMode] = useState<'night' | 'day'>('night');
  const [isBothMode, setIsBothMode]               = useState(false);
  const [answers, setAnswers]                     = useState<Record<string, string>>({});
  const [adjustmentResult, setAdjustmentResult]   = useState<AdjustmentResult | null>(null);

  const getARDate = () =>
    Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

  const loadCheckinForMode = async (userId: string, mode: 'night' | 'day') => {
    const today = getARDate();
    const { data } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', userId)
      .eq('checkin_date', today)
      .eq('checkin_mode', mode)
      .limit(1);
    return data?.[0] ?? null;
  };

  useEffect(() => {
    async function initCheckin() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setCurrentUser(user);

        const { data: profile } = await supabase
          .from('user_profile')
          .select('plan, plan_day, questionnaire_mode')
          .eq('id', user.id)
          .single();

        const { data: sessions } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('completed', true)
          .order('completed_at', { ascending: false })
          .limit(1);
        if (sessions?.[0]) setLastSession(sessions[0]);

        let mode: 'night' | 'day' = 'night';
        if (profile?.questionnaire_mode === 'both') {
          setIsBothMode(true);
          mode = sessions?.[0]?.protocol_mode === 'day' ? 'day' : 'night';
        } else if (profile?.questionnaire_mode === 'day') {
          mode = 'day';
        }
        setQuestionnaireMode(mode);

        let plan: TreatmentPlan = BASELINE_PLAN;
        const { data: activePlans } = await supabase
          .from('treatment_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        if (activePlans?.[0]) {
          plan = normalizePlan(activePlans[0]);
        } else if (profile?.plan) {
          const rawPlan = (mode === 'day' && profile.plan_day) ? profile.plan_day : profile.plan;
          plan = normalizePlan(rawPlan);
        }
        setActivePlan(plan);

        const checkin = await loadCheckinForMode(user.id, mode);
        if (checkin) {
          setExistingCheckin(checkin);
          setAnswers(checkin.answers || {});
        }
      } catch (err) {
        console.error('[SleepCheckin] Error init:', err);
      } finally {
        setLoading(false);
      }
    }
    initCheckin();
  }, []);

  const switchMode = async (mode: 'night' | 'day') => {
    if (!currentUser) return;
    setQuestionnaireMode(mode);
    setAnswers({});
    setExistingCheckin(null);
    setAdjustmentResult(null);
    const checkin = await loadCheckinForMode(currentUser.id, mode);
    if (checkin) {
      setExistingCheckin(checkin);
      setAnswers(checkin.answers || {});
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !activePlan) return;
      const today = getARDate();
      const { data } = await supabase
        .from('daily_checkins')
        .upsert(
          { user_id: user.id, checkin_date: today, answers, checkin_mode: questionnaireMode, session_id: lastSession?.id || null, updated_at: new Date().toISOString() },
          { onConflict: 'user_id,checkin_date,checkin_mode' }
        )
        .select()
        .single();
      if (data) {
        setExistingCheckin(data);
        setIsEditing(false);
        const score = questionnaireMode === 'night'
          ? calculateNightScore(answers)
          : calculateDayScore(answers);
        const result = evaluateAdjustment(activePlan, score, questionnaireMode);
        setAdjustmentResult(result);
        onComplete?.();
      }
    } catch (err) {
      console.error('[SleepCheckin] Error submit:', err);
      toast('Error al guardar. Intentá de nuevo.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyAdjustment = async () => {
    if (!currentUser || !activePlan || adjustmentResult?.action !== 'adjust') return;
    setSubmitting(true);
    try {
      const { suggestedPlan, changedField } = adjustmentResult;
      await supabase.from('treatment_plans').update({ is_active: false }).eq('user_id', currentUser.id);
      const { data: newPlan, error } = await supabase
        .from('treatment_plans')
        .insert({
          user_id: currentUser.id,
          duration_min: suggestedPlan.duration_min,
          master_gain: suggestedPlan.master_gain,
          frequency_hz: suggestedPlan.frequency_hz,
          theta_gain: suggestedPlan.theta_gain,
          fade_in_ms: suggestedPlan.fade_in_ms,
          fade_out_ms: suggestedPlan.fade_out_ms,
          wave_category: suggestedPlan.wave_category,
          wave_type: suggestedPlan.wave_type,
          is_active: true,
          source_checkin_id: existingCheckin?.id,
          change_reason: adjustmentResult.reason,
          changed_field: changedField,
          protocol_mode: questionnaireMode,
        })
        .select()
        .single();
      if (error) throw error;
      setActivePlan(normalizePlan(newPlan));
      setAdjustmentResult(null);
      toast('Ajuste aplicado. Tu próxima sesión usará el nuevo protocolo.', 'success');
    } catch (err) {
      console.error('[SleepCheckin] Error apply:', err);
      toast('Error al aplicar el ajuste. Intentá de nuevo.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return null;
  if (!currentUser) return null;
  if (!lastSession && !existingCheckin) {
    return (
      <div className="bg-[#4B2C69]/10 border border-white/5 rounded-3xl p-6 text-center text-gray-500 italic text-sm">
        Completá tu primera sesión para acceder al seguimiento clínico.
      </div>
    );
  }

  const questions = questionnaireMode === 'night' ? nightQuestions : dayQuestions;
  const modeLabel = questionnaireMode === 'night' ? 'Nocturno' : 'Diurno';
  const ModeIcon  = questionnaireMode === 'night' ? Moon : Sun;
  const modeColor = questionnaireMode === 'night' ? 'text-[#7B9CFF]' : 'text-amber-400';

  const ModeTabs = () => (
    <div className="flex gap-2 p-1 bg-white/5 rounded-2xl mb-4">
      <button onClick={() => switchMode('night')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs transition-all ${questionnaireMode === 'night' ? 'bg-[#7B9CFF] text-[#0A0E1A] font-medium' : 'text-gray-500 hover:text-gray-300'}`}>
        <Moon size={14} /> Noche
      </button>
      <button onClick={() => switchMode('day')} className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs transition-all ${questionnaireMode === 'day' ? 'bg-amber-400 text-[#0A0E1A] font-medium' : 'text-gray-500 hover:text-gray-300'}`}>
        <Sun size={14} /> Día
      </button>
    </div>
  );

  if (existingCheckin && !isEditing) {
    return (
      <div className="space-y-4">
        <Toast toasts={toasts} onDismiss={dismiss} />
        {isBothMode && <ModeTabs />}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-medium text-sm">Check-in completado</h3>
                <span className={`flex items-center gap-1 text-[10px] uppercase tracking-widest ${modeColor}`}>
                  <ModeIcon size={10} /> {modeLabel}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {lastSession?.completed_at ? format(new Date(lastSession.completed_at), "d 'de' MMMM", { locale: es }) : 'Hoy'}
              </p>
            </div>
          </div>
          <button onClick={() => { setIsEditing(true); setAdjustmentResult(null); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white text-xs hover:bg-white/10 transition-colors">
            <Edit3 size={14} /> Editar
          </button>
        </motion.div>

        {adjustmentResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className={`rounded-2xl p-5 space-y-4 border ${adjustmentResult.action === 'adjust' ? 'bg-[#7B9CFF]/10 border-[#7B9CFF]/30' : 'bg-emerald-500/5 border-emerald-500/20'}`}>
            <div className={`flex items-center gap-2 ${adjustmentResult.action === 'adjust' ? 'text-[#7B9CFF]' : 'text-emerald-400'}`}>
              <Sparkles size={18} />
              <h4 className="text-sm font-medium">
                {adjustmentResult.action === 'adjust' ? 'Ajuste sugerido' : 'Protocolo estable'}
              </h4>
            </div>
            <p className="text-xs text-blue-100/70 italic">"{adjustmentResult.reason}"</p>
            {adjustmentResult.action === 'adjust' && activePlan && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Actual</p>
                    <p className="text-sm text-gray-300">
                      {adjustmentResult.changedField === 'duration_min' && `${activePlan.duration_min} min`}
                      {adjustmentResult.changedField === 'master_gain' && `Vol. ${activePlan.master_gain}`}
                      {adjustmentResult.changedField === 'theta_gain' && `Intensidad ${adjustmentResult.suggestedPlan.theta_gain}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-[#7B9CFF] mb-1">Nuevo</p>
                    <p className="text-sm font-medium text-white flex items-center gap-1">
                      <ArrowRight size={14} className="text-[#7B9CFF]" />
                      {adjustmentResult.changedField === 'duration_min' && `${adjustmentResult.suggestedPlan.duration_min} min`}
                      {adjustmentResult.changedField === 'master_gain' && `Vol. ${adjustmentResult.suggestedPlan.master_gain}`}
                      {adjustmentResult.changedField === 'theta_gain' && `Intensidad ${adjustmentResult.suggestedPlan.theta_gain}`}
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleApplyAdjustment} disabled={submitting}
                    className="flex-1 bg-[#7B9CFF] text-[#0A0E1A] py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 disabled:opacity-70">
                    <CheckSquare size={14} /> Aplicar
                  </button>
                  <button onClick={() => setAdjustmentResult(null)}
                    className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-xs hover:bg-white/10">
                    Mantener actual
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-[#4B2C69]/10 border border-white/10 rounded-3xl p-6 space-y-6">
      <Toast toasts={toasts} onDismiss={dismiss} />
      {isBothMode && <ModeTabs />}
      <div className="flex items-center gap-2 border-b border-white/5 pb-4">
        <ModeIcon size={16} className={modeColor} />
        <h2 className="text-base font-light text-white">Seguimiento {modeLabel}</h2>
        <span className="text-xs text-gray-500 ml-auto">¿Cómo fue tu sesión?</span>
      </div>
      <div className="space-y-6">
        {questions.map((q) => (
          <Question key={q.id} label={q.label} value={answers[q.id]} onChange={(val: string) => setAnswers((prev) => ({ ...prev, [q.id]: val }))} options={q.options} mode={questionnaireMode} />
        ))}
        <div>
          <p className="text-sm text-gray-400 font-light mb-2">Nota opcional</p>
          <textarea value={answers.q4 || ''} onChange={(e) => setAnswers((prev) => ({ ...prev, q4: e.target.value }))}
            placeholder="¿Algo que quieras registrar?"
            className="w-full bg-[#0A0E1A] border border-white/5 rounded-2xl p-4 text-sm text-gray-300 focus:outline-none focus:border-[#7B9CFF]/50 resize-none" rows={2} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
        {isEditing && (
          <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500 hover:text-white transition-colors">Cancelar</button>
        )}
        <button onClick={handleSubmit} disabled={submitting}
          className="px-8 py-3 rounded-2xl bg-[#7B9CFF] text-[#0A0E1A] font-medium text-sm shadow-xl shadow-[#7B9CFF]/20 disabled:opacity-70">
          {submitting ? 'Guardando...' : existingCheckin ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function Question({ label, value, onChange, options, mode }: {
  label: string; value: string; onChange: (val: string) => void;
  options: { id: string; label: string }[]; mode: 'night' | 'day';
}) {
  const selectedClass = mode === 'night'
    ? 'bg-[#7B9CFF] border-[#7B9CFF] text-[#0A0E1A] font-medium'
    : 'bg-amber-400 border-amber-400 text-[#0A0E1A] font-medium';
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-300 font-light">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt.id} onClick={() => onChange(opt.id)}
            className={`px-4 py-2 rounded-xl text-xs transition-all border ${value === opt.id ? selectedClass : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
