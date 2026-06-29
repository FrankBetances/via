import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AudioContext,
  AudioManager,
  AudioRecorder,
  AnalyserNode,
  OscillatorNode,
  GainNode,
  StereoPannerNode,
} from 'react-native-audio-api';

/* ==========================================================================
 * AudioEngineProvider — motor de audio compartido de VIA+ v2
 * --------------------------------------------------------------------------
 * Centraliza, en un único AudioContext (Oboe en Android), lo que en v1 estaba
 * disperso en setNoiseMicAdapter / setVoiceMicAdapter / setAudiometryToneAdapter:
 *
 *   · toneAdapter  -> Audiometría Infantil + Condicionada (OscillatorNode+Gain)
 *   · micAdapter   -> Sonómetro + Análisis de Voz (AudioRecorder + AnalyserNode)
 *
 * Degradación: si falta permiso o hardware, `available=false` y cada módulo cae
 * a su modo demo (series/señales deterministas de v1), indicándolo en la UI.
 *
 * Colocar el provider tras GluestackUIProvider en la jerarquía de App.tsx.
 * ========================================================================== */

const SAMPLE_RATE = 48000;

export interface ToneOptions {
  freq: number; // Hz
  dbHL: number; // nivel en dB HL (se traduce a ganancia vía calibración)
  ear: 'right' | 'left';
  durationMs?: number; // def. 1500
  transducer?: 'supraaural' | 'insert' | 'speaker';
}

export interface MicFrame {
  buffer: Float32Array; // PCM mono normalizado (-1..1)
  rms: number;
  numFrames: number;
  when: number;
}

export interface AudioEngine {
  available: boolean;
  micGranted: boolean;
  playTone: (opts: ToneOptions) => Promise<void>;
  stopTone: () => void;
  startMic: (onFrame: (f: MicFrame) => void, opts?: { weightingA?: boolean }) => Promise<boolean>;
  stopMic: () => void;
  getAnalyser: () => AnalyserNode | null;
}

function dbHLtoGain(dbHL: number, _freq: number, _transducer: string): number {
  // Placeholder: mapea linealmente a dBFS y de ahí a ganancia. Reemplazar.
  const dbFS = -90 + dbHL;
  return Math.min(1, Math.pow(10, dbFS / 20));
}

const Ctx = createContext<AudioEngine | null>(null);

export const useAudioEngine = (): AudioEngine => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAudioEngine debe usarse dentro de <AudioEngineProvider>');
  return v;
};

export const AudioEngineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const ctxRef = useRef<AudioContext | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const toneStopRef = useRef<(() => void) | null>(null);

  const [available, setAvailable] = useState(false);
  const [micGranted, setMicGranted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        AudioManager.setAudioSessionOptions({
          iosCategory: 'playAndRecord',
          iosMode: 'measurement',
          iosOptions: ['defaultToSpeaker', 'allowBluetooth'],
        });
        const perm = await AudioManager.requestRecordingPermissions();
        const granted = perm === 'Granted';
        await AudioManager.setAudioSessionActivity(true);

        const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
        if (!mounted) return;
        ctxRef.current = audioCtx;
        setMicGranted(granted);
        setAvailable(true);
      } catch (e) {
        if (mounted) setAvailable(false);
      }
    })();
    return () => {
      mounted = false;
      try {
        toneStopRef.current?.();
        recorderRef.current?.stop();
        ctxRef.current?.close();
      } catch {}
    };
  }, []);

  const playTone = async (opts: ToneOptions): Promise<void> => {
    const ctx = ctxRef.current;
    if (!ctx) throw new Error('AudioContext no disponible');
    toneStopRef.current?.();

    const { freq, dbHL, ear, durationMs = 1500, transducer = 'supraaural' } = opts;
    const now = ctx.currentTime;
    const osc: OscillatorNode = ctx.createOscillator();
    const gain: GainNode = ctx.createGain();
    const panner: StereoPannerNode = ctx.createStereoPanner();

    osc.type = 'sine';
    osc.frequency.value = freq;
    panner.pan.value = ear === 'right' ? 1 : -1;

    const g = dbHLtoGain(dbHL, freq, transducer);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(g, now + 0.02);
    gain.gain.setValueAtTime(g, now + durationMs / 1000 - 0.02);
    gain.gain.linearRampToValueAtTime(0, now + durationMs / 1000);

    osc.connect(gain).connect(panner).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + durationMs / 1000);

    return new Promise<void>(resolve => {
      const stop = () => {
        try { osc.stop(); } catch {}
        try { osc.disconnect(); gain.disconnect(); panner.disconnect(); } catch {}
        toneStopRef.current = null;
        resolve();
      };
      toneStopRef.current = stop;
      setTimeout(stop, durationMs);
    });
  };

  const stopTone = () => toneStopRef.current?.();

  const startMic = async (
    onFrame: (f: MicFrame) => void,
    optsArg?: { weightingA?: boolean },
  ): Promise<boolean> => {
    const ctx = ctxRef.current;
    if (!ctx || !micGranted) return false;

    const recorder = new AudioRecorder({
      sampleRate: SAMPLE_RATE,
      bufferLengthInSamples: Math.round(SAMPLE_RATE * 0.1),
    });
    recorderRef.current = recorder;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyserRef.current = analyser;

    const adapter = recorder.connect();
    if (optsArg?.weightingA) {
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 100;
      const peak = ctx.createBiquadFilter();
      peak.type = 'peaking';
      peak.frequency.value = 2500;
      peak.gain.value = 3;
      adapter.connect(hp).connect(peak).connect(analyser);
    } else {
      adapter.connect(analyser);
    }

    recorder.onAudioReady(({ buffer, numFrames, when }) => {
      const data = buffer.getChannelData(0) as Float32Array;
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
      const rms = Math.sqrt(sum / (data.length || 1));
      onFrame({ buffer: data, rms, numFrames, when });
    });

    recorder.start();
    return true;
  };

  const stopMic = () => {
    try { recorderRef.current?.stop(); } catch {}
    recorderRef.current = null;
    analyserRef.current = null;
  };

  const getAnalyser = () => analyserRef.current;

  const value = useMemo<AudioEngine>(
    () => ({ available, micGranted, playTone, stopTone, startMic, stopMic, getAnalyser }),
    [available, micGranted],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
