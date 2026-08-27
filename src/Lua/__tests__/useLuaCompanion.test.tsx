/* -------------------------------------------------------------------------- */
/*  Pruebas del acompañante clínico: el ORDEN y los TIEMPOS de las tramas.      */
/*                                                                             */
/*  Este fichero existe por dos fallos que estuvieron vivos hasta el 27/8/2026  */
/*  y que ni `tsc` ni los 69 asertos del módulo veían, porque en los dos casos  */
/*  las tramas eran perfectamente válidas:                                     */
/*                                                                             */
/*   1 · `triggerReward` mandaba AWARD, AFFECT y CELEBRATE seguidos. En el      */
/*       aparato cada opcode SUSTITUYE la cara, y las tres llegan con           */
/*       microsegundos de diferencia: la insignia se quedaba puesta cero        */
/*       milisegundos. Seis pantallas la pedían y ninguna la enseñaba.          */
/*   2 · El mapa de insignias clínicas estaba escrito contra los nombres viejos */
/*       de los glifos. Valeria+ los redibujó el 25/8/2026 conservando las      */
/*       claves, así que «Oído Atento» mandaba el índice del cascabel de la voz.*/
/*                                                                             */
/*  Los dos son la misma clase de fallo: un número válido en el sitio           */
/*  equivocado. Lo único que los caza es mirar la SECUENCIA que sale al aire,   */
/*  que es lo que hace este fichero — no el estado de React, que en los dos     */
/*  casos era correcto.                                                        */
/* -------------------------------------------------------------------------- */

import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';

import { setLuaAdapter, type LuaAdapter } from '../luaAdapter';
import { LUA_OP } from '../luaProtocol';
import {
  useLuaCompanion,
  LuaEmotion,
  LUA_CELEBRATION_MS,
  LUA_CLINICAL_BADGES,
} from '../useLuaCompanion';

interface Sent {
  op: number;
  param: number;
}

let sent: Sent[] = [];

/**
 * Adaptador de mentira que solo anota qué opcode sale y con qué parámetro.
 *
 * Implementa `LuaAdapter` ENTERO, sin `as`: un mock recortado deja de compilar
 * cuando la interfaz crece, que es justo el aviso que hace falta.
 */
function spyAdapter(): LuaAdapter {
  return {
    isConnected: () => true,
    state: () => null,
    sendCtrl: (op, param = 0) => { sent.push({ op, param }); },
    sendSafe: async () => true,
    subscribeState: () => () => {},
    onLinkChange: () => () => {},
  };
}

/** Sonda mínima: solo monta el hook. Lo que se mira es lo que sale al aire. */
const Probe: React.FC<{ moduleKey?: string; onReady: (api: any) => void }> = ({
  moduleKey, onReady,
}) => {
  const lua = useLuaCompanion({ moduleKey, initialEmotion: LuaEmotion.Tranquility });
  onReady(lua);
  return <Text>{String(lua.currentLevel)}</Text>;
};

const opsOf = (op: number): Sent[] => sent.filter(f => f.op === op);

beforeEach(() => {
  sent = [];
  jest.useFakeTimers();
  setLuaAdapter(spyAdapter());
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  setLuaAdapter(null);
});

describe('el premio del módulo se deja ver', () => {
  it('la insignia NO sale a la vez que la celebración', () => {
    let api: any;
    render(<Probe moduleKey="voice_analysis" onReady={a => { api = a; }} />);

    act(() => { api.triggerReward('voice_analysis', 2); });

    // Antes del plazo, la celebración ha salido y la insignia NO.
    expect(opsOf(LUA_OP.CELEBRATE)).toHaveLength(1);
    expect(opsOf(LUA_OP.AWARD)).toHaveLength(0);

    act(() => { jest.advanceTimersByTime(LUA_CELEBRATION_MS); });
    expect(opsOf(LUA_OP.AWARD)).toHaveLength(1);
  });

  it('la emoción va ANTES de la celebración, no después', () => {
    let api: any;
    render(<Probe moduleKey="voice_analysis" onReady={a => { api = a; }} />);
    sent = [];

    act(() => { api.triggerReward('voice_analysis', 2); });

    // `AFFECT` también pone cara: si fuera el último, se comería la
    // celebración y el niño no vería el confeti.
    const orden = sent.map(f => f.op);
    expect(orden.indexOf(LUA_OP.AFFECT)).toBeLessThan(orden.indexOf(LUA_OP.CELEBRATE));
  });

  it('la insignia lleva el glifo en el byte bajo y el rango en el alto', () => {
    let api: any;
    render(<Probe moduleKey="verbal_audiometry" onReady={a => { api = a; }} />);

    act(() => { api.triggerReward('verbal_audiometry', 2); });
    act(() => { jest.advanceTimersByTime(LUA_CELEBRATION_MS); });

    const insignia = LUA_CLINICAL_BADGES.verbal_audiometry;
    const [trama] = opsOf(LUA_OP.AWARD);
    expect(trama.param & 0xff).toBe(insignia.glyph);
    expect(trama.param >> 8).toBe(insignia.rank);
  });

  it('salir de la pantalla antes del plazo no manda la insignia', () => {
    let api: any;
    const vista = render(<Probe moduleKey="prosody_analysis" onReady={a => { api = a; }} />);

    act(() => { api.triggerReward('prosody_analysis', 2); });
    vista.unmount();
    act(() => { jest.advanceTimersByTime(LUA_CELEBRATION_MS * 2); });

    // Si esto fallara, el premio de un módulo aparecería encima del siguiente.
    expect(opsOf(LUA_OP.AWARD)).toHaveLength(0);
  });
});

describe('el catálogo de insignias clínicas apunta a dibujos que existen', () => {
  const GLIFOS = 9;   // familias del catálogo flasheado (AWARD_GLYPH_KEYS)
  const RANGOS = 5;   // rangos (AWARD_TIER_KEYS)

  it('ningún glifo ni rango se sale del catálogo del aparato', () => {
    for (const [clave, insignia] of Object.entries(LUA_CLINICAL_BADGES)) {
      expect(`${clave}:${insignia.glyph}`).toBe(`${clave}:${Math.trunc(insignia.glyph)}`);
      expect(insignia.glyph).toBeGreaterThanOrEqual(0);
      expect(insignia.glyph).toBeLessThan(GLIFOS);
      expect(insignia.rank).toBeGreaterThanOrEqual(0);
      expect(insignia.rank).toBeLessThan(RANGOS);
    }
  });

  it('dos módulos no comparten la misma insignia', () => {
    // Compartir glifo Y rango deja al niño con el mismo dibujo dos veces y sin
    // manera de saber cuál de las dos pruebas acaba de cerrar.
    const vistos = Object.values(LUA_CLINICAL_BADGES).map(b => `${b.glyph}/${b.rank}`);
    expect(new Set(vistos).size).toBe(vistos.length);
  });

  it('los seis módulos y el cierre siguen teniendo insignia', () => {
    for (const clave of [
      'audiometry_conditioned', 'verbal_audiometry', 'voice_analysis',
      'prosody_analysis', 'articulation_tar', 'executive_functions', 'final_champion',
    ]) {
      expect(LUA_CLINICAL_BADGES[clave]).toBeDefined();
    }
  });
});
