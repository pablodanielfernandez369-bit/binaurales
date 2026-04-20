'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase, FIXED_USER_ID } from '@/lib/supabase';
import { Play, Pause, Square, Wind, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import WaveVisualizer from '@/components/WaveVisualizer';

export default function SessionPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [noiseVolume, setNoiseVolume] = useState(0.5);
  const [completed, setCompleted] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<{ l: OscillatorNode; r: OscillatorNode } | null>(null);
  const noiseRef = useRef<AudioBufferSourceNode | null>(null);
  const noiseGainRef = useRef<GainNode | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    async function fetchProfile() {
      const { data } = await supabase
        .from('user_profile')
        .select('*')
        .eq('id', FIXED_USER_ID)
        .single();
      
      if (data) {
        setProfile(data);
        setTimeLeft(data.plan.duration_min * 60);
        if (data.noise_volume !== undefined) {
          setNoiseVolume(data.noise_volume);
        }
      }
      setLoading(false);
    }
    fetchProfile();

    return () => stopAudio();
  }, []);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      audioCtxRef.current = new AudioContextClass();
    }

    const ctx = audioCtxRef.current!;
    const plan = profile.plan;

    // oscillators
    const oscL = ctx.createOscillator();
    const oscR = ctx.createOscillator();
    const panL = ctx.createStereoPanner();
    const panR = ctx.createStereoPanner();
    
    oscL.frequency.value = 200;
    oscR.frequency.value = 200 + plan.frequency_hz;
    
    panL.pan.value = -1;
    panR.pan.value = 1;

    const masterGain = ctx.createGain();
    masterGain.gain.value = 0.5;

    oscL.connect(panL).connect(masterGain);
    oscR.connect(panR).connect(masterGain);
    masterGain.connect(ctx.destination);

    oscRef.current = { l: oscL, r: oscR };

    // White Noise
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = noiseVolume;
    noiseGainRef.current = noiseGain;

    noiseSource.connect(noiseGain).connect(ctx.destination);
    noiseRef.current = noiseSource;

    oscL.start();
    oscR.start();
    noiseSource.start();
  };

  const stopAudio = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (oscRef.current) {
      oscRef.current.l.stop();
      oscRef.current.r.stop();
    }
    if (noiseRef.current) {
      noiseRef.current.stop();
    }
    setIsPlaying(false);
  };

  const togglePlay = async () => {
    if (isPlaying) {
      stopAudio();
    } else {
      if (audioCtxRef.current?.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      initAudio();
      setIsPlaying(true);
      
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
  };

  const handleComplete = async () => {
    stopAudio();
    setCompleted(true);
    
    // Save session
    await supabase.from('sessions').insert({
      user_id: FIXED_USER_ID,
      duration_min: profile.plan.duration_min,
      frequency_hz: profile.plan.frequency_hz,
      noise_volume: noiseVolume,
      completed: true
    });
  };

  const handleNoiseChange = (val: number) => {
    setNoiseVolume(val);
    if (noiseGainRef.current) {
      noiseGainRef.current.gain.setTargetAtTime(val, audioCtxRef.current!.currentTime, 0.1);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) return <div className="flex min-h-screen items-center justify-center">Cargando tratamiento...</div>;
  if (!profile) return <div className="flex min-h-screen items-center justify-center">Error al cargar el perfil.</div>;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 pb-24 pt-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg text-center"
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
          <WaveVisualizer isPlaying={isPlaying} frequency={profile.plan.frequency_hz} />
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
            
            {isPlaying && (
              <button
                onClick={stopAudio}
                className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center text-white border border-white/10"
              >
                <Square size={20} />
              </button>
            )}
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
                  onClick={() => setCompleted(false)}
                  className="w-full py-3 rounded-xl bg-[#7B9CFF] text-[#0A0E1A] font-medium transition-transform active:scale-95"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
