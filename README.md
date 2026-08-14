<div align="center">

# ⟁ VIA+
### Valoración Interactiva de Audición y Lenguaje

**Software como Dispositivo Médico (SaMD) · Clase IIa · MDR 2017/745**

[![Regulatory Status](https://img.shields.io/badge/SaMD-Class%20IIa%20MDR-blue?style=flat-square)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0745)
[![IEC 62304](https://img.shields.io/badge/IEC%2062304-Class%20B-yellow?style=flat-square)](#normativas-aplicables)
[![ISO 14971](https://img.shields.io/badge/ISO%2014971-Risk%20Management-orange?style=flat-square)](#normativas-aplicables)
[![GDPR](https://img.shields.io/badge/GDPR%2FLOPDGDD-Privacy%20by%20Design-green?style=flat-square)](#privacidad-y-datos)
[![Idiomas](https://img.shields.io/badge/Idiomas-es%20gl%20eu%20es--DO-purple?style=flat-square)](#idiomas-y-voz-neuronal)
[![License](https://img.shields.io/badge/License-Proprietary-red?style=flat-square)](./LICENSE)

*Parte del ecosistema [Earlify Health](https://futureforkids.eu) · Detección temprana en salud pediátrica*

</div>

---

> ⚠️ **AVISO DE SEGURIDAD CLÍNICA**
>
> VIA+ es una herramienta de **apoyo a la decisión clínica**. Bajo ninguna circunstancia emite
> diagnósticos automatizados ni sustituye el juicio del profesional sanitario. El uso está
> **estrictamente restringido** a entornos clínicos bajo supervisión de un profesional cualificado.
> La interpretación de todos los resultados es responsabilidad exclusiva del clínico evaluador.

---

## Índice

- [¿Qué es VIA+?](#qué-es-via)
- [Características Principales](#características-principales)
- [Marco Regulatorio](#marco-regulatorio)
- [Arquitectura del Sistema](#arquitectura-del-sistema)
- [Flujo Clínico](#flujo-clínico)
- [Idiomas y Voz Neuronal](#idiomas-y-voz-neuronal)
- [Privacidad y Datos](#privacidad-y-datos)
- [Telemetría de Usabilidad (Zero-PHI)](#telemetría-de-usabilidad-zero-phi)
- [Stack Tecnológico](#stack-tecnológico)
- [Instalación y Configuración](#instalación-y-configuración)
- [Módulos de la Aplicación](#módulos-de-la-aplicación)
- [Lúa (periférico de refuerzo)](#lúa-periférico-de-refuerzo)
- [Herramientas de Build-Time](#herramientas-de-build-time)
- [Automatización (CI/CD)](#automatización-cicd)
- [Distribución y Sitio Público](#distribución-y-sitio-público)
- [Documentación del Repositorio](#documentación-del-repositorio)
- [Gestión de Riesgos](#gestión-de-riesgos)
- [Contribución al Proyecto](#contribución-al-proyecto)
- [Ecosistema Earlify Health](#ecosistema-earlify-health)
- [Estado del Proyecto](#estado-del-proyecto)
- [Licencia](#licencia)
- [Contacto](#contacto)

---

## ¿Qué es VIA+?

VIA+ (**V**aloración **I**nteractiva de **A**udición y Lenguaje) es un **Software como Dispositivo Médico (SaMD) de Clase IIa** que actúa como herramienta de apoyo a la decisión clínica (CDSS) para profesionales sanitarios especializados en:

| Dominio | Función de VIA+ |
|---|---|
| **Audiología pediátrica** | Tamizaje auditivo y audiometría condicionada gamificada |
| **Logopedia y lenguaje** | Logoaudiometría, discriminación auditiva y repetición verbal |
| **Neurodesarrollo** | Indicadores conductuales de atención, cognición y procesamiento |

La aplicación opera sobre **tablets iOS/Android** en entornos clínicos bajo supervisión profesional directa, capturando biomarcadores vocales y respuestas conductuales a través de baterías de pruebas gamificadas adaptadas a la población pediátrica.

### ¿Qué NO hace VIA+?

| Restricción | Fundamento |
|---|---|
| ❌ Emitir diagnósticos automatizados | Requeriría clasificación SaMD Clase III |
| ❌ Sustituir el juicio clínico | Función de apoyo, no de reemplazo |
| ❌ Interpretar resultados como patológicos/normales | Fuera del alcance validado |
| ❌ Recomendar tratamientos | Competencia exclusiva del clínico |
| ❌ Funcionar sin supervisión profesional | Diseñado y validado solo en contexto supervisado |

---

## Características Principales

- 🎮 **Baterías gamificadas** — 12 módulos de evaluación adaptados al paciente pediátrico
- 🔇 **Offline-first** — Operación completa sin conexión; los datos clínicos del paciente residen solo en el dispositivo
- 🌐 **Cuatro lenguas de sesión** — Castellano · Galego · Euskara · Español dominicano, con [banco de estímulos y voz propios](#idiomas-y-voz-neuronal)
- 🧠 **Cero IA en el dispositivo** — Los modelos neuronales solo corren en **build-time**; la app reproduce audio ya empaquetado y mide con DSP determinista. Principio **ratificado** en [ADR de inferencia en el dispositivo](./docs/design/adr-inferencia-en-dispositivo.md)
- 🔐 **Privacidad por diseño** — Datos clínicos locales · TLS 1.3 en tránsito · seudonimización del NHC ([estado real de los controles](#controles-de-seguridad))
- 📋 **Consentimiento informado digital** — Gestión legal obligatoria para tutores legales
- 🏥 **Pre-screening clínico** — Certificado de Aptitud para la Prueba (CAP) integrado
- 📄 **Informes PDF** — Generación automática de informes clínicos estructurados
- 🔑 **Identidad del profesional** — Firebase Authentication (email/contraseña) + sincronización del perfil en Firestore
- 🎙️ **Audio clínico medido** — Sonómetro en **dB(A)** (IEC 61672) con calibración de campo persistida y análisis acústico [validado contra Praat](#herramientas-de-build-time)
- 👁️ **UX dual** — Modo Profesional analítico y Modo Niño lúdico en un único dispositivo
- 🗂️ **Historial longitudinal** — Resultados de la sesión y sesiones anteriores del paciente accesibles desde el hub
- 📊 **Telemetría de usabilidad Zero-PHI** — Fricción de uso + percepción del clínico (Likert), exportadas en un QR anónimo (IEC 62366-1), sin tocar la base de datos clínica
- 🐈‍⬛ **Lúa, refuerzo fuera de la medición** — Soporte del periférico BLE de Valeria+ reducido a la [recompensa de cierre](#lúa-periférico-de-refuerzo): el aparato **no está presente mientras se mide**, y sin hardware todo el módulo es *no-op*. La dirección amplió el alcance el 14/8/2026 —espejo durante la batería y alertas sonoras—, sin implementar todavía: [decisión y matriz](./docs/design/lua-salida-y-alertas-sonoras.md)

---

## Marco Regulatorio

### Clasificación MDR

VIA+ está clasificado como **SaMD Clase IIa** según el Reglamento (UE) 2017/745 (MDR), bajo la **Regla 11 MDR** (software que influye en decisiones clínicas).

```
Finalidad prevista:  Apoyo a la decisión diagnóstica en audiología y lenguaje pediátrico
Gravedad:            Moderada (pérdida auditiva, trastornos del lenguaje en edad temprana)
Clase resultante:    IIa
Ruta de conformidad: Organismo Notificado (ON) requerido para marcado CE
```

### Normativas Aplicables

| Norma | Ámbito | Estado |
|---|---|---|
| **MDR 2017/745** | Clasificación y marcado CE | 🔴 En proceso |
| **IEC 62304:2006+AMD1:2015** | Ciclo de vida del software médico · **Clase B** | 🟡 En implementación |
| **IEC 62366-1:2015** | Ingeniería de usabilidad para dispositivos médicos · [telemetría Zero-PHI](#telemetría-de-usabilidad-zero-phi) | 🟡 En implementación |
| **ISO 14971:2019** | Gestión de riesgos en el ciclo de vida | 🟡 En implementación |
| **ISO 13485:2016** | Sistema de Gestión de Calidad | 🔴 Pendiente |
| **GDPR / LOPDGDD** | Protección de datos sanitarios | 🟡 En implementación |
| **HL7 FHIR R4** | Interoperabilidad con HCE | 🟡 En implementación |
| **Reglamento (UE) 2024/1689 (IA)** | Sistemas de IA de alto riesgo | ⚪ **Fuera de alcance por diseño** — ver [ADR](./docs/design/adr-inferencia-en-dispositivo.md) |

> **Reglamento de IA:** VIA+ **no embarca modelos de inferencia**. Un modelo cuya salida propusiera una
> clasificación clínica, en un producto MDR de Clase IIa (organismo notificado), tendría muy probablemente
> la consideración de **sistema de IA de alto riesgo**, con obligaciones propias encima de las del MDR.
> Mantener el principio deja esa vía cerrada por diseño; el análisis completo y la decisión firmada están
> en el [ADR de inferencia en el dispositivo](./docs/design/adr-inferencia-en-dispositivo.md).

<!-- Separador: dos citas independientes, no una continuación. -->

> **IEC 62304 — Clase de Seguridad B:** Un fallo en el software podría generar datos erróneos que, sin el adecuado escrutinio clínico del profesional, podría conducir a una decisión subóptima. El riesgo de lesión directa es bajo gracias a la supervisión obligatoria.

---

## Arquitectura del Sistema

Estructura real del repositorio (React Native + TypeScript, `@/` → `src/`):

```
via/
├── src/
│   ├── Screens/                 # Una carpeta por pantalla (22 rutas en RootStackParamList)
│   │   ├── Splash · Bienvenida · Creditos            # Arranque, acceso e identidad del proyecto
│   │   ├── SeleccionProfesional · RegistroProfesional
│   │   ├── Pacientes · RegistroPaciente · Consentimiento
│   │   ├── ClinicalAssessment · AutismScreening · RoomNoiseCheck
│   │   ├── Audiometry · AudiometryConditioned · VerbalAudiometry
│   │   ├── VoiceAnalysis · Articulation · DysphagiaTest
│   │   ├── SahsScreening · ExecutiveFunctions
│   │   ├── SeleccionEjercicios                       # Hub de la batería + idioma de sesión
│   │   └── ResultadosPreliminares · ResultadosFinal · HistorialPaciente
│   │
│   ├── Voice/                   # Capa de voz neuronal multi-idioma (es · gl · eu · es-DO)
│   │   ├── voiceCorpusId        # Contrato de id por hash de contenido (PURO, build+runtime)
│   │   ├── viaVoiceCorpus       # Enumeración del corpus (consignas + bancos locutables)
│   │   ├── viaVoiceAssets       # GENERADO: mapa id → asset empaquetado
│   │   ├── viaVoice             # speak(): cadena de degradación elegante (asset → TTS → silencio)
│   │   └── viaVoicePlayback     # Reproducción del recorte (react-native-audio-api)
│   │
│   ├── Audio/                   # AudioContext compartido (48 kHz) para toda la app
│   ├── Lua/                     # Periférico de refuerzo BLE (proyecto de FrankBetances/Valeria)
│   │   ├── protocol.json        # Fuente vendorizada del enlace (copia byte a byte)
│   │   ├── luaProtocol          # GENERADO del .json: UUIDs, opcodes, límites, trama CTRL
│   │   ├── luaWire              # Trama SAFE y desglose de STATE, leídos del firmware
│   │   ├── luaAdapter           # Adaptador único + fachada no-op sin hardware
│   │   ├── clinicalSilence      # SAFE al abrirse una captura (defensa en profundidad)
│   │   ├── closingReward        # Única integración: recompensa en ResultadosFinal
│   │   ├── useLua               # useLuaClosingReward() y useLuaDiagnostics()
│   │   └── installLua           # Instalación conjunta: adaptador BLE + silencio clínico
│   ├── Telemetry/               # Telemetría de usabilidad Zero-PHI (singleton + hook useRef)
│   │   ├── telemetryStore       # Estado efímero fuera del árbol React
│   │   ├── useTelemetryTracker  # Hook silencioso: solo useRef → cero re-render
│   │   └── buildTelemetryPayload# JSON estricto {s,b,l,d,f} + compresión LZString
│   │
│   ├── Models/                  # Entidades TypeORM (Patient, Evaluation, *Test…)
│   ├── Repositories/            # Repositorios singleton por entidad
│   ├── Database/                # DataSource + driver nitro-sqlite + migraciones
│   ├── Services/
│   │   ├── firebase/            # Auth (email/contraseña) + perfil professionals/{uid}
│   │   └── local/               # Servicios locales core + por módulo
│   ├── PDF/                     # Plantillas y bloques de los informes clínicos
│   ├── Store/                   # Redux Toolkit (auth · theme · locale · patient…)
│   ├── Navigators/              # Native Stack + finishModule (salida de módulo)
│   ├── Components/              # Common · Survey · Themed · Mascot (LuaPixel, copia con gate)
│   ├── I18n/                    # Catálogos i18next (es · en · es-DO) — preparado
│   ├── Theme/                   # Tokens de diseño Gluestack
│   └── Helpers/
│
├── assets/
│   ├── audio/verbal/<lang>/     # Recortes de estímulo de la audiometría verbal
│   ├── voice/<id>.m4a           # Corpus general de consignas locutadas
│   ├── img/verbal/              # Ilustraciones de las láminas
│   └── verbal-approval.*.json   # Actas de aprobación clínica por idioma
│
├── scripts/                     # Pipeline de voz + gates (protocolo y sprite de Lúa)
├── tools/
│   ├── nos/                     # Motor de voz neuronal (ILENIA · Proxecto Nós · AhoTTS · Piper)
│   └── acoustics/               # Banco de validación del DSP contra Praat
│
├── android/ · ios-native/       # App Android (RN) y port nativo SwiftUI (parcial)
├── site/                        # Sitio público + política de privacidad (GitHub Pages)
└── docs/                        # Diseño, manual de usuario, capturas, gobernanza
```

### Modelo de Datos (Entidades Principales)

```
Professional ──── Session ──────── TestResult
      │               │                  │
      │               │             AudioCapture
  Patient ── Consent ─┤
      │           │   │
      │           │   └── PreScreening (CAP)
      └── CAP ────┘
```

---

## Flujo Clínico

El siguiente flujo es **obligatorio** y no puede omitirse. Cada fase es un prerequisito de la siguiente.

```
[0] ACCESO PROFESIONAL
      │  Autenticación del profesional sanitario
      ▼
[1] IDENTIFICACIÓN DEL PACIENTE
      │  Búsqueda o alta del paciente pediátrico
      ▼
[2] CONSENTIMIENTO INFORMADO ⚠️ BLOQUEANTE
      │  Firma digital del tutor legal (obligatoria)
      │  → Sin CI válido: acceso denegado a evaluación
      ▼
[3] PRE-SCREENING CLÍNICO (CAP) ⚠️ BLOQUEANTE
      │  Checklist médico: capacidad visual, motora, auditiva y cognitiva
      │  → CAP NO APTO: bloqueo + sugerencia de metodologías alternativas
      ▼
[4] HUB DE LA BATERÍA (SeleccionEjercicios)
      │  Idioma de la sesión (es · gl · eu · es-DO) → consignas y banco de estímulos
      │  Selección y orden de los módulos · estado del motor de voz (con reintento)
      ▼
[5] BATERÍA DE EVALUACIÓN GAMIFICADA
      │  12 módulos adaptados al perfil del paciente (clínicos + gamificados)
      │  Modo Niño: interfaz lúdica sin elementos clínicos visibles
      │  Al guardar cada módulo, `finishModule` lleva a los resultados de la sesión
      │  → Sin refuerzo del periférico Lúa en ninguna medición (ver §Lúa)
      ▼
[6] GENERACIÓN DE RESULTADOS
      │  Informe PDF estructurado para el profesional
      │  Datos clínicos persistidos localmente (SQLite del dispositivo)
      │  Telemetría de usabilidad: Likert del clínico → QR anónimo (Zero-PHI)
      │  Recompensa de Lúa (ResultadosFinal), ya con los datos sellados y solo si hay aparato
      ▼
[7] ARCHIVO Y SEGUIMIENTO
         Historial de sesiones anteriores del paciente (HistorialPaciente),
         accesible desde la lista de pacientes y desde el hub
```

### Pre-Screening — Checklist CAP

El profesional debe confirmar las siguientes capacidades **antes** de iniciar la evaluación:

| # | Capacidad | Evaluación |
|---|---|---|
| 1 | **Visual** | Identificación de estímulos en pantalla |
| 2 | **Motora fina** | Interacción táctil (drag & drop, tap) en tablet |
| 3 | **Auditiva periférica** | Percepción basal para recibir instrucciones |
| 4 | **Estado cognitivo** | Alerta y atención mínimas para tareas lúdicas |

---

## Idiomas y Voz Neuronal

VIA+ se aplica en **cuatro lenguas o variantes de sesión**. El idioma se elige en el hub de la
batería (`SeleccionEjercicios`), se **persiste** en `state.locale.language` (whitelist de
`redux-persist`) y determina dos cosas distintas: el **banco de estímulos** (contenido clínico) y
la **voz** que locuta (consignas y modelos hablados).

| Lengua | Banco verbal | Locuciones del estímulo | Consignas locutadas | Estado clínico |
|---|---|---|---|---|
| **es** — Español (España) | Base: 38 láminas, bandas A–D | ✅ empaquetadas | ✅ 91 recortes | 🟢 Validado |
| **gl** — Galego | Banco propio, 38 láminas (Proxecto Nós) | ✅ voz Celtia | ⬜ voz del sistema | 🟢 Banco aprobado por **ACOPROS** (2026-07-28) |
| **eu** — Euskara | Banco propio, 37 láminas (sibilantes, vibrante múltiple, diptongos decrecientes) | ✅ voz AhoTTS Maider | ⬜ voz del sistema | 🟡 **Provisional** — falta firma de logopeda euskaldun |
| **es-DO** — Español dominicano · *Quisqueya Habla* | Hereda el banco `es` con auditoría fonética caribeña (hoy **0 sustituciones firmadas**) | ✅ 37/37 aprobadas (2026-07-19) | ✅ 86 recortes | 🟢 Audio aprobado para los archivos actuales |

> El aviso de «banco provisional» y el de «estímulo no definitivo» se muestran **en la pantalla
> donde se elige el idioma**, no enterrados en la documentación. La audiometría verbal además
> **sanea** el idioma recibido (`resolveVerbalLang`): un valor persistido de una versión anterior
> degrada a castellano en vez de tumbar la pantalla.

### Principio rector: cero IA en el dispositivo

Los modelos neuronales de síntesis **solo se ejecutan en build-time** (`tools/nos/`). En runtime la
app únicamente **reproduce ficheros ya empaquetados** o cae a la voz del sistema operativo. VIA+
sigue siendo offline-first y no incorpora inferencia de IA como parte del dispositivo médico.

| Lengua | Motor (build-time) | Voz | Proyecto |
|---|---|---|---|
| `es` | Piper (VITS/ONNX) | `es_ES-sharvard-medium` (`lengthScale` 1.1) | rhasspy/piper-voices |
| `gl` | Coqui TTS (VITS grafemas) | **Celtia** | **Proxecto Nós / ILENIA** |
| `eu` | **AhoTTS** (VITS + frontend vasco) | **Maider** (respaldo Antton) | **HiTZ/Aholab · UPV/EHU** (ILENIA / NEL-GAITU) |
| `es-DO` | Piper (VITS/ONNX) | `es_MX-claude-high` (neutra LatAm, provisional) | rhasspy/piper-voices |

> La voz **neural es la vía por defecto de todos los idiomas**, castellano incluido.
> `VERBAL_TTS=espeak` queda solo como degradación explícita para entornos sin acceso a los pesos
> (y no cubre `gl` ni `eu`). Las voces están declaradas en `tools/nos/voices.json`; los `lengthScale`
> son parámetros **de la voz**, no del banco. El castellano usó `es_ES-davefx-medium` y hubo que
> retirarlo: desplomaba los monosílabos («pan» 116 ms frente a los 386 ms de es-DO) y ni realentizarlo
> recorte a recorte lo levantaba hasta el suelo de 350 ms. Ahora usa **sharvard**, la voz castellana de
> referencia de Valeria+, de donde ya venían las otras tres.

### Contrato del corpus de voz

```
id = [${lang}_]${style}_${fnv1a32(normalize(text))}_${len}
```

- **`style`** ∈ `tutor | child | clinical | slow` — la prosodia se **hornea** en el audio.
- **`lang`** ∈ `es | gl | eu | es-DO` — la base `es` no lleva prefijo (retro-compat de assets).
- La **misma función** calcula el id en build y en runtime (`src/Voice/voiceCorpusId.ts`, módulo
  puro). Si un literal cambia en el código, cambia su id, el mapa deja de resolver y la locución
  **cae limpiamente a la voz del sistema**: la deriva degrada calidad, nunca rompe.

**Cadena de degradación de `speak()`:** asset neuronal de la lengua → asset neuronal base `es` →
voz del sistema con la mejor voz verificada de esa lengua → silencio (el clínico lee la consigna).

### Corpus general y pipeline

El corpus enumerable actual tiene **177 entradas** (`es` 91 · `es-DO` 86): las 5 consignas de
Funciones Ejecutivas (solo `es` mientras el revisor lingüístico no firme el delta) y los 86 modelos
hablados del T.A.R. en sus dos variantes. El inventario del T.A.R. se **deriva de
`buildArticulationItems()`** —la misma función que dicta la pantalla—, así que corpus e inventario
no pueden divergir. `gl` y `eu` no tienen entradas propias todavía: sus consignas caen a la voz del
sistema y el T.A.R. reutiliza el recorte base `es` (la palabra evaluada sigue siendo la castellana).

```bash
node scripts/export-voice-corpus.js      # corpus puro → voice-corpus.json (valida colisiones)
node scripts/synthesize-voice-corpus.js  # síntesis incremental → assets/voice/<id>.m4a
node scripts/build-voice-asset-map.js    # assets presentes → src/Voice/viaVoiceAssets.ts
node scripts/verbal-assets.js            # recortes de la audiometría verbal por idioma
node scripts/check-verbal-coverage.js    # puerta de cobertura de locuciones (usada en release)
```

Documentos de diseño: [`arquitectura-corpus-voz.md`](./docs/design/arquitectura-corpus-voz.md) ·
[`integracion-proxecto-nos.md`](./docs/design/integracion-proxecto-nos.md) (gallego) ·
[`integracion-quisqueya-habla.md`](./docs/design/integracion-quisqueya-habla.md) (dominicano) ·
[`validacion-clinica-verbal.md`](./docs/design/validacion-clinica-verbal.md).

---

## Privacidad y Datos

VIA+ implementa un modelo de **privacidad por diseño** (Privacy by Design, GDPR Art. 25):

### Dónde vive cada dato

| Dato | Ubicación | Sale del dispositivo |
|---|---|---|
| Evaluaciones, umbrales, puntuaciones | SQLite local (`viaplus.db`) | ❌ Nunca |
| Grabaciones y capturas de audio/vídeo | Almacenamiento local del dispositivo | ❌ Nunca |
| Informes PDF | Generados en el dispositivo | Solo si el clínico los comparte |
| Identidad del profesional (correo, ficha) | Firebase Auth + `professionals/{uid}` | ✅ Sí (única sincronización) |
| Telemetría de usabilidad | Memoria (singleton efímero) | Solo si el clínico exporta el QR |

> **Alcance de la nube (Firestore):** solo se sincroniza el **perfil del profesional
> autenticado** (`professionals/{uid}`). Los datos clínicos del paciente (evaluaciones,
> capturas de audio, informes) **permanecen locales al dispositivo y nunca llegan a
> Firestore** — así lo imponen las reglas de seguridad de Firestore (`firestore.rules`).

La política de privacidad publicada (obligatoria para la ficha de Google Play) es la
**declaración pública** de todo esto: [`site/privacidad.html`](./site/privacidad.html).

### Seudonimización

El esquema de `Patient` separa la **referencia seudonimizada** del dato clínico: `idHash`
(referencia derivada del NHC) y columnas `nameEnc` / `dobEnc` para los identificadores directos.
Las sesiones y los resultados apuntan a la fila del paciente, no al NHC.

> ⚠️ **Estado real de la implementación.** El esquema está modelado, pero la **capa de seguridad
> que aplica el HMAC-SHA256 y el AES-256-GCM aún no está implementada**: hoy el nombre y la fecha
> de nacimiento se guardan **en claro** en las columnas `*Enc` (ver la nota en
> `src/Models/Patient/Patient.ts` y en `RegistroPacienteScreen.tsx`). Mientras eso sea así, la
> garantía de confidencialidad la aporta el **cifrado del propio dispositivo**, que el centro debe
> activar. No se afirma cifrado en reposo en la política publicada precisamente por esto.

### Controles de Seguridad

| Control | Estándar | Implementación | Estado |
|---|---|---|---|
| Datos clínicos sin salida a la nube | GDPR Art. 25 | Reglas de Firestore + persistencia local | 🟢 Implementado |
| Cifrado en tránsito | TLS 1.3 | Firebase Auth/Firestore (único tráfico) | 🟢 Implementado |
| Aislamiento de la telemetría | IEC 62366-1 | Singleton en memoria, Zero-PHI | 🟢 Implementado |
| Consentimiento informado bloqueante | GDPR / LOPDGDD | Firma del tutor previa a la evaluación | 🟢 Implementado |
| Cifrado en reposo | AES-256-GCM (SQLCipher) | Pendiente: hoy SQLite sin cifrar | 🔴 Pendiente |
| Seudonimización efectiva | GDPR Art. 4(5) | Esquema listo; HMAC/AES sin cablear | 🔴 Pendiente |
| Control de acceso | RBAC | Roles: Médico, Logopeda, Psicopedagogo, Enfermero | 🟡 Parcial |
| Auditoría | IEC 62304 | Log inmutable de eventos clínicos y de acceso | 🔴 Pendiente |
| Borrado seguro | LOPDGDD | Eliminación verificable al revocar consentimiento | 🔴 Pendiente |

> **Permisos que conviene no maquillar.** El permiso de **ubicación** existe únicamente para poder
> escanear el pulsioxímetro BLE en Android ≤ 11 (`maxSdkVersion=30`, y en Android 12+ el escaneo va
> con `BLUETOOTH_SCAN … neverForLocation`): VIA+ **no geolocaliza**. El **reconocimiento de voz** del
> T.A.R. lo realiza el motor del sistema operativo, que según el dispositivo puede procesar el audio
> en la nube de su proveedor; la prueba puede aplicarse sin él (SODA manual).

---

## Telemetría de Usabilidad (Zero-PHI)

VIA+ registra la **fricción de uso** de la batería y la **percepción del profesional** para
alimentar la ingeniería de usabilidad (**IEC 62366-1**) con datos de campo, **sin comprometer
la privacidad del paciente**. Al cerrar la batería, el payload se exporta en un **código QR
anónimo** que el clínico o el evaluador de usabilidad captura con otro dispositivo.

### Garantía Zero-PHI

| Propiedad | Implementación |
|---|---|
| **Sin datos del paciente** | El payload no contiene NHC, nombre, ni el `id` clínico. Nada reidentifica al paciente |
| **`sessionId` no reversible** | 8 caracteres aleatorios (base36), **no** derivado del NHC ni del `id` |
| **Efímero, en memoria** | Vive en un singleton de módulo; **nunca** toca Firestore, SQLite ni `redux-persist` |
| **Aislado de lo clínico** | La captura de telemetría es independiente de las entidades y repositorios clínicos |

### Arquitectura

- **Store singleton (`src/Telemetry/telemetryStore.ts`)** — El estado vive **fuera del árbol
  React**, porque las 9 pruebas son rutas hermanas del *native-stack* (sin contenedor que las
  envuelva); un `useRef`/`useState` de pantalla se perdería al desmontarse. El singleton
  sobrevive a toda la navegación hasta la pantalla de cierre. `startSession()` reinicia el
  estado (sin sesión zombie entre pacientes).
- **Hook silencioso (`useTelemetryTracker`)** — Solo `useRef`, **cero `useState`** → **cero
  re-render** provocado por la telemetría (rendimiento innegociable en dispositivos de gama
  baja). Inyectado en el hub de la batería (`SeleccionEjercicios`) y en las 9 pantallas de
  módulo.
- **Claves de reactivo con *namespace* por módulo** (`art-`, `aut-`, `sah-`, `aud-`, `auc-`,
  `ver-`, `ef-`, `voz-`, `dis-`) — Toda la batería comparte una única sesión; el prefijo evita
  que el ítem 1 de un cuestionario colisione con el ítem 1 de otro.

### Formato del payload y compresión

JSON estricto con **claves de un solo carácter** y **arrays anónimos** para minimizar bytes:

```jsonc
{
  "s": "AB12CD34",   // sessionId Zero-PHI (8 chars)
  "b": "e7",         // ID de batería: bitmask base36 de los módulos elegidos
  "l": 4,            // Likert 1–5 (percepción de facilidad de uso)
  "d": 842000,       // duración total de la batería (ms)
  "f": [[1, 3200, 0], [2, 1500, 1]]  // [id_ordinal, tiempo_ms, rectificaciones] por reactivo
}
```

- **Compresión:** `LZString.compressToEncodedURIComponent` (ASCII URL-safe, 1 byte/char en el
  QR). A escala de batería reduce **~32 %** frente al JSON crudo y **~49 %** frente a Base64
  (Base64 no comprime: infla +33 %).
- **QR:** `react-native-qrcode-svg` con **`ecl='Q'` (25 % de recuperación)** — óptimo medido
  entre tolerancia a arañazos de pantalla y densidad de módulos legible por cámaras de baja
  resolución.
- **Bloqueo del Likert:** el QR **no se revela** hasta que el clínico marca la escala Likert
  (1 = «Muy difícil» → 5 = «Muy fácil»), para mitigar la caída de tasa de respuesta por fatiga
  al terminar la evaluación.

### Cobertura de instrumentación (10/10 módulos)

Cada módulo emite eventos con su granularidad natural (tiempo = respuesta; 2.ª+ clasificación
= rectificación):

| Módulo | Reactivo | Cierre |
|---|---|---|
| Autismo M-CHAT-R · SAHS | ítem del cuestionario | respuesta Sí/No |
| Audiometría · Condicionada | umbral (oído+frecuencia / campo libre) | umbral confirmado |
| Audiometría Verbal | lámina (nivel dB + índice) | selección de tarjeta |
| Funciones Ejecutivas | mini-juego (5 dominios) | fin del juego |
| Análisis de Voz | toma de captura + 5 dimensiones GRBAS | análisis / puntuación GRBAS |
| Disfagia MECV-V | bolo (viscosidad × volumen) | avance de bolo |
| Articulación · T.A.R. | ítem (fonema) | clasificación SODA |
| Análisis Prosódico | toma de habla conectada | análisis de la muestra |

> Los «Sí/No» de las audiometrías son el *bracketing* de Hughson-Westlake (protocolo), **no**
> fricción; por eso esos módulos miden por umbral confirmado, no por pulsación.

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| **Frontend / App** | React Native 0.80.1 · TypeScript 5.4 | Multiplataforma iOS/Android (prioritario); optimizado para tablet |
| **UI / Design system** | Gluestack UI v1 + `lucide-react-native` | Sistema de diseño consistente, tokens propios (`Theme/gluestack-ui.config.ts`) |
| **Estado** | Redux Toolkit + redux-persist | Estado global offline-first (whitelist `theme`, `locale`) |
| **Persistencia local** | TypeORM 0.3.x + `react-native-nitro-sqlite` (SQLite) | Offline-first; `synchronize: true`; driver propio síncrono; repositorios singleton |
| **Preferencias del dispositivo** | `@react-native-async-storage/async-storage` | Calibración de campo del sonómetro (propiedad del terminal, no de la sesión) |
| **Navegación** | React Navigation v7 (Native Stack + Bottom Tabs) | Flujo Home → Paciente → Evaluación → Módulo → Resultado |
| **Formularios** | react-hook-form + Yup | Validación de cuestionarios y formularios clínicos |
| **Síntesis de tono + DSP de audio** | `react-native-audio-api` (Software Mansion, sobre Oboe en Android) | Tonos puros (audiometrías) y captura/análisis PCM (voz y sonómetro), sobre un **único `AudioContext` compartido a 48 kHz** (`src/Audio`) |
| **Captura de nivel sonoro** | `react-native-audio-api` (`AudioRecorder`) | Sonómetro Ambiental: ponderación **A con estado** (IEC 61672) → **LAeq** + percentiles L10/L90 |
| **Capa de voz de la app** | `src/Voice` sobre `react-native-tts` + assets `.m4a` | Un solo motor de voz para toda la app: recorte neuronal → recorte base `es` → voz del sistema → silencio |
| **Grabación/reproducción + voz** | `react-native-audio-recorder-player` · `@react-native-voice/voice` | Articulación T.A.R. (repetición y auto-evaluación); el reconocedor arranca con la etiqueta de la lengua y reintenta con la base |
| **Permisos runtime** | `react-native-permissions` | Micrófono y Bluetooth (escaneo + conexión), unificados Android/iOS. La app **no declara permiso de cámara** |
| **Pulsioximetría BLE** | `react-native-ble-plx` (perfil Pulse Oximeter 0x1822) | Test de Disfagia MECV-V |
| **Periférico de refuerzo BLE** | `react-native-ble-plx` sobre el GATT de Lúa (`src/Lua`) | Recompensa al cerrar la sesión y silencio clínico; **comparte el mismo `BleManager`** que el pulsioxímetro, ver [Lúa](#lúa-periférico-de-refuerzo) |
| **Firma digital** | `SignaturePad` propio (`react-native-svg` + `PanResponder`) | Consentimiento informado y cierre firmado del análisis de voz; sin dependencia externa de firma |
| **Generación PDF** | `pdf-lib` | Informes clínicos estructurados por módulo |
| **Telemetría de usabilidad** | `lz-string` · `react-native-qrcode-svg` (sobre `react-native-svg`) | Compresión extrema del payload Zero-PHI + código QR de cierre de batería |
| **Identidad y backend** | Firebase (`@react-native-firebase` app/auth/firestore) | Autenticación email/contraseña + perfil del profesional en Firestore (`professionals/{uid}`) |
| **Cifrado en tránsito** | TLS 1.3 | Obligatorio por GDPR para datos sanitarios |
| **Cifrado en reposo** | AES-256-GCM (SQLCipher) | Exigido por LOPDGDD — **pendiente de implementar**, ver [Controles de Seguridad](#controles-de-seguridad) |
| **Autenticación** | Firebase Authentication + `authSlice` (Redux, en memoria) | Verificación de credenciales y `uid` que ancla el perfil del profesional |
| **Sincronización HCE** | HL7 FHIR R4 REST API | Interoperabilidad con sistemas hospitalarios *(roadmap)* |
| **Voz neuronal (build-time)** | Piper · Coqui TTS (Celtia) · AhoTTS (Maider) + ffmpeg | Síntesis de los recortes fuera del dispositivo; ver [Idiomas y Voz Neuronal](#idiomas-y-voz-neuronal) |
| **i18n / Errores** | i18next (catálogos es · en · es-DO, preparados) · Sentry React Native | La app es hoy monolingüe en pantalla con literales; el contenido clínico sí es multi-idioma |

---

## Instalación y Configuración

> ⚠️ **Este software está destinado exclusivamente a instalaciones autorizadas bajo Acuerdo de Licencia vigente con Earlify Health.**

### Prerrequisitos

```
Node.js >= 18.x            (20.x en CI)
npm >= 9.x  o  yarn >= 1.22.x
React Native 0.80.x (CLI @react-native-community/cli)
Xcode >= 15 (para iOS)
Android Studio >= 2023.x (para Android) · AGP 8 (namespace en build.gradle)
Proyecto Firebase con Authentication (email/contraseña) y Firestore habilitados
Python 3.11 + ffmpeg      (solo para las herramientas de build-time: voz y acústica)
```

### Instalación de dependencias

```bash
# Clonar el repositorio (requiere acceso autorizado)
git clone https://github.com/FrankBetances/via.git
cd via

# Instalar dependencias
npm install
# o
yarn install
```

### Configuración de Firebase

La identidad del profesional se apoya en Firebase. Añade los archivos de configuración
que descargas de tu proyecto de Firebase (`.firebaserc` apunta al proyecto por defecto):

```bash
# Android
android/app/google-services.json

# iOS — port nativo SwiftUI (la app RN todavía no tiene proyecto iOS, ver abajo)
ios-native/VIAPlus/GoogleService-Info.plist
```

Puedes usar `android/app/google-services.json.example` como plantilla de la estructura
esperada, sustituyendo los placeholders por los valores de tu proyecto.

> 🔐 **NUNCA versiones los archivos de configuración de Firebase ni ningún `.env` con datos
> reales.** Están incluidos en `.gitignore`.
>
> ⚠️ **Identificador del paquete.** Firebase resuelve la configuración por `package_name`: la app
> Android debe estar registrada como **`eu.futureforkids.via`** (el identificador exigido por Play
> Console). Un `google-services.json` generado para el identificador anterior no funciona.

### Configuración de la aplicación

La app **no lee variables de entorno**: no hay `.env` ni `react-native-config` en el proyecto. Los
parámetros técnicos son constantes en el código, documentadas en su módulo:

| Parámetro | Dónde se define | Valor |
|---|---|---|
| Frecuencia de muestreo de audio | `src/Audio/sharedAudioContext.ts` | 48 000 Hz (`AUDIO_SAMPLE_RATE`) |
| Umbral de ruido de sala | `src/Screens/RoomNoiseCheck/` | 45 dB(A) por defecto |
| Referencia dBFS → dB SPL | `src/Screens/RoomNoiseCheck/noiseDsp.ts` | 105 dB(A) SPL a fondo de escala |
| Calibración de campo del sonómetro | AsyncStorage (`via.noise.calibrationOffsetDb`) | La fija el clínico contra un sonómetro patrón |
| Idioma de la sesión | Redux `state.locale.language` (persistido) | `es` por defecto |

### Ejecución en desarrollo

```bash
# Servidor Metro
npm start

# Android
npm run android
```

> ⚠️ **iOS.** `npm run ios` **no funciona todavía**: la app React Native usa flujo *bare* y la
> carpeta `ios/` aún no está generada en el repositorio, así que no hay proyecto Xcode que
> compilar. Hoy el único camino a un dispositivo iOS es el **port nativo SwiftUI** de
> [`ios-native/`](./ios-native/README.md). Qué haría falta para cerrar esa brecha —permisos,
> módulos nativos por validar y firma— está detallado en
> [`docs/design/arquitectura-exportacion-ios.md`](./docs/design/arquitectura-exportacion-ios.md).

### Verificación (tests · lint · tipos)

```bash
# Tests unitarios (Jest)
npm run test

# Tests de integración clínica
npm run test:clinical

# Cobertura (objetivo: ≥ 80% en módulos core)
npm run test:coverage

# Linter (ESLint)
npm run lint

# Comprobación de tipos (TypeScript, sin emitir)
npm run tsc
```

---

## Módulos de la Aplicación

> Leyenda de hardware: 🟢 sin hardware adicional · 🎙️ requiere micrófono · 🔊 requiere síntesis de tono ·
> 🗣️ requiere TTS/reconocimiento de voz · 📶 requiere Bluetooth LE.

### 1 — Evaluación Clínica Previa 🟢 (`ClinicalAssessment`)

- **Dominio:** Anamnesis / cuestionario clínico estructurado previo a las pruebas
- **Nativo:** formularios + firma de consentimiento (`react-native-signature-canvas`) + foto
- **Datos:** entidad `ClinicalAssessment` · informe PDF `ClinicalAssessmentDetail`

### 2 — Cuestionario de Autismo M-CHAT-R 🟢 (`Mchat`)

- **Dominio:** Cribado de TEA, 16–30 meses
- **Objetivo:** 20 ítems, scoring 0–20, bandas de riesgo bajo/medio/alto + entrevista de seguimiento
- **Datos:** entidad genérica `Screening` (`instrument: 'autism-tea'`) · informe PDF `ScreeningDetail`

### 3 — Sonómetro Ambiental 🎙️ (`RoomNoiseCheck`)

- **Dominio:** Gate de prerrequisito de sala
- **Objetivo:** Medir ruido de fondo y solo permitir continuar si está bajo umbral (45 dB(A) por defecto) y la checklist está completa
- **Nativo:** captura real de micrófono (`react-native-audio-api`: `AudioRecorder`); sin micrófono/permiso muestra error explícito (sin datos simulados)
- **Medición:** **ponderación A (IEC 61672) con estado conservado entre bloques** + bloqueo de DC, 400 ms de calentamiento descartados y descarte de bloques saturados (golpes al equipo). El veredicto es **LAeq + percentiles** (L90 de fondo, L10 de picos): un roce aislado ya no decide el resultado como hacía el máximo absoluto
- **Calibración:** offset de campo ajustable teclando la lectura de un sonómetro patrón, **persistido en el dispositivo** (es una propiedad del micrófono, no de la sesión)
- **Datos:** no persiste resultados clínicos — navega directamente al hub de la batería

### 4 — Audiometría Infantil 🔊 (`Audiometry`) · *paquete base*

- **Dominio:** Audiología pediátrica
- **Objetivo:** Audiometría tonal liminar, motor Hughson-Westlake guiado (250–4000 Hz)
- **Nativo:** síntesis de tono real (`react-native-audio-api`: `OscillatorNode` + `GainNode` + `StereoPannerNode`); requiere calibración dB HL → dB SPL por transductor
- **Datos:** entidad `AudiometryTest` · informe PDF `AudiometryDetail`

### 5 — Audiometría Condicionada — El Tren del Sonido 🔊 (`AudiometryConditioned`)

- **Dominio:** Audiología pediátrica con refuerzo lúdico (CRA)
- **Objetivo:** Un tren avanza por estaciones (frecuencias) al confirmar umbrales; el niño pulsa el silbato al oír
- **Nativo:** reutiliza el motor de audio de Audiometría Infantil + `react-native-reanimated`
- **Datos:** comparte la entidad `AudiometryTest` (`method: 'conditioned'`)

### 6 — Análisis Acústico de Voz 🎙️ (`VoiceAnalysis`)

- **Dominio:** Biomarcadores vocales infantiles
- **Objetivo:** F0, jitter, shimmer y HNR de voz sostenida (/a/), con formantes F1–F3 vía LPC
- **Nativo:** captura PCM real (`react-native-audio-api`) + DSP propio (`voiceDsp.ts`, módulo puro)
- **Validación:** contrastado contra **Praat** ([`tools/acoustics`](./tools/acoustics/README.md)) sobre señales sintéticas deterministas — F0 coincide al decimal; **orden LPC 20** (con 14 F3 se quedaba sin polos); pasa-alto de acondicionado a 55 Hz; techo del HNR documentado (~30 dB); **F3 ya no se fabrica** cuando no es estimable
- **Datos:** entidad `VoiceAnalysis` · informe PDF `VoiceAnalysisDetail`

### 7 — Test de Disfagia MECV-V 📶 (`DysphagiaTest`)

- **Dominio:** Método de Exploración Clínica Volumen-Viscosidad
- **Objetivo:** 9 bolos con bifurcación seguro/inseguro, desaturación de SpO₂ ≥3% y motor de recomendación de dieta
- **Nativo:** pulsioxímetro real por Bluetooth LE (`react-native-ble-plx`, perfil 0x1822) + vídeo clínico opcional
- **Datos:** entidad `DysphagiaTest` · informe PDF `DysphagiaDetail`

### 8 — Cribado SAHS Infantil 🟢 (`SahsScreening`)

- **Dominio:** Trastornos respiratorios del sueño
- **Objetivo:** PSQ de Chervin (SRBD-22) + exploración (Brodsky, IMC, signos) + factores de riesgo
- **Datos:** entidad `SahsScreening` · informe PDF `SahsScreeningDetail`
- **Aviso clínico:** orientativo; el diagnóstico de SAHS exige polisomnografía en Unidad de Sueño

### 9 — Articulación · T.A.R. (Test de Articulación a la Repetición) 🎙️🗣️ (`Articulation`)

- **Dominio:** Logopedia — registro descriptivo SODA por fonema
- **Objetivo:** El niño repite el modelo hablado; clasificación Correcto/Sustitución/Omisión/Distorsión/Adición por ítem, con % de acierto y fonemas a intervenir
- **Nativo:** modelo hablado servido por la capa `@/Voice` (recorte neuronal → recorte base `es` → mejor voz verificada del sistema), grabación (`react-native-audio-recorder-player`) y reconocimiento de voz (`@react-native-voice/voice`) que auto-evalúa la repetición; degrada a SODA manual sin hardware/permiso
- **Idioma:** la preparación del registro tiene **selector de idioma**, que escribe en el mismo `state.locale.language` que el hub. El **inventario fonético es del español**: lo que cambia es la voz (y la etiqueta del reconocedor: es-ES, es-DO, gl-ES, eu-ES, con reintento en la lengua base), no las palabras
- **Datos:** entidad `ArticulationTest` · informe PDF `ArticulationDetail`

### 10 — Audiometría Verbal 🔊🗣️ (`VerbalAudiometry`)

- **Dominio:** Logoaudiometría en campo libre (altavoz del dispositivo, sin audífonos)
- **Objetivo:** Reconocimiento de conjunto cerrado por selección de tarjetas (`WordCard`), con listas de estímulos por franja de edad (A–D); modos discriminación y umbral (URV/SRT estimado)
- **Idiomas:** un banco de estímulos por lengua — `es` · `gl` (banco propio del Proxecto Nós, aprobado por ACOPROS) · `eu` (banco propio, provisional) · `es-DO` (*Quisqueya Habla*, banco `es` auditado + locución propia); ver [Idiomas y Voz Neuronal](#idiomas-y-voz-neuronal)
- **Nativo:** **recortes de locución pre-sintetizados** como vía primaria (empaquetados por idioma), con la voz del sistema como degradación; presentados por el altavoz binaural. Degrada con placeholders si falta imagen
- **Datos:** entidad `VerbalAudiometryTest` (tabla `verbal_audiometry_test`) · informe PDF

### 11 — Funciones Ejecutivas 🟢🗣️ (`ExecutiveFunctions`)

- **Dominio:** Exploración lúdica del neurodesarrollo (cribado orientativo, cortes provisionales)
- **Objetivo:** Batería de 5 mini-juegos de tarjetas (atención, inhibición, flexibilidad, memoria de trabajo y planificación) con dificultad graduada por banda de edad A–D; puntuaciones 0–100 por dominio
- **Nativo:** dictado por voz de las consignas de los mini-juegos (`react-native-tts`); no requiere hardware adicional para jugar
- **Datos:** entidad `ExecutiveFunctionsTest` (tabla `executive_functions_test`) · informe PDF

### 12 — Análisis Prosódico 🎙️ (`ProsodyAnalysis`)

- **Dominio:** Logopedia — dinámica del habla (ritmo, pausas y entonación) sobre **habla conectada**
- **Objetivo:** Registro descriptivo de rango y variabilidad tonal (semitonos), contorno de cierre, pausas, fracción sonora y tasas de habla y articulación, a partir de una muestra de narración provocada
- **Tarea:** narración sobre lámina (prelectores, 3–6 a) o recuento de historia (lectores, 7–12 a), con consigna locutada por `@/Voice` para que sea idéntica entre exploradores; objetivo de 30–60 s de **habla válida**, descontando pausas
- **Nativo:** micrófono compartido (`@/Audio/sharedAudioRecorder`) + DSP propio en TypeScript (`prosodyDsp.ts`), reutilizando el acondicionado y la F0 del análisis de voz. Sin modelos ni librerías de análisis en el dispositivo
- **Afirmaciones:** **descriptivas, nunca normativas** — no hay baremos pediátricos españoles de prosodia y los de otras lenguas no son transferibles ni por lengua ni por tarea. Ver [`docs/design/b0-prosodia-tarea-y-afirmaciones.md`](./docs/design/b0-prosodia-tarea-y-afirmaciones.md)
- **Datos:** entidad `ProsodyAnalysis` (tabla `prosody_analysis`) · informe PDF `ProsodyDetail`

---

## Lúa (periférico de refuerzo)

**Lúa es la mascota de Valeria+** —una gata negra tipo *smoking*, en píxel art— y también un
**aparato físico de refuerzo** sobre ESP32-C3 con una pantalla circular de 240 × 240 que se
comunica por BLE. **El proyecto no es de este repositorio: vive en `FrankBetances/Valeria`**,
y allí están el firmware, la tabla de opcodes y el plan completo.

Lo que hay en VIA+ es deliberadamente pequeño, y el diseño está en
[`docs/design/integracion-lua.md`](./docs/design/integracion-lua.md).

> ⚠ **14/8/2026 · la dirección cambió el alcance, y esta sección describe lo que hay hoy.**
> Lúa queda fijada como periférico **estrictamente de salida** —pantalla y altavoz, cero
> micrófonos, cero ASR en el aparato— y pasa a estar **presente durante la batería**,
> espejando y con alertas sonoras en algunos módulos. Nada de eso está implementado y el
> sonido está bloqueado por hardware: **ninguna de las placas estudiadas anima la cara y
> habla a la vez**. La decisión entera, la matriz por módulo y lo que falta están en
> [`docs/design/lua-salida-y-alertas-sonoras.md`](./docs/design/lua-salida-y-alertas-sonoras.md).

### La postura: el control es la ausencia — *superada en la conclusión, vigente en el argumento*

El §8 del plan de Valeria+ se titula «VIA+: la integración correcta es la ausencia», y de ahí
sale todo lo demás:

> **Lúa no está presente durante la medición.** Es un **requisito del protocolo de exploración**
> —un aparato ausente no puede interferir en una audiometría de campo libre ni en una toma de
> voz—, no un control implementado en software. Se audita mirando, no leyendo logs.

Esa distinción no es retórica. Declarar el silencio del periférico como el control de riesgo de
la interferencia obligaría a demostrar, para el marcado CE de un SaMD Clase IIa, que el comando
llega siempre, que el firmware siempre obedece y que el fallo es detectable — y a meter un
dispositivo externo no verificado en el expediente técnico. Una versión anterior del diseño lo
planteaba así y era un error caro; está anotado en el §1.1 del documento.

**El criterio sobrevive al cambio de alcance, y es el que hay que aplicar módulo a módulo:** si
el aparato se apaga y la exploración sigue igual, es un accesorio; si la maniobra depende de que
el aviso llegue, no lo es. De las siete filas de la matriz nueva, tres caen del segundo lado —el
maquinista del tren de la audiometría condicionada **es el método**, no un adorno—, y esa
conversación se tiene con el organismo notificado, no en un `.md`.

### Lo único que hace VIA+

| Pieza | Qué hace | Dónde |
|---|---|---|
| **Recompensa de cierre** | La **única** integración de la v1: al llegar a `ResultadosFinal`, con la exploración terminada y los datos ya sellados, se pide `UNLOCK` → `GRANT` → `CELEBRATE` y se renueva el latido mientras la pantalla vive | `closingReward.ts` · `useLuaClosingReward()` |
| **Silencio clínico** | Defensa en profundidad, por si alguien la trae puesta: al abrirse **cualquier** captura de micrófono se escribe `SAFE`/`CLINICAL_SILENCE`, que revoca la concesión y **bloquea** nuevas hasta un desbloqueo explícito | `clinicalSilence.ts` |
| **Diagnóstico** | Estado notificado por `STATE` para una pantalla de ajustes. **No entra en ningún informe ni en ninguna decisión** | `useLuaDiagnostics()` |

Y, por el mismo motivo, lo que **no** hay:

- **Ningún refuerzo durante ningún módulo**, ni siquiera al cerrar uno (`ResultadosPreliminares`):
  la sesión sigue abierta y puede haber otra toma de voz a continuación. Solo al cerrar la **sesión**.
- **No se envían `VERDICT` ni `PHASE`.** Existen en el protocolo porque Valeria+ los usa dentro de
  la terapia; en VIA+ serían refuerzo durante la medición, explícitamente fuera de la v1.
- **Ninguna decisión de VIA+ lee nada de Lúa.** El enlace es de un solo sentido, y esa asimetría es
  lo que sostiene que el aparato sea un accesorio y no parte del dispositivo médico.

### El protocolo se genera, no se escribe

`protocol.json` lo consumen tres sitios —el firmware en C, Valeria+ y este repositorio— y su
propia nota avisa de que las copias a mano se desincronizan. El bug que produce eso no sale como
error de compilación: sale como una mascota que hace cosas raras en la consulta.

```
src/Lua/protocol.json           ← copia VENDORIZADA byte a byte desde Valeria+
scripts/build-lua-protocol.js   ← genera el .ts (--check lo verifica como gate)
src/Lua/luaProtocol.ts          ← GENERADO. No se edita a mano
src/Lua/luaWire.ts              ← lo que el .json no cubre (trama SAFE, desglose de STATE),
                                  leído del FIRMWARE y con la línea citada
```

El **sprite** sigue la misma regla: `src/Components/Mascot/LuaPixel.tsx` es una copia literal de
Valeria+ que no se edita aquí, y `scripts/check-lua-sprite.js` compara el dibujo **píxel a píxel**
en cada release. Si ese gate falla, el dibujo se cambia en Valeria+ y se vuelve a copiar.

### Enlace GATT

| Característica | Escritura | Para qué |
|---|---|---|
| `CTRL` | **Sin** confirmación | `GRANT`, `HEARTBEAT`, `IDLE`, `CELEBRATE`. Camino de latencia (presupuesto de 300 ms del veredicto al primer fotograma) |
| `SAFE` | **Con** confirmación | `CLINICAL_SILENCE` y `UNLOCK`. La única escritura del enlace en la que importa saber que llegó |
| `STATE` | Notificación | Modo, segundos de concesión restantes, cara, versión, fps y µs de despacho. **Diagnóstico** |
| `CFG` | — | No se usa en la v1 |

Dos reglas duras del adaptador:

1. **Nada de `await` hacia Lúa desde un flujo clínico.** Los envíos de `CTRL` son dispara-y-olvida
   con `catch` vacío deliberado: una mascota apagada no puede colgar una exploración.
2. **BLE-only.** La sesión de audio de VIA+ se configura con `allowBluetooth` y `allowBluetoothA2DP`;
   un perfil de audio clásico en el periférico dejaría que iOS encaminase hacia él los tonos de la
   audiometría **sin ningún error a la vista**. Lúa no anuncia A2DP ni HFP. Esta regla **sube de
   importancia** con el altavoz autorizado, no baja: mientras el aparato no podía sonar, un
   encaminamiento por descuido era un fallo silencioso sin transductor al otro lado; con altavoz,
   es una audiometría de campo libre saliendo de verdad por un altavoz de juguete sin calibrar.
   Las órdenes de sonido viajan como **un identificador por GATT**, nunca como audio encaminado
   por el sistema.

> **Zero-PHI estructural.** La tabla de opcodes no tiene **ni un campo de texto**. Un nombre de
> paciente no puede llegar al aparato porque no existe el sitio donde meterlo — es una garantía de
> la forma del protocolo, no de la disciplina de quien lo usa.

### Estado: hoy todo `src/Lua/` es *no-op*

El módulo está implementado y probado (`src/Lua/__tests__/`, 7 suites: protocolo, cable, adaptador,
silencio clínico, recompensa, gate del sprite y punto único del micrófono), pero **`installLua()`
todavía no se llama en `App.tsx`**: necesita un `BleManager` y hoy la app no crea ninguno — el
adaptador del pulsioxímetro está en la misma situación, esperando ese manager compartido. Crearlo
cambia el arranque en iOS (el primer uso dispara el permiso de Bluetooth del sistema), así que es
una decisión de la fase de hardware y se toma con la placa delante, de una vez para los dos
periféricos. Sin adaptador registrado, cada llamada a la fachada no hace nada y ninguna pantalla
se entera.

---

## Herramientas de Build-Time

Dos cadenas de herramientas corren **fuera del dispositivo**. Ninguna librería de IA ni de análisis
fonético entra en el APK: la app mide y reproduce en local, offline.

### `tools/nos/` — motor de voz neuronal

Síntesis de las locuciones con voces abiertas (Piper · Celtia del Proxecto Nós · AhoTTS Maider) y
post-proceso homogéneo con ffmpeg (`loudnorm I=-20:TP=-3:LRA=7`, m4a mono 44,1 kHz) para que todos
los idiomas tengan la **misma sonoridad**. Registro declarativo en `tools/nos/voices.json`;
glosario dominicano revisado en `tools/nos/glosario-es-do.csv`.

### `tools/acoustics/` — validación del DSP contra Praat

Banco de referencia que compara el DSP que **de verdad** corre en la app
(`src/Screens/VoiceAnalysis/voiceDsp.ts`) con **Praat**, el estándar de facto en fonética clínica,
sobre vocales sintéticas deterministas.

```bash
node tools/acoustics/fixtures.js                  # WAVs + medidas de VIA+
pip install -r tools/acoustics/requirements.txt
python3 tools/acoustics/validate.py               # mide con Praat y compara (sale ≠0 si se desvía)
```

Hallazgos de la primera pasada: orden LPC insuficiente (F3 no estimable en 10 de 11 casos), techo
del HNR no declarado, y un caso de prueba mal construido. Detalle en
[`tools/acoustics/README.md`](./tools/acoustics/README.md).

---

## Automatización (CI/CD)

| Workflow | Disparo | Qué hace |
|---|---|---|
| `voice-assets.yml` | Manual · push a `claude/**` que toque el corpus o `tools/nos` | Sintetiza consignas y/o recortes verbales de los cuatro idiomas y los commitea a la rama (nunca a `main`). Tolerante: una voz que falle no tira el lote |
| `android-release.yml` | Manual · push a `main` (android, src, assets/audio) | **Puerta de locuciones** → **gate del sprite de Lúa** → keystore → APK + AAB firmados → verificación de firma → artefactos |
| `acoustic-validation.yml` | PR/push que toque `VoiceAnalysis` o `tools/acoustics` | Contrasta el DSP con Praat y falla si un parámetro se desvía de su tolerancia |
| `codeql.yml` | Push/PR a `main` + semanal | Análisis estático de seguridad |
| `markdown-lint.yml` | Cambios en `**/*.md` | `markdownlint-cli2` con la configuración de `.markdownlint.yaml` |
| `pages.yml` | Push a `main` que toque `site/` | Publica el sitio público (política de privacidad) en GitHub Pages |

> **La puerta de locuciones no exige «todos los idiomas al 100 %»**, sino **coherencia** con
> `VERBAL_AUDIO_PENDING` — la declaración revisada de qué idiomas se sabe que no tienen locuciones
> propias, la misma que usa la pantalla para advertir al profesional. Falla en los dos sentidos: si
> a un idioma no declarado pendiente le faltan recortes (la app prometería un estímulo que no
> existe) y si un idioma declarado pendiente ya los tiene todos (el aviso ha pasado a ser falso).

<!-- Separador: dos citas independientes, no una continuación. -->

> **Los dos gates de Lúa.** `scripts/check-lua-sprite.js` corre en la release y compara el dibujo
> de la mascota píxel a píxel con el de Valeria+; `scripts/build-lua-protocol.js --check` verifica
> que la tabla generada siga cuadrando con `src/Lua/protocol.json` (también cubierto por
> `luaProtocolGate.test.ts`). Ninguno de los dos puede comprobar que la copia vendorizada siga al
> día respecto a Valeria+ —este repositorio no ve el otro—: para eso está el procedimiento de
> sincronización de [`docs/design/integracion-lua.md`](./docs/design/integracion-lua.md).

La gobernanza del repositorio —CODEOWNERS, política de divulgación, Dependabot en modo solo
seguridad, protección de rama y *secret scanning*— está documentada en
[`docs/SECURITY-GOBERNANZA.md`](./docs/SECURITY-GOBERNANZA.md), que distingue los controles ya
versionados de los que hay que **activar en la interfaz de GitHub** para que surtan efecto.

---

## Distribución y Sitio Público

| Elemento | Valor / ubicación |
|---|---|
| Identificador del paquete Android | **`eu.futureforkids.via`** (`namespace` y `applicationId`) |
| Artefactos de release | APK + AAB firmados por `android-release.yml` |
| Icono de la app | [`docs/capturas/`](./docs/capturas/README.md) (512 × 512 para la ficha + icono de lanzador) |
| Política de privacidad | [`site/privacidad.html`](./site/privacidad.html), publicada con GitHub Pages |
| Port nativo iOS | [`ios-native/`](./ios-native/README.md) — SwiftUI, parcial: acceso y créditos, profesionales, pacientes, consentimiento, evaluación clínica (CAP), sonómetro de sala y hub de módulos |
| Exportación a iOS | [`docs/design/arquitectura-exportacion-ios.md`](./docs/design/arquitectura-exportacion-ios.md) — firma fuera del repositorio, `.ipa` en tres modos y límites de la cuenta gratuita de Apple |

> ⚠️ **Capturas de pantalla.** Las imágenes de `docs/capturas/` son **reconstrucciones fieles a
> partir del código**, no capturas de dispositivo (el entorno donde se generaron no tiene emulador).
> Sirven para documentación; **para la ficha de Google Play hay que sustituirlas por capturas reales**,
> como exige la política de la tienda. El README de la carpeta enumera las diferencias conocidas.

---

## Documentación del Repositorio

```
docs/
├── manual/                     # Manual de Usuario (HTML fuente + PDF + DOCX generados)
├── capturas/                   # Icono de la app y capturas de pantalla
├── SECURITY-GOBERNANZA.md      # Controles de seguridad del repositorio en GitHub
└── design/
    ├── arquitectura-corpus-voz.md        # Capa de voz neuronal multi-idioma
    ├── arquitectura-audio.md             # AudioContext compartido y cadenas de audio
    ├── evaluacion-prosodia-y-asr.md      # Evaluación de la propuesta de módulo acústico
    ├── plan-prosodia-y-asr.md            # Plan de trabajo (prosodia + saneamiento del ASR)
    ├── b0-prosodia-tarea-y-afirmaciones.md # Tarea de habla y política de afirmaciones (ratificada)
    ├── prosodia-riesgos.md               # Análisis de riesgos del módulo (ISO 14971)
    ├── validacion-clinica-prosodia.md    # Protocolo de validación (parte A firmada, B pendiente)
    ├── adr-inferencia-en-dispositivo.md  # Decisión regulatoria sobre IA embarcada (A-bis)
    ├── arquitectura-exportacion-ios.md   # Las dos vías de iOS, firma y exportación del .ipa
    ├── audiometria-verbal.md             # Diseño del módulo (+ variantes gl · eu · es-DO)
    ├── validacion-clinica-verbal.md      # Trazabilidad de la aprobación clínica
    ├── integracion-proxecto-nos.md       # Plan de integración del gallego (ILENIA)
    ├── integracion-quisqueya-habla.md    # Plan de integración de la variante dominicana
    ├── integracion-valeria.md            # Voz de referencia de Valeria+: qué se portó y dónde se desvió
    └── integracion-lua.md                # Lúa en VIA+: solo recompensa de cierre (el aparato es de Valeria+)
```

El **manual de usuario** con casos de uso clínicos de principio a fin se genera desde
[`docs/manual/manual.html`](./docs/manual/manual.html):

```bash
node docs/manual/build-pdf.js       # PDF A4 (requiere Playwright + Chromium)
python3 docs/manual/build-docx.py   # DOCX (rasteriza cada página; requiere python-docx)
```

---

## Gestión de Riesgos

La gestión de riesgos de VIA+ sigue la norma **ISO 14971:2019** a lo largo de todo el ciclo de vida del software. Todos los cambios de arquitectura, nuevas funcionalidades y modificaciones de flujo deben incluir una **evaluación de impacto en seguridad del paciente** antes de su implementación.

El expediente formal de gestión de riesgos (tabla FMEA, registro de riesgos activos y controles
implementados) está **pendiente de constituir** en `docs/risk-management/`; hasta entonces, los
riesgos identificados viven en los documentos de diseño y en las justificaciones de cada PR.

```
docs/risk-management/          (🔴 pendiente)
├── FMEA-table.md              # Tabla FMEA completa
├── risk-register.md           # Registro de riesgos activos
└── risk-controls.md           # Controles implementados
```

> **Periféricos externos y alcance del expediente.** El refuerzo de Lúa está diseñado para quedar
> **fuera** del análisis de riesgo del dispositivo: el aparato no está presente durante la medición
> —control de procedimiento, no de software—, el enlace es de un solo sentido y nada de lo que
> notifica entra en una decisión clínica o en un informe. Ver [Lúa](#lúa-periférico-de-refuerzo).

Para reportar un incidente de seguridad o una vulnerabilidad del código, los canales privados son
los de la política de divulgación responsable: **GitHub Security Advisories** (pestaña *Security* →
*Report a vulnerability*) o el correo indicado en
[`.github/SECURITY.md`](./.github/SECURITY.md). **No abras un issue público.**

---

## Contribución al Proyecto

VIA+ es software propietario. Las contribuciones están restringidas al equipo de desarrollo autorizado por Earlify Health. Si formas parte del equipo:

### Convenciones de desarrollo

```
Branching:
  main         → Producción (protegida: PR + revisión de Code Owners)
  claude/xxx   → Ramas de trabajo (disparan la síntesis de assets de voz en CI)
  feature/xxx  → Nuevas funcionalidades
  fix/xxx      → Correcciones de bugs

Commits:  Convención Conventional Commits
  feat:     Nueva funcionalidad
  fix:      Corrección de bug
  docs:     Documentación
  security: Cambio relacionado con seguridad (¡prioritario!)
  refactor: Refactorización sin cambio funcional
  test:     Adición o modificación de tests
```

### Pull Requests

La plantilla de [`.github/pull_request_template.md`](./.github/pull_request_template.md) recoge el
checklist obligatorio. Cada PR debe incluir:

- [ ] Descripción del cambio y justificación clínica/técnica
- [ ] Evaluación de impacto en seguridad del paciente (ISO 14971)
- [ ] Verificación de seguridad y privacidad (¿toca datos clínicos, permisos o la nube?)
- [ ] Tests añadidos o actualizados (cobertura mantenida ≥ 80%)
- [ ] Documentación actualizada
- [ ] Revisión de los **Code Owners** de las rutas sensibles (Firestore, auth, Database, telemetría, CI)

---

## Ecosistema Earlify Health

VIA+ forma parte del ecosistema de salud digital pediátrica de Earlify Health:

```
Earlify Health
│
├── VIA+          →  Evaluación y tamizaje (este repositorio)
│                    SaMD Clase IIa · Audiología · Lenguaje · Neurodesarrollo
│
├── Valeria+      →  Rehabilitación adaptativa del lenguaje
│                    Cápsulas TPR (Total Physical Response) con padres
│                    │
│                    └── Lúa  →  Mascota y periférico físico de refuerzo (ESP32-C3, BLE)
│                                Su firmware, su protocolo y su sprite viven en
│                                `FrankBetances/Valeria`. VIA+ solo lo usa para la
│                                recompensa de cierre (ver §Lúa)
│
└── [Módulos futuros en roadmap]
```

---

## Estado del Proyecto

> Estado de integración según el Contrato de Compilación v3 (2026-06-25/26). La fuente de
> verdad es cada paquete `VIA+ <Módulo> (React Native)` (pantalla + `integration/`).

| Componente | Estado |
|---|---|
| Módulo de Consentimiento Informado | 🟢 Integrado (bloqueante) |
| Pre-screening clínico (CAP) | 🟢 Integrado (bloqueante) |
| Autenticación profesional (Firebase Auth) | 🟢 Integrado |
| Sincronización del perfil (Firestore) | 🟢 Integrado |
| Identificación de paciente | 🟢 Integrado |
| Generación de informes PDF | 🟢 Integrado |
| Resultados de sesión e historial del paciente | 🟢 Integrado |
| Telemetría de usabilidad Zero-PHI (Likert → QR) | 🟢 Integrado |
| Capa de voz neuronal multi-idioma (es · gl · eu · es-DO) | 🟢 Integrada (consignas `gl`/`eu` con voz del sistema) |
| Validación del análisis acústico contra Praat | 🟢 En CI |
| Sitio público y política de privacidad (Pages) | 🟢 Publicable |
| Release firmada de Android (APK + AAB) | 🟢 En CI, con puerta de locuciones |
| Port nativo iOS (SwiftUI) | 🟡 Parcial (acceso, paciente, consentimiento, CAP, sonómetro) |
| Lúa — periférico de refuerzo BLE | 🟡 Código completo y probado; *no-op* hasta que exista el `BleManager` compartido ([detalle](#estado-hoy-todo-srclua-es-no-op)) |
| Cifrado en reposo y seudonimización efectiva | 🔴 Pendiente ([detalle](#controles-de-seguridad)) |
| Expediente de gestión de riesgos (ISO 14971) | 🔴 Pendiente |
| Sincronización clínica HL7-FHIR | 🔴 Pendiente (roadmap) |
| Certificación MDR Clase IIa | 🔴 En proceso |

### Batería de evaluación — 12 módulos

| # | Módulo | Pantalla + `integration/` | Servicio local | Hardware nativo |
|---|---|---|---|---|
| 1 | Evaluación Clínica Previa | 🟢 Construido | 🟢 OK | 🟢 ninguno |
| 2 | Autismo M-CHAT-R | 🟢 Construido | 🟢 OK (`screenings`) | 🟢 ninguno |
| 3 | Sonómetro Ambiental | 🟢 Construido | — (sin persistencia clínica) | 🟢 micrófono real · dB(A) calibrable |
| 4 | Audiometría Infantil | 🟢 Construido | 🟢 OK (`audiometry`) | 🟢 síntesis de tono (`audio-api`) |
| 5 | Audiometría Condicionada | 🟢 Construido | 🟢 Reutiliza `audiometry` | 🟢 síntesis de tono + reanimated |
| 6 | Análisis Acústico de Voz | 🟢 Construido | 🟢 OK (`voiceAnalysis`) | 🟢 mic + DSP (LPC orden 20, validado vs. Praat) |
| 7 | Test de Disfagia MECV-V | 🟢 Construido | 🟢 OK (`dysphagiaTest`) | 🟢 BLE pulsioxímetro (`ble-plx`) |
| 8 | Cribado SAHS Infantil | 🟢 Construido | 🟢 OK (`sahsScreenings`) | 🟢 ninguno |
| 9 | Articulación · T.A.R. | 🟢 Construido | 🟢 OK (`articulationTests`) | 🟢 mic + reconocedor + `@/Voice` (degrada a SODA manual) |
| 10 | Audiometría Verbal | 🟢 Construido | 🟢 OK (`verbalAudiometry`) | 🟢 recortes neuronales en 4 idiomas (campo libre) |
| 11 | Funciones Ejecutivas | 🟢 Construido | 🟢 OK (`executiveFunctions`) | 🟢 consignas locutadas (`@/Voice`) |
| 12 | Análisis Prosódico | 🟢 Construido | 🟢 OK (`prosodyAnalysis`) | 🟢 mic compartido + DSP propio (validado vs. Praat) |

> Los 12 módulos están construidos (pantalla + `integration/`) con su servicio local y
> migración TypeORM propia. Las 12 rutas están registradas en `RootStackParamList` y la
> batería completa persiste en la base SQLite local del dispositivo.

---

## Licencia

VIA+ es software propietario de Earlify Health S.L. **Todos los derechos reservados.**

El uso, copia, modificación o distribución de este software sin un Acuerdo de Licencia vigente con Earlify Health está estrictamente prohibido y puede constituir una infracción de la propiedad intelectual y de la normativa de dispositivos médicos aplicable.

Consulta el archivo [LICENSE](./LICENSE) para los términos completos.

---

## Contacto

| Área | Contacto |
|---|---|
| General / Licencias | fbetances@futureforkids.eu |
| Incidentes de seguridad y vulnerabilidades | Canales privados de [`.github/SECURITY.md`](./.github/SECURITY.md) (GitHub Security Advisories, preferido) |

---

<div align="center">

*VIA+ · Earlify Health S.L. · © 2024–2026 · Todos los derechos reservados*

*Desarrollado con rigor clínico para la salud pediátrica*

</div>
