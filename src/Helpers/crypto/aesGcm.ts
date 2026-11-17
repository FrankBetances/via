/* -------------------------------------------------------------------------- */
/*  AES-256-GCM (NIST SP 800-38D) en TypeScript puro — primitiva de D2.       */
/*                                                                            */
/*  ESTADO: NO ESTÁ CABLEADO. Ningún modelo, repositorio, pantalla ni la base */
/*  de datos usa este fichero: los datos de paciente siguen en claro. El      */
/*  cableado es D3/D4.                                                        */
/*                                                                            */
/*  RESPONSABILIDAD DEL LLAMANTE (esto no lo resuelve el módulo):             */
/*   - La custodia de la clave de 32 bytes (dónde se guarda, cómo se pierde). */
/*   - Un IV de 12 bytes ÚNICO por mensaje y por clave. Repetir (clave, IV)   */
/*     en GCM rompe la confidencialidad y la autenticidad. Este módulo NO     */
/*     genera claves ni IV: los recibe.                                       */
/*                                                                            */
/*  Alcance: IV de 12 bytes (el caso recomendado por NIST), etiqueta de 16.   */
/*  `aes256GcmDecrypt` LANZA si la etiqueta no cuadra y nunca devuelve texto  */
/*  sin autenticar.                                                           */
/*                                                                            */
/*  No es de tiempo constante en el acceso a la S-box (tablas indexadas por   */
/*  el dato): vale para proteger datos en reposo, no frente a un atacante     */
/*  que mida tiempos en el mismo dispositivo. La comparación de la etiqueta   */
/*  sí es de tiempo constante. Su corrección está comprobada contra `crypto`  */
/*  de Node y vectores NIST en `__tests__/aesGcm.test.ts`; el coste en        */
/*  Hermes NO está medido.                                                    */
/* -------------------------------------------------------------------------- */

/* eslint-disable no-bitwise -- AES y GHASH son aritmética sobre GF(2^8) y GF(2^128) por definición (FIPS 197, SP 800-38D). */

const SBOX = new Uint8Array(256);
(() => {
  // Construcción de la S-box de FIPS 197 §5.1.1 (inverso en GF(2^8) + afín).
  const rotl8 = (x: number, n: number): number => ((x << n) | (x >>> (8 - n))) & 0xff;
  let p = 1;
  let q = 1;
  do {
    p = (p ^ ((p << 1) & 0xff) ^ (p & 0x80 ? 0x1b : 0)) & 0xff; // p *= 3
    q ^= q << 1;
    q ^= q << 2;
    q ^= q << 4;
    q &= 0xff;
    if (q & 0x80) q ^= 0x09; // q /= 3
    SBOX[p] = (q ^ rotl8(q, 1) ^ rotl8(q, 2) ^ rotl8(q, 3) ^ rotl8(q, 4) ^ 0x63) & 0xff;
  } while (p !== 1);
  SBOX[0] = 0x63;
})();

const xtime = (x: number): number => ((x << 1) ^ (x & 0x80 ? 0x1b : 0)) & 0xff;

const NK = 8; // palabras de la clave (256 bits)
const NR = 14; // rondas

/** Expansión de clave (FIPS 197 §5.2): 15 claves de ronda de 16 bytes. */
function expandKey(key: Uint8Array): Uint8Array {
  const w = new Uint8Array(16 * (NR + 1));
  w.set(key);
  let rcon = 1;
  for (let i = NK; i < 4 * (NR + 1); i++) {
    let t0 = w[(i - 1) * 4];
    let t1 = w[(i - 1) * 4 + 1];
    let t2 = w[(i - 1) * 4 + 2];
    let t3 = w[(i - 1) * 4 + 3];
    if (i % NK === 0) {
      const r = t0;
      t0 = SBOX[t1] ^ rcon;
      t1 = SBOX[t2];
      t2 = SBOX[t3];
      t3 = SBOX[r];
      rcon = xtime(rcon);
    } else if (i % NK === 4) {
      t0 = SBOX[t0];
      t1 = SBOX[t1];
      t2 = SBOX[t2];
      t3 = SBOX[t3];
    }
    w[i * 4] = w[(i - NK) * 4] ^ t0;
    w[i * 4 + 1] = w[(i - NK) * 4 + 1] ^ t1;
    w[i * 4 + 2] = w[(i - NK) * 4 + 2] ^ t2;
    w[i * 4 + 3] = w[(i - NK) * 4 + 3] ^ t3;
  }
  return w;
}

function encryptBlock(rk: Uint8Array, input: Uint8Array): Uint8Array {
  const s = new Uint8Array(16);
  for (let i = 0; i < 16; i++) s[i] = input[i] ^ rk[i];
  const t = new Uint8Array(16);
  for (let round = 1; round <= NR; round++) {
    // SubBytes + ShiftRows (el estado va por columnas: s[4*c + r]).
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) t[4 * c + r] = SBOX[s[4 * ((c + r) % 4) + r]];
    }
    if (round < NR) {
      // MixColumns
      for (let c = 0; c < 4; c++) {
        const a0 = t[4 * c];
        const a1 = t[4 * c + 1];
        const a2 = t[4 * c + 2];
        const a3 = t[4 * c + 3];
        const all = a0 ^ a1 ^ a2 ^ a3;
        s[4 * c] = a0 ^ all ^ xtime(a0 ^ a1);
        s[4 * c + 1] = a1 ^ all ^ xtime(a1 ^ a2);
        s[4 * c + 2] = a2 ^ all ^ xtime(a2 ^ a3);
        s[4 * c + 3] = a3 ^ all ^ xtime(a3 ^ a0);
      }
    } else {
      s.set(t);
    }
    for (let i = 0; i < 16; i++) s[i] ^= rk[16 * round + i];
  }
  return s;
}

