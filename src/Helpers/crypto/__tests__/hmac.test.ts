import { hmacSha256 } from '@/Helpers/crypto/hmac';
import { toHex, utf8 } from '@/Helpers/passwordHash';

declare function require(name: string): any;
const nodeCrypto = require('crypto');

const rep = (byte: number, n: number): Uint8Array => new Uint8Array(n).fill(byte);

/* RFC 4231 §4, HMAC-SHA-256 (casos 1-4, 6, 7; el 5 trunca la salida). */
const RFC4231: Array<[string, Uint8Array, Uint8Array, string]> = [
  ['caso 1', rep(0x0b, 20), utf8('Hi There'), 'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7'],
  ['caso 2', utf8('Jefe'), utf8('what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843'],
  ['caso 3', rep(0xaa, 20), rep(0xdd, 50), '773ea91e36800e46854db8ebd09181a72959098b3ef8c122d9635514ced565fe'],
  [
    'caso 4',
    Uint8Array.from({ length: 25 }, (_, i) => i + 1),
    rep(0xcd, 50),
    '82558a389a443c0ea4cc819899f2083a85f0faa3e578f8077a2e3ff46729665b',
  ],
  [
    'caso 6',
    rep(0xaa, 131),
    utf8('Test Using Larger Than Block-Size Key - Hash Key First'),
    '60e431591ee0b67f0d8a26aacbf5b77f8e0bc6213728c5140546040f0ee37f54',
  ],
  [
    'caso 7',
    rep(0xaa, 131),
    utf8(
      'This is a test using a larger than block-size key and a larger than block-size data. ' +
        'The key needs to be hashed before being used by the HMAC algorithm.',
    ),
    '9b09ffa71b942fcb27635fbcd5b0e944bfdc63644f0713938a7f51535c3a35e2',
  ],
];

describe('hmacSha256 (D2)', () => {
  it.each(RFC4231)('RFC 4231 %s', (_n, key, msg, expected) => {
    expect(toHex(hmacSha256(key, msg))).toBe(expected);
  });

  it('coincide con crypto.createHmac de Node en claves y mensajes de varios tamaños', () => {
    for (const keyLen of [0, 1, 32, 63, 64, 65, 200]) {
      for (const msgLen of [0, 1, 55, 64, 1000]) {
        const key = Uint8Array.from({ length: keyLen }, (_, i) => (i * 7 + 3) % 256);
        const msg = Uint8Array.from({ length: msgLen }, (_, i) => (i * 13 + 5) % 256);
        expect(toHex(hmacSha256(key, msg))).toBe(
          nodeCrypto.createHmac('sha256', key).update(msg).digest('hex'),
        );
      }
    }
  });
});
