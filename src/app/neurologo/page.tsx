'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Activity, Calendar, Clock, Trash2, Moon, Sun, Brain, TrendingUp, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import SleepCheckin from '@/components/SleepCheckin';

export default function NeurologoPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const [dailyDiagnostic, setDailyDiagnostic] = useState<any>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from('user_profile')
      .select('*')
      .eq('id', user.id)
      .single();
    setProfile(prof);

    const { data: sess } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', user.id)
      .eq('completed', true)
      .order('completed_at', { ascending: false });
    setSessions(sess || []);

    // Buscar check-in de hoy para diagnóstico diario
    const today = Intl.DateTimeFormat('en-CA', { 
      timeZone: 'America/Argentina/Buenos_Aires' 
    }).format(new Date());
    const { data: checkin } = await supabase
      .from('daily_checkins')
      .select('*')
      .eq('user_id', user.id)
      .eq('checkin_date', today)
      .limit(1);
    if (checkin && checkin.length > 0) {
      setDailyDiagnostic(generateDailyDiagnostic(checkin[0]));
    }

    setLoading(false);
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    await supabase.from('sessions').delete().eq('id', sessionToDelete);
    setSessions(prev => prev.filter(s => s.id !== sessionToDelete));
    setSessionToDelete(null);
  };

  // Separar sesiones por protocolo
  const isBothMode = profile?.questionnaire_mode === 'both';
  const nightSessions = sessions.filter(s => {
    if (!isBothMode) return true;
    const hz = s.frequency_hz;
    return hz <= 13; // nocturno: Delta, Theta, Alpha/Theta, Alpha
  });
  const daySessions = sessions.filter(s => {
    if (!isBothMode) return false;
    return s.frequency_hz >= 10 && s.frequency_hz <= 15; // SMR y Alpha diurno
  });

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center text-[#7B9CFF]">
      Cargando Panel Clínico...
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col px-6 pt-12 pb-24 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-light text-white">Panel Clínico</h1>
        <p className="text-gray-500 text-sm mt-1">Seguimiento y evolución de tu tratamiento.</p>
      </header>

      {/* Check-in */}
      <SleepCheckin onComplete={fetchData} />

      {/* Diagnóstico Diario */}
      {dailyDiagnostic && (
        <div className="space-y-3">
          <button
            onClick={() => setShowDiagnostico(!showDiagnostico)}
            className="w-full flex items-center justify-between p-5 bg-[#4B2C69]/10 border border-[#7B9CFF]/20 rounded-2xl hover:border-[#7B9CFF]/40 transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#7B9CFF]/10 flex items-center justify-center text-[#7B9CFF]">
                <Brain size={20} />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-medium">Diagnóstico Clínico Diario</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">
                  Basado en tu check-in de hoy
                </p>
              </div>
            </div>
            <motion.div animate={{ rotate: showDiagnostico ? 180 : 0 }}>
              <TrendingUp size={16} className="text-[#7B9CFF]" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showDiagnostico && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-6 space-y-4">
                  {/* Estado general */}
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      dailyDiagnostic.status === 'improving' ? 'bg-emerald-400' :
                      dailyDiagnostic.status === 'stable' ? 'bg-[#7B9CFF]' : 'bg-amber-400'
                    }`} />
                    <p className="text-white font-medium text-sm">{dailyDiagnostic.statusLabel}</p>
                  </div>

                  {/* Análisis */}
                  <p className="text-gray-400 text-sm font-light leading-relaxed">
                    {dailyDiagnostic.analysis}
                  </p>

                  {/* Métricas */}
                  <div className="grid grid-cols-2 gap-3">
                    {dailyDiagnostic.metrics.map((m: any) => (
                      <div key={m.label} className="bg-[#0A0E1A]/40 rounded-xl p-3">
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{m.label}</p>
                        <p className={`text-sm font-medium mt-1 ${m.color}`}>{m.value}</p>
                      </div>
                    ))}
                  </div>

                  {/* Recomendación */}
                  {dailyDiagnostic.recommendation && (
                    <div className="bg-[#7B9CFF]/5 border border-[#7B9CFF]/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 text-[#7B9CFF] mb-2">
                        <Sparkles size={14} />
                        <p className="text-xs font-medium uppercase tracking-widest">Recomendación</p>
                      </div>
                      <p className="text-gray-300 text-xs leading-relaxed">{dailyDiagnostic.recommendation}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Estadísticas de sesiones */}
      <div className={`grid gap-4 ${isBothMode ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {isBothMode ? (
          <>
            <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#7B9CFF]">
                <Moon size={14} />
                <p className="text-[10px] uppercase tracking-widest">Sesiones Nocturnas</p>
              </div>
              <p className="text-2xl font-light text-white">{nightSessions.length}</p>
              <p className="text-xs text-gray-500">
                {nightSessions.reduce((a, s) => a + (s.duration_min || 0), 0)} min totales
              </p>
            </div>
            <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-5 space-y-2">
              <div className="flex items-center gap-2 text-amber-400">
                <Sun size={14} />
                <p className="text-[10px] uppercase tracking-widest">Sesiones Diurnas</p>
              </div>
              <p className="text-2xl font-light text-white">{daySessions.length}</p>
              <p className="text-xs text-gray-500">
                {daySessions.reduce((a, s) => a + (s.duration_min || 0), 0)} min totales
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-5 space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total Sesiones</p>
              <p className="text-2xl font-light text-white">{sessions.length}</p>
            </div>
            <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-5 space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Minutos Totales</p>
              <p className="text-2xl font-light text-white">
                {sessions.reduce((a, s) => a + (s.duration_min || 0), 0)}
              </p>
            </div>
            <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-5 space-y-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Protocolo</p>
              <p className="text-sm font-medium text-[#7B9CFF]">
                {profile?.plan?.wave_type || '—'}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Historial */}
      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-gray-500">Historial de Sesiones</h2>
        {sessions.length === 0 ? (
          <p className="text-gray-600 text-sm italic text-center py-8">
            Aún no hay sesiones registradas.
          </p>
        ) : (
          sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1A1F2E] flex items-center justify-center">
                  {s.frequency_hz >= 10 && isBothMode
                    ? <Sun size={13} className="text-amber-400" />
                    : <Moon size={13} className="text-[#7B9CFF]" />
                  }
                </div>
                <div>
                  <p className="text-sm text-white">
                    {format(new Date(s.completed_at), "d 'de' MMMM, HH:mm", { locale: es })}
                  </p>
                  <p className="text-[10px] text-gray-500 uppercase">
                    {s.duration_min} min · {s.frequency_hz} Hz
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSessionToDelete(s.id)}
                className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </section>

      {/* Modal borrar sesión */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-50 bg-[#0A0E1A]/90 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-[#1A0A0A] border border-red-500/30 p-8 rounded-3xl text-center max-w-sm space-y-4">
            <h2 className="text-white text-xl font-light">¿Borrar sesión?</h2>
            <p className="text-gray-500 text-sm">Esta acción es irreversible.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDeleteSession} className="py-3 bg-red-500 text-white rounded-xl text-sm font-medium">
                Sí, borrar
              </button>
              <button onClick={() => setSessionToDelete(null)} className="py-3 bg-white/5 text-white rounded-xl text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Función que genera el diagnóstico diario basado en el check-in
function generateDailyDiagnostic(checkin: any) {
  const answers = checkin.answers || {};
  const mode = checkin.checkin_mode || 'night';

  let score = 0;
  let metrics: any[] = [];

  if (mode === 'night') {
    if (answers.q3 === 'much_better') score += 2;
    else if (answers.q3 === 'better') score += 1;
    else if (answers.q3 === 'worse') score -= 2;
    if (answers.q2 === '0') score += 2;
    else if (answers.q2 === '1') score += 1;
    else if (answers.q2 === '4+') score -= 2;
    if (answers.q1b === 'yes') score += 1; // se durmió durante la sesión

    metrics = [
      { label: 'Despertares', value: answers.q2 || '—', color: answers.q2 === '0' ? 'text-emerald-400' : answers.q2 === '4+' ? 'text-red-400' : 'text-white' },
      { label: 'Comparación', value: (({ much_better: 'Mucho mejor', better: 'Mejor', same: 'Igual', worse: 'Peor' } as Record<string,string>)[answers.q3]) || '—', color: answers.q3 === 'much_better' ? 'text-emerald-400' : answers.q3 === 'worse' ? 'text-red-400' : 'text-white' },
      { label: 'Al despertar', value: (({ rested: 'Descansado', okay: 'Algo cansado', tired: 'Cansado', exhausted: 'Agotado' } as Record<string,string>)[answers.q_quality]) || '—', color: answers.q_quality === 'rested' ? 'text-emerald-400' : answers.q_quality === 'exhausted' ? 'text-red-400' : 'text-[#7B9CFF]' },
      { label: 'Durmió en sesión', value: answers.q1b === 'yes' ? 'Sí ✓' : 'No', color: answers.q1b === 'yes' ? 'text-emerald-400' : 'text-gray-400' },
    ];
  } else {
    if (answers.qd1 === 'much_better') score += 2;
    else if (answers.qd1 === 'better') score += 1;
    else if (answers.qd1 === 'worse') score -= 2;
    if (answers.qd2 === 'yes') score += 1;
    if (answers.qd3 === 'low') score += 1;
    else if (answers.qd3 === 'high') score -= 1;

    metrics = [
      { label: 'Estado post sesión', value: (({ much_better: 'Excelente', better: 'Mejor', same: 'Igual', worse: 'Peor' } as Record<string,string>)[answers.qd1]) || '—', color: answers.qd1 === 'much_better' ? 'text-emerald-400' : answers.qd1 === 'worse' ? 'text-red-400' : 'text-white' },
      { label: 'Desconexión', value: (({ yes: 'Completa', partial: 'Parcial', no: 'Difícil' } as Record<string,string>)[answers.qd2]) || '—', color: answers.qd2 === 'yes' ? 'text-emerald-400' : answers.qd2 === 'no' ? 'text-amber-400' : 'text-white' },
      { label: 'Ansiedad actual', value: (({ low: 'Baja', moderate: 'Moderada', high: 'Alta' } as Record<string,string>)[answers.qd3]) || '—', color: answers.qd3 === 'low' ? 'text-emerald-400' : answers.qd3 === 'high' ? 'text-red-400' : 'text-amber-400' },
      { label: 'Concentración', value: (({ good: 'Buena', moderate: 'Regular', poor: 'Difícil' } as Record<string,string>)[answers.qd4]) || '—', color: answers.qd4 === 'good' ? 'text-emerald-400' : answers.qd4 === 'poor' ? 'text-red-400' : 'text-white' },
    ];
  }

  let status: string, statusLabel: string, analysis: string, recommendation: string;

  if (score >= 4) {
    status = 'improving';
    statusLabel = 'Progreso excelente';
    analysis = mode === 'night'
      ? 'Tu cerebro está respondiendo muy bien al protocolo binaural. Las ondas cerebrales están sincronizando correctamente durante el sueño, lo que se refleja en la calidad del descanso.'
      : 'El protocolo diurno está generando una respuesta óptima. Tu sistema nervioso autónomo muestra señales claras de regulación.';
    recommendation = 'Mantené la consistencia. Si el progreso continúa 2-3 días más, el sistema ajustará automáticamente la duración para consolidar el avance.';
  } else if (score >= 1) {
    status = 'stable';
    statusLabel = 'Evolución estable';
    analysis = mode === 'night'
      ? 'El tratamiento está actuando dentro de parámetros normales. La adaptación neurológica al estímulo binaural lleva entre 7-14 días en consolidarse.'
      : 'Tu sistema nervioso está respondiendo al protocolo. La regulación del estado de alerta es progresiva.';
    recommendation = 'Continuá con el protocolo actual. La consistencia diaria es el factor más importante en las primeras semanas.';
  } else {
    status = 'warning';
    statusLabel = 'Necesita ajuste';
    analysis = mode === 'night'
      ? 'Tu respuesta al protocolo actual sugiere que puede ser necesario ajustar la carga del estímulo. Esto es normal en las primeras semanas.'
      : 'La respuesta al protocolo diurno indica que el sistema nervioso necesita una estimulación diferente.';
    recommendation = 'Considerá reducir la duración de la sesión o cambiar el horario de uso. El sistema puede ajustar el plan automáticamente.';
  }

  return { status, statusLabel, analysis, recommendation, metrics, score };
}
