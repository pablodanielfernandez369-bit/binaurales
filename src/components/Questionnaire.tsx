'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ShieldCheck, Moon, Sun } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateDiagnostic, generateDayDiagnostic, SleepPlan, QuestionnaireResponses, DayResponses } from '@/lib/diagnostic';

// MODO NOCHE — Sueño e insomnio
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

// MODO DÍA — Bienestar diurno
const daySteps = [
  { id: 'energy_level', block: 'Estado General', question: '¿Cómo describirías tu nivel de energía durante el día?', type: 'options', options: ['alto y estable', 'irregular, con picos y caídas', 'bajo pero constante', 'muy bajo, me cuesta funcionar'] },
  { id: 'focus_quality', block: 'Estado General', question: '¿Cómo es tu capacidad de concentración?', type: 'options', options: ['buena, me concentro sin problemas', 'me distraigo con facilidad', 'me cuesta arrancar pero luego mejora', 'muy difícil mantener el foco'] },
  { id: 'day_anxiety', block: 'Estado Emocional', question: '¿Sentís ansiedad o nerviosismo durante el día?', type: 'options', options: ['no', 'leve, manejable', 'moderada, me afecta', 'intensa, me bloquea'] },
  { id: 'day_stress', block: 'Estado Emocional', question: '¿Cuál es tu nivel de estrés en este momento?', type: 'slider', min: 1, max: 10, unit: '' },
  { id: 'mental_fatigue', block: 'Estado Emocional', question: '¿Sentís fatiga mental o "niebla mental" durante el día?', type: 'options', options: ['no', 'a veces', 'frecuentemente', 'casi siempre'] },
  { id: 'body_tension', block: 'Síntomas Físicos', question: '¿Sentís tensión física o contracturas durante el día?', type: 'options', options: ['no', 'leve', 'moderada', 'intensa'] },
  { id: 'day_goal', block: 'Tu Objetivo', question: '¿Qué buscás lograr con la sesión?', type: 'options', options: ['reducir ansiedad ahora', 'mejorar concentración', 'calmar el cuerpo', 'recuperar energía mental', 'desconectarme un momento'] },
];

type Mode = 'select' | 'night' | 'day';

export default function Questionnaire() {
  const [mode, setMode] = useState<Mode>('select');
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<any>({ sleep_hours: 7, stress_level: 5, day_stress: 5 });
  const [isCompleted, setIsCompleted] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{ analysis: string; plan: SleepPlan } | null>(null);

  const steps = mode === 'night' ? nightSteps : daySteps;

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else finishQuestionnaire();
  };
  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
    else setMode('select');
  };
  const updateResponse = (id: string, value: any) => setResponses((prev: any) => ({ ...prev, [id]: value }));

  const finishQuestionnaire = async () => {
    const result = mode === 'night'
      ? generateDiagnostic(responses as QuestionnaireResponses)
      : generateDayDiagnostic(responses as DayResponses);

    setDiagnostic(result);
    setIsCompleted(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('user_profile').upsert(
        { id: user.id, email: user.email, answers: responses, plan: result.plan, questionnaire_mode: mode, created_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      setTimeout(() => { window.location.href = '/sesion'; }, 3500);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error al guardar tu perfil. Por favor intentá de nuevo.');
      setIsCompleted(false);
    }
  };

  // Pantalla de resultado
  if (isCompleted && diagnostic) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full p-8 rounded-3xl space-y-6">
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
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Frecuencia</span>
            <span className="text-[#7B9CFF] font-medium">{diagnostic.plan.frequency_hz} Hz</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Duración</span>
            <span className="text-white">{diagnostic.plan.duration_min} minutos</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Momento ideal</span>
            <span className="text-white">{diagnostic.plan.ideal_time}</span>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600">Iniciando sesión en unos segundos...</p>
      </motion.div>
    );
  }

  // Pantalla de selección de modo
  if (mode === 'select') {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full px-6 py-10 space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs text-[#7B9CFF] uppercase tracking-widest">Evaluación Inicial</p>
          <h2 className="text-2xl font-light text-white leading-snug">¿Para qué momento del día es tu tratamiento?</h2>
          <p className="text-gray-500 text-sm font-light">El protocolo se ajusta según tu objetivo y el momento en que usarás la sesión.</p>
        </div>

        <div className="space-y-4">
          {/* Modo Noche */}
          <button onClick={() => setMode('night')} className="w-full p-6 rounded-3xl bg-[#4B2C69]/10 border border-white/5 hover:border-[#7B9CFF]/30 transition-all text-left space-y-3 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#7B9CFF]/10 flex items-center justify-center text-[#7B9CFF] group-hover:bg-[#7B9CFF]/20 transition-all">
                <Moon size={20} />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Protocolo Nocturno</p>
                <p className="text-[#7B9CFF] text-xs">Delta · Theta · Alpha/Theta</p>
              </div>
            </div>
            <p className="text-gray-400 text-xs font-light leading-relaxed">
              Para problemas de sueño, insomnio, pensamientos nocturnos, ansiedad al acostarse o calidad del descanso. Se escucha en la cama, antes o durante el proceso de dormir.
            </p>
          </button>

          {/* Modo Día */}
          <button onClick={() => setMode('day')} className="w-full p-6 rounded-3xl bg-[#4B2C69]/10 border border-white/5 hover:border-[#7B9CFF]/30 transition-all text-left space-y-3 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-all">
                <Sun size={20} />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Protocolo Diurno</p>
                <p className="text-amber-400 text-xs">Alpha · SMR · Beta bajo</p>
              </div>
            </div>
            <p className="text-gray-400 text-xs font-light leading-relaxed">
              Para ansiedad diurna, falta de concentración, fatiga mental, estrés en el trabajo o necesidad de calmar el sistema nervioso durante el día. Se puede escuchar en cualquier momento.
            </p>
          </button>
        </div>
      </motion.div>
    );
  }

  // Cuestionario
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="max-w-md w-full px-6 py-10 flex flex-col min-h-screen">
      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span className="text-[#7B9CFF] flex items-center gap-1">
            {mode === 'night' ? <Moon size={12} /> : <Sun size={12} />}
            {step.block}
          </span>
          <span>{currentStep + 1} / {steps.length}</span>
        </div>
        <div className="w-full h-1 bg-white/5 rounded-full">
          <motion.div className="h-1 bg-[#7B9CFF] rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={currentStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }} className="flex-1">
          <h2 className="text-xl font-light text-white mb-8 leading-snug">{step.question}</h2>
          <div className="space-y-3">
            {step.type === 'slider' && (
              <div className="space-y-4">
                <p className="text-center text-4xl font-extralight text-[#7B9CFF]">
                  {responses[step.id]}{step.unit}
                </p>
                <input type="range" min={step.min} max={step.max} value={responses[step.id]} onChange={(e) => updateResponse(step.id, parseInt(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg accent-[#7B9CFF]" />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{step.min}{step.unit}</span>
                  <span>{step.max}{step.unit}</span>
                </div>
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
        <button onClick={handleBack} className="p-3 rounded-xl bg-white/5 text-gray-400">
          <ChevronLeft size={20} />
        </button>
        {step.type !== 'options' && (
          <button onClick={handleNext} className="px-8 py-3 bg-[#7B9CFF] text-[#0A0E1A] font-medium rounded-2xl text-sm">
            {currentStep === steps.length - 1 ? 'Ver diagnóstico' : 'Siguiente'}
          </button>
        )}
      </div>
    </div>
  );
}
