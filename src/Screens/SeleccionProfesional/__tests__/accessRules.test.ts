/* C5 · Acceso del profesional: contraseña (PBKDF2 local), perfil antiguo sin contraseña y
 * ida y vuelta por los repositorios REALES sobre SQLite en memoria (sql.js).
 *
 * QUÉ NO PRUEBA: el coste de las 10 000 iteraciones en Hermes (no medido), ni el
 * driver nitro-sqlite del dispositivo, ni las pantallas (no se montan). */
jest.mock('@/Database/config', () => require('../../../../jest/memoryDataSource').configMock());

import { AppDataSource } from '@/Database/config';
import {
  hashPassword,
  hasLocalPassword,
  isPasswordHashWellFormed,
  PASSWORD_ITERATIONS,
  PASSWORD_MIN_LENGTH,
  toHex,
  verifyPassword,
} from '@/Helpers/passwordHash';
import { Professional } from '@/Models/Professional/Professional';
import { ProfessionalRepository } from '@/Repositories/ProfessionalRepository';
import {
  decideAccess,
  isCreatingPassword,
  isRegistrationEmailOk,
  isRegistrationPasswordOk,
} from '../accessRules';

declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');
const nodeCrypto = require('crypto');

const SALT_A = new Uint8Array(16).map((_, i) => i + 1);
const SALT_B = new Uint8Array(16).map((_, i) => i + 2);
const FAST = 50; // iteraciones bajas: solo para no gastar tiempo en tests que no miden coste

beforeAll(async () => {
  await AppDataSource.initialize();
});
afterAll(async () => {
  await AppDataSource.destroy();
});

