import { hashPassword, hasLocalPassword, hmacSha256, pbkdf2Sha256, sha256, toHex, utf8, verifyPassword } from '@/Helpers/passwordHash';

/* Se compara con `crypto` de Node: si la implementación propia se aparta de
 * SHA-256 / HMAC / PBKDF2 estándar en un solo bit, falla. */
declare function require(name: string): any;
const nodeCrypto = require('crypto');

describe('passwordHash', () => {
  it('SHA-256: vectores FIPS y textos de varios bloques, igual que Node', () => {
    expect(toHex(sha256(utf8('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(toHex(sha256(utf8('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    for (const text of ['a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'ñandú «Lúa» 🐱'.repeat(9)]) {
      expect(toHex(sha256(utf8(text)))).toBe(nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex'));
    }
  });

  it('HMAC-SHA256 y PBKDF2-HMAC-SHA256, igual que Node', () => {
    const key = utf8('k'.repeat(70));
    expect(toHex(hmacSha256(key, utf8('mensaje')))).toBe(
      nodeCrypto.createHmac('sha256', 'k'.repeat(70)).update('mensaje').digest('hex'),
    );
    // RFC 7914 §11: PBKDF2-HMAC-SHA256("passwd", "salt", 1, 64)
    expect(toHex(pbkdf2Sha256(utf8('passwd'), utf8('salt'), 1, 64))).toBe(
      '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783',
    );
    expect(toHex(pbkdf2Sha256(utf8('clave'), utf8('sal'), 1000, 32))).toBe(
      nodeCrypto.pbkdf2Sync('clave', 'sal', 1000, 32, 'sha256').toString('hex'),
    );
  });

  it('guarda con sal propia y verifica solo la contraseña correcta', () => {
    const stored = hashPassword('secreto1', undefined, 200);
    expect(hasLocalPassword(stored)).toBe(true);
    expect(stored).not.toContain('secreto1');
    expect(verifyPassword('secreto1', stored)).toBe(true);
    expect(verifyPassword('secreto2', stored)).toBe(false);
    expect(hashPassword('secreto1', undefined, 200)).not.toBe(stored); // otra sal
    expect(hasLocalPassword('')).toBe(false);
    expect(verifyPassword('x', 'basura')).toBe(false);
  });
});
