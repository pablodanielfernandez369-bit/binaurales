'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { CheckCircle2, Edit3, Sparkles, ArrowRight, CheckSquare, Moon, Sun } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateSleepScore, generateTreatmentSuggestion, BASELINE_PLAN, TreatmentPlan } from '@/lib/treatment';

interface SleepCheckinProps {
  onComplete?: () => void;
}

// Preguntas modo NOCHE
const nightQuestions = [
  { id: 'q1a', label: '¿Escuchaste el final de la sesión?', options: [{ id: 'finished', label: 'Sí, terminó' }, { id: 'unsure', label: 'Me dormí' }, { id: 'cut', label: 'La corté antes' }] },
  { id: 'q1b', label: '¿Te dormiste mientras sonaba?', options: [{ id: 'yes', label: 'Sí' }, { id: 'no', label: 'No' }, { id: 'unsure', label: 'No sé' }] },
  { id: 'q2', label: '¿Cuántas veces te despertaste?', options: [{ id: '0', label: '0' }, { id: '1', label: '1' }, { id: '2-3', label: '2-3' }, { id: '4+', label: '4 o más' }] },
  { id: 'q_quality', label: '¿Cómo te sentís al despertar hoy?', options: [{ id: 'rested', label: 'Descansado' }, { id: 'okay', label: 'Algo cansado' }, { id: 'tired', label: 'Muy cansado' }, { id: 'exhausted', label: 'Agotado' }] },
  { id: 'q3', label: '¿Cómo dormiste comparado con antes del tratamiento?', options: [{ id: 'much_better', label: 'Mucho mejor' }, { id: 'better', label: 'Mejor' }, { id: 'same', label: 'Igual' }, { id: 'worse', label: 'Peor' }] },
];

// Preguntas modo DÍA
const dayQuestions = [
  { id: 'qd1', label: '¿Cómo te sentís ahora comparado con antes de la sesión?', options: [{ id: 'much_better', label: 'Mucho más tranquilo' }, { id: 'better', label: 'Algo mejor' }, { id: 'same', label: 'Igual' }, { id: 'worse', label: 'Peor' }] },
  { id: 'qd2', label: '¿Lograste desconectarte durante la sesión?', options: [{ id: 'yes', label: 'Sí, completamente' }, { id: 'partial', label: 'Parcialmente' }, { id: 'no', label: 'No, me costó' }] },
  { id: 'qd3', label: '¿Cómo está tu nivel de ansiedad ahora?', options: [{ id: 'low', label: 'Bajo' }, { id: 'moderate', label: 'Moderado' }, { id: 'high', label: 'Alto' }] },
  { id: 'qd4', label: '¿Cómo está tu concentración ahora?', options: [{ id: 'good', label: 'Buena' }, { id: 'moderate', label: 'Regular' }, { id: 'poor', label: 'Difícil' }] },
  { id: 'q3', label: '¿Cómo fue esta sesión comparada con las anteriores?', options: [{ id: 'much_better', label: 'Mucho mejor' }, { id: 'better', label: 'Mejor' }, { id: 'same', label: 'Igual' }, { id: 'worse', label: 'Peor' }] },
];

