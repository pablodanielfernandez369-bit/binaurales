'use client';

import { useEffect, useState, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Play, Pause, Square, Wind, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WaveVisualizer from '@/components/WaveVisualizer';
import { Toast } from '@/components/Toast';
import { useToast } from '@/hooks/useToast';

function SessionContent() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [noiseVolume, setNoiseVolume] = useState(0.05);
  const [completed, setCompleted] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState(false);
  const { toasts, toast, dismiss } = useToast();

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
  const completedRef = useRef(false);

  const stopAudio = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    if (audioCtxRef.current && masterGainRef.current) {
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      const stopDuration = 0.08; // Slightly longer for safe zero-crossing
      
      // Strict Fade-out sequence
      const fadeOutDuration = profile?.plan?.fade_out_ms 
        ? profile.plan.fade_out_ms / 1000 
        : 0.5; // 500ms de fade out por defecto
      masterGainRef.current.gain.cancelScheduledValues(now);
      masterGainRef.current.gain.setValueAtTime(masterGainRef.current.gain.value, now);
      masterGainRef.current.gain.linearRampToValueAtTime(0, now + fadeOutDuration);

      const stopTime = now + fadeOutDuration + 0.02;
      
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
  }, [profile]);

  const handleComplete = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    
    try {
      await stopAudio();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        toast('No se pudo encontrar el usuario. Asegurate de estar logueado.', 'error');
        return;
      }

      setCompleted(true);
      
      const sessionData = {
        user_id: user.id,
        duration_min: profile.plan.duration_min,
        frequency_hz: profile.plan.frequency_hz,
        noise_volume: noiseVolume,
        completed: true,
        completed_at: new Date().toISOString(),
        wave_category: profile.plan.wave_category || 'theta',
        protocol_mode: (profile.plan.wave_category === 'smr' && profile.questionnaire_mode !== 'night') 
          ? 'day' : profile.questionnaire_mode === 'day' ? 'day' : 'night'
      };

      const { error: saveError } = await supabase
        .from('sessions')
        .insert(sessionData);

      if (saveError) {
        console.error('[Session] Error saving row:', saveError);
        toast(`No se pudo guardar la sesión [${saveError.code}]: ${saveError.message}`, 'error');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[Session] Unexpected error:', err);
      toast(`Error inesperado al finalizar: ${message}`, 'error');
    }
  }, [profile, noiseVolume, stopAudio]);

  // 1. Profile Loading
  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push('/login'); return; }

      // Primero verificar modo both — tiene prioridad visual
      const { data: profileData } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', authUser.id)
        .single();

      if (profileData?.questionnaire_mode === 'both' && profileData?.plan_day) {
        setProfile(profileData);
        setTimeLeft(profileData.plan.duration_min * 60);
        setShowPlanSelector(true);
        setLoading(false);
        return;
      }

      // Si hay plan calibrado activo, usarlo
      const { data: activePlans } = await supabase
        .from('treatment_plans')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_active', true)
        .limit(1);

      let currentPlan: any = null;
      if (activePlans && activePlans.length > 0) {
        const plan = activePlans[0];
        currentPlan = {
          ...plan,
          frequency_hz: plan.frequency_hz ?? plan.beat_hz ?? plan.theta_beat_hz ?? 4.5,
          wave_type: plan.wave_type || 'Calibrado',
          wave_category: plan.wave_category || 'theta'
        };
      } else if (profileData?.plan) {
        currentPlan = {
          ...profileData.plan,
          wave_category: profileData.plan.wave_category || 'theta'
        };
      }

      if (!currentPlan) { router.push('/'); return; }
      setProfile({ plan: currentPlan });
      setTimeLeft(currentPlan.duration_min * 60);
      setLoading(false);
    }
    init();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        try {
          if (oscRef.current) {
            try { oscRef.current.l.stop(); oscRef.current.r.stop(); } catch { /* already stopped */ }
            oscRef.current = null;
          }
          if (noiseNodeRef.current) {
            try { noiseNodeRef.current.disconnect(); } catch { /* already disconnected */ }
            noiseNodeRef.current = null;
          }
          audioCtxRef.current.close();
          audioCtxRef.current = null;
        } catch { /* best-effort cleanup */ }
      }
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
    // Limpiar nodos anteriores si existen
    if (oscRef.current) {
      try { oscRef.current.l.stop(); oscRef.current.r.stop(); } catch {}
      oscRef.current = null;
    }
    if (noiseNodeRef.current) {
      try { noiseNodeRef.current.disconnect(); } catch {}
      noiseNodeRef.current = null;
    }

    const ctx = audioCtxRef.current!;
    const plan = profile.plan || profile; 
    const now = ctx.currentTime;

    // Frecuencia base según categoría de onda
    // Delta y Theta usan portadora baja (100Hz) para mayor profundidad
    // Alpha/SMR usan portadora media (200Hz) estándar
    function getCarrierFreq(wave_category: string): number {
      switch (wave_category) {
        case 'delta':       return 200;
        case 'theta':       return 250;
        case 'alpha_theta': return 300;
        case 'alpha':       return 350;
        case 'smr':         return 400;
        default:            return 250;
      }
    }

    // Validación defensiva — nunca llegar al oscilador con undefined
    const beatFreq: number = typeof plan.frequency_hz === 'number' && plan.frequency_hz > 0
      ? plan.frequency_hz
      : 4.5; // fallback seguro: Theta Profunda

    const carrierFreq: number = getCarrierFreq(plan.wave_category);

    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();

    oscL.type = 'sine';
    oscL.frequency.setValueAtTime(carrierFreq, now);
    panL.pan.setValueAtTime(-1, now); // 100% izquierdo

    oscR.type = 'sine';
    oscR.frequency.setValueAtTime(carrierFreq + beatFreq, now); // el diferencial ES el batido
    panR.pan.setValueAtTime(1, now); // 100% derecho

    const defaultGainByCategory: Record<string, number> = {
      delta: 0.08, theta: 0.12, alpha_theta: 0.10, alpha: 0.11, smr: 0.14
    };
    const defaultMasterGainByCategory: Record<string, number> = {
      delta: 0.40, theta: 0.45, alpha_theta: 0.42, alpha: 0.43, smr: 0.48
    };

    const oscGainValue = plan.theta_gain || defaultGainByCategory[plan.wave_category] || 0.12;
    const masterGainValue = plan.master_gain || defaultMasterGainByCategory[plan.wave_category] || 0.45;

    if (!muteOsc) {
      const oscGain = ctx.createGain();
      oscGain.gain.setValueAtTime(oscGainValue, now);
      oscL.connect(panL).connect(oscGain).connect(masterGainRef.current!);
      oscR.connect(panR).connect(oscGain).connect(masterGainRef.current!);
    }

    oscRef.current = { l: oscL, r: oscR };

    // Ruido de fondo adaptado por onda
    // Delta: ruido marrón suave (más grave, más envolvente)
    // SMR: ruido más bajo para no interferir con la frecuencia
    const noiseNode = new AudioWorkletNode(ctx, 'brown-noise-processor');
    const noiseGain = ctx.createGain();
    
    // Si el usuario no tocó el slider, usar valor por defecto según onda
    const defaultNoiseByCategory: Record<string, number> = {
      delta: 0.08,
      theta: 0.05,
      alpha_theta: 0.04,
      alpha: 0.04,
      smr: 0.03,
    };
    const effectiveNoise = noiseVolume === 0.05 
      ? (defaultNoiseByCategory[plan.wave_category] || 0.05)
      : noiseVolume;

    noiseGain.gain.setValueAtTime(effectiveNoise, now);
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

    // Fade-in adaptado: Delta más lento, SMR más rápido
    const fadeInSec = (plan.fade_in_ms || 150) / 1000;
    const masterGainGain = masterGainRef.current!.gain;
    masterGainGain.cancelScheduledValues(now);
    masterGainGain.setValueAtTime(0, now);
    masterGainGain.linearRampToValueAtTime(masterGainValue, now + fadeInSec);
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
        setTimeLeft(p => {
          if (p <= 1) {
            clearInterval(timerRef.current!);
            handleComplete();
            return 0;
          }
          return p - 1;
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

  if (showPlanSelector && profile?.plan_day) {
    function getSuggestedProtocol(): 'night' | 'day' {
      const hour = new Date().getHours();
      return (hour >= 18 || hour < 7) ? 'night' : 'day';
    }
    const suggested = getSuggestedProtocol();

    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          className="w-full max-w-md space-y-6 text-center"
        >
          <div className="space-y-2 mb-8">
            <p className="text-xs text-[#7B9CFF] uppercase tracking-widest">Plan Dual Premium</p>
            <h2 className="text-3xl font-light text-white">¿Qué protocolo usás hoy?</h2>
          </div>
          
          <button
            onClick={() => { 
              // profile ya tiene .plan por defecto
              setTimeLeft(profile.plan.duration_min * 60); 
              setShowPlanSelector(false); 
            }}
            className="w-full p-6 rounded-3xl bg-[#4B2C69]/10 border border-white/5 hover:border-[#7B9CFF]/30 transition-all text-left space-y-2 group"
          >
            <div className="flex items-center gap-2 text-[#7B9CFF] group-hover:scale-105 transition-transform">
              <Moon size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">Protocolo Nocturno</span>
              {suggested === 'night' && (
                <span className="text-[10px] bg-[#7B9CFF]/20 text-[#7B9CFF] px-2 py-0.5 rounded-full border border-[#7B9CFF]/30 ml-auto">
                  ✦ Te toca esta
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{profile.plan.wave_type} · {profile.plan.frequency_hz} Hz · {profile.plan.ideal_time}</p>
          </button>
          
          <button
            onClick={() => {
              setProfile((prev: any) => ({ ...prev, plan: prev.plan_day }));
              setTimeLeft(profile.plan_day.duration_min * 60);
              setShowPlanSelector(false);
            }}
            className="w-full p-6 rounded-3xl bg-amber-500/5 border border-amber-500/10 hover:border-amber-500/30 transition-all text-left space-y-2 group"
          >
            <div className="flex items-center gap-2 text-amber-400 group-hover:scale-105 transition-transform">
              <Sun size={18} />
              <span className="text-sm font-medium uppercase tracking-wider">Protocolo Diurno</span>
              {suggested === 'day' && (
                <span className="text-[10px] bg-amber-400/20 text-amber-400 px-2 py-0.5 rounded-full border border-amber-400/30 ml-auto">
                  ✦ Te toca esta
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500">{profile.plan_day.wave_type} · {profile.plan_day.frequency_hz} Hz · {profile.plan_day.ideal_time}</p>
          </button>

          <p className="text-[10px] text-gray-600 uppercase tracking-tighter pt-4">
            Podés cambiar de protocolo al reiniciar la sesión
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-24 pt-12">
      <Toast toasts={toasts} onDismiss={dismiss} />
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

              <div className="bg-[#4B2C69]/10 border border-white/5 rounded-3xl p-8 space-y-3 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Protocolo</span>
                  <span className="text-[#7B9CFF] font-medium">{profile.plan.wave_type}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Frecuencia</span>
                  <span className="text-white">{profile.plan.frequency_hz} Hz</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duración</span>
                  <span className="text-white">{profile.plan.duration_min} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Indicado para</span>
                  <span className="text-white text-right text-xs max-w-[60%]">{profile.plan.description}</span>
                </div>
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
                {showVisualizer && <WaveVisualizer 
              isPlaying={isPlaying} 
              frequency={profile.plan.frequency_hz}
              waveCategory={profile.plan.wave_category}
            />}
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
                    onClick={handleComplete}
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
            
            {debugMode && profile && (
              <div className="mt-4 bg-black/40 rounded-2xl p-4 text-left space-y-2 font-mono text-xs">
                <p className="text-[#7B9CFF] font-bold mb-2">── Audio Debug ──</p>
                <p className="text-gray-300">Onda: <span className="text-white">{profile.plan.wave_category}</span></p>
                <p className="text-gray-300">Portadora L: <span className="text-white">
                  {profile.plan.wave_category === 'delta' ? 200 :
                   profile.plan.wave_category === 'theta' ? 250 :
                   profile.plan.wave_category === 'alpha_theta' ? 300 :
                   profile.plan.wave_category === 'alpha' ? 350 : 400} Hz
                </span></p>
                <p className="text-gray-300">Portadora R: <span className="text-emerald-400">
                  {(profile.plan.wave_category === 'delta' ? 200 :
                    profile.plan.wave_category === 'theta' ? 250 :
                    profile.plan.wave_category === 'alpha_theta' ? 300 :
                    profile.plan.wave_category === 'alpha' ? 350 : 400) + profile.plan.frequency_hz} Hz
                </span></p>
                <p className="text-gray-300">Beat binaural: <span className="text-emerald-400 font-bold">{profile.plan.frequency_hz} Hz</span></p>
                <p className="text-gray-300">Master gain: <span className="text-white">{profile.plan.master_gain || 0.45}</span></p>
                <p className="text-gray-300">Osc gain: <span className="text-white">{profile.plan.theta_gain || 0.12}</span></p>
                <p className="text-gray-300">Noise vol: <span className="text-white">{noiseVolume}</span></p>
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
