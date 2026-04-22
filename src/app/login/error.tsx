'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import Link from 'next/link';

export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Login Route Error:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-[#0A0E1A] text-white">
      <div className="w-full max-w-md text-center space-y-8 bg-[#1A0A0A] border border-red-500/20 p-10 rounded-[40px] backdrop-blur-xl">
        <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto border border-red-500/20">
          <AlertTriangle size={40} />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-2xl font-light tracking-tight">Error en el Login</h1>
          <p className="text-gray-400 font-light text-sm leading-relaxed">
            Se produjo un fallo inesperado al cargar el acceso privado. 
            Esto puede deberse a un problema temporal de conexión o de hidratación.
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={() => reset()}
            className="w-full bg-white/10 hover:bg-white/20 text-white font-medium py-4 rounded-2xl transition-all border border-white/10 flex items-center justify-center gap-3 active:scale-95"
          >
            <RefreshCcw size={18} />
            <span>Reintentar carga</span>
          </button>
          
          <Link
            href="/"
            className="w-full bg-[#7B9CFF]/10 hover:bg-[#7B9CFF]/20 text-[#7B9CFF] font-medium py-4 rounded-2xl transition-all border border-[#7B9CFF]/20 flex items-center justify-center gap-3 active:scale-95"
          >
            <Home size={18} />
            <span>Volver al inicio</span>
          </Link>
        </div>

        <div className="pt-8 border-t border-white/5">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest">
            ID de error: <span className="font-mono text-gray-500">{error.digest || 'no-digest'}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