/** Cifra un bloque de 16 bytes con AES-256 (FIPS 197). Exportada para los vectores. */
export function aes256EncryptBlock(key: Uint8Array, block: Uint8Array): Uint8Array {
  if (key.length !== 32) throw new Error('AES-256: la clave debe tener 32 bytes');
  if (block.length !== 16) throw new Error('AES: el bloque debe tener 16 bytes');
  return encryptBlock(expandKey(key), block);
}

/** Multiplicación en GF(2^128) de GCM (SP 800-38D §6.3), bit a bit. */
function gfMul(x: Uint8Array, y: Uint8Array): Uint8Array {
  const z = new Uint8Array(16);
  const v = y.slice();
  for (let i = 0; i < 128; i++) {
    if ((x[i >> 3] >> (7 - (i & 7))) & 1) {
      for (let j = 0; j < 16; j++) z[j] ^= v[j];
    }
    const lsb = v[15] & 1;
    for (let j = 15; j > 0; j--) v[j] = (v[j] >>> 1) | ((v[j - 1] & 1) << 7);
    v[0] >>>= 1;
    if (lsb) v[0] ^= 0xe1;
  }
  return z;
}

function ghash(h: Uint8Array, aad: Uint8Array, ct: Uint8Array): Uint8Array {
  let y: Uint8Array = new Uint8Array(16);
  const absorb = (data: Uint8Array) => {
    for (let off = 0; off < data.length; off += 16) {
      const n = Math.min(16, data.length - off);
      for (let i = 0; i < n; i++) y[i] ^= data[off + i];
      y = gfMul(y, h);
    }
  };
  absorb(aad);
  absorb(ct);
  const lens = new Uint8Array(16);
  const dv = new DataView(lens.buffer);
  dv.setUint32(0, Math.floor((aad.length * 8) / 0x100000000));
  dv.setUint32(4, (aad.length * 8) >>> 0);
  dv.setUint32(8, Math.floor((ct.length * 8) / 0x100000000));
  dv.setUint32(12, (ct.length * 8) >>> 0);
  for (let i = 0; i < 16; i++) y[i] ^= lens[i];
  return gfMul(y, h);
}

function checkArgs(key: Uint8Array, iv: Uint8Array): void {
  if (key.length !== 32) throw new Error('AES-256-GCM: la clave debe tener 32 bytes');
  if (iv.length !== 12) throw new Error('AES-256-GCM: el IV debe tener 12 bytes');
}

/** CTR de GCM: bloques de contador desde J0+1 (inc32 sobre los 4 últimos bytes). */
function gctr(rk: Uint8Array, j0: Uint8Array, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(data.length);
  const ctr = j0.slice();
  for (let off = 0; off < data.length; off += 16) {
    for (let i = 15; i >= 12; i--) {
      ctr[i] = (ctr[i] + 1) & 0xff;
      if (ctr[i] !== 0) break;
    }
    const ks = encryptBlock(rk, ctr);
    const n = Math.min(16, data.length - off);
    for (let i = 0; i < n; i++) out[off + i] = data[off + i] ^ ks[i];
  }
  return out;
}

function computeTag(rk: Uint8Array, j0: Uint8Array, h: Uint8Array, aad: Uint8Array, ct: Uint8Array): Uint8Array {
  const s = ghash(h, aad, ct);
  const ek = encryptBlock(rk, j0);
  for (let i = 0; i < 16; i++) s[i] ^= ek[i];
  return s;
}

function setup(key: Uint8Array, iv: Uint8Array) {
  const rk = expandKey(key);
  const h = encryptBlock(rk, new Uint8Array(16));
  const j0 = new Uint8Array(16);
  j0.set(iv);
  j0[15] = 1;
  return { rk, h, j0 };
}

export interface AesGcmResult {
  ciphertext: Uint8Array;
  /** Etiqueta de autenticación de 16 bytes. */
  tag: Uint8Array;
}

/**
 * AES-256-GCM. `key`: 32 bytes. `iv`: 12 bytes, ÚNICO por mensaje y por clave
 * (lo garantiza el llamante). No genera ni clave ni IV.
 */
export function aes256GcmEncrypt(
  key: Uint8Array,
  iv: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array = new Uint8Array(0),
): AesGcmResult {
  checkArgs(key, iv);
  const { rk, h, j0 } = setup(key, iv);
  const ciphertext = gctr(rk, j0, plaintext);
  return { ciphertext, tag: computeTag(rk, j0, h, aad, ciphertext) };
}

/**
 * Descifra y autentica. LANZA si la etiqueta no cuadra (texto, etiqueta, AAD,
 * IV o clave alterados): jamás devuelve texto sin autenticar.
 */
export function aes256GcmDecrypt(
  key: Uint8Array,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  tag: Uint8Array,
  aad: Uint8Array = new Uint8Array(0),
): Uint8Array {
  checkArgs(key, iv);
  if (tag.length !== 16) throw new Error('AES-256-GCM: la etiqueta debe tener 16 bytes');
  const { rk, h, j0 } = setup(key, iv);
  const expected = computeTag(rk, j0, h, aad, ciphertext);
  let diff = 0;
  for (let i = 0; i < 16; i++) diff |= expected[i] ^ tag[i];
  if (diff !== 0) throw new Error('AES-256-GCM: la etiqueta de autenticación no cuadra');
  return gctr(rk, j0, ciphertext);
}
/* eslint-enable no-bitwise */
