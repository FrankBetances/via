// ============================================================================
// VIA+ · Genera la tabla de opcodes de Lúa desde la fuente vendorizada
//
//   node scripts/build-lua-protocol.js           → escribe src/Lua/luaProtocol.ts
//   node scripts/build-lua-protocol.js --check   → falla si no coincide (gate)
//
// POR QUÉ ESTE SCRIPT EXISTE EN VIA+
// La tabla de opcodes de Lúa la consumen TRES sitios: el firmware del ESP32 (C),
// Valeria+ (TS) y este repositorio (TS). La fuente única es
// `firmware/lua/protocol.json` en `FrankBetances/Valeria`, y su propio aviso lo
// dice: «tres copias a mano se desincronizan». Aquí hubo una cuarta copia escrita
// a mano, con UUIDs y tramas inventados que no habrían conectado con ningún
// aparato flasheado; este generador la sustituye.
//
// El `.json` de `src/Lua/protocol.json` es una COPIA VENDORIZADA, byte a byte, de
// la de Valeria+. Este gate comprueba que nadie edite a mano lo generado; lo que
// NO puede comprobar es que la copia siga al día respecto a Valeria+, porque este
// repositorio no ve el otro. Para eso está el procedimiento de sincronización de
// `docs/design/integracion-lua.md` §5.
//
// El cuerpo del fichero generado es IDÉNTICO al de `src/valeriaLuaProtocol.ts` de
// Valeria+: solo cambia la cabecera de origen. Así un diff entre los dos
// repositorios enseña la cabecera y nada más.
// ============================================================================
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'src', 'Lua', 'protocol.json');
const OUT_TS = path.join(ROOT, 'src', 'Lua', 'luaProtocol.ts');

const hx = n => `0x${n.toString(16).padStart(2, '0').toUpperCase()}`;
// La máscara se deriva del bit: escribir el valor a mano en el .json sería
// tener dos formas de decir lo mismo y que se separen.
const capMask = c => 1 << c.bit;

/** Cabecera propia de VIA+: deja escrito de dónde viene la tabla. */
const header = `// GENERADO por scripts/build-lua-protocol.js — no editar a mano.
// Fuente: src/Lua/protocol.json, copia vendorizada byte a byte de
//   FrankBetances/Valeria · firmware/lua/protocol.json
// que es la fuente ÚNICA del enlace y la comparten el firmware del ESP32,
// Valeria+ y este repositorio. Para cambiar un opcode se cambia allí.
//
// El cuerpo de este fichero es idéntico al de src/valeriaLuaProtocol.ts en
// Valeria+; un diff entre repositorios debe enseñar solo esta cabecera.
`;

/** Cuerpo compartido con Valeria+. No tocar el formato: se compara literalmente. */
function renderBody(p) {
  return `//
// Tabla de opcodes del periférico Lúa. Ni un campo de texto: es la garantía
// ESTRUCTURAL de Zero-PHI — un nombre de paciente no puede llegar al aparato
// porque no existe el sitio donde meterlo.

export const LUA_PROTOCOL_VERSION = ${p.version};

export const LUA_SERVICE_UUID = '${p.service.uuid}';

export const LUA_CHR = {
${p.characteristics.map(c => `  ${c.key}: '${c.uuid}',`).join('\n')}
} as const;

/** Opcodes de la característica CTRL (camino de latencia, sin confirmación). */
export const LUA_OP = {
${p.opcodes.map(o => `  ${o.key}: ${hx(o.code)},`).join('\n')}
} as const;

/**
 * Capacidades concedibles. Viajan en el byte ALTO del parámetro de \`GRANT\`;
 * el byte bajo es el TTL. Una máscara de 0 concede SOLO la visual, que es lo
 * que valía un \`GRANT\` antes de que este campo existiera.
 */
export const LUA_CAP = {
${p.capabilities.map(c => `  ${c.key}: ${hx(capMask(c))},`).join('\n')}
} as const;

/** Operaciones de SAFE (con confirmación: aquí sí importa saber que llegó). */
export const LUA_SAFE = {
${p.safeOps.map(o => `  ${o.key}: ${hx(o.code)},`).join('\n')}
} as const;

/** Modos que publica el aparato en STATE. REST es el estado seguro. */
export const LUA_MODE = {
${p.modes.map(m => `  ${m.key}: ${hx(m.code)},`).join('\n')}
} as const;

export const LUA_LIMITS = {
  /** Toda concesión caduca. Sin latido, el aparato vuelve a reposo. */
  grantMaxSeconds: ${p.limits.grantMaxSeconds},
  heartbeatSeconds: ${p.limits.heartbeatSeconds},
  /** Del veredicto del adulto al primer fotograma. Criterio de la Fase 0. */
  latencyBudgetMs: ${p.limits.latencyBudgetMs},
  minFps: ${p.limits.minFps},
} as const;

export type LuaOp = (typeof LUA_OP)[keyof typeof LUA_OP];

/** Trama de CTRL: versión, opcode y parámetro de 16 bits little-endian. */
export const luaFrame = (op: LuaOp, param = 0): Uint8Array =>
  Uint8Array.from([LUA_PROTOCOL_VERSION, op, param & 0xff, (param >> 8) & 0xff]);

/**
 * Parámetro de \`GRANT\`: TTL en el byte bajo, capacidades en el alto.
 * Sin capacidades explícitas concede solo la visual — la sonora se pide, nunca
 * se hereda.
 */
export const luaGrantParam = (ttlSeconds: number, caps = 0): number => {
  const ttl = Math.max(1, Math.min(LUA_LIMITS.grantMaxSeconds, Math.trunc(ttlSeconds)));
  return ((caps & 0xff) << 8) | ttl;
};
`;
}

/** Contenido completo que debe tener `src/Lua/luaProtocol.ts`. */
function render() {
  const p = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  return header + renderBody(p);
}

module.exports = { render, renderBody, SRC, OUT_TS };

if (require.main === module) {
  const content = render();
  const check = process.argv.includes('--check');
  const current = fs.existsSync(OUT_TS) ? fs.readFileSync(OUT_TS, 'utf8') : null;

  if (check) {
    if (current !== content) {
      console.error('✗ src/Lua/luaProtocol.ts no coincide con src/Lua/protocol.json');
      console.error('  Corre `node scripts/build-lua-protocol.js` y vuelve a commitear.');
      process.exit(1);
    }
    const p = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    console.log(`✓ Tabla de opcodes al día (${p.opcodes.length} opcodes, versión ${p.version}).`);
  } else if (current !== content) {
    fs.writeFileSync(OUT_TS, content);
    console.log('· escrito src/Lua/luaProtocol.ts');
  } else {
    console.log('· src/Lua/luaProtocol.ts ya estaba al día');
  }
}
