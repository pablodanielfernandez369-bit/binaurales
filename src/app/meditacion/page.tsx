'use client';
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Sparkles, Moon, ChevronDown } from 'lucide-react';

const PHASES = [
  { name: 'Relajación', duration: 600, hz: 10, carrier: 350, color: '#7B9CFF', description: 'Calma mental y corporal' },
  { name: 'Descenso', duration: 900, hz: 7, carrier: 300, color: '#8b5cf6', description: 'Estado hipnagógico' },
  { name: 'Proyección', duration: 1200, hz: 4.5, carrier: 250, color: '#6366f1', description: 'Theta profunda' },
];

export default function MeditacionPage() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [currentPhase, setCurrentPhase] = useState(0);
  const [timeLeft, setTimeLeft] = useState(PHASES[0].duration);
  const [totalTimeLeft, setTotalTimeLeft] = useState(2700);
  const [completed, setCompleted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscRef = useRef<{ l: OscillatorNode; r: OscillatorNode } | null>(null);
  const noiseNodeRef = useRef<AudioWorkletNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const phaseRef = useRef(0);

  const stopAudio = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (audioCtxRef.current && masterGainRef.current) {
      const now = audioCtxRef.current.currentTime;
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.linearRampToValueAtTime(0, now + 2);
      setTimeout(() => {
        try { oscRef.current?.l.stop(); oscRef.current?.r.stop(); } catch {}
        try { noiseNodeRef.current?.disconnect(); } catch {}
        oscRef.current = null;
        noiseNodeRef.current = null;
      }, 2100);
    }
    setIsPlaying(false);
  }, []);

  const startPhaseAudio = useCallback(async (phaseIndex: number) => {
    if (!audioCtxRef.current || !masterGainRef.current) return;
    const ctx = audioCtxRef.current;
    const phase = PHASES[phaseIndex];
    const now = ctx.currentTime;

    if (oscRef.current) {
      try {
        oscRef.current.l.stop(now + 3);
        oscRef.current.r.stop(now + 3);
      } catch {}
    }

    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();

    oscL.type = 'sine';
    oscR.type = 'sine';
    oscL.frequency.setValueAtTime(phase.carrier, now);
    oscR.frequency.setValueAtTime(phase.carrier + phase.hz, now);
    panL.pan.setValueAtTime(-1, now);
    panR.pan.setValueAtTime(1, now);

    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.10, now);

    oscL.connect(panL).connect(oscGain).connect(masterGainRef.current);
    oscR.connect(panR).connect(oscGain).connect(masterGainRef.current);

    oscL.start(now);
    oscR.start(now);
    oscRef.current = { l: oscL, r: oscR };

    if (phaseIndex === 0) {
      masterGainRef.current.gain.setValueAtTime(0, now);
      masterGainRef.current.gain.linearRampToValueAtTime(0.45, now + 3);
    }
  }, []);

  const handleComplete = useCallback(async () => {
    await stopAudio();
    setCompleted(true);
  }, [stopAudio]);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          const nextPhase = phaseRef.current + 1;
          if (nextPhase < PHASES.length) {
            phaseRef.current = nextPhase;
            setCurrentPhase(nextPhase);
            setTimeLeft(PHASES[nextPhase].duration);
            startPhaseAudio(nextPhase);
            return PHASES[nextPhase].duration;
          } else {
            clearInterval(timerRef.current!);
            handleComplete();
            return 0;
          }
        }
        return prev - 1;
      });
      setTotalTimeLeft(prev => Math.max(0, prev - 1));
    }, 1000);
  }, [startPhaseAudio, handleComplete]);

  const togglePlay = useCallback(async () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass({ latencyHint: 'playback' });
      const master = audioCtxRef.current.createGain();
      master.gain.value = 0;
      master.connect(audioCtxRef.current.destination);
      masterGainRef.current = master;
      await audioCtxRef.current.audioWorklet.addModule('/audio/noise-processor.js');

      const noise = new AudioWorkletNode(audioCtxRef.current, 'brown-noise-processor');
      const nGain = audioCtxRef.current.createGain();
      nGain.gain.value = 0.04;
      noise.connect(nGain).connect(masterGainRef.current);
      noiseNodeRef.current = noise;
      noiseGainRef.current = nGain;
    }

    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume();
    }

    if (!hasStarted) {
      setHasStarted(true);
      phaseRef.current = 0;
      await startPhaseAudio(0);
      startTimer();
      setIsPlaying(true);
      return;
    }

    if (isPlaying) {
      await stopAudio();
    } else {
      await audioCtxRef.current.resume();
      await startPhaseAudio(phaseRef.current);
      startTimer();
      setIsPlaying(true);
    }
  }, [isPlaying, hasStarted, startPhaseAudio, stopAudio, startTimer]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
  const phase = PHASES[currentPhase];
  const phaseProgress = ((phase.duration - timeLeft) / phase.duration) * 100;

  if (completed) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-6 max-w-md">
          <div className="w-24 h-24 rounded-full bg-[#6366f1]/20 border border-[#6366f1]/30 flex items-center justify-center mx-auto">
            <Sparkles size={40} className="text-[#6366f1]" />
          </div>
          <h2 className="text-2xl font-light text-white">Meditación completada</h2>
          <p className="text-gray-400 text-sm font-light leading-relaxed">
            Tomá unos momentos antes de moverte. Anotá cualquier experiencia que hayas tenido — los recuerdos se desvanecen rápido.
          </p>
          <button
            onClick={() => {
              setCompleted(false);
              setHasStarted(false);
              setCurrentPhase(0);
              setTimeLeft(PHASES[0].duration);
              setTotalTimeLeft(2700);
              phaseRef.current = 0;
              audioCtxRef.current = null;
              masterGainRef.current = null;
            }}
            className="px-8 py-3 bg-[#6366f1] text-white rounded-2xl font-medium">
            Volver a meditar
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-24 pt-12">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-8 text-center">

        {!hasStarted ? (
          <div className="space-y-8">
            <div className="space-y-3">
              <div className="w-20 h-20 rounded-full bg-[#6366f1]/10 border border-[#6366f1]/20 flex items-center justify-center mx-auto">
                <Moon size={36} className="text-[#6366f1]" />
              </div>
              <h1 className="text-3xl font-light text-white">Meditación Profunda</h1>
              <p className="text-gray-500 text-sm font-light">45 minutos · 3 fases progresivas · Proyección astral</p>
            </div>

            <div className="space-y-3">
              {PHASES.map((p, i) => (
                <div key={i} className="flex items-center gap-4 bg-white/5 rounded-2xl p-4 border border-white/5 text-left">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                    style={{ background: `${p.color}30`, border: `1px solid ${p.color}40` }}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium">{p.name}</p>
                    <p className="text-gray-500 text-xs">{p.description} · {p.hz} Hz · {Math.floor(p.duration / 60)} min</p>
                  </div>
                </div>
              ))}
            </div>

            <button onClick={() => setShowInstructions(!showInstructions)}
              className="flex items-center gap-2 text-gray-500 text-xs mx-auto hover:text-white transition-colors">
              Preparación recomendada <ChevronDown size={14} className={showInstructions ? 'rotate-180' : ''} />
            </button>

            <AnimatePresence>
              {showInstructions && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-[#6366f1]/5 border border-[#6366f1]/20 rounded-2xl p-5 text-left space-y-2 overflow-hidden">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    · Usá auriculares — es imprescindible para el efecto binaural<br/>
                    · Acostada, en un lugar oscuro y silencioso<br/>
                    · No comer al menos 2 horas antes<br/>
                    · El mejor horario: al despertar a la madrugada (4-6am) o antes de dormir<br/>
                    · No te duermas — el objetivo es mantener la conciencia<br/>
                    · Si ves imágenes o sentís vibración, es la señal — no te asustes
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={togglePlay}
              className="w-full py-5 rounded-2xl font-medium text-white text-lg shadow-xl flex items-center justify-center gap-3"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', boxShadow: '0 20px 40px rgba(99,102,241,0.3)' }}>
              <Sparkles size={20} /> Comenzar Meditación
            </button>
          </div>
        ) : (
          <div className="space-y-10">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-widest" style={{ color: phase.color }}>
                Fase {currentPhase + 1} de {PHASES.length}
              </p>
              <h2 className="text-2xl font-light text-white">{phase.name}</h2>
              <p className="text-gray-500 text-sm">{phase.description} · {phase.hz} Hz</p>
            </div>

            <div className="relative w-48 h-48 mx-auto">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
                <circle cx="50" cy="50" r="45" fill="none" strokeWidth="2"
                  stroke={phase.color}
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${2 * Math.PI * 45 * (1 - phaseProgress / 100)}`}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 1s linear' }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-4xl font-extralight" style={{ color: phase.color }}>{formatTime(timeLeft)}</p>
                <p className="text-xs text-gray-600 mt-1">esta fase</p>
              </div>
            </div>

            <p className="text-xs text-gray-600">Total restante: {formatTime(totalTimeLeft)}</p>

            <div className="flex gap-2 justify-center">
              {PHASES.map((p, i) => (
                <div key={i} className="h-1 rounded-full transition-all duration-500"
                  style={{
                    width: i === currentPhase ? '48px' : '16px',
                    background: i <= currentPhase ? p.color : 'rgba(255,255,255,0.1)'
                  }} />
              ))}
            </div>

            <button onClick={togglePlay}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto transition-all"
              style={{ background: `${phase.color}20`, border: `2px solid ${phase.color}40` }}>
              {isPlaying
                ? <Pause size={32} style={{ color: phase.color }} />
                : <Play size={32} style={{ color: phase.color }} className="ml-1" />}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
