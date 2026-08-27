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
  /* Escucha atenta: orejas erguidas, quietud alerta. Se usa en las pruebas
     en que Lúa acompaña sin intervenir (audiometría verbal, T.A.R.).
     NO está en la tabla del enlace, que declara `AFFECT 0-7`: llega a la cara
     correcta porque el firmware manda a `kExprAttentive` todo id que no
     reconozca. Ver el porqué —y su riesgo— en `luaAdapter.luaAffect`. */
  Attentive = 8,  // Escucha atenta (orejas erguidas, quietud alerta)
}

export interface LuaBadgeInfo {
  glyph: number;
  rank: number;
  name: string;
  category: string;
}

/**
 * Qué insignia enseña el aparato al cerrar cada módulo.
 *
 * `glyph` y `rank` NO son adornos: son los dos bytes del parámetro de `AWARD`,
 * y significan una POSICIÓN en el catálogo que el aparato lleva flasheado
 * (`AWARD_GLYPH_KEYS` y `AWARD_TIER_KEYS`, que se deciden en Valeria+). El
 * `name` y la `category` se quedan en la tableta: por el enlace no viaja texto.
 *
 * ── Corregido el 27/8/2026, y conviene saber por qué ──────────────────────
 * Valeria+ redibujó las nueve insignias el 25/8/2026 y **las claves siguen
 * llamándose igual mientras que los dibujos ya no son lo que decían**: el
 * glifo 0 no es una llama sino un cascabel, el 1 no es una huella genérica
 * sino la huella de exploradora, el 2 no es una estrella sino unas orejitas
 * atentas. Este mapa estaba escrito contra los nombres viejos, así que la
 * audiometría condicionada («Oído Atento») mandaba el glifo 0 y el aparato
 * pintaba el cascabel de la voz. Ningún gate lo veía: el parámetro era válido
 * y el enlace no sabe qué significa.
 *
 * La identidad de cada glifo la declara Valeria+ en `PIXEL_GLYPH_CORE`, y es la
 * que se ha usado aquí para repartirlos:
 *
 * | # | dibujo | módulo | por qué |
 * | - | ------ | ------ | ------- |
 * | 0 | cascabel fonador | análisis acústico | es el glifo del sonido de la voz |
 * | 1 | huella de exploradora | funciones ejecutivas | seguir la pista y cambiar de norma |
 * | 2 | orejitas atentas | audiometría condicionada | «discriminación auditiva», literal |
 * | 3 | lupa curiosa | T.A.R. | el test examina fonema a fonema |
 * | 5 | mochila de palabras | audiometría verbal | palabras oídas y repetidas |
 * | 6 | ovillo de cuentos | prosodia | se mide sobre narración |
 * | 8 | corona | informe final | ya estaba, y sigue valiendo |
 *
 * El reparto de los seis módulos entre nueve dibujos es una elección de este
 * repositorio, no una regla clínica: si Frank prefiere otro, se cambia aquí y
 * no hay nada más que tocar. Lo que NO es opinable son los índices en sí —los
 * decide Valeria+ y hay aparatos flasheados—, ni que 4 (Lúa soñadora) y 7
 * (ronroneo) se queden libres para el cribado de SAHS y la disfagia cuando
 * esos módulos cierren sesión.
 */
export const LUA_CLINICAL_BADGES: Record<string, LuaBadgeInfo> = {
  audiometry_conditioned: {
    glyph: 2, // orejitas atentas
    rank: 1,
    name: 'Oído Atento',
    category: 'Audiometría Lúdica',
  },
  verbal_audiometry: {
    glyph: 5, // mochila de palabras
    rank: 1,
    name: 'Palabras Claras',
    category: 'Audiometría Verbal',
  },
  voice_analysis: {
    glyph: 0, // cascabel fonador
    rank: 1,
    name: 'Voz Firme y Sonora',
    category: 'Análisis Acústico',
  },
  prosody_analysis: {
    glyph: 6, // ovillo de cuentos
    rank: 1,
    name: 'Ritmo y Melodía',
    category: 'Prosodia Clínica',
  },
  articulation_tar: {
    glyph: 3, // lupa curiosa
    rank: 1,
    name: 'Maestro Articulatorio',
    category: 'Test T.A.R.',
  },
  executive_functions: {
    glyph: 1, // huella de exploradora
    rank: 1,
    name: 'Mente Flexible',
    category: 'Funciones Ejecutivas',
  },
  final_champion: {
    glyph: 8, // corona
    rank: 4,
    name: 'Campeón VIA+',
    category: 'Evaluación Completa',
  },
};


/**
 * Cuánto se deja ver la celebración antes de la insignia.
 *
 * NO es un número elegido aquí: es lo que dura `kFramesSuccess` en
 * `core/src/faces.cpp` del firmware, la cara que pone `CELEBRATE(2)`. Es una
 * copia, y como tal se puede desincronizar; la compara
 * `tools/check-reward-parity.js --via` desde lua-firmware, que es el
 * repositorio que ve los dos.
 */
export const LUA_CELEBRATION_MS = 2000;

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
  const rewardTimer = useRef<any>(null);

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
      // Salir antes de que la insignia llegue a mandarse: si no se limpia, el
      // `AWARD` sale con la pantalla ya cerrada y deja el premio de un módulo
      // encima del siguiente.
      if (rewardTimer.current) clearTimeout(rewardTimer.current);
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

  /**
   * El premio del módulo: celebración primero, insignia detrás.
   *
   * ── Arreglado el 27/8/2026 ────────────────────────────────────────────────
   * Esto mandaba `AWARD`, `AFFECT` y `CELEBRATE` **seguidos**, y en el aparato
   * cada opcode SUSTITUYE la cara (`Device::setExpression`). Las tres tramas
   * llegan con microsegundos de diferencia, así que la insignia se quedaba
   * puesta el tiempo que tarda la siguiente en cruzar el aire: cero. Seis
   * pantallas llamaban a esto para enseñar su insignia y ninguna la enseñaba.
   * No lo veía ningún test ni ningún gate — los tres parámetros eran válidos y
   * el enlace no sabe en qué orden tienen sentido.
   *
   * Ahora va en dos tiempos:
   *   1 · `AFFECT(Orgullo)` siembra sus partículas y `CELEBRATE` pone encima la
   *       cara de éxito con su confeti. En este orden, porque `AFFECT` también
   *       pone cara y al revés se comería la celebración.
   *   2 · `LUA_CELEBRATION_MS` después, la insignia, que se queda sus 3 s.
   */
  const triggerReward = useCallback((badgeKey?: string, intensity: 0 | 1 | 2 = 1) => {
    const badge = badgeKey ? LUA_CLINICAL_BADGES[badgeKey] : activeBadge;
    if (badge) setActiveBadge(badge);

    setCurrentEmotion(LuaEmotion.Pride);
    luaAffect(LuaEmotion.Pride);
    luaCelebrate(intensity);

    if (rewardTimer.current) clearTimeout(rewardTimer.current);
    if (!badge) return;
    rewardTimer.current = setTimeout(() => {
      rewardTimer.current = null;
      luaAward(badge.glyph, badge.rank);
    }, LUA_CELEBRATION_MS);
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