export default function SleepCheckin({ onComplete }: SleepCheckinProps) {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lastSession, setLastSession] = useState<any>(null);
  const [existingCheckin, setExistingCheckin] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activePlan, setActivePlan] = useState<TreatmentPlan | null>(null);
  const [questionnaireMode, setQuestionnaireMode] = useState<'night' | 'day'>('night');
  const [suggestion, setSuggestion] = useState<{ suggestedPlan: TreatmentPlan; reason: string; changedField: string } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [answers, setAnswers] = useState<any>({});

  const getARDate = () => Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

  useEffect(() => {
    async function initCheckin() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setLoading(false); return; }
        setCurrentUser(user);

        const today = getARDate();

        // Obtener modo del cuestionario del perfil
        const { data: profile } = await supabase
          .from('user_profile')
          .select('plan, questionnaire_mode')
          .eq('id', user.id)
          .single();

        if (profile?.questionnaire_mode) {
          setQuestionnaireMode(profile.questionnaire_mode);
        }

        // Última sesión completada
        const { data: sessions } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('completed', true)
          .order('completed_at', { ascending: false })
          .limit(1);
        if (sessions && sessions.length > 0) setLastSession(sessions[0]);

        // Plan activo
        let initialPlan: TreatmentPlan | null = null;
        const { data: activePlans } = await supabase
          .from('treatment_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);

        if (activePlans && activePlans.length > 0) {
          initialPlan = activePlans[0];
        } else if (profile?.plan) {
          initialPlan = {
            duration_min: profile.plan.duration_min || BASELINE_PLAN.duration_min,
            master_gain: profile.plan.master_gain || BASELINE_PLAN.master_gain,
            beat_hz: profile.plan.frequency_hz || BASELINE_PLAN.beat_hz,
            theta_gain: profile.plan.theta_gain || BASELINE_PLAN.theta_gain,
            fade_in_ms: profile.plan.fade_in_ms || BASELINE_PLAN.fade_in_ms,
            fade_out_ms: profile.plan.fade_out_ms || BASELINE_PLAN.fade_out_ms,
          };
        } else {
          initialPlan = BASELINE_PLAN;
        }
        setActivePlan(initialPlan);

        // Check-in de hoy
        const { data: checkins } = await supabase
          .from('daily_checkins')
          .select('*')
          .eq('user_id', user.id)
          .eq('checkin_date', today)
          .limit(1);

        if (checkins && checkins.length > 0) {
          const todayCheckin = checkins[0];
          setExistingCheckin(todayCheckin);
          setAnswers(todayCheckin.answers || {});
          setSuggestionDismissed(todayCheckin.suggestion_dismissed || false);
          if (!todayCheckin.suggestion_dismissed && initialPlan) {
            const score = calculateSleepScore(todayCheckin.answers);
            const sug = generateTreatmentSuggestion(initialPlan, score);
            setSuggestion(sug);
          }
        }
      } catch (err) {
        console.error('[SleepCheckin] Error:', err);
      } finally {
        setLoading(false);
      }
    }
    initCheckin();
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const today = getARDate();
      const payload = {
        user_id: user.id,
        checkin_date: today,
        session_id: lastSession?.id || null,
        answers,
        checkin_mode: questionnaireMode,
        updated_at: new Date().toISOString()
      };
      const { data, error } = await supabase
        .from('daily_checkins')
        .upsert(payload, { onConflict: 'user_id,checkin_date' })
        .select().single();
      if (error) throw error;
      if (data) {
        setExistingCheckin(data);
        setIsEditing(false);
        if (!data.suggestion_dismissed && activePlan) {
          const score = calculateSleepScore(data.answers);
          const sug = generateTreatmentSuggestion(activePlan, score);
          setSuggestion(sug);
        }
        if (onComplete) onComplete();
      }
    } catch (err: any) {
      alert(`Error al guardar: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplySuggestion = async () => {
    if (!currentUser || !suggestion) return;
    setSubmitting(true);
    try {
      await supabase.from('treatment_plans').update({ is_active: false }).eq('user_id', currentUser.id);
      const { data: newPlan, error } = await supabase
        .from('treatment_plans')
        .insert({
          user_id: currentUser.id,
          ...suggestion.suggestedPlan,
          is_active: true,
          source_checkin_id: existingCheckin.id,
          change_reason: `auto:score=${calculateSleepScore(existingCheckin.answers)}`,
          changed_field: suggestion.changedField
        })
        .select().single();
      if (error) throw error;
      setActivePlan(newPlan);
      setSuggestion(null);
      alert('¡Plan actualizado! Tu próxima sesión usará estos ajustes.');
    } catch (err) {
      alert('Error al actualizar el plan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissSuggestion = async () => {
    if (!existingCheckin) return;
    await supabase.from('daily_checkins').update({ suggestion_dismissed: true }).eq('id', existingCheckin.id);
    setSuggestionDismissed(true);
    setSuggestion(null);
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
  const ModeIcon = questionnaireMode === 'night' ? Moon : Sun;
  const modeColor = questionnaireMode === 'night' ? 'text-[#7B9CFF]' : 'text-amber-400';

  // Check-in ya completado
  if (existingCheckin && !isEditing) {
    return (
      <div className="space-y-4">
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
                {lastSession ? format(new Date(lastSession.completed_at), "d 'de' MMMM", { locale: es }) : 'Hoy'}
              </p>
            </div>
          </div>
          <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white text-xs hover:bg-white/10 transition-colors">
            <Edit3 size={14} /> Editar
          </button>
        </motion.div>

        {suggestion && !suggestionDismissed && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-[#7B9CFF]/10 border border-[#7B9CFF]/30 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2 text-[#7B9CFF]">
              <Sparkles size={18} />
              <h4 className="text-sm font-medium">Ajuste sugerido para la próxima sesión</h4>
            </div>
            <p className="text-xs text-blue-100/70 italic">"{suggestion.reason}"</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Actual</p>
                <p className="text-sm text-gray-300">
                  {suggestion.changedField === 'duration_min' && `${activePlan?.duration_min} min`}
                  {suggestion.changedField === 'master_gain' && `Vol. ${activePlan?.master_gain}`}
                  {suggestion.changedField === 'theta_gain' && `Intensidad ${activePlan?.theta_gain}`}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-[#7B9CFF] mb-1">Sugerencia</p>
                <p className="text-sm font-medium text-white flex items-center gap-1">
                  <ArrowRight size={14} className="text-[#7B9CFF]" />
                  {suggestion.changedField === 'duration_min' && `${suggestion.suggestedPlan.duration_min} min`}
                  {suggestion.changedField === 'master_gain' && `Vol. ${suggestion.suggestedPlan.master_gain}`}
                  {suggestion.changedField === 'theta_gain' && `Intensidad ${suggestion.suggestedPlan.theta_gain}`}
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={handleApplySuggestion} disabled={submitting}
                className="flex-1 bg-[#7B9CFF] text-[#0A0E1A] py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2">
                <CheckSquare size={14} /> Aplicar
              </button>
              <button onClick={handleDismissSuggestion}
                className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-xs hover:bg-white/10">
                Mantener actual
              </button>
            </div>
          </motion.div>
        )}
      </div>
    );
  }

  // Formulario de check-in
  return (
    <div className="bg-[#4B2C69]/10 border border-white/10 rounded-3xl p-6 space-y-6">
      <div className="flex items-center gap-2 border-b border-white/5 pb-4">
        <ModeIcon size={16} className={modeColor} />
        <h2 className="text-base font-light text-white">Seguimiento {modeLabel}</h2>
        <span className="text-xs text-gray-500 ml-auto">¿Cómo fue tu sesión?</span>
      </div>

      <div className="space-y-6">
        {questions.map((q) => (
          <Question
            key={q.id}
            label={q.label}
            value={answers[q.id]}
            onChange={(val: string) => setAnswers((prev: any) => ({ ...prev, [q.id]: val }))}
            options={q.options}
          />
        ))}

        <div>
          <p className="text-sm text-gray-400 font-light mb-2">Nota opcional</p>
          <textarea
            value={answers.q4 || ''}
            onChange={(e) => setAnswers((prev: any) => ({ ...prev, q4: e.target.value }))}
            placeholder="¿Algo que quieras registrar?"
            className="w-full bg-[#0A0E1A] border border-white/5 rounded-2xl p-4 text-sm text-gray-300 focus:outline-none focus:border-[#7B9CFF]/50 resize-none"
            rows={2}
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2 border-t border-white/5">
        {isEditing && (
          <button onClick={() => setIsEditing(false)} className="text-sm text-gray-500 hover:text-white transition-colors">
            Cancelar
          </button>
        )}
        <button onClick={handleSubmit} disabled={submitting}
          className="px-8 py-3 rounded-2xl bg-[#7B9CFF] text-[#0A0E1A] font-medium text-sm shadow-xl shadow-[#7B9CFF]/20 disabled:opacity-70">
          {submitting ? 'Guardando...' : existingCheckin ? 'Actualizar' : 'Guardar'}
        </button>
      </div>
    </div>
  );
}

function Question({ label, value, onChange, options }: any) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-300 font-light">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt: any) => (
          <button key={opt.id} onClick={() => onChange(opt.id)}
            className={`px-4 py-2 rounded-xl text-xs transition-all border ${value === opt.id ? 'bg-[#7B9CFF] border-[#7B9CFF] text-[#0A0E1A] font-medium' : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'}`}>
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
