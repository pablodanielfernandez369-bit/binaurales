'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Edit3, MessageSquare, Moon, Sun, Clock, Star } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

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
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
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
      answers: answers
    };

    try {
      if (existingCheckin && isEditing) {
        await supabase
          .from('daily_checkins')
          .update({ answers, updated_at: new Date().toISOString() })
          .eq('id', existingCheckin.id);
      } else {
        await supabase
          .from('daily_checkins')
          .insert([payload]);
      }
      
      // Refresh state
      const { data } = await supabase
        .from('daily_checkins')
        .select('*')
        .eq('user_id', currentUser.id)
        .eq('checkin_date', today)
        .single();
      
      setExistingCheckin(data);
      setIsEditing(false);
      if (onComplete) onComplete();
    } catch (err) {
      console.error('[SleepCheckin] Error saving:', err);
      alert('Error al guardar el check-in. Reintenta.');
    } finally {
      setSubmitting(false);
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
