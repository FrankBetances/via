/* -------------------------------------------------------------------------- */
/*  useLuaCompanion — Hook de sincronización clínica con Lúa                    */
/*  Fusiona el Enfoque A (Biofeedback / Espejo) y el Enfoque C (Recompensas)   */
/* -------------------------------------------------------------------------- */

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  isLuaConnected,
  luaAffect,
  luaAward,
  luaCelebrate,
  luaGrant,
  luaHeartbeat,
  luaIdle,
  luaLevel,
  luaPhase,
  luaVerdict,
  getLuaAdapter,
} from './index';

export enum LuaEmotion {
  Joy = 0,        // Alegría (chispeante)
  Love = 1,       // Amor (media luna, rubor cálido)
  Gratitude = 2,  // Gratitud (inclinación suave)
  Tranquility = 3,// Tranquilidad (respiración profunda pautada)
  Hope = 4,       // Esperanza (mirada estelar hacia arriba)
  Pride = 5,      // Orgullo (pecho erguido, postura satisfecha)
  Inspire = 6,    // Inspiración (destello creativo, ojos abiertos)
  Fun = 7,        // Diversión (guiño travieso, micro-salto)
}

export interface LuaBadgeInfo {
  glyph: number;
  rank: number;
  name: string;
  category: string;
}

export const LUA_CLINICAL_BADGES: Record<string, LuaBadgeInfo> = {
  audiometry_conditioned: {
    glyph: 0,
    rank: 1,
    name: 'Oído Atento',
    category: 'Audiometría Lúdica',
  },
  verbal_audiometry: {
    glyph: 1,
    rank: 1,
    name: 'Palabras Claras',
    category: 'Audiometría Verbal',
  },
  voice_analysis: {
    glyph: 2,
    rank: 1,
    name: 'Voz Firme y Sonora',
    category: 'Análisis Acústico',
  },
  prosody_analysis: {
    glyph: 3,
    rank: 1,
    name: 'Ritmo y Melodía',
    category: 'Prosodia Clínica',
  },
  articulation_tar: {
    glyph: 4,
    rank: 1,
    name: 'Maestro Articulatorio',
    category: 'Test T.A.R.',
  },
  executive_functions: {
    glyph: 5,
    rank: 1,
    name: 'Mente Flexible',
    category: 'Funciones Ejecutivas',
  },
  final_champion: {
    glyph: 8,
    rank: 4,
    name: 'Campeón VIA+',
    category: 'Evaluación Completa',
  },
};

export interface UseLuaCompanionOptions {
  moduleKey?: string;
  initialEmotion?: LuaEmotion;
  initialLevel?: number;
  enableBreathing?: boolean;
}

export function useLuaCompanion(options: UseLuaCompanionOptions = {}) {
  const {
    moduleKey,
    initialEmotion = LuaEmotion.Tranquility,
    initialLevel = 1,
    enableBreathing = false,
  } = options;

  const [connected, setConnected] = useState<boolean>(isLuaConnected());
  const [currentEmotion, setCurrentEmotion] = useState<LuaEmotion>(initialEmotion);
  const [currentPhase, setCurrentPhase] = useState<number>(0);
  const [currentLevel, setCurrentLevel] = useState<number>(initialLevel);
  const [isBreathing, setIsBreathing] = useState<boolean>(enableBreathing);
  const [activeBadge, setActiveBadge] = useState<LuaBadgeInfo | null>(
    moduleKey && LUA_CLINICAL_BADGES[moduleKey] ? LUA_CLINICAL_BADGES[moduleKey] : null,
  );

  const heartbeatTimer = useRef<any>(null);

  // Escuchar estado de conexión BLE
  useEffect(() => {
    const adapter = getLuaAdapter();
    if (!adapter) return;
    const unsub = adapter.onLinkChange(c => setConnected(c));
    return () => unsub();
  }, []);

  // Mantener concesión visual viva durante la pantalla
  useEffect(() => {
    luaGrant(45); // Concesión visual de 45 segundos
    luaAffect(initialEmotion);
    luaLevel(initialLevel);

    heartbeatTimer.current = setInterval(() => {
      luaHeartbeat();
    }, 15000);

    return () => {
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      luaIdle();
    };
  }, [initialEmotion, initialLevel]);

  const setEmotion = useCallback((emotion: LuaEmotion) => {
    setCurrentEmotion(emotion);
    luaAffect(emotion);
  }, []);

  const setPhase = useCallback((phase: number) => {
    setCurrentPhase(phase);
    luaPhase(phase);
  }, []);

  const setVerdict = useCallback((verdict: 0 | 1 | 2) => {
    luaVerdict(verdict);
    if (verdict === 2) {
      setCurrentEmotion(LuaEmotion.Joy);
      luaAffect(LuaEmotion.Joy);
    } else if (verdict === 1) {
      setCurrentEmotion(LuaEmotion.Inspire);
      luaAffect(LuaEmotion.Inspire);
    } else {
      // Veredicto 0 no castiga: calma receptiva
      setCurrentEmotion(LuaEmotion.Tranquility);
      luaAffect(LuaEmotion.Tranquility);
    }
  }, []);

  const triggerBreathing = useCallback((seconds = 4) => {
    setIsBreathing(true);
    setCurrentEmotion(LuaEmotion.Tranquility);
    luaAffect(LuaEmotion.Tranquility);
    setTimeout(() => {
      setIsBreathing(false);
    }, seconds * 1000);
  }, []);

  const triggerReward = useCallback((badgeKey?: string, intensity: 0 | 1 | 2 = 1) => {
    const badge = badgeKey ? LUA_CLINICAL_BADGES[badgeKey] : activeBadge;
    if (badge) {
      setActiveBadge(badge);
      luaAward(badge.glyph, badge.rank);
    }
    setCurrentEmotion(LuaEmotion.Pride);
    luaAffect(LuaEmotion.Pride);
    luaCelebrate(intensity);
  }, [activeBadge]);

  const setProgressLevel = useCallback((level: number) => {
    const clamped = Math.max(1, Math.min(12, level));
    setCurrentLevel(clamped);
    luaLevel(clamped);
  }, []);

  return {
    connected,
    currentEmotion,
    currentPhase,
    currentLevel,
    isBreathing,
    activeBadge,
    setEmotion,
    setPhase,
    setVerdict,
    triggerBreathing,
    triggerReward,
    setProgressLevel,
  };
}
