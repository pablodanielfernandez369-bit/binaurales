'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ShieldCheck, Moon, Sun, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateDiagnostic, generateDayDiagnostic, SleepPlan, QuestionnaireResponses, DayResponses } from '@/lib/diagnostic';

const nightSteps = [
  { id: 'sleep_hours', block: 'Patrón de Sueño', question: '¿Cuántas horas dormís por noche en promedio?', type: 'slider', min: 3, max: 10, unit: 'hs' },
  { id: 'sleep_latency', block: 'Patrón de Sueño', question: '¿Cuánto tardás en dormirte desde que apagás la luz?', type: 'options', options: ['menos de 15 min', '15-30 min', '30-60 min', 'más de 1 hora'] },
  { id: 'wake_ups', block: 'Patrón de Sueño', question: '¿Cuántas veces te despertás durante la noche?', type: 'options', options: ['nunca', '1-2 veces', '3 o más veces'] },
  { id: 'sleep_quality', block: 'Patrón de Sueño', question: '¿Cómo te sentís al despertar?', type: 'options', options: ['descansado', 'algo cansado', 'muy cansado', 'agotado aunque dormí'] },
  { id: 'racing_thoughts', block: 'Estado Mental', question: '¿Tenés pensamientos que no podés apagar al acostarte?', type: 'options', options: ['casi nunca', 'a veces', 'frecuentemente', 'siempre'] },
  { id: 'anxiety_level', block: 'Estado Mental', question: '¿Sentís ansiedad o tensión antes de dormir?', type: 'options', options: ['no', 'leve', 'moderada', 'intensa'] },
  { id: 'stress_level', block: 'Estado Mental', question: '¿Cuál es tu nivel de estrés general en la vida diaria?', type: 'slider', min: 1, max: 10, unit: '' },
  { id: 'physical_tension', block: 'Síntomas Físicos', question: '¿Sentís tensión muscular o inquietud física al intentar dormir?', type: 'options', options: ['no', 'a veces', 'frecuentemente'] },
  { id: 'screen_time', block: 'Síntomas Físicos', question: '¿Usás pantallas en la última hora antes de dormir?', type: 'options', options: ['no', 'a veces', 'sí, siempre'] },
  { id: 'main_goal', block: 'Tu Objetivo', question: '¿Qué resultado buscás principalmente?', type: 'options', options: ['dormir más profundo', 'apagar la mente', 'reducir ansiedad nocturna', 'descansar el cuerpo', 'mejorar calidad general del sueño'] },
];

const daySteps = [
  { id: 'energy_level', block: 'Estado General', question: '¿Cómo describirías tu nivel de energía durante el día?', type: 'options', options: ['alto y estable', 'irregular, con picos y caídas', 'bajo pero constante', 'muy bajo, me cuesta funcionar'] },
  { id: 'focus_quality', block: 'Estado General', question: '¿Cómo es tu capacidad de concentración?', type: 'options', options: ['buena, me concentro sin problemas', 'me distraigo con facilidad', 'me cuesta arrancar pero luego mejora', 'muy difícil mantener el foco'] },
  { id: 'day_anxiety', block: 'Estado Emocional', question: '¿Sentís ansiedad o nerviosismo durante el día?', type: 'options', options: ['no', 'leve, manejable', 'moderada, me afecta', 'intensa, me bloquea'] },
  { id: 'day_stress', block: 'Estado Emocional', question: '¿Cuál es tu nivel de estrés en este momento?', type: 'slider', min: 1, max: 10, unit: '' },
  { id: 'mental_fatigue', block: 'Estado Emocional', question: '¿Sentís fatiga mental o "niebla mental" durante el día?', type: 'options', options: ['no', 'a veces', 'frecuentemente', 'casi siempre'] },
  { id: 'body_tension', block: 'Síntomas Físicos', question: '¿Sentís tensión física o contracturas durante el día?', type: 'options', options: ['no', 'leve', 'moderada', 'intensa'] },
  { id: 'day_goal', block: 'Tu Objetivo', question: '¿Qué buscás lograr con la sesión?', type: 'options', options: ['reducir ansiedad ahora', 'mejorar concentración', 'calmar el cuerpo', 'recuperar energía mental', 'desconectarme un momento'] },
];

type Mode = 'select' | 'night' | 'day' | 'both';
type BothPhase = 'night' | 'night_result' | 'day' | 'day_result';

