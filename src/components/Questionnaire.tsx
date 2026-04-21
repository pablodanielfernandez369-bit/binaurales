'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Moon, Brain, ShieldCheck } from 'lucide-react';
import { supabase, FIXED_USER_ID } from '@/lib/supabase';
import { generateDiagnostic, SleepPlan, QuestionnaireResponses } from '@/lib/diagnostic';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const steps = [
  {
    id: 'sleep_hours',
    question: '¿Cuántas horas dormís por noche en promedio?',
    type: 'slider',
    min: 3,
    max: 10,
    unit: 'hs',
  },
  {
    id: 'sleep_latency',
    question: '¿Cuánto tardás en dormirte?',
    type: 'options',
    options: ['menos de 15 min', '15-30 min', '30-60 min', 'más de 1 hora'],
  },
  {
    id: 'wake_ups',
    question: '¿Te despertás durante la noche?',
    type: 'options',
    options: ['nunca', '1-2 veces', '3 o más veces'],
  },
  {
    id: 'sleep_quality',
    question: '¿Cómo te sentís al despertar?',
    type: 'options',
    options: ['descansado', 'algo cansado', 'muy cansado'],
  },
  {
    id: 'stress_level',
    question: '¿Cuál es tu nivel de estrés general?',
    type: 'slider',
    min: 1,
    max: 10,
    unit: '',
  },
  {
    id: 'racing_thoughts',
    question: '¿Tenés pensamientos que no te dejan dormir?',
    type: 'options',
    options: ['casi nunca', 'a veces', 'frecuentemente', 'siempre'],
  },
  {
    id: 'bedtime',
    question: '¿A qué hora te vas a dormir habitualmente?',
    type: 'time',
  },
  {
    id: 'screen_time',
    question: '¿Usás pantallas antes de dormir?',
    type: 'options',
    options: ['no', 'hasta 30 min antes', 'hasta 1 hora antes', 'más de 1 hora antes'],
  },
];

export default function Questionnaire() {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState<Partial<QuestionnaireResponses>>({
    sleep_hours: 7,
    stress_level: 5,
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [diagnostic, setDiagnostic] = useState<{ analysis: string; plan: SleepPlan } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      finishQuestionnaire();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateResponse = (id: string, value: any) => {
    setResponses((prev) => ({ ...prev, [id]: value }));
  };

  const finishQuestionnaire = async () => {
    const fullResponses = responses as QuestionnaireResponses;
    const result = generateDiagnostic(fullResponses);
    setDiagnostic(result);
    setIsCompleted(true);
    
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('user_profile').insert({
        id: user.id,
        email: user.email,
        answers: fullResponses,
        plan: result.plan,
        created_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isCompleted && diagnostic) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full glass p-8 rounded-3xl"
      >
        <div className="flex justify-center mb-6">
          <ShieldCheck className="w-16 h-16 text-accent" />
        </div>
        <h2 className="text-2xl font-bold mb-4 text-center text-gradient">Diagnóstico del Neurólogo</h2>
        <p className="text-zinc-300 mb-6 leading-relaxed italic text-center">
          "{diagnostic.analysis}"
        </p>
        
        <div className="bg-primary/20 p-6 rounded-2xl border border-primary/30 mb-8">
          <h3 className="text-accent font-semibold mb-2">Plan Recomendado:</h3>
          <ul className="space-y-2 text-sm text-zinc-200">
            <li><span className="text-accent/60">Terapia:</span> Binaural de fase {diagnostic.plan.wave_type}</li>
            <li><span className="text-accent/60">Frecuencia:</span> {diagnostic.plan.frequency_hz} Hz</li>
            <li><span className="text-accent/60">Duración:</span> {diagnostic.plan.duration_min} minutos</li>
            <li><span className="text-accent/60">Frecuencia semanal:</span> {diagnostic.plan.sessions_per_week === 'daily' ? 'Todas las noches' : `${diagnostic.plan.sessions_per_week} veces por semana`}</li>
          </ul>
        </div>

        <button 
          onClick={() => window.location.href = '/sesion'}
          className="w-full py-4 bg-accent hover:bg-accent/90 text-background font-bold rounded-2xl transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2"
        >
          Comenzar mi primera sesión
          <ChevronRight className="w-5 h-5" />
        </button>
      </motion.div>
    );
  }

  const step = steps[currentStep];

  return (
    <div className="max-w-md w-full px-6 py-12 flex flex-col items-center">
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 text-xs font-medium text-accent mb-4">
          <Brain className="w-4 h-4" />
          CONSULTA NEUROLÓGICA
        </div>
        <div className="w-full bg-zinc-800/50 h-1.5 rounded-full mb-2 overflow-hidden">
          <motion.div 
            className="h-full bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Paso {currentStep + 1} de {steps.length}</span>
      </div>

      {/* Question Content */}
      <div className="w-full min-h-[300px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-8"
          >
            <h2 className="text-2xl font-light text-center leading-tight">
              {step.question}
            </h2>

            {step.type === 'slider' && (
              <div className="flex flex-col gap-4">
                <input 
                  type="range" 
                  min={step.min} 
                  max={step.max} 
                  value={(responses as any)[step.id]}
                  onChange={(e) => updateResponse(step.id, parseInt(e.target.value))}
                  className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="text-5xl font-bold text-center text-accent">
                  {(responses as any)[step.id]}
                  <span className="text-xl font-normal text-zinc-500 ml-1">{step.unit}</span>
                </div>
              </div>
            )}

            {step.type === 'options' && (
              <div className="grid gap-3">
                {step.options?.map((option) => (
                  <button
                    key={option}
                    onClick={() => {
                      updateResponse(step.id, option);
                      setTimeout(handleNext, 300);
                    }}
                    className={cn(
                      "w-full p-4 rounded-2xl text-left border transition-all text-sm",
                      (responses as any)[step.id] === option
                        ? "bg-accent text-background border-accent font-medium"
                        : "bg-white/5 border-white/10 text-white hover:border-accent/40"
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}

            {step.type === 'time' && (
              <div className="flex justify-center">
                <input 
                  type="time" 
                  value={(responses as any)[step.id] || ''}
                  onChange={(e) => updateResponse(step.id, e.target.value)}
                  className="bg-zinc-800 text-white p-4 rounded-2xl border border-white/10 text-xl"
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <div className="mt-auto w-full flex items-center justify-between pt-12">
        <button 
          onClick={handleBack}
          disabled={currentStep === 0}
          className={cn(
            "p-4 rounded-2xl border border-white/10 text-white transition-opacity",
            currentStep === 0 ? "opacity-0" : "opacity-100"
          )}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        
        {step.type !== 'options' && (
          <button 
            onClick={handleNext}
            className="flex items-center gap-2 px-8 py-4 bg-accent text-background font-bold rounded-2xl transition-all"
          >
            Siguiente
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}
