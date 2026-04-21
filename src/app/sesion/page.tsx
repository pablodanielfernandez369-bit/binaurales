'use client';

import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Play, Pause, Square, Wind, Volume2, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WaveVisualizer from '@/components/WaveVisualizer';

function SessionContent() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [noiseVolume, setNoiseVolume] = useState(0.05);
  const [completed, setCompleted] = useState(false);
  
  // Debug Flags
  const searchParams = useSearchParams();
  const isDebugRequested = searchParams.get('debug') === '1';
  const [debugMode, setDebugMode] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [muteOsc, setMuteOsc] = useState(false);
  const [muteNoise, setMuteNoise] = useState(false);
  
  const router = useRouter();

  // Audio Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const oscRef = useRef<{ l: OscillatorNode; r: OscillatorNode } | null>(null);
  const noiseNodeRef = useRef<AudioWorkletNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const workletLoadedRef = useRef<Promise<void> | null>(null);
  
  // Logic Refs
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const stopAudio = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (audioCtxRef.current && masterGainRef.current) {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const stopDuration = 0.08; // Slightly longer for safe zero-crossing
      
      // Strict Fade-out sequence
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, now);
      masterGainRef.current.gain.linearRampToValueAtTime(0, now + stopDuration);

      const stopTime = now + stopDuration + 0.02;
      
      if (oscRef.current) {
        oscRef.current.l.stop(stopTime);
        oscRef.current.r.stop(stopTime);
        oscRef.current.l.onended = () => {
          oscRef.current?.l.disconnect();
          oscRef.current?.r.disconnect();
          oscRef.current = null;
        };
      }
      
      if (noiseNodeRef.current) {
        setTimeout(() => {
          noiseNodeRef.current?.disconnect();
          noiseGainRef.current?.disconnect();
          noiseNodeRef.current = null;
        }, stopDuration * 1000 + 50);
      }
    }
    
    setIsPlaying(false);
  }, []);

  const handleComplete = useCallback(async () => {
    await stopAudio();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setCompleted(true);
    await supabase.from('sessions').insert({
      user_id: user.id,
      duration_min: profile.plan.duration_min,
      frequency_hz: profile.plan.frequency_hz,
      noise_volume: noiseVolume,
      completed: true
    });
  }, [profile, noiseVolume, stopAudio]);

  // 1. Profile Loading
  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (!authUser) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', authUser.id)
        .single();
      
      if (!profileData) {
        router.push('/');
        return;
      }

      setProfile(profileData);
      setTimeLeft(profileData.plan.duration_min * 60);
      if (profileData.noise_volume !== undefined) {
        setNoiseVolume(profileData.noise_volume);
      }
      setLoading(false);
    }
    init();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [router]);

  const initAudioContext = async () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      // Latency Hint: 'playback' for glitch-free stability
      audioCtxRef.current = new AudioContextClass({ latencyHint: 'playback' });
      
      const masterGain = audioCtxRef.current.createGain();
      masterGain.gain.value = 0; 
      masterGain.connect(audioCtxRef.current.destination);
      masterGainRef.current = masterGain;

      if (!workletLoadedRef.current) {
        workletLoadedRef.current = audioCtxRef.current.audioWorklet.addModule('/audio/noise-processor.js');
      }
      await workletLoadedRef.current;
    }
  };

  const startAudioGraph = async () => {
    const ctx = audioCtxRef.current!;
    const plan = profile.plan;
    const now = ctx.currentTime;

    // --- Oscillators (Theta Fix) ---
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    
    // Using setTargetAtTime for smooth initial frequency set
    oscL.frequency.setValueAtTime(200, now);
    oscR.frequency.setValueAtTime(200 + plan.frequency_hz, now);
    
    panL.pan.setValueAtTime(-1, now);
    panR.pan.setValueAtTime(1, now);

    if (!muteOsc) {
      oscL.connect(panL).connect(masterGainRef.current!);
      oscR.connect(panR).connect(masterGainRef.current!);
    }
    oscRef.current = { l: oscL, r: oscR };

    // --- Infinite Noise (Worklet) ---
    const noiseNode = new AudioWorkletNode(ctx, 'brown-noise-processor');
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(noiseVolume, now);
    noiseGainRef.current = noiseGain;

    if (!muteNoise) {
      noiseNode.connect(noiseGain).connect(masterGainRef.current!);
    }
    noiseNodeRef.current = noiseNode;

    // --- Click Detector (Monitor) ---
    if (isDebugRequested && debugMode) {
      const analyser = ctx.createAnalyser();
      masterGainRef.current!.connect(analyser);
      const monitorData = new Float32Array(analyser.fftSize);
      const checkClick = () => {
        if (!audioCtxRef.current || audioCtxRef.current.state === 'closed' || !isPlaying) return;
        analyser.getFloatTimeDomainData(monitorData);
        for (let i = 1; i < monitorData.length; i++) {
          const delta = Math.abs(monitorData[i] - monitorData[i-1]);
          if (delta > 0.2) {
            console.warn(`[ClickDetector] ALERT at ${ctx.currentTime.toFixed(2)}s | Delta: ${delta.toFixed(3)}`);
            break;
          }
        }
        if (isPlaying) requestAnimationFrame(checkClick);
      };
      checkClick();
    }

    oscL.start(now);
    oscR.start(now);

    // Final Fade-in Sequence
    const masterGainGain = masterGainRef.current!.gain;
    masterGainGain.cancelScheduledValues(now);
    masterGainGain.setValueAtTime(0, now);
    masterGainGain.linearRampToValueAtTime(0.5, now + 0.15);
  };

  const togglePlay = useCallback(async () => {
    setLoading(true);
    await initAudioContext();
    const ctx = audioCtxRef.current!;

    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    if (!hasStarted) {
      setHasStarted(true);
    }

    if (isPlaying) {
      await stopAudio();
      setLoading(false);
    } else {
      await startAudioGraph();
      setIsPlaying(true);
      setLoading(false);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [isPlaying, hasStarted, handleComplete, stopAudio]);

  const handleNoiseChange = (val: number) => {
    setNoiseVolume(val);
    if (noiseGainRef.current && audioCtxRef.current) {
      const now = audioCtxRef.current.currentTime;
      noiseGainRef.current.gain.cancelScheduledValues(now);
      noiseGainRef.current.gain.setTargetAtTime(val, now, 0.1);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center text-[#7B9CFF]">Sincronizando Ondas...</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-24 pt-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg text-center"
      >
        <AnimatePresence mode="wait">
          {!hasStarted ? (
            <motion.div
              key="intro"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="space-y-8"
            >
              <div>
                <span className="px-3 py-1 rounded-full bg-[#4B2C69]/30 text-[#7B9CFF] text-xs font-medium uppercase tracking-widest border border-[#7B9CFF]/20">
                  Plan Personalizado
                </span>
                <h1 className="mt-4 text-4xl font-light tracking-tight text-white leading-tight">
                  ¿Listo para tu <br/> <span className="text-[#7B9CFF]">descanso profundo?</span>
                </h1>
              </div>

              <div className="bg-[#4B2C69]/10 border border-white/5 rounded-3xl p-8 space-y-6 text-left">
                <div className="flex items-center gap-4 text-gray-300">
                  <div className="w-10 h-10 rounded-xl bg-[#0A0E1A] flex items-center justify-center text-[#7B9CFF]">
                    <Brain size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Frecuencia de Onda</p>
                    <p className="text-sm font-medium">{profile.plan.wave_type} ({profile.plan.frequency_hz} Hz)</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 text-gray-300">
                  <div className="w-10 h-10 rounded-xl bg-[#0A0E1A] flex items-center justify-center text-[#7B9CFF]">
                    <Volume2 size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase tracking-widest">Duración Estimada</p>
                    <p className="text-sm font-medium">{profile.plan.duration_min} Minutos</p>
                  </div>
                </div>

                <p className="text-sm text-gray-400 font-light leading-relaxed border-t border-white/5 pt-4">
                  Recomendación: Asegúrate de estar en un lugar tranquilo y usar auriculares para el efecto binaural.
                </p>
              </div>

              <button
                onClick={togglePlay}
                className="w-full py-5 rounded-2xl bg-[#7B9CFF] text-[#0A0E1A] font-medium text-lg shadow-xl shadow-[#7B9CFF]/20 transition-transform active:scale-95 flex items-center justify-center gap-2"
              >
                <Play size={20} fill="currentColor" />
                Iniciar Sesión
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="player"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full"
            >
              <div className="mb-8">
                <span className="px-3 py-1 rounded-full bg-[#4B2C69]/30 text-[#7B9CFF] text-xs font-medium uppercase tracking-widest border border-[#7B9CFF]/20">
                  Tratamiento {profile.plan.wave_type}
                </span>
                <h1 className="mt-4 text-3xl font-light tracking-tight text-white">
                  Tu Sesión de Descanso
                </h1>
                <p className="mt-2 text-gray-400 font-light italic">
                  "{profile.plan.description}"
                </p>
              </div>

              <div className="relative mb-12 flex flex-col items-center justify-center">
                <div className="text-6xl font-extralight tracking-tighter text-[#7B9CFF] mb-4">
                  {formatTime(timeLeft)}
                </div>
                {showVisualizer && <WaveVisualizer isPlaying={isPlaying} frequency={profile.plan.frequency_hz} />}
              </div>

              <div className="space-y-8 w-full px-8">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={togglePlay}
                    className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 ${
                      isPlaying 
                      ? 'bg-[#4B2C69] text-white shadow-lg shadow-[#4B2C69]/40' 
                      : 'bg-[#7B9CFF] text-[#0A0E1A] shadow-lg shadow-[#7B9CFF]/40'
                    }`}
                  >
                    {isPlaying ? <Pause size={32} /> : <Play size={32} className="ml-1" />}
                  </button>
                  
                  <button
                    onClick={() => {
                      stopAudio();
                      setHasStarted(false);
                      setTimeLeft(profile.plan.duration_min * 60);
                    }}
                    className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10"
                  >
                    <Square size={20} />
                  </button>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs text-gray-500 uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                      <Wind size={14} />
                      <span>Ruido Blanco</span>
                    </div>
                    <span>{Math.round(noiseVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="1" 
                    step="0.01"
                    value={noiseVolume}
                    onChange={(e) => handleNoiseChange(parseFloat(e.target.value))}
                    className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-[#7B9CFF]"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {completed && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0A0E1A]/90 backdrop-blur-md p-6"
            >
              <div className="bg-[#4B2C69]/20 border border-[#7B9CFF]/30 p-8 rounded-3xl text-center max-w-sm">
                <h2 className="text-2xl font-light text-[#7B9CFF] mb-2">Sesión Completada</h2>
                <p className="text-gray-300 mb-8 font-light">Tu cerebro ha recibido el estímulo necesario. Que tengas un buen descanso.</p>
                <button
                  onClick={() => {
                    setCompleted(false);
                    setHasStarted(false);
                    router.push('/perfil');
                  }}
                  className="w-full py-3 rounded-xl bg-[#7B9CFF] text-[#0A0E1A] font-medium transition-transform active:scale-95"
                >
                  Ver Progreso
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Diagnostic Menu - Hidden behind ?debug=1 */}
        {isDebugRequested && (
          <div className="mt-12 pt-8 border-t border-white/5 opacity-50 hover:opacity-100 transition-opacity">
            <button 
              onClick={() => setDebugMode(!debugMode)}
              className="text-[10px] text-gray-500 uppercase tracking-widest mb-4"
            >
              {debugMode ? 'OCULTAR DIAGNÓSTICO' : 'MODO DIAGNÓSTICO'}
            </button>
            
            {debugMode && (
              <div className="flex flex-col gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Visualizador Activo</span>
                  <input type="checkbox" checked={showVisualizer} onChange={(e) => setShowVisualizer(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Silenciar Binaural</span>
                  <input type="checkbox" checked={muteOsc} onChange={(e) => setMuteOsc(e.target.checked)} />
                </label>
                <label className="flex items-center justify-between text-xs text-gray-400">
                  <span>Silenciar Ruido</span>
                  <input type="checkbox" checked={muteNoise} onChange={(e) => setMuteNoise(e.target.checked)} />
                </label>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando...</div>}>
      <SessionContent />
    </Suspense>
  );
}
