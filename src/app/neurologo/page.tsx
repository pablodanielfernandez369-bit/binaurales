'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';
import { Activity, Calendar, CheckCircle2, Clock, Info, TrendingUp, AlertTriangle, Trash2, Moon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, isSameWeek } from 'date-fns';
import { es } from 'date-fns/locale';
import SleepCheckin from '@/components/SleepCheckin';

interface Session {
  id: string;
  completed_at: string;
  completed: boolean;
  duration_min: number;
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
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Required: Get real user
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        router.push('/login');
        return;
      }

      const { data: sessionData, error: dbError } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('completed', true)
        .order('completed_at', { ascending: false });

      if (dbError) {
        console.error('[Neurologo] Database Error:', dbError);
        // Specific message for missing columns (SQL common issue)
        if (dbError.message.includes('completed_at')) {
          setError('Error de Esquema: La tabla sessions no tiene la columna completed_at. Por favor, ejecuta el script SQL de migración.');
        } else {
          setError(`Error de Base de Datos: ${dbError.message}`);
        }
        return;
      }

      if (sessionData) {
        setSessions(sessionData);
        processWeeklyStats(sessionData);
      }
    } catch (err) {
      console.error('[Neurologo] Unexpected error:', err);
      setError('Ocurrió un error inesperado al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    await supabase.from('sessions').delete().eq('id', sessionToDelete);
    setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete));
    setSessionToDelete(null);
  };

  useEffect(() => {
    fetchData();
  }, [router]);

  const processWeeklyStats = (data: Session[]) => {
    const statsMap = new Map<string, WeeklyStat>();

    data.forEach(session => {
      const date = new Date(session.completed_at);
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
      if (session.completed) current.completedCount++;
      current.totalDuration += (session.duration_min * 60);
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
    ? Math.round((sessions.filter(s => s.completed).length / totalSessions) * 100) 
    : 0;

  return (
    <div className="flex min-h-screen flex-col px-6 pt-12 pb-24 max-w-4xl mx-auto space-y-10">
      <header>
        <h1 className="text-3xl font-light text-white mb-2">Panel de Diagnóstico</h1>
        <p className="text-gray-400 font-light">Seguimiento clínico y ajustes de tratamiento.</p>
      </header>

      {/* Sleep Check-in Section */}
      <SleepCheckin />

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
          value={`${Math.round(sessions.reduce((acc, s) => acc + (s.duration_min * 60), 0) / 60)} min`} 
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

      {/* Detailed Session History */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Activity size={20} />
          <h2 className="text-lg font-medium tracking-tight">Historial Detallado</h2>
        </div>
        
        <div className="space-y-3">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between bg-white/5 rounded-2xl p-4 border border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1A1F2E] flex items-center justify-center text-gray-400">
                  <Moon size={14} />
                </div>
                <div>
                  <p className="text-sm text-white">{format(new Date(session.completed_at), "d 'de' MMMM, HH:mm", { locale: es })}</p>
                  <p className="text-[10px] text-gray-500 uppercase">{session.duration_min} min • {session.frequency_hz} Hz</p>
                </div>
              </div>
              <button
                onClick={() => setSessionToDelete(session.id)}
                className="p-2 rounded-xl bg-red-500/5 text-red-400 hover:bg-red-500/20 border border-red-500/10 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Confirmation Modal */}
      {sessionToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0E1A]/90 backdrop-blur-md p-6">
          <div className="bg-[#1A0A0A] border border-red-500/30 p-8 rounded-3xl text-center max-w-sm">
            <Trash2 size={40} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-light text-white mb-2">¿Borrar esta sesión?</h2>
            <p className="text-gray-400 mb-8 font-light text-sm">Esta acción es irreversible.</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleDeleteSession} className="w-full py-3 rounded-xl bg-red-500 text-white font-medium text-sm">Sí, borrar</button>
              <button onClick={() => setSessionToDelete(null)} className="w-full py-3 rounded-xl bg-white/5 text-white font-medium text-sm">Cancelar</button>
            </div>
          </div>
        </div>
      )}
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
