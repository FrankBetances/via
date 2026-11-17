import { aes256EncryptBlock, aes256GcmDecrypt, aes256GcmEncrypt } from '@/Helpers/crypto/aesGcm';
import { toHex, utf8 } from '@/Helpers/passwordHash';

declare function require(name: string): any;
const nodeCrypto = require('crypto');

const hex = (s: string): Uint8Array => Uint8Array.from((s.match(/../g) ?? []).map(b => parseInt(b, 16)));
const bytes = (n: number, seed: number): Uint8Array => Uint8Array.from({ length: n }, (_, i) => (i * 31 + seed) % 256);

const KEY = bytes(32, 1);
const IV = bytes(12, 2);

function nodeEncrypt(key: Uint8Array, iv: Uint8Array, pt: Uint8Array, aad?: Uint8Array) {
  const c = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  if (aad) c.setAAD(aad);
  const ct: string = c.update(pt, undefined, 'hex') + c.final('hex');
  return { ct, tag: c.getAuthTag().toString('hex') };
}

describe('AES-256 (bloque)', () => {
  it('FIPS 197 apéndice C.3', () => {
    const key = Uint8Array.from({ length: 32 }, (_, i) => i);
    const pt = hex('00112233445566778899aabbccddeeff');
    expect(toHex(aes256EncryptBlock(key, pt))).toBe('8ea2b7ca516745bfeafc49904b496089');
  });
});

describe('AES-256-GCM (D2)', () => {
  const K15 = hex('feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308');
  const IV15 = hex('cafebabefacedbaddecaf888');
  const P15 = hex(
    'd9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b391aafd255',
  );

  // Vectores de «The Galois/Counter Mode of Operation» (McGrew-Viega), casos 13-16 (AES-256).
  const VECTORS: Array<[string, Uint8Array, Uint8Array, Uint8Array, Uint8Array, string, string]> = [
    ['TC13', new Uint8Array(32), new Uint8Array(12), new Uint8Array(0), new Uint8Array(0), '', '530f8afbc74536b9a963b4f1c4cb738b'],
    [
      'TC14',
      new Uint8Array(32),
      new Uint8Array(12),
      new Uint8Array(16),
      new Uint8Array(0),
      'cea7403d4d606b6e074ec5d3baf39d18',
      'd0d1c8a799996bf0265b98b5d48ab919',
    ],
    [
      'TC15',
      K15,
      IV15,
      P15,
      new Uint8Array(0),
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662898015ad',
      'b094dac5d93471bdec1a502270e3cc6c',
    ],
    [
      'TC16 (con AAD)',
      K15,
      IV15,
      P15.slice(0, 60),
      hex('feedfacedeadbeeffeedfacedeadbeefabaddad2'),
      '522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f662',
      '76fc6ece0f4e1768cddf8853bb2d551b',
    ],
  ];

  it.each(VECTORS)('vector NIST/McGrew-Viega %s', (_n, key, iv, pt, aad, ct, tag) => {
    const r = aes256GcmEncrypt(key, iv, pt, aad);
    expect(toHex(r.ciphertext)).toBe(ct);
    expect(toHex(r.tag)).toBe(tag);
    expect(toHex(aes256GcmDecrypt(key, iv, r.ciphertext, r.tag, aad))).toBe(toHex(pt));
  });

  it.each([0, 1, 15, 16, 17, 31, 32, 33, 1000])('igual que Node con %i bytes, sin AAD y con AAD', n => {
    const pt = bytes(n, 9);
    for (const aad of [undefined, bytes(0, 0), bytes(1, 4), bytes(20, 5), bytes(33, 6)]) {
      const mine = aes256GcmEncrypt(KEY, IV, pt, aad);
      const node = nodeEncrypt(KEY, IV, pt, aad);
      expect(toHex(mine.ciphertext)).toBe(node.ct);
      expect(toHex(mine.tag)).toBe(node.tag);
      expect(toHex(aes256GcmDecrypt(KEY, IV, mine.ciphertext, mine.tag, aad))).toBe(toHex(pt));
    }
  });

  it('descifra lo que cifra Node (nombre con acentos y emoji)', () => {
    const pt = utf8('Ñandú «Lúa» 🐱');
    const node = nodeEncrypt(KEY, IV, pt, bytes(8, 3));
    const out = aes256GcmDecrypt(KEY, IV, hex(node.ct), hex(node.tag), bytes(8, 3));
    expect(decodeURIComponent(escape(String.fromCharCode(...out)))).toBe('Ñandú «Lúa» 🐱');
  });

  describe('manipulación: lanza, nunca devuelve texto sin autenticar', () => {
    const pt = bytes(40, 7);
    const aad = bytes(10, 8);
    const { ciphertext, tag } = aes256GcmEncrypt(KEY, IV, pt, aad);
    const flip = (a: Uint8Array, i: number): Uint8Array => {
      const c = a.slice();
      c[i] = c[i] === 0xff ? 0xfe : c[i] + (c[i] % 2 === 0 ? 1 : -1); // invierte el bit menos significativo
      return c;
    };

    it('un bit del texto cifrado', () => {
      expect(() => aes256GcmDecrypt(KEY, IV, flip(ciphertext, 17), tag, aad)).toThrow();
    });
    it('un bit de la etiqueta', () => {
      expect(() => aes256GcmDecrypt(KEY, IV, ciphertext, flip(tag, 5), aad)).toThrow();
    });
    it('un bit del AAD', () => {
      expect(() => aes256GcmDecrypt(KEY, IV, ciphertext, tag, flip(aad, 3))).toThrow();
    });
    it('AAD ausente cuando se cifró con AAD', () => {
      expect(() => aes256GcmDecrypt(KEY, IV, ciphertext, tag)).toThrow();
    });
    it('otra clave u otro IV', () => {
      expect(() => aes256GcmDecrypt(flip(KEY, 0), IV, ciphertext, tag, aad)).toThrow();
      expect(() => aes256GcmDecrypt(KEY, flip(IV, 0), ciphertext, tag, aad)).toThrow();
    });
    it('sin manipular, descifra', () => {
      expect(toHex(aes256GcmDecrypt(KEY, IV, ciphertext, tag, aad))).toBe(toHex(pt));
    });
  });

  it('rechaza tamaños de clave, IV y etiqueta incorrectos', () => {
    expect(() => aes256GcmEncrypt(bytes(16, 0), IV, bytes(1, 0))).toThrow();
    expect(() => aes256GcmEncrypt(KEY, bytes(16, 0), bytes(1, 0))).toThrow();
    expect(() => aes256GcmDecrypt(KEY, IV, bytes(1, 0), bytes(15, 0))).toThrow();
  });
});