describe('hashPassword / verifyPassword', () => {
  it('contraseña correcta verifica; incorrecta no', () => {
    const stored = hashPassword('secreto1', SALT_A, FAST);
    expect(verifyPassword('secreto1', stored)).toBe(true);
    expect(verifyPassword('secreto2', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
    expect(verifyPassword('SECRETO1', stored)).toBe(false);
  });

  it('una contraseña que es prefijo o extensión de la correcta no verifica', () => {
    const stored = hashPassword('secreto1', SALT_A, FAST);
    expect(verifyPassword('secreto', stored)).toBe(false);
    expect(verifyPassword('secreto12', stored)).toBe(false);
    expect(verifyPassword('secreto1 ', stored)).toBe(false);
  });

  it('sal distinta da hash distinto para la misma contraseña, y cada hash solo verifica con lo suyo', () => {
    const a = hashPassword('secreto1', SALT_A, FAST);
    const b = hashPassword('secreto1', SALT_B, FAST);
    expect(a).not.toBe(b);
    expect(a.split('$')[3]).not.toBe(b.split('$')[3]);
    expect(verifyPassword('secreto1', a)).toBe(true);
    expect(verifyPassword('secreto1', b)).toBe(true);
  });

  it('sin sal explícita, dos llamadas dan sales (y hashes) distintos', () => {
    const a = hashPassword('secreto1', undefined, FAST);
    const b = hashPassword('secreto1', undefined, FAST);
    expect(a.split('$')[2]).not.toBe(b.split('$')[2]);
    expect(a).not.toBe(b);
  });

  it('formato almacenado estable: pbkdf2-sha256$<iteraciones>$<sal hex>$<hash hex>, igual que PBKDF2 de Node', () => {
    const stored = hashPassword('clave-ñ', SALT_A, 10);
    expect(stored).toMatch(/^pbkdf2-sha256\$10\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    const expected = nodeCrypto.pbkdf2Sync('clave-ñ', SALT_A, 10, 32, 'sha256').toString('hex');
    expect(stored).toBe(`pbkdf2-sha256$10$${toHex(SALT_A)}$${expected}`);
  });

  it('por defecto guarda PASSWORD_ITERATIONS iteraciones (10 000)', () => {
    expect(PASSWORD_ITERATIONS).toBe(10000);
    expect(hashPassword('secreto1', SALT_A).split('$')[1]).toBe('10000');
  });

  it('el hash no contiene la contraseña en claro', () => {
    expect(hashPassword('secreto1', SALT_A, FAST)).not.toContain('secreto1');
  });

  it('formatos mal formados no verifican', () => {
    const good = hashPassword('secreto1', SALT_A, FAST);
    const [tag, it_, salt, hash] = good.split('$');
    expect(verifyPassword('secreto1', '')).toBe(false);
    expect(verifyPassword('secreto1', 'basura')).toBe(false);
    expect(verifyPassword('secreto1', `md5$${it_}$${salt}$${hash}`)).toBe(false);
    expect(verifyPassword('secreto1', `${tag}$${it_}$${salt}`)).toBe(false);
    expect(verifyPassword('secreto1', `${good}$extra`)).toBe(false);
    for (const bad of ['0', '-5', '1.5', 'NaN', 'abc', '']) {
      expect(verifyPassword('secreto1', `${tag}$${bad}$${salt}$${hash}`)).toBe(false);
    }
  });

  it('un hash con bytes de más, o con un byte cambiado, no verifica', () => {
    const good = hashPassword('secreto1', SALT_A, FAST);
    expect(verifyPassword('secreto1', `${good}00`)).toBe(false);
    const flipped = `${good.slice(0, -1)}${good.endsWith('0') ? '1' : '0'}`;
    expect(verifyPassword('secreto1', flipped)).toBe(false);
  });

  // FALLO REAL: `verifyPassword` toma la longitud del hash de lo que venga en la fila
  // (`expected.length`) y compara solo esa longitud. Un valor almacenado con el hash
  // vacío —`pbkdf2-sha256$<n>$<sal>$`— deriva 0 bytes, el bucle no compara nada y
  // `diff === 0`: devuelve TRUE para CUALQUIER contraseña. Y `hasLocalPassword` lo da
  // por «contraseña local», así que la pantalla de acceso lo VERIFICA en vez de crearla.
  // Alcanzable con una fila truncada o corrupta; no con el alta normal.
  it('un hash almacenado vacío NO verifica ninguna contraseña (arreglado el 18/11/2026)', () => {
    const [tag, it_, salt] = hashPassword('secreto1', SALT_A, FAST).split('$');
    expect(verifyPassword('cualquier cosa', `${tag}$${it_}$${salt}$`)).toBe(false);
  });

  // FALLO REAL (misma causa): un hash TRUNCADO es prefijo del bueno y verifica la
  // contraseña correcta; con 1 byte, además, acepta una contraseña errónea 1 de cada 256.
  it('un hash almacenado truncado (prefijo del bueno) NO verifica (arreglado el 18/11/2026)', () => {
    const good = hashPassword('secreto1', SALT_A, FAST);
    const truncated = good.slice(0, good.lastIndexOf('$') + 1 + 2); // 1 byte del hash
    expect(verifyPassword('secreto1', truncated)).toBe(false);
  });

  // FALLO REAL (misma familia): `hasLocalPassword` solo mira el prefijo de la etiqueta.
  // Resuelto el 19/11/2026 («arréglalo todo», Frank): un hash dañado sigue por la
  // vía de VERIFICAR —si pasara a «crear contraseña», cualquiera podría quedarse
  // con el perfil—, verifyPassword lo rechaza y la pantalla dice que la
  // contraseña guardada está dañada, no «contraseña incorrecta».
  it('un hash dañado queda bloqueado y se reconoce como dañado', () => {
    for (const broken of ['pbkdf2-sha256$', 'pbkdf2-sha256$10000$', 'pbkdf2-sha256$10000$abc$def']) {
      expect(hasLocalPassword(broken)).toBe(true);
      expect(isPasswordHashWellFormed(broken)).toBe(false);
      expect(verifyPassword('secreto1', broken)).toBe(false);
    }
    expect(isPasswordHashWellFormed(hashPassword('secreto1', SALT_A, FAST))).toBe(true);
  });

  it('la pantalla de acceso avisa del hash dañado antes de verificar', () => {
    const code: string = fs.readFileSync(
      path.join(__dirname, '..', 'SeleccionProfesionalScreen.tsx'),
      'utf8',
    );
    expect(code).toMatch(/isPasswordHashWellFormed\(authTarget\.passwordHash\)[\s\S]{0,120}contrasenaGuardadaDanada/);
  });

  it('hasLocalPassword: vacío, nulo y otros formatos son «sin contraseña»', () => {
    expect(hasLocalPassword('')).toBe(false);
    expect(hasLocalPassword(null)).toBe(false);
    expect(hasLocalPassword(undefined)).toBe(false);
    expect(hasLocalPassword('$2b$10$abcdef')).toBe(false);
    expect(hasLocalPassword(hashPassword('x1y2z3', SALT_A, FAST))).toBe(true);
  });
});

describe('accessRules == pantallas (leídas como texto)', () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
  const norm = (s: string) => s.replace(/\s+/g, ' ');
  const SELECCION = norm(read('SeleccionProfesional', 'SeleccionProfesionalScreen.tsx'));
  const REGISTRO = norm(read('RegistroProfesional', 'RegistroProfesionalScreen.tsx'));
  const RULES = norm(read('SeleccionProfesional', 'accessRules.ts'));

  it('«perfil antiguo sin contraseña la crea» y la decisión de acceso, literales', () => {
    for (const frag of [
      '!hasLocalPassword(authTarget.passwordHash)',
      'if (!verifyPassword(password, authTarget.passwordHash)) {',
      'if (password.length < PASSWORD_MIN_LENGTH) {',
    ]) {
      expect(SELECCION).toContain(frag);
    }
    expect(RULES).toContain('!hasLocalPassword(passwordHash)');
    expect(RULES).toContain('if (!verifyPassword(password, passwordHash as string)) {');
    expect(RULES).toContain('if (password.length < PASSWORD_MIN_LENGTH) {');
  });

  it('el mínimo del alta (literal 6) coincide con PASSWORD_MIN_LENGTH del acceso', () => {
    const reg = REGISTRO.match(/const passwordOk = password\.length >= (\d+);/);
    const own = RULES.match(/isRegistrationPasswordOk = \(password: string\): boolean => password\.length >= (\d+);/);
    expect(reg).not.toBeNull();
    expect(own).not.toBeNull();
    expect(Number(own![1])).toBe(Number(reg![1]));
    expect(Number(reg![1])).toBe(PASSWORD_MIN_LENGTH);
  });

  it('el regex de correo del alta es el mismo', () => {
    const rx = String.raw`/^\S+@\S+\.\S+$/.test(email.trim())`;
    expect(REGISTRO).toContain(`const emailOk = ${rx};`);
    expect(RULES).toContain(rx);
  });
});

describe('accessRules · decisiones', () => {
  it('perfil antiguo sin contraseña: la CREA en el primer acceso (si llega al mínimo)', () => {
    expect(isCreatingPassword('')).toBe(true);
    expect(isCreatingPassword(null)).toBe(true);
    expect(decideAccess('abcdef', '')).toBe('create');
    expect(decideAccess('abcde', '')).toBe('too-short-to-create');
    expect(decideAccess('a'.repeat(PASSWORD_MIN_LENGTH), '')).toBe('create');
  });

  it('perfil con contraseña: verifica; no crea ni acepta otra', () => {
    const stored = hashPassword('secreto1', SALT_A, FAST);
    expect(isCreatingPassword(stored)).toBe(false);
    expect(decideAccess('secreto1', stored)).toBe('verified');
    expect(decideAccess('otra-cosa', stored)).toBe('incorrect');
    // Una contraseña corta pero correcta verifica: el mínimo solo rige al CREAR.
    const short = hashPassword('abc', SALT_A, FAST);
    expect(decideAccess('abc', short)).toBe('verified');
  });

  it('alta: contraseña de al menos 6 y correo con forma de correo', () => {
    expect(isRegistrationPasswordOk('12345')).toBe(false);
    expect(isRegistrationPasswordOk('123456')).toBe(true);
    expect(isRegistrationEmailOk(' ana@centro.es ')).toBe(true);
    for (const bad of ['', 'ana', 'ana@', 'ana@centro', '@centro.es', 'a b@c.es']) {
      expect(isRegistrationEmailOk(bad)).toBe(false);
    }
  });
});

describe('ida y vuelta del profesional con contraseña (repositorio real, SQLite en memoria)', () => {
  it('alta con contraseña: se guarda, se relee y verifica solo la correcta', async () => {
    const p = new Professional();
    p.fullName = 'Ana Pérez';
    p.role = 'logopeda';
    p.licenseNumber = 'COL-001';
    p.email = 'ana@centro.es';
    p.passwordHash = hashPassword('secreto1');
    p.centerId = null;
    const saved = await ProfessionalRepository.createProfessional(p);
    expect(saved.id).toBeGreaterThan(0);

    const byEmail = await ProfessionalRepository.getProfessionalByEmail('ana@centro.es');
    expect(byEmail?.id).toBe(saved.id);
    expect(byEmail?.passwordHash).toBe(p.passwordHash);
    expect(byEmail?.passwordHash).not.toContain('secreto1');
    expect(isCreatingPassword(byEmail!.passwordHash)).toBe(false);
    expect(decideAccess('secreto1', byEmail!.passwordHash)).toBe('verified');
    expect(decideAccess('secreto2', byEmail!.passwordHash)).toBe('incorrect');
    expect((await ProfessionalRepository.getProfessionalByLicense('COL-001'))?.id).toBe(saved.id);
  });

  it('alta repetida con el mismo correo: la pantalla la detecta por getProfessionalByEmail', async () => {
    expect(await ProfessionalRepository.getProfessionalByEmail('ana@centro.es')).not.toBeNull();
    expect(await ProfessionalRepository.getProfessionalByEmail('otra@centro.es')).toBeNull();
  });

  it('perfil antiguo sin contraseña: primer acceso la crea, se persiste y el segundo acceso la VERIFICA', async () => {
    const legacy = new Professional();
    legacy.fullName = 'Luis Antiguo';
    legacy.role = 'medico';
    legacy.licenseNumber = '';
    legacy.email = null;
    legacy.centerId = null;
    // Sin `passwordHash`: la columna toma su valor por defecto ''.
    const saved = await ProfessionalRepository.createProfessional(legacy);

    const listed = (await ProfessionalRepository.getAllProfessionals()).find(x => x.id === saved.id)!;
    expect(listed.passwordHash).toBe('');
    expect(decideAccess('nueva-clave', listed.passwordHash)).toBe('create');
    expect(decideAccess('corta', listed.passwordHash)).toBe('too-short-to-create');

    // Lo que hace handleConfirmPassword al crearla.
    const stored = hashPassword('nueva-clave');
    const updated = Object.assign(new Professional(), listed, { passwordHash: stored });
    await ProfessionalRepository.updateProfessional(updated);

    const row = await ProfessionalRepository.getProfessionalById(saved.id);
    expect(row?.passwordHash).toBe(stored);
    expect(row?.fullName).toBe('Luis Antiguo');
    expect(decideAccess('nueva-clave', row!.passwordHash)).toBe('verified');
    expect(decideAccess('otra-clave', row!.passwordHash)).toBe('incorrect');
  });
});
