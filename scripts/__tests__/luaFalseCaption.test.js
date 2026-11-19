/* -------------------------------------------------------------------------- */
/*  Incidente del 3/11/2026 (docs/incidente-2026-11-03-pie-lua.md).            */
/*                                                                            */
/*  Un pie inventado («aún no está fabricada y la luz del cubo todavía no     */
/*  tiene programa») llegó a la app publicada. Era falso: el muñeco está hecho */
/*  y el material y las luces están probados (Frank). Se quitó de la pantalla */
/*  y, el 19/11/2026, también del catálogo. Este test falla si vuelve.        */
/* -------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');

const I18N = path.join(__dirname, '..', '..', 'src', 'I18n');

const FALSE_CLAIMS = [
  /no está fabricada/i,
  /non está fabricada/i,
  /ez dago fabrikatuta/i,
  /no està fabricada/i,
  /not manufactured yet/i,
  /no tiene programa/i,
  /non ten programa/i,
  /ez du programarik/i,
  /no té programa/i,
  /has no program/i,
];

describe('el pie falso de Lúa no está en el catálogo', () => {
  const files = fs.readdirSync(I18N).filter(f => f.startsWith('strings.') && f.endsWith('.ts'));

  it('hay catálogos que revisar', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it.each(files)('%s no afirma que Lúa no esté fabricada ni que la luz no tenga programa', f => {
    const code = fs.readFileSync(path.join(I18N, f), 'utf8');
    expect(code).not.toMatch(/mascotRenderCaption/);
    for (const claim of FALSE_CLAIMS) expect(code).not.toMatch(claim);
  });
});
