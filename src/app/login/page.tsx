'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Send, Loader2, ShieldCheck, AlertCircle, Brain } from 'lucide-react';
import { useEffect } from 'react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setStatus('loading');
    setMessage('');

    try {
      const response = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('¡Link enviado! Revisa tu email para entrar.');
      } else {
        setStatus('error');
        setMessage(data.error || 'Error al intentar ingresar.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('Error de conexión. Intenta de nuevo.');
    }
  };

  // 1. STATIC SHELL (SSR & Initial Client Render)
  // This avoids mismatch #418 by rendering the same structure on both sides.
  const renderContent = () => {
    if (status === 'success') {
      return (
        <div className="text-center space-y-6 py-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto border border-emerald-500/30">
            <ShieldCheck size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-medium text-white">¡Email Enviado!</h2>
            <p className="text-gray-400 text-sm font-light leading-relaxed">
              Hemos enviado un link de acceso seguro a <br/>
              <span className="text-[#7B9CFF] font-medium">{email}</span>
            </p>
          </div>
          <button 
            onClick={() => setStatus('idle')}
            className="text-xs text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
          >
            Intentar con otro email
          </button>
        </div>
      );
    }

    return (
      <form onSubmit={handleLogin} className="space-y-6">
        <div className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input 
              type="email" 
              placeholder="Tu email autorizado"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              <span>Enviar Link de Acceso</span>
              <Send size={18} className="transition-transform group-hover:translate-x-1" />
            </>
          )}
        </button>
      </form>
    );
  };

  // 2. MAIN LAYOUT
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
            // STATIC SHELL (SSR)
            renderContent()
          ) : (
            // ANIMATED CLIENT
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
