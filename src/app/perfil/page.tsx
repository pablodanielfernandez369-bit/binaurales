'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { User, Activity, Trash2, ChevronRight, Moon, Sun, Brain, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const router = useRouter();

  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.replace('/login');
        return;
      }

      setUserEmail(user.email || null);

      const { data: profileData } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', user.id)
        .single();
      
      const [{ data: sessionsData }, { data: activePlans }] = await Promise.all([
        supabase
          .from('sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('completed', true)
          .order('completed_at', { ascending: false })
          .limit(5),
        supabase
          .from('treatment_plans')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .limit(1),
      ]);

      let mergedProfile = profileData;
      if (profileData && profileData.questionnaire_mode !== 'both' && activePlans?.length) {
        const tp = activePlans[0];
        mergedProfile = {
          ...profileData,
          plan: {
            ...profileData.plan,
            ...tp,
            frequency_hz: tp.frequency_hz ?? tp.beat_hz ?? profileData.plan?.frequency_hz,
          },
        };
      }

      if (mergedProfile) setProfile(mergedProfile);
      if (sessionsData) setSessions(sessionsData);
      setLoading(false);
    }
    fetchData();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh(); // Ensure all server states are cleared
  };

  const handleReset = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('user_profile').delete().eq('id', user.id);
    await supabase.from('sessions').delete().eq('user_id', user.id);
    router.push('/');
  };

  const handleDeleteSession = async () => {
    if (!sessionToDelete) return;
    await supabase.from('sessions').delete().eq('id', sessionToDelete);
    setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete));
    setSessionToDelete(null);
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">Cargando perfil...</div>;

  return (
    <div className="flex min-h-screen flex-col px-6 pt-12 pb-24 max-w-lg mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-8"
      >
        <header className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#4B2C69]/30 flex items-center justify-center text-[#7B9CFF] border border-[#7B9CFF]/20">
            <User size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-light text-white">Mi Perfil</h1>
            <p className="text-[10px] text-[#7B9CFF] uppercase tracking-widest mt-1">
              {userEmail || 'Cargando...'}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="ml-auto px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-gray-400 text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 transition-all font-medium uppercase tracking-widest"
          >
            Log Out
          </button>
        </header>

        {/* Diagnostic Card */}
        <section>
          {profile?.questionnaire_mode === 'both' && profile?.plan_day ? (
            <div className="space-y-4">
              <div className="bg-[#4B2C69]/10 border border-white/5 rounded-3xl p-6">
                <div className="flex items-center gap-2 text-[#7B9CFF] mb-4">
                  <Moon size={16} />
                  <h2 className="text-sm font-medium uppercase tracking-wider">Protocolo Nocturno</h2>
                </div>
                <p className="text-gray-300 font-light text-sm italic mb-4">"{profile?.plan?.description}"</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1">Onda</span>
                    <span className="text-sm font-medium text-white">{profile?.plan?.wave_type}</span>
                  </div>
                  <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1">Frecuencia</span>
                    <span className="text-sm font-medium text-[#7B9CFF]">{profile?.plan?.frequency_hz} Hz</span>
                  </div>
                  <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5 col-span-2">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1">Momento ideal</span>
                    <span className="text-sm font-medium text-white">{profile?.plan?.ideal_time}</span>
                  </div>
                </div>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-3xl p-6">
                <div className="flex items-center gap-2 text-amber-400 mb-4">
                  <Sun size={16} />
                  <h2 className="text-sm font-medium uppercase tracking-wider">Protocolo Diurno</h2>
                </div>
                <p className="text-gray-300 font-light text-sm italic mb-4">"{profile?.plan_day?.description}"</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1">Onda</span>
                    <span className="text-sm font-medium text-white">{profile?.plan_day?.wave_type}</span>
                  </div>
                  <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1">Frecuencia</span>
                    <span className="text-sm font-medium text-amber-400">{profile?.plan_day?.frequency_hz} Hz</span>
                  </div>
                  <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5 col-span-2">
                    <span className="text-[10px] text-gray-500 uppercase block mb-1">Momento ideal</span>
                    <span className="text-sm font-medium text-white">{profile?.plan_day?.ideal_time}</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#4B2C69]/10 border border-white/5 rounded-3xl p-6">
              <div className="flex items-center gap-2 text-[#7B9CFF] mb-4">
                <Brain size={18} />
                <h2 className="text-sm font-medium uppercase tracking-wider">Diagnóstico</h2>
              </div>
              <p className="text-gray-300 font-light leading-relaxed mb-6">
                "{profile?.plan?.description || 'No hay diagnóstico disponible.'}"
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase block mb-1">Onda</span>
                  <span className="text-sm font-medium text-white">{profile?.plan?.wave_type}</span>
                </div>
                <div className="bg-[#0A0E1A]/40 rounded-2xl p-4 border border-white/5">
                  <span className="text-[10px] text-gray-500 uppercase block mb-1">Frecuencia</span>
                  <span className="text-sm font-medium text-[#7B9CFF]">{profile?.plan?.frequency_hz} Hz</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Stats / History */}
        <section>
          <div className="flex items-center gap-2 text-gray-400 mb-4">
              <Activity size={18} />
              <h2 className="text-sm font-medium uppercase tracking-wider">Sesiones Recientes</h2>
            </div>

          {/* Contador por protocolo */}
          {profile?.questionnaire_mode === 'both' ? (
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-[#7B9CFF] mb-1">
                  <Moon size={12} />
                  <p className="text-[10px] uppercase tracking-widest">Nocturnas</p>
                </div>
                <p className="text-xl font-light text-white">
                  {sessions.filter(s => s.protocol_mode !== 'day').length}
                </p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4">
                <div className="flex items-center gap-2 text-amber-400 mb-1">
                  <Sun size={12} />
                  <p className="text-[10px] uppercase tracking-widest">Diurnas</p>
                </div>
                <p className="text-xl font-light text-white">
                  {sessions.filter(s => s.protocol_mode === 'day').length}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-[#4B2C69]/10 border border-white/5 rounded-2xl p-4 mb-4">
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Total sesiones</p>
              <p className="text-xl font-light text-white">{sessions.length}</p>
            </div>
          )}
          <div className="space-y-3">
            {sessions.length > 0 ? (
              sessions.map((session) => (
                <div key={session.id} className="flex items-center justify-between bg-white/5 rounded-2xl p-4 border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1A1F2E] flex items-center justify-center">
                      {session.protocol_mode === 'day'
                        ? <Sun size={13} className="text-amber-400" />
                        : <Moon size={13} className="text-[#7B9CFF]" />}
                    </div>
                    <div>
                      <p className="text-sm text-white">{new Date(session.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</p>
                      <p className="text-[10px] text-gray-500 uppercase">{session.duration_min} min • {session.frequency_hz} Hz</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.completed && (
                      <span className="text-[10px] bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full border border-green-500/20">Completada</span>
                    )}
                    <button
                      onClick={() => setSessionToDelete(session.id)}
                      className="p-2 rounded-xl bg-red-500/5 text-red-400 hover:bg-red-500/20 border border-red-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-gray-600 text-sm italic">Aún no has realizado ninguna sesión.</p>
            )}
          </div>
        </section>

        {/* Danger Zone */}
        <section className="pt-8 border-t border-white/5">
          <button
            onClick={() => setShowConfirmReset(true)}
            className="w-full flex items-center justify-between bg-red-500/5 hover:bg-red-500/10 text-red-400 p-4 rounded-2xl border border-red-500/20 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Trash2 size={18} />
              <span className="text-sm">Reiniciar Cuestionario</span>
            </div>
            <ChevronRight size={18} />
          </button>
          <p className="mt-2 text-[10px] text-gray-600 text-center uppercase tracking-tighter">
            Esto borrará permanentemente tu diagnóstico y progreso.
          </p>
        </section>
      </motion.div>

      {/* Confirmation Modal */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0E1A]/90 backdrop-blur-md p-6">
          <div className="bg-[#1A0A0A] border border-red-500/30 p-8 rounded-3xl text-center max-w-sm">
            <ShieldAlert size={48} className="mx-auto text-red-500 mb-4" />
            <h2 className="text-2xl font-light text-white mb-2">¿Estás seguro?</h2>
            <p className="text-gray-400 mb-8 font-light text-sm">Esta acción es irreversible y tendrás que completar el cuestionario inicial nuevamente.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleReset}
                className="w-full py-3 rounded-xl bg-red-500 text-white font-medium transition-transform active:scale-95 text-sm"
              >
                Sí, borrar todo
              </button>
              <button
                onClick={() => setShowConfirmReset(false)}
                className="w-full py-3 rounded-xl bg-white/5 text-white font-medium transition-transform active:scale-95 text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

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
