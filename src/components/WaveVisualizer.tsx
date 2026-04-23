'use client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

interface WaveVisualizerProps {
  isPlaying: boolean;
  frequency: number;
  waveCategory?: string;
}

export default function WaveVisualizer({ isPlaying, frequency, waveCategory }: WaveVisualizerProps) {
  const [dots, setDots] = useState<number[]>([]);

  useEffect(() => {
    // Generar 20 puntos para la visualización
    setDots(Array.from({ length: 20 }, (_, i) => i));
  }, []);

  // Duración corregida: mapeo más intuitivo y clínico
  const duration = Math.max(0.3, Math.min(4, 8 / frequency));

  // Color por onda
  const waveColor = {
    delta: '#6366f1',      // índigo profundo
    theta: '#7B9CFF',      // azul
    alpha_theta: '#8b5cf6', // violeta
    alpha: '#06b6d4',      // cyan
    smr: '#10b981',        // esmeralda
  }[waveCategory || 'theta'] || '#7B9CFF';

  return (
    <div className="flex items-center justify-center gap-1 h-12 w-full max-w-[200px] mx-auto">
      {dots.map((i) => (
        <motion.div
          key={i}
          className="w-1.5 rounded-full"
          style={{ background: waveColor }}
          animate={isPlaying ? {
            height: [4, 24, 8, 32, 4],
            opacity: [0.3, 0.8, 0.3, 1, 0.3],
          } : {
            height: 4,
            opacity: 0.2,
          }}
          transition={{
            duration: duration,
            repeat: Infinity,
            delay: i * 0.03, // Delay reducido para mayor cohesión
            ease: "easeInOut"
          }}
        />
      ))}
    </div>
  );
}
