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

- 🎮 **Baterías gamificadas** — 5 módulos de evaluación adaptados al paciente pediátrico
- 🔇 **Offline-first** — Operación completa sin conexión en entornos clínicos aislados
- 🔐 **Seguridad robusta** — AES-256 en reposo · TLS 1.3 en tránsito · Seudonimización
- 📋 **Consentimiento informado digital** — Gestión legal obligatoria para tutores legales
- 🏥 **Pre-screening clínico** — Certificado de Aptitud para la Prueba (CAP) integrado
- 📄 **Informes PDF** — Generación automática de informes clínicos estructurados
- 🔄 **Interoperabilidad HL7-FHIR** — Sincronización con HCE hospitalarias
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
│   ├── auth/              # Autenticación profesional + control de sesión
│   ├── consent/           # Módulo de Consentimiento Informado (BLOQUEANTE)
│   ├── prescreening/      # Pre-screening clínico + Certificado de Aptitud (CAP)
│   ├── sync/              # Motor de sincronización FHIR (offline-first)
│   └── security/          # Cifrado, seudonimización, gestión de claves
│
├── /patient
│   ├── registration/      # Alta y búsqueda de pacientes
│   └── profile/           # Perfil clínico del paciente
│
├── /evaluation
│   ├── session/           # Gestión de sesión de evaluación
│   ├── games/
│   │   ├── game01-audiometry/     # Audiometría condicionada gamificada
│   │   ├── game02-logoaudiometry/ # Logoaudiometría
│   │   ├── game03-discrimination/ # Discriminación auditiva
│   │   ├── game04-verbal/         # Repetición verbal (captura de audio)
│   │   └── game05-inhibition/     # Control inhibitorio (Toca Solo Si…)
│   └── audio/             # Captura, calibración y procesamiento de audio
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
      │  5 módulos de juegos adaptados al perfil del paciente
      │  Modo Niño: interfaz lúdica sin elementos clínicos visibles
      ▼
[5] GENERACIÓN DE RESULTADOS
      │  Informe PDF estructurado para el profesional
      │  Sincronización diferida con HCE (HL7 FHIR R4)
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
| **Frontend / App** | React Native · Flutter *(decisión pendiente)* | Multiplataforma iOS/Android; optimizado para tablet |
| **Persistencia local** | SQLite + SQLCipher | Offline-first; AES-256 en reposo |
| **Captura de audio** | react-native-audio-recorder-player · flutter_sound | Estéreo L/R independiente; latencia controlada |
| **Generación PDF** | react-native-pdf-lib · pdf_flutter | Informes clínicos y CAP |
| **Sincronización HCE** | HL7 FHIR R4 REST API | Interoperabilidad con sistemas hospitalarios |
| **Cifrado en tránsito** | TLS 1.3 | Obligatorio por GDPR para datos sanitarios |
| **Cifrado en reposo** | AES-256-GCM | Obligatorio por LOPDGDD |
| **Autenticación** | JWT + refresh tokens (corta caducidad) | Gestión segura de sesiones de profesionales |

---

## Instalación y Configuración

> ⚠️ **Este software está destinado exclusivamente a instalaciones autorizadas bajo Acuerdo de Licencia vigente con Earlify Health.**

### Prerrequisitos

```
Node.js >= 18.x
npm >= 9.x  o  yarn >= 1.22.x
React Native CLI >= 0.73  o  Flutter >= 3.x
Xcode >= 15 (para iOS)
Android Studio >= 2023.x (para Android)
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

### Variables de entorno

Crear un archivo `.env` a partir de la plantilla `.env.example`:

```bash
cp .env.example .env
```

```env
# Configuración del entorno
APP_ENV=development              # development | staging | production
API_BASE_URL=https://api.earlify.com/v1

# Seguridad
DEVICE_KEY_SALT=                 # Rellenar con valor provisto por Earlify Health
JWT_SECRET=                      # No compartir ni versionar

# FHIR
FHIR_SERVER_URL=                 # URL del servidor FHIR del hospital
FHIR_CLIENT_ID=                  # Credencial provista por el hospital

# Análisis de audio
AUDIO_SAMPLE_RATE=44100
AUDIO_CHANNELS=2                 # Estéreo (L/R)
AUDIO_BIT_DEPTH=16
```

> 🔐 **NUNCA versiones el archivo `.env` con datos reales.** Está incluido en `.gitignore`.

### Ejecución en desarrollo

```bash
# iOS
npx react-native run-ios --device "iPad Pro (12.9-inch)"

# Android
npx react-native run-android
```

### Tests

```bash
# Tests unitarios
npm run test

# Tests de integración clínica
npm run test:clinical

# Cobertura (objetivo: ≥ 80% en módulos core)
npm run test:coverage
```

---

## Módulos de la Aplicación

### Juego 01 — Audiometría Condicionada Gamificada

- **Dominio:** Audiología
- **Objetivo:** Evaluar umbrales de detección tonal mediante respuesta condicionada operante
- **Estímulos:** Tonos puros L/R independientes (250 Hz – 8 kHz)
- **Respuesta del niño:** Acción táctil ante detección del sonido

### Juego 02 — Logoaudiometría

- **Dominio:** Audiología + Lenguaje
- **Objetivo:** Evaluar discriminación de palabras en diferentes relaciones señal/ruido
- **Estímulos:** Material verbal grabado y calibrado

### Juego 03 — Discriminación y Comprensión Auditiva

- **Dominio:** Lenguaje receptivo
- **Objetivo:** Evaluar comprensión de instrucciones verbales simples y complejas
- **Respuesta del niño:** Selección de imagen correspondiente

### Juego 04 — Repetición Verbal

- **Dominio:** Lenguaje expresivo + biomarcadores vocales
- **Objetivo:** Captura de producción verbal para análisis espectrográfico
- **Datos generados:** Archivos de audio cifrados para revisión clínica diferida

### Juego 05 — Control Inhibitorio (Toca Solo Si…)

- **Dominio:** Neurodesarrollo · Funciones ejecutivas
- **Objetivo:** Evaluar control inhibitorio y atención selectiva
- **Datos generados:** Aciertos, errores perseverativos, tiempos de reacción

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

| Componente | Estado |
|---|---|
| Módulo de Consentimiento Informado | 🟡 En diseño |
| Pre-screening clínico (CAP) | 🟡 En diseño |
| Autenticación profesional | 🟢 Documentado |
| Identificación de paciente | 🟢 Documentado |
| Batería de juegos (5 módulos) | 🟢 Documentado |
| Generación de informes PDF | 🟢 Documentado |
| Sincronización HL7-FHIR | 🔴 Pendiente |
| Certificación MDR Clase IIa | 🔴 En proceso |

---

## Licencia

VIA+ es software propietario de Earlify Health S.L. **Todos los derechos reservados.**

El uso, copia, modificación o distribución de este software sin un Acuerdo de Licencia vigente con Earlify Health está estrictamente prohibido y puede constituir una infracción de la propiedad intelectual y de la normativa de dispositivos médicos aplicable.

Consulta el archivo [LICENSE](./LICENSE) para los términos completos.

---

## Contacto

| Área | Contacto |
fbetances@futureforkids.eu

---

<div align="center">

*VIA+ · Earlify Health S.L. · © 2024–2026 · Todos los derechos reservados*

*Desarrollado con rigor clínico para la salud pediátrica*

</div>
