<div align="center">

# ⟁ VIA+

### Valoración Interactiva de Audición y Lenguaje

Herramienta de apoyo a la decisión clínica en audición, lenguaje y neurodesarrollo pediátricos,
para tableta Android.

*Software propietario de Earlify Health S.L. · Todos los derechos reservados*

</div>

---

> ⚠️ **Aviso de seguridad clínica.** VIA+ apoya la decisión del profesional; no emite
> diagnósticos ni sustituye su juicio. Su uso está restringido a entornos clínicos con un
> profesional cualificado presente, que es el responsable de interpretar todos los resultados.

## Índice

- [Qué es VIA+](#qué-es-via)
- [Estado regulatorio](#estado-regulatorio)
- [Módulos](#módulos)
- [Flujo de una sesión](#flujo-de-una-sesión)
- [Idiomas y voz](#idiomas-y-voz)
- [Privacidad y datos](#privacidad-y-datos)
- [Arquitectura](#arquitectura)
- [Desarrollo](#desarrollo)
- [Automatización](#automatización)
- [Documentación](#documentación)
- [Estado del proyecto](#estado-del-proyecto)
- [Licencia y seguridad](#licencia-y-seguridad)

---

## Qué es VIA+

Una batería de pruebas pediátricas, en buena parte gamificadas, que el profesional aplica en una
tableta Android. Recoge respuestas, mide señales de audio y redacta un informe PDF con una
síntesis por reglas que el profesional revisa y firma.

**Qué NO hace VIA+:**

| Restricción | Motivo |
|---|---|
| Emitir diagnósticos | Es apoyo a la decisión, no un sistema diagnóstico |
| Calificar un resultado como «normal» o «patológico» | Fuera del alcance validado: describe y señala |
| Recomendar tratamientos | Competencia del profesional |
| Funcionar sin supervisión | Diseñado para uso supervisado |

Principios de diseño que se mantienen en todo el código:

- **Sin conexión.** Todo funciona sin red; los datos clínicos no salen del dispositivo.
- **Cero IA en el dispositivo.** Los modelos de voz neuronal solo corren al preparar el
  contenido; la app reproduce audio ya empaquetado y mide con algoritmos deterministas. Decisión
  registrada en el [ADR de inferencia](./docs/design/adr-inferencia-en-dispositivo.md).
- **Informe por reglas.** El motor de síntesis (`src/PDF/nlgReportEngine.ts`) no genera texto
  libre: cada frase sale de una regla con su identificador y de un dato medido, y sus cortes
  viven en un solo sitio (`src/PDF/nlgThresholds.ts`), con su
  [matriz de evidencia](./docs/design/matriz-evidencia-nlg.md).
- **Nada falla en silencio.** Si falta un dato, la app lo dice; nunca cae en el resultado
  favorable.

---

## Estado regulatorio

VIA+ se desarrolla con la finalidad de ser un **Software como Dispositivo Médico (SaMD) de
Clase IIa** según el Reglamento (UE) 2017/745 (Regla 11), con el software en **Clase B** de la
IEC 62304. **No tiene marcado CE** y no se ha presentado a un organismo notificado.

| Norma | Estado |
|---|---|
| MDR 2017/745 (marcado CE) | Pendiente |
| IEC 62304 (ciclo de vida del software) | En implementación |
| ISO 14971 (gestión de riesgos) | En implementación; expediente formal pendiente |
| IEC 62366-1 (usabilidad) | En implementación (telemetría de usabilidad sin datos del paciente) |
| ISO 13485 (sistema de calidad) | Pendiente |
| RGPD / LOPDGDD | En implementación; ver [Privacidad y datos](#privacidad-y-datos) |
| Reglamento (UE) 2024/1689 (IA) | Fuera de alcance por diseño: no hay inferencia en el dispositivo |

---

## Módulos

Trece módulos clínicos, elegidos desde el hub de la batería:

| # | Módulo | Qué necesita |
|---|---|---|
| 1 | Evaluación clínica previa (CAP): otoscopia y capacidades visual, verbal y motora | — |
| 2 | Cuestionario de autismo M-CHAT-R | — |
| 3 | Sonómetro de sala, en dB(A) | Micrófono |
| 4 | Audiometría infantil (tonal) | Salida de audio |
| 5 | Audiometría condicionada («el tren del sonido») | Salida de audio |
| 6 | Análisis acústico de voz (F0, jitter, shimmer, HNR, formantes, GRBAS) | Micrófono |
| 7 | Exploración de disfagia MECV-V | Pulsioxímetro (hoy, sensor de demostración) |
| 8 | Cribado SAHS infantil | — |
| 9 | Articulación (T.A.R.) | Micrófono; reconocimiento de voz opcional |
| 10 | Audiometría verbal | Salida de audio |
| 11 | Funciones ejecutivas | — |
| 12 | Análisis prosódico | Micrófono |
| 13 | Cribado de hitos del lenguaje ASHA | — |

Pantallas de apoyo, que no son módulos clínicos:

- **Comprobar audio:** recorre la cadena de audio y dice qué eslabón falla.
- **Informe de arranque:** si la app no arranca, muestra el error en pantalla.
- **Resultados preliminares, Resultados finales e Historial del paciente.**

**El reconocimiento de voz del T.A.R. solo se usa si puede ocurrir en el propio dispositivo.**
Si no, la prueba sigue con clasificación manual.

---

## Flujo de una sesión

```
Acceso del profesional (contraseña local)
  → Paciente (alta o búsqueda)
  → Consentimiento informado firmado          (sin él no empiezan las pruebas)
  → Evaluación clínica previa (CAP)           («NO APTO» se avisa en el hub; no bloquea)
  → Sonómetro de sala                         (para las pruebas auditivas)
  → Hub de la batería: cada prueba se guarda y se vuelve al hub, con las hechas marcadas
  → Resultados preliminares → Resultados finales
  → Informe PDF con síntesis por reglas, notas y firma del profesional
  → Finalizar: la evaluación queda cerrada
```

---

## Idiomas y voz

La interfaz y la sesión están en **siete variedades**: castellano, galego, euskara, català,
español de Latinoamérica, español dominicano e inglés. Toda la interfaz se lee del catálogo de
`src/I18n/`; un gate (`scripts/check-ui-strings.js`) falla si un `.tsx` pinta texto fijo.

- **Castellano, gallego, euskera y dominicano** tienen banco verbal y corpus de voz completos.
- **Catalán, inglés y español de Latinoamérica** son provisionales: usan el banco castellano o
  solo tienen las consignas, y la pantalla lo advierte.
- Las voces se sintetizan antes de compilar, con motores abiertos (`tools/nos/`), y van
  empaquetadas en la app. Cada lengua lleva su revisión clínica documentada en `docs/design/`.
- La app cae de forma ordenada si falta un audio: recorte empaquetado, luego la voz del sistema,
  luego silencio. La pantalla «Comprobar audio» lo detecta.

---

## Privacidad y datos

| Dato | Dónde vive | ¿Sale del dispositivo? |
|---|---|---|
| Pacientes, evaluaciones y resultados | Base SQLite local (`viaplus.db`) | No |
| Grabaciones de audio | Solo en memoria, para medir | No |
| Cuenta del profesional | Base local; contraseña como PBKDF2-SHA256 con sal | No |
| Informes PDF | Carpeta de la app, con copia en la carpeta que elija el profesional | Solo si el profesional lo comparte |
| Telemetría de usabilidad | Memoria; se exporta en un QR anónimo | Solo si el profesional lo exporta |

La app **no usa ningún servicio remoto**.

**Lo que todavía no está**, y no se afirma en ningún sitio:

- La base de datos **no está cifrada**: lo protege el cifrado del propio dispositivo, que el
  centro debe activar. Hay un estudio de viabilidad en
  [`docs/informes/`](./docs/informes/2026-11-17-d1-viabilidad-cifrado.md).
- El nombre y la fecha de nacimiento del paciente se guardan **en claro**. Las primitivas de
  cifrado están escritas y probadas, pero sin conectar.
- No hay registro de auditoría ni borrado verificable.

La política de privacidad publicada está en [`site/privacidad.html`](./site/privacidad.html).

---

## Arquitectura

React Native 0.81.5 con TypeScript y módulos Expo SDK 54 sobre flujo *bare*. Solo hay
aplicación Android: el directorio `ios-native/` es un demostrador visual en SwiftUI, sin módulos
clínicos.

```
src/
├── Screens/        Una carpeta por pantalla; la lógica clínica pura va en .ts con sus tests
├── PDF/            Informe: plantilla, bloques por módulo, motor de síntesis y cortes clínicos
├── Models/         Entidades TypeORM
├── Repositories/   Acceso a la base local
├── Database/       DataSource, lista de entidades y driver sobre react-native-nitro-sqlite
├── Audio/          AudioContext compartido (react-native-audio-api)
├── Voice/          Capa de voz: recortes empaquetados (expo-audio) y voz del sistema (expo-speech)
├── I18n/           Catálogos de interfaz de las siete variedades
├── Telemetry/      Telemetría de usabilidad sin datos del paciente
├── Lua/            Periférico de refuerzo Lúa (BLE); sin hardware no hace nada
├── Startup/        Barrera de error e informe de arranque
├── Store/          Redux Toolkit
├── Navigators/     Navegación y cierre de módulo
├── Components/     Componentes comunes
├── Theme/          Tokens de diseño
└── Helpers/        Utilidades (contraseñas, cifrado, escritura con verificación…)
```

| Función | Motor |
|---|---|
| Voz del sistema | `expo-speech` |
| Reconocimiento de voz (T.A.R.) | `expo-speech-recognition`, solo en el dispositivo |
| Locuciones empaquetadas | `expo-audio` |
| Tonos de audiometría y captura de audio | `react-native-audio-api` |
| Base de datos | TypeORM sobre `react-native-nitro-sqlite` |
| Informes | `pdf-lib` |

`CLAUDE.md` explica por qué se usa cada motor y qué no se debe cambiar.

---

## Desarrollo

Requisitos: Node.js 20, Android Studio con el SDK de Android y, solo para preparar voces o
validar la acústica, Python 3.11 y ffmpeg.

```bash
npm ci --legacy-peer-deps     # la misma orden que el CI
npm start                     # servidor Metro
npm run android               # compilar e instalar en Android
```

**Gates obligatorios antes de subir cambios**, en este orden:

```bash
npx tsc --noEmit
npx jest
npx eslint . --ext .js,.jsx,.ts,.tsx           # cero errores y cero avisos
node scripts/check-verbal-coverage.js --strict
node scripts/check-lua-sprite.js
node scripts/build-launcher-icons.js --check
node scripts/resize-verbal-images.js --check
node scripts/build-lua-protocol.js --check
node scripts/check-ui-strings.js
npm run lint:md
```

- Un cambio de texto **locutado** lleva `node scripts/export-voice-corpus.js` y
  `node scripts/build-voice-asset-map.js` en el mismo commit.
- **Antes de tocar el código, lee `CLAUDE.md`**: recoge las reglas de trabajo del repositorio.

---

## Automatización

| Workflow | Qué hace |
|---|---|
| `android-release.yml` | Compila y firma APK y AAB. Solo publica los ficheros si se lanza a mano o con una etiqueta `v*`; un push a `main` compila sin publicar |
| `voice-assets.yml` | Sintetiza las locuciones de los siete idiomas en ramas de trabajo |
| `acoustic-validation.yml` | Contrasta el análisis acústico con Praat sobre señales sintéticas |
| `markdown-lint.yml` | Ejecuta `npm run lint:md` |
| `codeql.yml` | Análisis estático de seguridad |
| `pages.yml` | Publica el sitio público y la política de privacidad |

Que el análisis acústico coincida con Praat sobre señales sintéticas prueba que el cálculo es
correcto. No prueba que la medida sea válida sobre la voz real de un niño.

---

## Documentación

| Documento | Contenido |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Reglas de trabajo del repositorio |
| [`docs/PLAN-MEJORA-APP.md`](./docs/PLAN-MEJORA-APP.md) | Plan de mejora en curso y lista de pendientes |
| [`docs/PLAN-DE-TRABAJO.md`](./docs/PLAN-DE-TRABAJO.md) | Plan de producto (documento interno) |
| [`docs/recorrido-emulador.md`](./docs/recorrido-emulador.md) | Guion para recorrer los módulos (escrito para el emulador; vale para la tableta) |
| [`docs/design/`](./docs/design/) | Diseño de cada módulo, voz, audio y matriz de evidencia del informe |
| [`docs/informes/`](./docs/informes/) | Informes técnicos: cortes clínicos, textos, cifrado, accesibilidad |
| [`docs/manual/`](./docs/manual/manual.html) | Manual de usuario |
| [`docs/SECURITY-GOBERNANZA.md`](./docs/SECURITY-GOBERNANZA.md) | Controles de seguridad del repositorio |

---

## Estado del proyecto

- **Construido:**
  - los trece módulos;
  - el informe PDF con síntesis por reglas;
  - el cierre de la evaluación;
  - el historial del paciente;
  - las siete variedades de interfaz.
- **Comprobado en dispositivo:** la cadena de salida de audio, con las cuatro escuchas de
  «Comprobar audio».
- **Sin comprobar en dispositivo:** el recorrido completo de los trece módulos, el PDF real y el
  selector de carpetas. Las pruebas se hacen en una tableta Android.
- **Pendiente:**
  - cifrado de la base de datos y seudonimización efectiva;
  - registro de auditoría y borrado verificable;
  - expediente de gestión de riesgos;
  - bancos verbales propios de catalán e inglés;
  - recuperación de contraseña.

El detalle, con lo que está decidido y lo que falta por decidir, está en
[`docs/PLAN-MEJORA-APP.md`](./docs/PLAN-MEJORA-APP.md) §9.

---

## Licencia y seguridad

VIA+ es software propietario de **Earlify Health S.L.** Queda prohibido usarlo, copiarlo,
modificarlo o distribuirlo sin un acuerdo de licencia vigente. Los términos completos están en
[`LICENSE.md`](./LICENSE.md).

Para notificar una vulnerabilidad o un incidente de seguridad, usa los canales privados de
[`.github/SECURITY.md`](./.github/SECURITY.md). **No abras un issue público.**

<div align="center">

*VIA+ · Earlify Health S.L. · © 2024–2026*

</div>
