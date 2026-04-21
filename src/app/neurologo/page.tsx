'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Activity, Calendar, CheckCircle2, Clock, Info, TrendingUp, AlertTriangle } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';

interface Session {
  id: string;
  started_at: string;
  status: string;
  duration_seconds: number;
  frequency_hz: number;
  symptoms_before: string;
  symptoms_after: string;
}

interface WeeklyStat {
  weekStart: Date;
  sessionsCount: number;
  completedCount: number;
  totalDuration: number;
  avgFrequency: number;
}

export default function NeurologoPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          setError('No se pudo verificar la sesión. Por favor, inicia sesión.');
          return;
        }

        const { data: sessionData, error: dbError } = await supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('started_at', { ascending: false });

        if (dbError) {
          console.error('[Neurologo] Error fetching sessions:', dbError);
          setError('No se pudieron cargar los datos clínicos. Reintenta más tarde.');
          return;
        }

        if (sessionData) {
          setSessions(sessionData);
          processWeeklyStats(sessionData);
        }
      } catch (err) {
        console.error('[Neurologo] Unexpected error:', err);
        setError('Ocurrió un error inesperado al cargar la información.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const processWeeklyStats = (data: Session[]) => {
    const statsMap = new Map<string, WeeklyStat>();

    data.forEach(session => {
      const date = new Date(session.started_at);
      const weekStart = startOfWeek(date, { weekStartsOn: 1 });
      const weekKey = weekStart.toISOString();

      const current = statsMap.get(weekKey) || {
        weekStart,
        sessionsCount: 0,
        completedCount: 0,
        totalDuration: 0,
        avgFrequency: 0
      };

      current.sessionsCount++;
      if (session.status === 'completed') current.completedCount++;
      current.totalDuration += session.duration_seconds;
      current.avgFrequency += session.frequency_hz;

      statsMap.set(weekKey, current);
    });

    const sortedStats = Array.from(statsMap.values()).sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime());
    setWeeklyStats(sortedStats);
  };

  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center space-y-4">
      <div className="w-8 h-8 border-4 border-[#7B9CFF] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-[#7B9CFF] font-light animate-pulse">Cargando datos clínicos...</p>
    </div>
  );

  if (error) return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-red-500/10 flex items-center justify-center text-red-400 border border-red-500/20">
        <AlertTriangle size={32} />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-light text-white">Oops, algo salió mal</h2>
        <p className="text-gray-400 font-light max-w-xs">{error}</p>
      </div>
      <button 
        onClick={() => window.location.reload()}
        className="px-8 py-3 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );

  const totalSessions = sessions.length;

  if (totalSessions === 0) return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-16 h-16 rounded-3xl bg-[#7B9CFF]/10 flex items-center justify-center text-[#7B9CFF] border border-[#7B9CFF]/20">
        <Activity size={32} />
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-light text-white">Sin Registro Clínico</h2>
        <p className="text-gray-400 font-light max-w-xs">Todavía no hay sesiones registradas en tu historial.</p>
      </div>
      <button 
        onClick={() => router.push('/sesion')}
        className="px-8 py-3 rounded-2xl bg-[#7B9CFF] text-[#0A0E1A] font-medium"
      >
        Comenzar Primera Sesión
      </button>
    </div>
  );

  const completionRate = totalSessions > 0 
    ? Math.round((sessions.filter(s => s.status === 'completed').length / totalSessions) * 100) 
    : 0;

  return (
    <div className="flex min-h-screen flex-col px-6 pt-12 pb-24 max-w-4xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-light text-white mb-2">Panel de Diagnóstico</h1>
        <p className="text-gray-400 font-light">Seguimiento clínico y ajustes de tratamiento.</p>
      </header>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          icon={<Activity className="text-blue-400" />} 
          label="Total Sesiones" 
          value={totalSessions.toString()} 
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-400" />} 
          label="Tasa Completado" 
          value={`${completionRate}%`} 
        />
        <StatCard 
          icon={<Clock className="text-purple-400" />} 
          label="Tiempo Total" 
          value={`${Math.round(sessions.reduce((acc, s) => acc + s.duration_seconds, 0) / 60)} min`} 
        />
      </div>

      {/* Weekly Aggregated Table */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-[#7B9CFF]">
          <Calendar size={20} />
          <h2 className="text-lg font-medium tracking-tight">Resumen Semanal</h2>
        </div>
        
        <div className="overflow-hidden rounded-3xl border border-white/5 bg-[#4B2C69]/5">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 text-[10px] uppercase tracking-widest text-gray-500">
                <th className="px-6 py-4 font-medium">Semana</th>
                <th className="px-6 py-4 font-medium text-center">Sesiones</th>
                <th className="px-6 py-4 font-medium text-center">% Éxito</th>
                <th className="px-6 py-4 font-medium text-center">Frec. Media</th>
              </tr>
            </thead>
            <tbody className="text-sm text-gray-300 divide-y divide-white/5">
              {weeklyStats.map((stat, i) => (
                <tr key={i} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap font-light">
                    {format(stat.weekStart, "d 'de' MMM", { locale: es })}
                  </td>
                  <td className="px-6 py-4 text-center">{stat.sessionsCount}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      (stat.completedCount / stat.sessionsCount) > 0.8 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                    }`}>
                      {Math.round((stat.completedCount / stat.sessionsCount) * 100)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center text-[#7B9CFF]">
                    {Math.round((stat.avgFrequency / stat.sessionsCount) * 10) / 10} Hz
                  </td>
                </tr>
              ))}
              {weeklyStats.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 italic font-light">
                    No hay datos suficientes para el análisis semanal.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Diagnostic Tips */}
      <section className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6">
        <div className="flex items-center gap-3 text-emerald-400 mb-2">
          <Info size={18} />
          <h3 className="text-sm font-medium tracking-wide uppercase">Nota de Ajuste</h3>
        </div>
        <p className="text-gray-300 font-light text-sm leading-relaxed">
          Si la tasa de completado cae por debajo del 70%, considere reducir la duración de las sesiones 
          o ajustar la frecuencia base hacia ondas Delta (2-4Hz) para mejorar la tolerancia inicial.
        </p>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
  return (
    <div className="bg-[#4B2C69]/10 border border-white/5 rounded-3xl p-6 flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-[#0A0E1A] flex items-center justify-center">
        {icon}
      </div>
      <div>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</p>
        <p className="text-xl font-medium text-white">{value}</p>
      </div>
    </div>
  );
}
