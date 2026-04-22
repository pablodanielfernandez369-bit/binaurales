'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, ShieldCheck, AlertCircle, Brain, Send } from 'lucide-react';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    if (password !== confirmPassword) {
      setStatus('error');
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    setStatus('loading');
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      setStatus('success');
      setMessage('Tu contraseña ha sido actualizada correctamente.');
      setTimeout(() => {
        router.push('/sesion');
      }, 2000);
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Error al actualizar la contraseña. Revisa que el link sea válido.');
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#0A0E1A]">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-[#7B9CFF]/10 flex items-center justify-center text-[#7B9CFF] mx-auto mb-6 border border-[#7B9CFF]/20 shadow-2xl shadow-[#7B9CFF]/10">
            <Brain size={40} />
          </div>
          <h1 className="text-3xl font-light text-white tracking-tight">Nueva Contraseña</h1>
          <p className="text-gray-400 mt-2 font-light">Binaural Sleep • Clinical Prototype</p>
        </div>

        <div className="bg-[#4B2C69]/10 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl shadow-2xl overflow-hidden">
          {status === 'success' ? (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/30">
                <ShieldCheck size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-medium text-white">¡Actualizada!</h2>
                <p className="text-gray-400 text-sm font-light leading-relaxed">
                  {message} Redirigiendo a tu sesión...
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleReset} className="space-y-6">
              <div className="space-y-4">
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="password" 
                    placeholder="Nueva contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-[#0A0E1A]/60 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#7B9CFF]/50 transition-all font-light"
                  />
                </div>

                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <input 
                    type="password" 
                    placeholder="Confirmar nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-[#0A0E1A]/60 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#7B9CFF]/50 transition-all font-light"
                  />
                </div>
              </div>

              {status === 'error' && (
                <div className="flex items-center gap-3 text-red-400 bg-red-400/5 p-4 rounded-2xl border border-red-400/10 text-xs">
                  <AlertCircle size={16} />
                  <p>{message}</p>
                </div>
              )}

              <button 
                type="submit"
                disabled={status === 'loading'}
                className="w-full bg-[#7B9CFF] hover:bg-[#6A8AFF] text-[#0A0E1A] font-medium py-4 rounded-2xl transition-all shadow-xl shadow-[#7B9CFF]/20 flex items-center justify-center gap-2 group disabled:opacity-70"
              >
                {status === 'loading' ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <span>Actualizar Contraseña</span>
                    <Send size={18} className="transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-8 text-center text-[10px] text-gray-600 uppercase tracking-widest leading-relaxed">
          <p>Tu privacidad es nuestra prioridad.</p>
          <p>Binaural Sleep Data Privacy.</p>
        </div>
      </div>
    </div>
  );
}
