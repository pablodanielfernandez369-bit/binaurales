'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Edit3, MessageSquare, Moon, Sun, Clock, Star, Sparkles, ArrowRight, XCircle, CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { calculateSleepScore, generateTreatmentSuggestion, BASELINE_PLAN, TreatmentPlan } from '@/lib/treatment';

interface SleepCheckinProps {
  onComplete?: () => void;
}

export default function SleepCheckin({ onComplete }: SleepCheckinProps) {
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [lastSession, setLastSession] = useState<any>(null);
  const [existingCheckin, setExistingCheckin] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activePlan, setActivePlan] = useState<TreatmentPlan | null>(null);
  const [suggestion, setSuggestion] = useState<{ suggestedPlan: TreatmentPlan; reason: string; changedField: string } | null>(null);
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);

  // Form State
  const [answers, setAnswers] = useState<any>({
    q1a: '', // Audio end
    q1b: '', // Slept during
    q1c: '', // Slept after
    q1d: '', // Latency after (conditional)
    q2: '',  // Awakenings
    q3: '',  // Comparison
    q4: ''   // Notes
  });

  const getARDate = () => {
    return Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  };

  useEffect(() => {
    async function initCheckin() {
      try {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setCurrentUser(user);

        const today = getARDate();

        // 1. Fetch last COMPLETED session
        const { data: sessions } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('started_at', { ascending: false })
          .limit(1);

        if (sessions && sessions.length > 0) {
          setLastSession(sessions[0]);
        }

        // 2. Fetch today's check-in
        const { data: checkins } = await supabase
          .from('daily_checkins')
          .select('*')
          .eq('user_id', user.id)
          .eq('checkin_date', today)
          .limit(1);

        if (checkins && checkins.length > 0) {
          setExistingCheckin(checkins[0]);
          setAnswers(checkins[0].answers);
          setSuggestionDismissed(checkins[0].suggestion_dismissed || false);
        }

        // 3. Fetch active treatment plan
        const { data: activePlans } = await supabase
          .from('treatment_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1);
        
        if (activePlans && activePlans.length > 0) {
          setActivePlan(activePlans[0]);
        } else {
          // Use user_profile.plan as baseline if available
          const { data: profile } = await supabase
            .from('user_profile')
            .select('plan')
            .eq('id', user.id)
            .single();
          
          if (profile?.plan) {
            setActivePlan({
              duration_min: profile.plan.duration_min || BASELINE_PLAN.duration_min,
              master_gain: profile.plan.master_gain || BASELINE_PLAN.master_gain,
              theta_beat_hz: profile.plan.frequency_hz || BASELINE_PLAN.theta_beat_hz,
              theta_gain: profile.plan.theta_gain || BASELINE_PLAN.theta_gain,
              fade_in_ms: profile.plan.fade_in_ms || BASELINE_PLAN.fade_in_ms,
              fade_out_ms: profile.plan.fade_out_ms || BASELINE_PLAN.fade_out_ms,
            });
          } else {
            setActivePlan(BASELINE_PLAN);
          }
        }
      } catch (err) {
        console.error('[SleepCheckin] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    }

    initCheckin();
  }, []);

  const handleSubmit = async () => {
    if (!currentUser || submitting) return;
    
    setSubmitting(true);
    const today = getARDate();
    
    const payload = {
      user_id: currentUser.id,
      checkin_date: today,
      session_id: lastSession?.id || null,
      answers: answers,
      updated_at: new Date().toISOString()
    };

    try {
      // Use upsert to handle both insert and update atomically
      // onConflict handles the UNIQUE(user_id, checkin_date) constraint
      const { data, error } = await supabase
        .from('daily_checkins')
        .upsert(payload, { 
          onConflict: 'user_id,checkin_date',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;
      
      if (data) {
        setExistingCheckin(data);
        setAnswers(data.answers);
        setSuggestionDismissed(data.suggestion_dismissed || false);
        setIsEditing(false);
        
        // Calculate suggestion if not already dismissed
        if (!data.suggestion_dismissed && activePlan) {
          const score = calculateSleepScore(data.answers);
          const sug = generateTreatmentSuggestion(activePlan, score);
          setSuggestion(sug);
        }

        if (onComplete) onComplete();
      }
    } catch (err: any) {
      console.error('[SleepCheckin] Error saving:', err);
      alert(`No se pudo guardar el check-in: ${err.message || 'Error desconocido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplySuggestion = async () => {
    if (!currentUser || !suggestion || submitting) return;
    setSubmitting(true);
    try {
      // 1. Deactivate current active plans for this user
      await supabase
        .from('treatment_plans')
        .update({ is_active: false })
        .eq('user_id', currentUser.id);
      
      // 2. Insert new plan
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
        .select()
        .single();
      
      if (error) throw error;
      
      setActivePlan(newPlan);
      setSuggestion(null);
      alert('¡Plan actualizado! Tu próxima sesión usará estos ajustes.');
    } catch (err: any) {
      console.error('[SleepCheckin] Error applying suggestion:', err);
      alert('Error al aplicar el plan. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismissSuggestion = async () => {
    if (!existingCheckin || submitting) return;
    try {
      await supabase
        .from('daily_checkins')
        .update({ suggestion_dismissed: true })
        .eq('id', existingCheckin.id);
      
      setSuggestionDismissed(true);
      setSuggestion(null);
    } catch (err) {
      console.error('[SleepCheckin] Error dismissing:', err);
    }
  };

  if (loading) return null;
  if (!currentUser) return null;
  if (!lastSession && !existingCheckin) {
    return (
      <div className="bg-[#4B2C69]/10 border border-white/5 rounded-3xl p-6 text-center">
        <p className="text-gray-500 font-light italic">Todavía no hay una sesión completada para evaluar.</p>
      </div>
    );
  }

  const showLatencyQuestion = answers.q1a === 'finished' && answers.q1c === 'yes';

  if (existingCheckin && !isEditing) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-4"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <h3 className="text-white font-medium">Check-in completado</h3>
            <p className="text-xs text-gray-400">Evaluación de la sesión del {format(new Date(lastSession?.started_at || Date.now()), "d 'de' MMMM", { locale: es })}</p>
          </div>
        </div>
          <button 
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-white text-sm hover:bg-white/10 transition-colors"
          >
            <Edit3 size={16} />
            Editar
          </button>
        </div>

        {suggestion && !suggestionDismissed && !isEditing && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-6 bg-[#7B9CFF]/10 border border-[#7B9CFF]/30 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center gap-2 text-[#7B9CFF]">
              <Sparkles size={18} />
              <h4 className="text-sm font-medium">Plan sugerido para la próxima sesión</h4>
            </div>
            
            <p className="text-xs text-blue-100/70 italic">"{suggestion.reason}"</p>
            
            <div className="grid grid-cols-2 gap-4 py-2">
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-gray-500">Valor Actual</p>
                <div className="text-sm text-gray-300">
                  {suggestion.changedField === 'duration_min' && `${activePlan?.duration_min} min`}
                  {suggestion.changedField === 'master_gain' && `${activePlan?.master_gain} vol`}
                  {suggestion.changedField === 'theta_gain' && `${activePlan?.theta_gain} theta`}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wider text-[#7B9CFF]">Sugerencia</p>
                <div className="text-sm font-medium text-white flex items-center gap-2">
                  <ArrowRight size={14} className="text-[#7B9CFF]" />
                  {suggestion.changedField === 'duration_min' && `${suggestion.suggestedPlan.duration_min} min`}
                  {suggestion.changedField === 'master_gain' && `${suggestion.suggestedPlan.master_gain} vol`}
                  {suggestion.changedField === 'theta_gain' && `${suggestion.suggestedPlan.theta_gain} theta`}
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button 
                onClick={handleApplySuggestion}
                className="flex-1 bg-[#7B9CFF] text-[#0A0E1A] py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
              >
                <CheckSquare size={14} />
                Aplicar Sugerencia
              </button>
              <button 
                onClick={handleDismissSuggestion}
                className="px-4 py-2 bg-white/5 text-gray-400 rounded-xl text-xs hover:bg-white/10"
              >
                Mantener Actual
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="bg-[#4B2C69]/10 border border-white/10 rounded-3xl p-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h2 className="text-xl font-light text-white">Check-in de sueño</h2>
          <p className="text-sm text-gray-400 mt-1">Sobre tu sesión del {format(new Date(lastSession.started_at), "d 'de' MMMM", { locale: es })}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-blue-300 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
          <Clock size={14} />
          <span>{Math.round(lastSession.duration_seconds / 60)} min | {lastSession.frequency_hz}Hz</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Q1: Audio Status */}
        <section className="space-y-4">
          <h4 className="text-xs uppercase tracking-widest text-[#7B9CFF] font-medium">1. Calidad del Inicio</h4>
          
          <Question 
            label="¿Escuchaste el final de la sesión?"
            value={answers.q1a}
            onChange={(val: string) => setAnswers({...answers, q1a: val})}
            options={[
              { id: 'finished', label: 'Sí, terminó' },
              { id: 'unsure', label: 'No sé / me dormí' },
              { id: 'cut', label: 'La corté antes' }
            ]}
          />

          <Question 
            label="¿Te dormiste MIENTRAS sonaba?"
            value={answers.q1b}
            onChange={(val: string) => setAnswers({...answers, q1b: val})}
            options={[
              { id: 'no', label: 'No' },
              { id: 'yes', label: 'Sí' },
              { id: 'unsure', label: 'No sé' }
            ]}
          />

          <Question 
            label="¿Te dormiste DESPUÉS de que terminó?"
            value={answers.q1c}
            onChange={(val: string) => setAnswers({...answers, q1c: val})}
            options={[
              { id: 'no', label: 'No' },
              { id: 'yes', label: 'Sí' },
              { id: 'unsure', label: 'No sé' }
            ]}
          />

          <AnimatePresence>
            {showLatencyQuestion && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Question 
                  label="¿Cuánto tardaste en dormirte (aprox)?"
                  value={answers.q1d}
                  onChange={(val: string) => setAnswers({...answers, q1d: val})}
                  options={[
                    { id: '<15', label: '<15 min' },
                    { id: '15-30', label: '15-30 min' },
                    { id: '30-60', label: '30-60 min' },
                    { id: '>60', label: '>60 min' }
                  ]}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Q2 & Q3: Night & Quality */}
        <section className="space-y-8">
          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-[#7B9CFF] font-medium">2. Durante la Noche</h4>
            <Question 
              label="¿Cuántas veces te despertaste?"
              value={answers.q2}
              onChange={(val: string) => setAnswers({...answers, q2: val})}
              options={[
                { id: '0', label: '0' },
                { id: '1', label: '1' },
                { id: '2-3', label: '2-3' },
                { id: '4+', label: '4+' }
              ]}
            />
          </div>

          <div className="space-y-4">
            <h4 className="text-xs uppercase tracking-widest text-[#7B9CFF] font-medium">3. Comparación</h4>
            <Question 
              label="¿Cómo te sientes comparado con antes?"
              value={answers.q3}
              onChange={(val: string) => setAnswers({...answers, q3: val})}
              options={[
                { id: 'much_better', label: 'Mucho mejor' },
                { id: 'better', label: 'Mejor' },
                { id: 'same', label: 'Igual' },
                { id: 'worse', label: 'Peor' }
              ]}
            />
          </div>

          <div className="space-y-3">
            <h4 className="text-xs uppercase tracking-widest text-gray-500 font-medium">4. Nota Breve</h4>
            <div className="relative">
              <textarea 
                value={answers.q4}
                onChange={(e) => setAnswers({...answers, q4: e.target.value})}
                placeholder="Ej: Me desperté con sed, pero me dormí rápido..."
                className="w-full bg-[#0A0E1A] border border-white/5 rounded-2xl p-4 text-sm font-light text-gray-300 focus:outline-none focus:border-[#7B9CFF]/50 transition-colors"
                rows={2}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-[10px] text-gray-500 italic max-w-xs text-center md:text-left">
          Tus respuestas ayudan al sistema a calibrar la efectividad de los tonos binaurales.
        </p>
        <div className="flex items-center gap-4">
          {isEditing && (
            <button 
              onClick={() => setIsEditing(false)}
              className="text-sm text-gray-400 hover:text-white"
            >
              Cancelar
            </button>
          )}
          <button 
            onClick={handleSubmit}
            disabled={submitting}
            className="px-10 py-3 rounded-2xl bg-[#7B9CFF] text-[#0A0E1A] font-medium shadow-xl shadow-[#7B9CFF]/20 active:scale-95 transition-all flex items-center gap-2"
          >
            {submitting ? 'Guardando...' : existingCheckin ? 'Actualizar' : 'Guardar Registro'}
          </button>
        </div>
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
          <button
            key={opt.id}
            onClick={() => onChange(opt.id)}
            className={`px-4 py-2 rounded-xl text-xs transition-all border ${
              value === opt.id 
                ? 'bg-[#7B9CFF] border-[#7B9CFF] text-[#0A0E1A] font-medium shadow-lg shadow-[#7B9CFF]/10' 
                : 'bg-white/5 border-white/5 text-gray-400 hover:bg-white/10'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
