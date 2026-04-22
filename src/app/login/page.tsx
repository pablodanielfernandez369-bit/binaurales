'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, Loader2, ShieldCheck, AlertCircle, Brain, Lock, UserPlus, LogIn } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    if (mode === 'signup' && password !== confirmPassword) {
      setStatus('error');
      setMessage('Las contraseñas no coinciden.');
      return;
    }

    setStatus('loading');
    setMessage('');

    try {
      if (mode === 'signin') {
        const { error, data } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push('/');
        } else {
          throw new Error('No se pudo iniciar sesión.');
        }
      } else {
        const { error, data } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.session) {
          router.push('/sesion');
        } else {
          setStatus('success');
          setMessage('¡Registro exitoso! Revisa tu email para confirmar tu cuenta si es necesario.');
        }
      }
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Error al procesar la solicitud.');
      console.error('[auth] Error:', err);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setStatus('error');
      setMessage('Por favor, ingresa tu email para enviarte el link de recuperación.');
      return;
    }

    setStatus('loading');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });
      if (error) throw error;
      setStatus('success');
      setMessage('Email de recuperación enviado. Revisa tu bandeja de entrada.');
    } catch (err: any) {
      setStatus('error');
      setMessage(err.message || 'Error al enviar el email de recuperación.');
    }
  };

  const renderContent = () => {
    if (status === 'success') {
      return (
        <div className="text-center space-y-6 py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/30">
            <ShieldCheck size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-medium text-white">¡Link Enviado!</h2>
            <p className="text-gray-400 text-sm font-light leading-relaxed">
              {message}
            </p>
          </div>
          <button 
            onClick={() => {
              setStatus('idle');
              setMode('signin');
            }}
            className="px-8 py-3 rounded-xl bg-[#7B9CFF] text-[#0A0E1A] font-medium text-sm"
          >
            Ir a Iniciar Sesión
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex p-1 bg-[#0A0E1A]/40 rounded-2xl border border-white/5">
          <button 
            onClick={() => { setMode('signin'); setStatus('idle'); }}
            className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${mode === 'signin' ? 'bg-[#7B9CFF] text-[#0A0E1A]' : 'text-gray-500 hover:text-white'}`}
          >
            <LogIn size={14} />
            Iniciar Sesión
          </button>
          <button 
            onClick={() => { setMode('signup'); setStatus('idle'); }}
            className={`flex-1 py-3 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-2 ${mode === 'signup' ? 'bg-[#7B9CFF] text-[#0A0E1A]' : 'text-gray-500 hover:text-white'}`}
          >
            <UserPlus size={14} />
            Registrarse
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="email" 
              placeholder="Tu email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-[#0A0E1A]/60 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#7B9CFF]/50 transition-all font-light"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="password" 
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-[#0A0E1A]/60 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#7B9CFF]/50 transition-all font-light"
            />
          </div>

          {mode === 'signup' && (
            <div className="relative">
              <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
              <input 
                type="password" 
                placeholder="Confirmar contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full bg-[#0A0E1A]/60 border border-white/5 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-gray-600 focus:outline-none focus:border-[#7B9CFF]/50 transition-all font-light"
              />
            </div>
          )}

          {status === 'error' && (
            <div className="flex items-center gap-3 text-red-400 bg-red-400/5 p-4 rounded-2xl border border-red-400/10 text-xs">
              <AlertCircle size={16} />
              <p>{message}</p>
            </div>
          )}

          <div className="pt-2">
            <button 
              type="submit"
              disabled={status === 'loading'}
              className="w-full bg-[#7B9CFF] hover:bg-[#6A8AFF] text-[#0A0E1A] font-medium py-4 rounded-2xl transition-all shadow-xl shadow-[#7B9CFF]/20 flex items-center justify-center gap-2 group disabled:opacity-70"
            >
              {status === 'loading' ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <span>{mode === 'signin' ? 'Ingresar' : 'Crear Cuenta'}</span>
                  <Send size={18} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
          
          {mode === 'signin' && (
            <p 
              onClick={handleForgotPassword}
              className="text-center text-xs text-gray-500 font-light cursor-pointer hover:text-white transition-colors pt-2"
            >
              ¿Olvidaste tu contraseña?
            </p>
          )}
        </form>
      </div>
    );
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#0A0E1A]">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-20 h-20 rounded-3xl bg-[#7B9CFF]/10 flex items-center justify-center text-[#7B9CFF] mx-auto mb-6 border border-[#7B9CFF]/20 shadow-2xl shadow-[#7B9CFF]/10">
            <Brain size={40} />
          </div>
          <h1 className="text-3xl font-light text-white tracking-tight">Acceso Privado</h1>
          <p className="text-gray-400 mt-2 font-light">Binaural Sleep • Clinical Prototype</p>
        </div>

        <div className="bg-[#4B2C69]/10 border border-white/10 rounded-[32px] p-8 backdrop-blur-xl shadow-2xl overflow-hidden min-h-[300px]">
          {!isMounted ? (
            renderContent()
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={status}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          )}
        </div>

        <div className="mt-8 text-center text-[10px] text-gray-600 uppercase tracking-widest leading-relaxed">
          <p>Acceso limitado exclusivamente a personal autorizado.</p>
          <p>Todos los accesos son monitoreados.</p>
        </div>
      </div>
    </div>
  );
}
