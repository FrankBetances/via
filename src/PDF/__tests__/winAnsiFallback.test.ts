import { PDFDocument, StandardFonts } from 'pdf-lib';

import { AudiometryDetail } from '@/PDF/blocks/AudiometryDetail';
import { renderAudiometryInterpretation } from '@/PDF/nlgReportEngine';
import { installWinAnsiFallback } from '@/PDF/winAnsiFallback';

/* -------------------------------------------------------------------------- */
/*  «Exportar PDF» fallaba: el bloque de audiometría dibujaba la frase del     */
/*  motor («≤ 20 dB HL») con Helvetica y pdf-lib lanzaba «WinAnsi cannot      */
/*  encode». El primer test REPRODUCE el fallo sin la red; el segundo         */
/*  comprueba que con la red el mismo bloque se dibuja y el PDF se guarda.    */
/*  El orden importa: la red es global y no se desinstala.                    */
/* -------------------------------------------------------------------------- */

const audiometry = () => {
  const thresholds = {
    OD: { 500: 10, 1000: 15, 2000: 10, 4000: 20 },
    OI: { 500: 10, 1000: 10, 2000: 10, 4000: 10 },
  };
  return {
    id: 1,
    method: 'play',
    transducer: 'air',
    thresholds,
    noResponseAtMax: { OD: [], OI: [] },
    ptaOD: 14,
    ptaOI: 10,
    reliability: 90,
    interpretation: renderAudiometryInterpretation(thresholds, 'es', { OD: [], OI: [] }),
    notes: '',
    evaluatorName: 'Evaluadora',
    evaluatorLicense: '123',
    completedAt: new Date(2026, 10, 2),
  } as never;
};

const draw = async () => {
  const doc = await PDFDocument.create();
  const fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    semiBold: await doc.embedFont(StandardFonts.HelveticaBold),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const t = (_k: string, fallback?: string | Record<string, unknown>) =>
    typeof fallback === 'string' ? fallback : _k;
  await AudiometryDetail({ test: audiometry() }, { page: doc.addPage([595, 842]), fonts, t });
  return doc.save();
};

describe('PDF · texto que Helvetica no codifica', () => {
  it('la frase del motor lleva «≤» (el carácter que tumbaba el PDF)', () => {
    expect(renderAudiometryInterpretation({ OD: { 500: 10, 1000: 10, 2000: 10, 4000: 10 }, OI: {} }, 'es')).toContain('≤');
  });

  it('SIN la red, el bloque de audiometría lanza (el fallo de «Exportar PDF»)', async () => {
    await expect(draw()).rejects.toThrow(/WinAnsi cannot encode/);
  });

  it('CON la red, el mismo bloque se dibuja y el PDF se guarda', async () => {
    installWinAnsiFallback();
    const bytes = await draw();
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it('sustituye por equivalentes legibles y deja intacto lo que sí se codifica', async () => {
    installWinAnsiFallback();
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    // Mismo ancho que el texto sustituido: prueba que se midió «<= 20», no «≤ 20».
    expect(font.widthOfTextAtSize('≤ 20 · SpO₂ → ✓ 🎉', 10)).toBe(
      font.widthOfTextAtSize('<= 20 · SpO2 -> v ?', 10),
    );
    expect(font.widthOfTextAtSize('Oído «á» – ’', 10)).toBeGreaterThan(0);
  });
});
