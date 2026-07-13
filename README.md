<div align="center">

# ⟁ VIA+
### Valoración Interactiva de Audición y Lenguaje

**Software como Dispositivo Médico (SaMD) · Clase IIa · MDR 2017/745**

[![Regulatory Status](https://img.shields.io/badge/SaMD-Class%20IIa%20MDR-blue?style=flat-square)](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32017R0745)
[![IEC 62304](https://img.shields.io/badge/IEC%2062304-Class%20B-yellow?style=flat-square)](#normativas-aplicables)
[![ISO 14971](https://img.shields.io/badge/ISO%2014971-Risk%20Management-orange?style=flat-square)](#normativas-aplicables)
[![GDPR](https://img.shields.io/badge/GDPR%2FLOPDGDD-Compliant-green?style=flat-square)](#privacidad-y-datos)
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
- [Privacidad y Datos](#privacidad-y-datos)
- [Stack Tecnológico](#stack-tecnológico)
- [Instalación y Configuración](#instalación-y-configuración)
- [Módulos de la Aplicación](#módulos-de-la-aplicación)
- [Gestión de Riesgos](#gestión-de-riesgos)
- [Contribución al Proyecto](#contribución-al-proyecto)
- [Ecosistema Earlify Health](#ecosistema-earlify-health)
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

- 🎮 **Baterías gamificadas** — 11 módulos de evaluación adaptados al paciente pediátrico
- 🔇 **Offline-first** — Operación completa sin conexión; los datos clínicos del paciente residen solo en el dispositivo
- 🔐 **Seguridad robusta** — AES-256 en reposo · TLS 1.3 en tránsito · Seudonimización
- 📋 **Consentimiento informado digital** — Gestión legal obligatoria para tutores legales
- 🏥 **Pre-screening clínico** — Certificado de Aptitud para la Prueba (CAP) integrado
- 📄 **Informes PDF** — Generación automática de informes clínicos estructurados
- 🔑 **Identidad del profesional** — Firebase Authentication (email/contraseña) + sincronización del perfil en Firestore
- 🎙️ **Captura de audio estéreo** — Canales L/R independientes con calibración acústica
- 👁️ **UX dual** — Modo Profesional analítico y Modo Niño lúdico en un único dispositivo

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
| **IEC 62366-1:2015** | Ingeniería de usabilidad para dispositivos médicos | 🟡 En implementación |
| **ISO 14971:2019** | Gestión de riesgos en el ciclo de vida | 🟡 En implementación |
| **ISO 13485:2016** | Sistema de Gestión de Calidad | 🔴 Pendiente |
| **GDPR / LOPDGDD** | Protección de datos sanitarios | 🟡 En implementación |
| **HL7 FHIR R4** | Interoperabilidad con HCE | 🟡 En implementación |

> **IEC 62304 — Clase de Seguridad B:** Un fallo en el software podría generar datos erróneos que, sin el adecuado escrutinio clínico del profesional, podría conducir a una decisión subóptima. El riesgo de lesión directa es bajo gracias a la supervisión obligatoria.

---

## Arquitectura del Sistema

```
VIA+ App
│
├── /core
│   ├── auth/              # Firebase Authentication (email/contraseña) + authSlice (Redux)
│   ├── consent/           # Módulo de Consentimiento Informado (BLOQUEANTE)
│   ├── prescreening/      # Pre-screening clínico + Certificado de Aptitud (CAP)
│   ├── sync/              # Firestore: perfil del profesional (professionals/{uid})
│   └── security/          # Cifrado, seudonimización, gestión de claves
│
├── /patient
│   ├── registration/      # Alta y búsqueda de pacientes
│   └── profile/           # Perfil clínico del paciente
│
├── /evaluation
│   ├── session/           # Gestión de sesión de evaluación
│   ├── modules/
│   │   ├── clinical-assessment/    # Evaluación Clínica Previa (anamnesis + firma)
│   │   ├── autism-mchat/           # Cuestionario de Autismo M-CHAT-R (cribado TEA)
│   │   ├── room-noise-check/       # Sonómetro Ambiental (gate de sala, sin persistencia)
│   │   ├── audiometry/             # Audiometría Infantil (tonal liminar, Hughson-Westlake)
│   │   ├── audiometry-conditioned/ # Audiometría Condicionada — El Tren del Sonido (CRA)
│   │   ├── verbal-audiometry/      # Audiometría Verbal (logoaudiometría en campo libre)
│   │   ├── voice-analysis/         # Análisis Acústico de Voz (F0, jitter, shimmer, HNR)
│   │   ├── dysphagia-test/         # Test de Disfagia MECV-V (pulsioximetría BLE)
│   │   ├── sahs-screening/         # Cribado SAHS Infantil (PSQ de Chervin)
│   │   ├── articulation-tar/       # Articulación · T.A.R. (repetición + SODA)
│   │   └── executive-functions/    # Exploración lúdica de Funciones Ejecutivas (5 mini-juegos)
│   └── audio/             # AudioEngineProvider + PermissionsProvider (captura, síntesis, calibración)
│
├── /results
│   ├── viewer/            # Visualización de resultados por test
│   ├── report/            # Generación de informe PDF
│   └── archive/           # Archivo de evaluaciones pasadas
│
└── /professional
    ├── profile/           # Perfil del profesional sanitario
    └── settings/          # Configuración del centro y del dispositivo
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
[4] BATERÍA DE EVALUACIÓN GAMIFICADA
      │  11 módulos adaptados al perfil del paciente (clínicos + gamificados)
      │  Modo Niño: interfaz lúdica sin elementos clínicos visibles
      ▼
[5] GENERACIÓN DE RESULTADOS
      │  Informe PDF estructurado para el profesional
      │  Datos clínicos persistidos localmente (SQLite cifrado)
      ▼
[6] ARCHIVO Y SEGUIMIENTO
         Historial de evaluaciones del paciente
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

## Privacidad y Datos

VIA+ implementa un modelo de **privacidad por diseño** (Privacy by Design, GDPR Art. 25):

### Seudonimización

Los datos personales del paciente se almacenan **separados** de los datos clínicos:

```sql
-- Tabla de identidad (acceso restringido, cifrado adicional)
patients_identity:
  id_hash     TEXT   -- HMAC-SHA256(NHC, device_key)
  name_enc    BLOB   -- AES-256-GCM(nombre_completo)
  dob_enc     BLOB   -- AES-256-GCM(fecha_nacimiento)

-- Tabla clínica (seudonimizada, sin PII directa)
clinical_sessions:
  session_id  TEXT   -- UUID v4
  patient_ref TEXT   -- Referencia al id_hash, nunca al NHC directo
```

> **Alcance de la nube (Firestore):** solo se sincroniza el **perfil del profesional
> autenticado** (`professionals/{uid}`). Los datos clínicos del paciente (evaluaciones,
> capturas de audio, informes) **permanecen locales al dispositivo y nunca llegan a
> Firestore** — así lo imponen las reglas de seguridad de Firestore (`firestore.rules`).

### Controles de Seguridad

| Control | Estándar | Implementación |
|---|---|---|
| Cifrado en reposo | AES-256-GCM | SQLCipher (base de datos local) |
| Cifrado en tránsito | TLS 1.3 | Toda comunicación con backend |
| Seudonimización | GDPR Art. 4(5) | HMAC-SHA256 sobre NHC con clave de dispositivo |
| Control de acceso | RBAC | Roles: Médico, Logopeda, Psicopedagogo, Enfermero |
| Auditoría | IEC 62304 | Log inmutable de eventos clínicos y de acceso |
| Borrado seguro | LOPDGDD | Eliminación verificable de datos al revocar consentimiento |

---

## Stack Tecnológico

| Capa | Tecnología | Justificación |
|---|---|---|
| **Frontend / App** | React Native 0.80.1 · TypeScript 5.4 | Multiplataforma iOS/Android (prioritario); optimizado para tablet |
| **UI / Design system** | Gluestack UI v1 + `lucide-react-native` | Sistema de diseño consistente, tokens propios (`Theme/gluestack-ui.config.ts`) |
| **Estado** | Redux Toolkit + redux-persist | Estado global offline-first (whitelist `theme`) |
| **Persistencia local** | TypeORM 0.3.27 + `react-native-nitro-sqlite` (SQLite) | Offline-first; `synchronize: true`; repositorios singleton |
| **Navegación** | React Navigation v7 (Native Stack + Bottom Tabs) | Flujo Home → Paciente → Evaluación → Módulo → Resultado |
| **Formularios** | react-hook-form + Yup | Validación de cuestionarios y formularios clínicos |
| **Síntesis de tono + DSP de audio** | `react-native-audio-api` (Software Mansion, sobre Oboe en Android) | Tonos puros (audiometrías) y captura/análisis PCM (voz y sonómetro) |
| **Captura de nivel sonoro** | `react-native-audio-api` (`AudioRecorder`) | Sonómetro Ambiental (RMS → dBFS → dB) |
| **Grabación/reproducción + voz** | `react-native-audio-recorder-player` · `@react-native-voice/voice` · `react-native-tts` | Articulación T.A.R. (modelo hablado, repetición, auto-evaluación) |
| **Permisos runtime** | `react-native-permissions` | Micrófono, Bluetooth, cámara, unificados Android/iOS |
| **Pulsioximetría BLE** | `react-native-ble-plx` (perfil Pulse Oximeter 0x1822) | Test de Disfagia MECV-V |
| **Firma digital** | `react-native-signature-canvas` | Consentimiento informado en Evaluación Clínica |
| **Vídeo / foto clínica** | `react-native-vision-camera` · `react-native-image-picker` | Disfagia y Evaluación Clínica |
| **Generación PDF** | `pdf-lib` | Informes clínicos estructurados por módulo |
| **Identidad y backend** | Firebase (`@react-native-firebase` app/auth/firestore) | Autenticación email/contraseña + perfil del profesional en Firestore (`professionals/{uid}`) |
| **Cifrado en tránsito** | TLS 1.3 | Obligatorio por GDPR para datos sanitarios |
| **Cifrado en reposo** | AES-256-GCM | Obligatorio por LOPDGDD |
| **Autenticación** | Firebase Authentication + `authSlice` (Redux, en memoria) | Verificación de credenciales y `uid` que ancla el perfil del profesional |
| **Sincronización HCE** | HL7 FHIR R4 REST API | Interoperabilidad con sistemas hospitalarios *(roadmap)* |
| **i18n / Errores** | i18next (es) · Sentry React Native | Localización y monitorización de errores en producción |

---

## Instalación y Configuración

> ⚠️ **Este software está destinado exclusivamente a instalaciones autorizadas bajo Acuerdo de Licencia vigente con Earlify Health.**

### Prerrequisitos

```
Node.js >= 18.x
npm >= 9.x  o  yarn >= 1.22.x
React Native 0.80.x (CLI @react-native-community/cli)
Xcode >= 15 (para iOS)
Android Studio >= 2023.x (para Android)
Proyecto Firebase con Authentication (email/contraseña) y Firestore habilitados
```

### Instalación de dependencias

```bash
# Clonar el repositorio (requiere acceso autorizado)
git clone https://github.com/earlify-health/via-plus.git
cd via-plus

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

# iOS
ios/GoogleService-Info.plist
```

> 🔐 **NUNCA versiones los archivos de configuración de Firebase ni ningún `.env` con datos
> reales.** Están incluidos en `.gitignore`.

### Variables de entorno

Crear un archivo `.env` a partir de la plantilla `.env.example`:

```bash
cp .env.example .env
```

```env
# Configuración del entorno
APP_ENV=development              # development | staging | production

# Seguridad
DEVICE_KEY_SALT=                 # Rellenar con valor provisto por Earlify Health

# Análisis de audio
AUDIO_SAMPLE_RATE=44100
AUDIO_CHANNELS=2                 # Estéreo (L/R)
AUDIO_BIT_DEPTH=16
```

### Ejecución en desarrollo

```bash
# Servidor Metro
npm start

# iOS
npm run ios

# Android
npm run android
```

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
- **Objetivo:** Medir ruido de fondo y solo permitir continuar si está bajo umbral (45 dB por defecto) y la checklist está completa
- **Nativo:** captura real de micrófono (`react-native-audio-api`: `AudioRecorder`); sin micrófono/permiso muestra error explícito (sin datos simulados)
- **Datos:** no persiste — navega directamente a `GameMenu`

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
- **Nativo:** captura PCM real (`react-native-audio-api`) + módulo nativo de DSP (fallback JS: `pitchfinder` + `fft.js`)
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
- **Nativo:** modelo hablado (`react-native-tts`) + grabación (`react-native-audio-recorder-player`) + reconocimiento de voz es-ES (`@react-native-voice/voice`) que auto-evalúa la repetición; degrada a SODA manual sin hardware/permiso
- **Datos:** entidad `ArticulationTest` · informe PDF `ArticulationDetail`

### 10 — Audiometría Verbal 🔊🗣️ (`VerbalAudiometry`)

- **Dominio:** Logoaudiometría en campo libre (altavoz del dispositivo, sin audífonos)
- **Objetivo:** Reconocimiento de conjunto cerrado por selección de tarjetas (`WordCard`), con listas de estímulos por franja de edad (A–D); modos discriminación y umbral (URV/SRT estimado)
- **Nativo:** voz humana neural del dispositivo (`react-native-tts`) presentada por el altavoz binaural; degrada con placeholders si falta imagen
- **Datos:** entidad `VerbalAudiometryTest` (tabla `verbal_audiometry_test`) · informe PDF

### 11 — Funciones Ejecutivas 🟢🗣️ (`ExecutiveFunctions`)

- **Dominio:** Exploración lúdica del neurodesarrollo (cribado orientativo, cortes provisionales)
- **Objetivo:** Batería de 5 mini-juegos de tarjetas (atención, inhibición, flexibilidad, memoria de trabajo y planificación) con dificultad graduada por banda de edad A–D; puntuaciones 0–100 por dominio
- **Nativo:** dictado por voz de las consignas de los mini-juegos (`react-native-tts`); no requiere hardware adicional para jugar
- **Datos:** entidad `ExecutiveFunctionsTest` (tabla `executive_functions_test`) · informe PDF

---

## Gestión de Riesgos

La gestión de riesgos de VIA+ sigue la norma **ISO 14971:2019** a lo largo de todo el ciclo de vida del software. Todos los cambios de arquitectura, nuevas funcionalidades y modificaciones de flujo deben incluir una **evaluación de impacto en seguridad del paciente** antes de su implementación.

Los principales riesgos identificados y sus controles se documentan en:

```
docs/risk-management/
├── FMEA-table.md          # Tabla FMEA completa
├── risk-register.md       # Registro de riesgos activos
└── risk-controls.md       # Controles implementados
```

Para reportar un incidente de seguridad: **safety@earlify.com**

---

## Contribución al Proyecto

VIA+ es software propietario. Las contribuciones están restringidas al equipo de desarrollo autorizado por Earlify Health. Si formas parte del equipo:

### Convenciones de desarrollo

```
Branching strategy:  Git Flow
  main         → Producción (protegida, requiere PR + revisión)
  develop      → Integración continua
  feature/xxx  → Nuevas funcionalidades
  fix/xxx      → Correcciones de bugs
  release/x.x  → Preparación de versiones

Commits:  Convención Conventional Commits
  feat:     Nueva funcionalidad
  fix:      Corrección de bug
  docs:     Documentación
  security: Cambio relacionado con seguridad (¡prioritario!)
  refactor: Refactorización sin cambio funcional
  test:     Adición o modificación de tests
```

### Pull Requests

Cada PR debe incluir obligatoriamente:

- [ ] Descripción del cambio y justificación clínica/técnica
- [ ] Evaluación de impacto en seguridad del paciente (ISO 14971)
- [ ] Tests añadidos o actualizados (cobertura mantenida ≥ 80%)
- [ ] Documentación actualizada
- [ ] Revisión por al menos 1 ingeniero senior y 1 responsable clínico

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
│
└── [Módulos futuros en roadmap]
```

---

## Estado del Proyecto

> Estado de integración según el Contrato de Compilación v3 (2026-06-25/26). La fuente de
> verdad es cada paquete `VIA+ <Módulo> (React Native)` (pantalla + `integration/`).

| Componente | Estado |
|---|---|
| Módulo de Consentimiento Informado | 🟡 En diseño |
| Pre-screening clínico (CAP) | 🟡 En diseño |
| Autenticación profesional (Firebase Auth) | 🟢 Integrado |
| Sincronización del perfil (Firestore) | 🟢 Integrado |
| Identificación de paciente | 🟢 Documentado |
| Generación de informes PDF | 🟢 Documentado |
| Sincronización clínica HL7-FHIR | 🔴 Pendiente (roadmap) |
| Certificación MDR Clase IIa | 🔴 En proceso |

### Batería de evaluación — 11 módulos

| # | Módulo | Pantalla + `integration/` | Servicio local | Hardware nativo |
|---|---|---|---|---|
| 1 | Evaluación Clínica Previa | 🟢 Construido | 🟢 OK | 🟢 ninguno |
| 2 | Autismo M-CHAT-R | 🟢 Construido | 🟢 OK (`screenings`) | 🟢 ninguno |
| 3 | Sonómetro Ambiental | 🟢 Construido | — (sin persistencia) | 🟢 micrófono real integrado |
| 4 | Audiometría Infantil | 🟢 Construido | 🟢 OK (`audiometry`) | 🟢 síntesis de tono (`audio-api`) |
| 5 | Audiometría Condicionada | 🟢 Construido | 🟢 Reutiliza `audiometry` | 🟢 síntesis de tono + reanimated |
| 6 | Análisis Acústico de Voz | 🟢 Construido | 🟢 OK (`voiceAnalysis`) | 🟢 mic + DSP (LPC nativo/fallback JS) |
| 7 | Test de Disfagia MECV-V | 🟢 Construido | 🟢 OK (`dysphagiaTest`) | 🟢 BLE pulsioxímetro (`ble-plx`) |
| 8 | Cribado SAHS Infantil | 🟢 Construido | 🟢 OK (`sahsScreenings`) | 🟢 ninguno |
| 9 | Articulación · T.A.R. | 🟢 Construido | 🟢 OK (`articulationTests`) | 🟢 mic + voz + TTS (degrada a SODA manual) |
| 10 | Audiometría Verbal | 🟢 Construido | 🟢 OK (`verbalAudiometry`) | 🟢 TTS neural (campo libre) |
| 11 | Funciones Ejecutivas | 🟢 Construido | 🟢 OK (`executiveFunctions`) | 🟢 TTS (dictado de consignas) |

> Los 11 módulos están construidos (pantalla + `integration/`) con su servicio local y
> migración TypeORM propia. Las 11 rutas están registradas en `RootStackParamList` y la
> batería completa persiste en SQLite cifrado del dispositivo.

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
| Incidentes de seguridad | safety@earlify.com |

---

<div align="center">

*VIA+ · Earlify Health S.L. · © 2024–2026 · Todos los derechos reservados*

*Desarrollado con rigor clínico para la salud pediátrica*

</div>
