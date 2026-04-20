'use client';

import { useEffect, useRef } from 'react';

interface WaveVisualizerProps {
  isPlaying: boolean;
  frequency: number;
}

export default function WaveVisualizer({ isPlaying, frequency }: WaveVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;
    let offset = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (isPlaying) {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#7B9CFF';

        const amplitude = 40;
        const speed = 0.05 + (frequency / 200); // Speed changes slightly with frequency

        for (let x = 0; x < canvas.width; x++) {
          const y = (canvas.height / 2) + Math.sin(x * 0.02 + offset) * amplitude;
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }

        ctx.stroke();

        // Second wave for depth (violet)
        ctx.beginPath();
        ctx.strokeStyle = '#4B2C69';
        for (let x = 0; x < canvas.width; x++) {
          const y = (canvas.height / 2) + Math.sin(x * 0.015 + offset * 0.8 + 1) * (amplitude * 0.7);
          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();

        offset += speed;
      } else {
        // Flat line when not playing
        ctx.beginPath();
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(123, 156, 255, 0.2)';
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }

      animationFrame = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying, frequency]);

  return (
    <div className="w-full h-40 flex items-center justify-center overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={160}
        className="w-full max-w-lg opacity-80"
      />
    </div>
  );
}
