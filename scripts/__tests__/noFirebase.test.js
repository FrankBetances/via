/* -------------------------------------------------------------------------- */
/*  VIA+ no usa Firebase desde el 2/11/2026 (decisión de Frank). Ningún build  */
/*  lo llegó a inicializar —no había google-services.json— y aun así se       */
/*  compilaban tres módulos nativos y el alta decía «Firebase no configurado». */
/*  Este test impide que vuelva por la puerta de atrás: dependencia,          */
/*  plugin de Gradle o import en `src/`.                                      */
/* -------------------------------------------------------------------------- */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const walk = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : walk(full);
    return /\.(ts|tsx|js)$/.test(entry.name) ? [full] : [];
  });

describe('sin Firebase', () => {
  it('package.json no declara ningún paquete de Firebase', () => {
    const pkg = JSON.parse(read('package.json'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter(name => /firebase/i.test(name))).toEqual([]);
  });

  it('Gradle no aplica google-services', () => {
    expect(read('android/build.gradle')).not.toMatch(/google-services|com\.google\.gms/);
    expect(read('android/app/build.gradle')).not.toMatch(/google-services|com\.google\.gms/);
  });

  it('ningún fichero de src/ importa Firebase', () => {
    const offenders = walk(path.join(ROOT, 'src')).filter(file =>
      /from ['"]@?(react-native-)?firebase|require\(['"]@?(react-native-)?firebase|@react-native-firebase/.test(
        fs.readFileSync(file, 'utf8'),
      ),
    );
    expect(offenders.map(f => path.relative(ROOT, f))).toEqual([]);
  });
});
