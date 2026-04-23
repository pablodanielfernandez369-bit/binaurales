'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const icons = { success: CheckCircle2, error: XCircle, info: Info };

const styles: Record<ToastType, string> = {
  success: 'bg-emerald-500/10 border-emerald-500/30',
  error: 'bg-red-500/10 border-red-500/30',
  info: 'bg-[#7B9CFF]/10 border-[#7B9CFF]/30',
};

const iconStyles: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-[#7B9CFF]',
};

export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed top-6 right-6 z-[200] flex flex-col gap-2 max-w-xs w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = icons[t.type];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border backdrop-blur-md text-sm ${styles[t.type]}`}
            >
              <Icon size={16} className={`mt-0.5 shrink-0 ${iconStyles[t.type]}`} />
              <p className="flex-1 text-white/90 font-light leading-relaxed">{t.message}</p>
              <button
                onClick={() => onDismiss(t.id)}
                className="shrink-0 text-white/40 hover:text-white/80 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
