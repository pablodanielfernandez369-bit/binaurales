'use client';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateDiagnostic, SleepPlan, QuestionnaireResponses } from '@/lib/diagnostic';

const steps = [
  // Bloque 1 — Patrón de sueño
  { id: 'sleep_hours', block: 'Patrón de Sueño', question: '¿Cuántas horas dormís por noche en promedio?', type: 'slider', min: 3, max: 10, unit: 'hs' },
  { id: 'sleep_latency', block: 'Patrón de Sueño', question: '¿Cuánto tardás en dormirte desde que apagás la luz?', type: 'options', options: ['menos de 15 min', '15-30 min', '30-60 min', 'más de 1 hora'] },
  { id: 'wake_ups', block: 'Patrón de Sueño', question: '¿Cuántas veces te despertás durante la noche?', type: 'options', options: ['nunca', '1-2 veces', '3 o más veces'] },
  { id: 'sleep_quality', block: 'Patrón de Sueño', question: '¿Cómo te sentís al despertar?', type: 'options', options: ['descansado', 'algo cansado', 'muy cansado', 'agotado aunque dormí'] },
  // Bloque 2 — Estado mental
  { id: 'racing_thoughts', block: 'Estado Mental', question: '¿Tenés pensamientos que no podés apagar al acostarte?', type: 'options', options: ['casi nunca', 'a veces', 'frecuentemente', 'siempre'] },
  { id: 'anxiety_level', block: 'Estado Mental', question: '¿Sentís ansiedad o tensión antes de dormir?', type: 'options', options: ['no', 'leve', 'moderada', 'intensa'] },
  { id: 'stress_level', block: 'Estado Mental', question: '¿Cuál es tu nivel de estrés general en la vida diaria?', type: 'slider', min: 1, max: 10, unit: '' },
  // Bloque 3 — Síntomas físicos
  { id: 'physical_tension', block: 'Síntomas Físicos', question: '¿Sentís tensión muscular o inquietud física al intentar dormir?', type: 'options', options: ['no', 'a veces', 'frecuentemente'] },
  { id: 'screen_time', block: 'Síntomas Físicos', question: '¿Usás pantallas en la última hora antes de dormir?', type: 'options', options: ['no', 'a veces', 'sí, siempre'] },
  // Bloque 4 — Objetivo
  { id: 'main_goal', block: 'Tu Objetivo', question: '¿Qué resultado buscás principalmente?', type: 'options', options: ['dormir más profundo', 'apagar la mente', 'reducir ansiedad', 'descansar el cuerpo', 'mejorar calidad general'] },
];

export default function Questionnaire() {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Partial<QuestionnaireResponses>>({ sleep_hours: 7, stress_level: 5 });
  const [isCompleted, setIsCompleted] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{ analysis: string; plan: SleepPlan } | null>(null);

  const handleNext = () => {
    if (currentStep < steps.length - 1) setCurrentStep(currentStep + 1);
    else finishQuestionnaire();
  };
  const handleBack = () => { if (currentStep > 0) setCurrentStep(currentStep - 1); };
  const updateResponse = (id: string, value: any) => setResponses((prev) => ({ ...prev, [id]: value }));

  const finishQuestionnaire = async () => {
    const fullResponses = responses as QuestionnaireResponses;
    const result = generateDiagnostic(fullResponses);
    setDiagnostic(result);
    setIsCompleted(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('user_profile').upsert(
        { id: user.id, email: user.email, answers: fullResponses, plan: result.plan, created_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
      setTimeout(() => { window.location.href = '/sesion'; }, 3500);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Error al guardar tu perfil. Por favor intentá de nuevo.');
      setIsCompleted(false);
    }
  };

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
            <span className="text-gray-500">Protocolo</span>
            <span className="text-white">{diagnostic.plan.wave_type}</span>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600">Iniciando sesión en unos segundos...</p>
      </motion.div>
    );
  }

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="max-w-md w-full px-6 py-10 flex flex-col">
      {/* Barra de progreso */}
      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-xs text-gray-600">
          <span className="text-[#7B9CFF]">{step.block}</span>
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
                  {(responses as any)[step.id]}{step.unit}
                </p>
                <input type="range" min={step.min} max={step.max} value={(responses as any)[step.id]} onChange={(e) => updateResponse(step.id, parseInt(e.target.value))} className="w-full h-2 bg-white/10 rounded-lg accent-[#7B9CFF]" />
                <div className="flex justify-between text-xs text-gray-600">
                  <span>{step.min}{step.unit}</span>
                  <span>{step.max}{step.unit}</span>
                </div>
              </div>
            )}
            {step.type === 'options' && step.options?.map((option) => (
              <button key={option} onClick={() => { updateResponse(step.id, option); setTimeout(handleNext, 250); }}
                className={`w-full p-4 rounded-2xl text-left text-sm transition-all border ${(responses as any)[step.id] === option ? 'bg-[#7B9CFF] text-[#0A0E1A] border-[#7B9CFF] font-medium' : 'bg-white/5 border-white/5 text-gray-300 hover:border-white/20'}`}>
                {option}
              </button>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center justify-between pt-10">
        <button onClick={handleBack} className={`p-3 rounded-xl bg-white/5 text-gray-400 transition-opacity ${currentStep === 0 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
