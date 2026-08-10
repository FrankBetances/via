/* -------------------------------------------------------------------------- */
/*  Gate: la tabla de opcodes no se edita a mano.                                */
/*                                                                             */
/*  El equivalente de `scripts/check-lua-protocol.js` en Valeria+, adaptado a la  */
/*  copia vendorizada de este repositorio. Regenera desde `src/Lua/protocol.json` */
/*  y compara con `src/Lua/luaProtocol.ts`.                                      */
/*                                                                             */
/*  El bug que evita es el caro de un periférico: firmware y app entendiendo el   */
/*  mismo byte de forma distinta. No se manifiesta como error de compilación ni   */
/*  como test rojo — se manifiesta como una mascota que hace cosas raras en la    */
/*  consulta. Aquí ya pasó una vez en su peor forma: una tabla escrita a mano que */
/*  no coincidía en NADA con la del aparato.                                     */
/* -------------------------------------------------------------------------- */

export {};

/* El proyecto no incluye @types/node (tipado RN puro): los globals que Jest sí
 * provee se declaran localmente, como en `verbalAssets.test.ts`. */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const ROOT: string = path.resolve(__dirname, '..', '..', '..');
const generator = require(path.join(ROOT, 'scripts', 'build-lua-protocol.js'));

describe('src/Lua/luaProtocol.ts está generado y al día', () => {
  it('coincide byte a byte con lo que produce protocol.json', () => {
    const actual = fs.readFileSync(path.join(ROOT, 'src', 'Lua', 'luaProtocol.ts'), 'utf8');
    expect(actual).toBe(generator.render());
  });

  it('lleva el aviso de generado y la referencia a la fuente única', () => {
    const actual: string = fs.readFileSync(path.join(ROOT, 'src', 'Lua', 'luaProtocol.ts'), 'utf8');
    expect(actual).toContain('GENERADO por scripts/build-lua-protocol.js');
    expect(actual).toContain('FrankBetances/Valeria');
    expect(actual).toContain('firmware/lua/protocol.json');
  });

  it('el cuerpo es el mismo que consume Valeria+, para que el diff sea la cabecera', () => {
    // El cuerpo empieza en la declaración de la versión de protocolo. Si alguien
    // reordena el generador, los dos repositorios dejan de poder compararse de un
    // vistazo y este test lo dice.
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'Lua', 'protocol.json'), 'utf8'));
    const body: string = generator.renderBody(p);
    expect(body).toContain(`export const LUA_PROTOCOL_VERSION = ${p.version};`);
    expect(body).toContain(`export const LUA_SERVICE_UUID = '${p.service.uuid}';`);
    for (const op of p.opcodes) {
      expect(body).toContain(`  ${op.key}: 0x${op.code.toString(16).padStart(2, '0').toUpperCase()},`);
    }
  });
});

describe('la fuente vendorizada no se toca a mano', () => {
  it('protocol.json se declara fuente única y nombra a VIA+ como consumidor', () => {
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'Lua', 'protocol.json'), 'utf8'));
    expect(p.note).toContain('VIA+');
    expect(p.version).toBe(1);
  });

  it('ninguna característica transporta texto: es el Zero-PHI estructural', () => {
    // La garantía no es «no enviamos nombres», es que no existe el sitio donde
    // meterlos. Si alguien añadiera una característica de cadena, se vería aquí.
    const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'Lua', 'protocol.json'), 'utf8'));
    for (const c of p.characteristics) {
      expect(typeof c.bytes).toBe('number');
      expect(c.bytes).toBeLessThanOrEqual(20);
    }
  });
});