export default function Questionnaire() {
  const router = useRouter();
  const { toasts, toast, dismiss } = useToast();

  const [mode, setMode] = useState<Mode>('select');
  const [bothPhase, setBothPhase] = useState<BothPhase>('night');
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<any>({ sleep_hours: 7, stress_level: 5, day_stress: 5 });
  const [nightDiagnostic, setNightDiagnostic] = useState<{ analysis: string; plan: SleepPlan } | null>(null);
  const [dayDiagnostic, setDayDiagnostic] = useState<{ analysis: string; plan: SleepPlan } | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{ analysis: string; plan: SleepPlan } | null>(null);

  const activeSteps = (mode === 'both' ? bothPhase === 'night' || bothPhase === 'night_result' : mode === 'night')
    ? nightSteps : daySteps;

  const handleNext = () => {
    if (currentStep < activeSteps.length - 1) setCurrentStep(currentStep + 1);
    else finishCurrentQuestionnaire();
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
    else if (mode === 'both' && bothPhase === 'day') setBothPhase('night_result');
    else setMode('select');
  };

  const updateResponse = (id: string, value: any) =>
    setResponses((prev: any) => ({ ...prev, [id]: value }));

  const finishCurrentQuestionnaire = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (mode === 'night') {
      const result = generateDiagnostic(responses as QuestionnaireResponses);
      setDiagnostic(result);
      setIsCompleted(true);
      const { error } = await supabase.from('user_profile').upsert(
        { id: user.id, email: user.email, answers: responses, plan: result.plan, questionnaire_mode: 'night', created_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      if (error) {
        toast('No se pudo guardar el diagnóstico. Verificá tu conexión.', 'error');
        return;
      }
      toast('Diagnóstico guardado. Iniciando sesión...', 'success');
      setTimeout(() => router.push('/sesion'), 3500);

    } else if (mode === 'day') {
      const result = generateDayDiagnostic(responses as DayResponses);
      setDiagnostic(result);
      setIsCompleted(true);
      const { error } = await supabase.from('user_profile').upsert(
        { id: user.id, email: user.email, answers: responses, plan: result.plan, questionnaire_mode: 'day', created_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      if (error) {
        toast('No se pudo guardar el diagnóstico. Verificá tu conexión.', 'error');
        return;
      }
      toast('Diagnóstico guardado. Iniciando sesión...', 'success');
      setTimeout(() => router.push('/sesion'), 3500);

    } else if (mode === 'both') {
      if (bothPhase === 'night') {
        const result = generateDiagnostic(responses as QuestionnaireResponses);
        setNightDiagnostic(result);
        setBothPhase('night_result');

      } else if (bothPhase === 'day') {
        const result = generateDayDiagnostic(responses as DayResponses);
        setDayDiagnostic(result);
        setBothPhase('day_result');

        // Guardar ambos planes — nocturno como plan principal, diurno como plan_day
        const { error } = await supabase.from('user_profile').upsert(
          {
            id: user.id,
            email: user.email,
            answers: responses,
            plan: nightDiagnostic!.plan,
            plan_day: result.plan,
            questionnaire_mode: 'both',
            created_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        );
        if (error) {
          toast('No se pudo guardar el plan dual. Verificá tu conexión.', 'error');
          setBothPhase('night_result');
          return;
        }
        toast('Ambos planes guardados correctamente.', 'success');
      }
    }
  };

  // Resultado modo both — fase nocturna
  if (mode === 'both' && bothPhase === 'night_result' && nightDiagnostic) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full p-8 space-y-6 mx-auto">
        <div className="flex items-center gap-2 text-[#7B9CFF]">
          <Moon size={16} />
          <p className="text-xs uppercase tracking-widest">Diagnóstico Nocturno</p>
        </div>
        <h2 className="text-2xl font-light text-white">{nightDiagnostic.plan.wave_type}</h2>
        <p className="text-gray-400 text-sm font-light leading-relaxed">"{nightDiagnostic.analysis}"</p>
        <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Frecuencia</span><span className="text-[#7B9CFF]">{nightDiagnostic.plan.frequency_hz} Hz</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Momento ideal</span><span className="text-white">{nightDiagnostic.plan.ideal_time}</span></div>
        </div>
        <div className="pt-4 border-t border-white/5 space-y-3">
          <p className="text-xs text-gray-500 text-center">Ahora completá el cuestionario diurno</p>
          <button
            onClick={() => { setBothPhase('day'); setCurrentStep(0); }}
            className="w-full py-4 bg-amber-500 text-[#0A0E1A] rounded-2xl font-medium flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            <Sun size={18} /> Continuar con Protocolo Diurno
          </button>
        </div>
      </motion.div>
    );
  }

  // Resultado modo both — fase diurna (final)
  if (mode === 'both' && bothPhase === 'day_result' && nightDiagnostic && dayDiagnostic) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full p-8 space-y-6 mx-auto">
        <Toast toasts={toasts} onDismiss={dismiss} />
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-[#7B9CFF]/10 flex items-center justify-center border border-[#7B9CFF]/20">
            <ShieldCheck className="w-8 h-8 text-[#7B9CFF]" />
          </div>
        </div>
        <h2 className="text-xl font-light text-white text-center">Tus dos protocolos están listos</h2>

        {/* Protocolo nocturno */}
        <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-[#7B9CFF] mb-2">
            <Moon size={14} /><span className="text-xs uppercase tracking-widest">Nocturno</span>
          </div>
          <p className="text-white font-medium">{nightDiagnostic.plan.wave_type}</p>
          <p className="text-xs text-gray-500">{nightDiagnostic.plan.frequency_hz} Hz · {nightDiagnostic.plan.ideal_time}</p>
        </div>

        {/* Protocolo diurno */}
        <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Sun size={14} /><span className="text-xs uppercase tracking-widest">Diurno</span>
          </div>
          <p className="text-white font-medium">{dayDiagnostic.plan.wave_type}</p>
          <p className="text-xs text-gray-500">{dayDiagnostic.plan.frequency_hz} Hz · {dayDiagnostic.plan.ideal_time}</p>
        </div>

        <button onClick={() => router.push('/sesion')}
          className="w-full py-4 bg-[#7B9CFF] text-[#0A0E1A] rounded-2xl font-medium transition-transform active:scale-95">
          Comenzar primera sesión
        </button>
      </motion.div>
    );
  }

  // Resultado modo single
  if (isCompleted && diagnostic) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full p-8 space-y-6 mx-auto">
        <Toast toasts={toasts} onDismiss={dismiss} />
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-[#7B9CFF]/10 flex items-center justify-center border border-[#7B9CFF]/20">
            <ShieldCheck className="w-10 h-10 text-[#7B9CFF]" />
          </div>
        </div>
        <div className="text-center space-y-2">
          <p className="text-xs text-[#7B9CFF] uppercase tracking-widest">Diagnóstico del Neurólogo</p>
          <h2 className="text-2xl font-light text-white">{diagnostic.plan.wave_type}</h2>
          <p className="text-gray-400 font-light text-sm leading-relaxed">"{diagnostic.analysis}"</p>
        </div>
        <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between text-sm"><span className="text-gray-500">Frecuencia</span><span className="text-[#7B9CFF] font-medium">{diagnostic.plan.frequency_hz} Hz</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Duración</span><span className="text-white">{diagnostic.plan.duration_min} minutos</span></div>
          <div className="flex justify-between text-sm"><span className="text-gray-500">Momento ideal</span><span className="text-white">{diagnostic.plan.ideal_time}</span></div>
        </div>
        <p className="text-center text-xs text-gray-600">Iniciando sesión en unos segundos...</p>
      </motion.div>
    );
  }

  // Pantalla de selección
  if (mode === 'select') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full px-6 py-10 space-y-8 mx-auto">
        <div className="text-center space-y-2">
          <p className="text-xs text-[#7B9CFF] uppercase tracking-widest">Evaluación Inicial</p>
          <h2 className="text-2xl font-light text-white leading-snug">¿Para qué momento del día es tu tratamiento?</h2>
          <p className="text-gray-500 text-sm font-light">El protocolo se ajusta según tu objetivo.</p>
        </div>
        <div className="space-y-4">
          <button onClick={() => setMode('night')} className="w-full p-6 rounded-3xl bg-[#4B2C69]/10 border border-white/5 hover:border-[#7B9CFF]/30 transition-all text-left space-y-3 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#7B9CFF]/10 flex items-center justify-center text-[#7B9CFF] group-hover:bg-[#7B9CFF]/20 transition-all"><Moon size={20} /></div>
              <div><p className="text-white font-medium text-sm">Protocolo Nocturno</p><p className="text-[#7B9CFF] text-xs">Delta · Theta · Alpha/Theta</p></div>
            </div>
            <p className="text-gray-400 text-xs font-light leading-relaxed">Insomnio, pensamientos nocturnos, ansiedad al acostarse o calidad del descanso.</p>
          </button>

          <button onClick={() => setMode('day')} className="w-full p-6 rounded-3xl bg-[#4B2C69]/10 border border-white/5 hover:border-amber-500/20 transition-all text-left space-y-3 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-all"><Sun size={20} /></div>
              <div><p className="text-white font-medium text-sm">Protocolo Diurno</p><p className="text-amber-400 text-xs">Alpha · SMR · Beta bajo</p></div>
            </div>
            <p className="text-gray-400 text-xs font-light leading-relaxed">Ansiedad diurna, falta de concentración, fatiga mental o estrés en el trabajo.</p>
          </button>

          <button onClick={() => { setMode('both'); setBothPhase('night'); setCurrentStep(0); }} className="w-full p-6 rounded-3xl bg-white/5 border border-white/5 hover:border-white/20 transition-all text-left space-y-3 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center text-white group-hover:bg-white/10 transition-all"><Sparkles size={20} /></div>
              <div><p className="text-white font-medium text-sm">Ambos Protocolos</p><p className="text-gray-400 text-xs">Nocturno + Diurno</p></div>
            </div>
            <p className="text-gray-400 text-xs font-light leading-relaxed">Completás los dos cuestionarios y recibís un plan personalizado para el día y la noche.</p>
          </button>
        </div>
      </motion.div>
    );
  }

  // Cuestionario activo
  const step = activeSteps[currentStep];
  const progress = ((currentStep + 1) / activeSteps.length) * 100;
  const isNightPhase = mode === 'night' || (mode === 'both' && bothPhase === 'night');

  return (
    <div className="max-w-md w-full px-6 py-10 flex flex-col min-h-screen mx-auto">
      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span className={`flex items-center gap-1 ${isNightPhase ? 'text-[#7B9CFF]' : 'text-amber-400'}`}>
            {isNightPhase ? <Moon size={12} /> : <Sun size={12} />}
            {mode === 'both' && <span className="mr-1">[{bothPhase === 'night' ? '1/2' : '2/2'}]</span>}
            {step.block}
          </span>
          <span>{currentStep + 1} / {activeSteps.length}</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full">
          <motion.div
            className={`h-1 rounded-full ${isNightPhase ? 'bg-[#7B9CFF]' : 'bg-amber-400'}`}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1">
          <h2 className="text-xl font-light text-white mb-8 leading-snug">{step.question}</h2>
          <div className="space-y-3">
            {step.type === 'slider' && (
              <div className="space-y-4">
                <p className="text-center text-4xl font-extralight text-[#7B9CFF]">{responses[step.id]}{step.unit}</p>
                <input type="range" min={step.min} max={step.max} value={responses[step.id]} onChange={(e) => updateResponse(step.id, parseInt(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg accent-[#7B9CFF]" />
              </div>
            )}
            {step.type === 'options' && step.options?.map((option: string) => (
              <button key={option} onClick={() => { updateResponse(step.id, option); setTimeout(handleNext, 250); }}
                className={`w-full p-4 rounded-2xl text-left text-sm transition-all border ${responses[step.id] === option ? 'bg-[#7B9CFF] text-[#0A0E1A] border-[#7B9CFF] font-medium' : 'bg-white/5 border-white/5 text-gray-300 hover:border-white/20'}`}>
                {option}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between pt-10">
        <button onClick={handleBack} className="p-3 rounded-xl bg-white/5 text-gray-400 transition-transform active:scale-95"><ChevronLeft size={20} /></button>
        {step.type !== 'options' && (
          <button onClick={handleNext} className="px-8 py-3 bg-[#7B9CFF] text-[#0A0E1A] font-medium rounded-2xl text-sm transition-transform active:scale-95">
            {currentStep === activeSteps.length - 1 ? 'Ver diagnóstico' : 'Siguiente'}
          </button>
        )}
      </div>
    </div>
  );
}
