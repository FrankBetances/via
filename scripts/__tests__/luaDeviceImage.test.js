/* -------------------------------------------------------------------------- */
/*  La imagen de Lúa en «Conoce a Lúa» es la Lúa V5 del repositorio            */
/*  lua-firmware (3/11/2026), no la gata astronauta de antes. Se comprueba:    */
/*  · que las salidas son las que generó `build-lua-device-image.js` (hash),   */
/*    para que nadie las retoque a mano sin dejar rastro de dónde salen;       */
/*  · tamaño y fondo transparente;                                            */
/*  · que la pantalla las usa y ya no carga la imagen vieja;                  */
/*  · que el recorte no se come lo gris que está DENTRO del muñeco.           */
/* -------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { decodePng } = require('../lib/png');
const { removeBackground } = require('../build-lua-device-image');

const ROOT = path.resolve(__dirname, '..', '..');
const IMG = path.join(ROOT, 'assets', 'img');
const origin = JSON.parse(fs.readFileSync(path.join(IMG, 'lua_v5_luz.origen.json'), 'utf8'));

describe('imagen de Lúa V5', () => {
  it('viene de lua-firmware y está declarada como render', () => {
    expect(origin.fuente).toBe('github.com/FrankBetances/lua-firmware');
    expect(origin.ruta).toBe('docs/cad/lua-v5/luz');
    expect(origin.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(origin.nota).toMatch(/render/i);
    expect(Object.keys(origin.colores)).toEqual(['naranja', 'azul', 'verde']);
  });

  it('cada salida es la que generó el script: mismo hash, tamaño y fondo transparente', () => {
    for (const entry of Object.values(origin.colores)) {
      for (const [name, { lado, sha256 }] of Object.entries(entry.salidas)) {
        const buf = fs.readFileSync(path.join(IMG, name));
        expect(crypto.createHash('sha256').update(buf).digest('hex')).toBe(sha256);
        const png = decodePng(buf);
        expect([png.width, png.height]).toEqual([lado, lado]);
        const alphaAt = (x, y) => png.rgba[(y * png.width + x) * 4 + 3];
        expect([alphaAt(0, 0), alphaAt(lado - 1, 0), alphaAt(0, lado - 1), alphaAt(lado - 1, lado - 1)]).toEqual([
          0, 0, 0, 0,
        ]);
        expect(alphaAt(lado / 2, lado / 2)).toBe(255); // el centro es el muñeco
      }
    }
  });

  it('la pantalla carga la Lúa V5 y no la imagen anterior', () => {
    const src = fs.readFileSync(path.join(ROOT, 'src/Screens/PresentacionLua/PresentacionLuaScreen.tsx'), 'utf8');
    for (const color of ['naranja', 'azul', 'verde']) {
      expect(src).toContain(`assets/img/lua_v5_luz_${color}.png`);
    }
    expect(src).not.toContain('lua_mascot_device');
    expect(fs.existsSync(path.join(IMG, 'lua_mascot_device.png'))).toBe(false);
  });

  it('quita el gris del estudio pero no el gris encerrado en el muñeco', () => {
    // 9×9: fondo gris, un cuadrado turquesa de 5×5 y dentro un píxel gris (el ojo).
    const w = 9;
    const rgba = Buffer.alloc(w * w * 4);
    for (let y = 0; y < w; y++) {
      for (let x = 0; x < w; x++) {
        const o = (y * w + x) * 4;
        const inside = x >= 2 && x <= 6 && y >= 2 && y <= 6;
        const [r, g, b] = inside ? [90, 180, 175] : [134, 135, 136];
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = 255;
      }
    }
    const eye = (4 * w + 4) * 4;
    rgba[eye] = rgba[eye + 1] = rgba[eye + 2] = 134;
    const out = removeBackground(rgba, w, w);
    expect(out[3]).toBe(0); // esquina: fondo
    expect(out[eye + 3]).toBe(255); // el ojo gris sigue ahí
  });
});
