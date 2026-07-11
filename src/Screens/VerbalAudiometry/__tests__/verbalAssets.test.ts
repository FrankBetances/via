import { registeredVerbalAssets } from '../verbalAssets';
import { VERBAL_BANDS, collectAssetInventory } from '../verbalAudiometryLists';
import { VERBAL_GLYPHS } from '../verbalAudiometryGlyphs';

/* -------------------------------------------------------------------------- */
/*  Pruebas del registro de assets: el banco de estímulos, el registro         */
/*  generado (verbalAssets.ts), los archivos en disco y el manifiesto de       */
/*  producción no pueden divergir. Si cambian las listas, este test exige      */
/*  regenerar assets y registro (`node scripts/verbal-assets.js`).             */
/* -------------------------------------------------------------------------- */

/* El proyecto no incluye @types/node (tipado RN puro): los globals de Node
 * que Jest sí provee se declaran localmente para poder verificar el disco. */
declare function require(name: string): any;
declare const __dirname: string;
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio', 'verbal');
const IMG_DIR = path.join(ROOT, 'assets', 'img', 'verbal');
const MANIFEST = path.join(ROOT, 'assets', 'verbal-manifest.json');

describe('registro de assets · completitud contra el inventario', () => {
  const inventory = collectAssetInventory();
  const registered = registeredVerbalAssets();

  it('el registro cubre exactamente el inventario de audio (37 objetivos)', () => {
    expect(registered.audio).toEqual(inventory.audio);
  });

  it('el registro cubre exactamente el inventario de imágenes', () => {
    expect(registered.images).toEqual(inventory.images);
  });

  it('todos los archivos de audio existen en assets/audio/verbal', () => {
    for (const key of inventory.audio) {
      expect(fs.existsSync(path.join(AUDIO_DIR, `${key}.m4a`))).toBe(true);
    }
  });

  it('todos los archivos de imagen existen en assets/img/verbal', () => {
    for (const key of inventory.images) {
      expect(fs.existsSync(path.join(IMG_DIR, `${key}.png`))).toBe(true);
    }
  });

  it('el manifiesto de producción está sincronizado con el inventario', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
    expect(manifest.audio.map((e: { key: string }) => e.key)).toEqual(inventory.audio);
    expect(manifest.images.map((e: { key: string }) => e.key)).toEqual(inventory.images);
    // Mientras las locuciones/ilustraciones sean sintéticas debe declararse.
    expect(manifest.provisional).toBe(true);
  });
});

describe('pictogramas provisionales', () => {
  it('todas las claves del mapa de pictogramas son palabras reales del banco', () => {
    const words = new Set(
      VERBAL_BANDS.flatMap(b => b.items.flatMap(i => i.options.map(o => o.word))),
    );
    for (const word of Object.keys(VERBAL_GLYPHS)) {
      expect(words).toContain(word);
    }
  });
});
