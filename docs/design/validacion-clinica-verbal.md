# Validación clínica — Audiometría Verbal en Campo Libre

> **Estado:** PENDIENTE DE FIRMA. Este documento define qué debe validar el
> logopeda/fonoaudiólogo antes de habilitar el módulo `VerbalAudiometry` para
> uso clínico, qué garantiza ya la validación automática, y la justificación
> provisional de los cortes de interpretación.
> **Módulo:** `VerbalAudiometry` · SaMD Clase IIa (MDR 2017/745).
> **Diseño:** `docs/design/audiometria-verbal.md` · Mockup: `audiometria-verbal.dc.html`.

---

## 1. Qué está validado por máquina (CI) y qué no

La suite `verbalAudiometryValidation.test.ts` garantiza en cada build los
**invariantes estructurales** del banco de estímulos:

| Invariante | Comprobación automática |
|---|---|
| Cada lámina contiene el objetivo exactamente una vez, sin duplicados | ✅ CI |
| Objetivos únicos dentro de la lista puntuable de cada banda | ✅ CI |
| Distractores a ±1 sílaba del objetivo (se mide discriminación, no longitud) | ✅ CI |
| Bandas C/D: ≥1 vecino cercano por lámina (Levenshtein ≤ 2) | ✅ CI |
| Banda D: ≥3 de 5 distractores son pares mínimos o casi (≤ 2) | ✅ CI |
| Objetivos A/B en rango de vocabulario temprano (1–4 sílabas) | ✅ CI |
| Claves de asset biyectivas (ñ no colisiona: caña ≠ cana) | ✅ CI |
| Assets completos: 37 locuciones + 97 ilustraciones presentes | ✅ CI |

Lo que **NO puede validar la máquina** — y requiere firma del clínico — es el
**contenido**: familiaridad de las palabras por franja de edad y variante de
español, imaginabilidad de las ilustraciones (¿un niño de 2 años reconoce el
dibujo como «pato»?), equilibrio fonético de las listas, y la idoneidad de los
cortes de interpretación (§4).

## 2. Alcance de la validación clínica solicitada

Para **cada banda** (A–D), el validador debe revisar y firmar:

1. **Familiaridad léxica**: cada palabra objetivo y cada distractor pertenecen
   al vocabulario receptivo esperable de la franja de edad (y a la variante de
   español de la población diana; localizar si procede).
2. **Confundibilidad fonética**: los distractores fuerzan discriminación
   auditiva (pares mínimos / rima / estructura silábica), no adivinación por
   descarte semántico.
3. **Imaginabilidad (bandas A/B/C)**: la ilustración FINAL de cada palabra es
   inequívoca para la edad diana. ⚠️ Las ilustraciones actuales son
   **provisionales** (pictogramas emoji / tiles de inicial, ver §5): sirven
   para desarrollo y pilotos técnicos, **no para uso clínico**.
4. **Locuciones (todas las bandas)**: el dictado usa por decisión de
   producto el **sintetizador de voz NATIVO de Android** (TextToSpeech,
   voz es-ES del dispositivo), con nivel relativo aplicado por volumen de
   síntesis (KEY_PARAM_VOLUME) y presentación binaural centrada. El
   validador debe valorar si la voz nativa es aceptable para el cribado o
   si exige locución humana profesional (dicción neutra, sin carrier
   phrase, sonoridad normalizada); en tal caso los recortes sustituyen a
   la síntesis cambiando el motor a `engine: 'assets'` en App.tsx, sin
   otro cambio de código. ⚠️ La calidad de la voz nativa depende del motor
   TTS instalado en cada tableta: fijar/verificar el motor (p. ej. Speech
   Services de Google, voz es-ES) en el dispositivo de despliegue.
5. **Protocolo**: nº de láminas por pasada, repeticiones de ayuda (2),
   familiarización (1 lámina no puntuable) y niveles (65/50 dB orientativos).

## 3. Propiedades estructurales medidas del banco

Distancia de Levenshtein objetivo↔distractor (proxy de confundibilidad; en
español la ortografía de estas listas es cuasi-fonémica):

- **Banda C** (pares mínimos): 8/8 láminas con ≥1 distractor a distancia ≤2;
  6/8 láminas con los 5 distractores a distancia ≤2 (p. ej. «boca»:
  foca·roca·loca·toca·bota, todas a distancia 1).
- **Banda D** (adultos): 10/10 láminas con ≥3 distractores a distancia ≤2;
  7/10 con los 5 (p. ej. «pala»: bala·mala·gala·sala·tala).
- **Bandas A/B**: la confundibilidad se apoya en estructura silábica y rima
  (p. ej. «ventana»: manzana·campana·cabaña·semana·mañana), con todos los
  distractores a ±1 sílaba del objetivo. La lámina de familiarización de cada
  banda reutiliza palabras del pool (sin assets adicionales).

## 4. Justificación provisional de los cortes (≥90 / 70–89 / <70)

Los cortes de `verbalAudiometryResult.ts` (`DISCRIMINATION_OK_CUT = 90`,
`DISCRIMINATION_WARN_CUT = 70`) siguen la práctica audiológica común para
puntuaciones de reconocimiento verbal supraliminar (excelente ≥90 %;
reducción moderada 70–89 %; alterado <70 %), **ajustada al formato de
conjunto cerrado**, donde el azar no es 0 % sino 1/N (25 % en banda A con 4
opciones; 17 % en B/C/D con 6): un resultado cercano al azar es claramente
patológico o indica fallo de comprensión de la tarea.

Consideraciones que el validador debe confirmar o corregir:

- En conjunto cerrado las puntuaciones son sistemáticamente MÁS ALTAS que en
  repetición abierta: el corte de normalidad de 90 % es, si acaso,
  conservador; valorar si en banda A (4 opciones, azar 25 %) debe exigirse
  100 % o ampliarse la lista antes de interpretar.
- Con 8–10 láminas por pasada, la resolución es gruesa (1 fallo en banda A =
  −12,5 puntos): los cortes deben leerse como bandas orientativas de cribado,
  nunca como diagnóstico (así se etiqueta en UI/PDF).
- Según PubMed, el test ChEgSS (reconocimiento *closed-set* en español e
  inglés) demostró viabilidad y fiabilidad del paradigma de conjunto cerrado
  con normativa desde los **4 años** (Leibold et al., *Ear and Hearing* 2024,
  [DOI](https://doi.org/10.1097/AUD.0000000000001480)). Nuestra **banda A
  (<4 años)** queda por debajo de esa evidencia: el validador debe decidir si
  se mantiene como exploración orientativa con acompañamiento del profesional
  o se restringe la edad mínima.
- El URV/SRT estimado (modo umbral) usa bloques por nivel sin interpolación:
  precisión de ±paso de nivel; etiquetarlo siempre como «estimado».

## 5. Estado de los assets (provisionales vs. producción)

Inventario generado por `node scripts/verbal-assets.js manifest`
(`assets/verbal-manifest.json`, `provisional: true`):

| Asset | Estado | Firma |
|---|---|---|
| Dictado (motor por defecto) | **Recortes empaquetados** (`engine: 'assets'`, `preferTts: false`): emisión determinista e idéntica en todos los equipos. El TTS del dispositivo queda como degradación | — |
| Locuciones `assets/audio/verbal/**` (es 37 · gl 37 · eu 32 · es-DO 37 · es-419 37) | **Voz neuronal APROBADA PARA PRODUCCIÓN**, loudnorm −20 LUFS, suelo de duración 350 ms | ACOPROS (es · gl) y Ulertuz (eu), 31/07/2026 · **Quisqueya Habla (es-DO · es-419), 31/08/2026** — `assets/verbal-approval.<lang>.json` |
| 97 ilustraciones `assets/img/verbal/*.png` | Pictograma emoji o tile de inicial — **provisionales** | Ilustrador, estilo homogéneo, validadas con niños, misma clave |

Lo aprobado es la voz **con su receta** (modelo + parámetros + post-proceso),
no un lote de bytes: regenerar un banco con la misma receta conserva la firma;
cambiar de modelo, de `lengthScale` base o de post-proceso la invalida. Las
locuciones que el suelo de duración corrige con un `lengthScale` propio sí son
estímulos nuevos y necesitan reescucha — hoy, tres del castellano: «pan», «ven»
e «higo».

El **banco de estímulos** es una firma distinta de la del audio: el gallego lo
tiene desde el 28/07; el vasco desde el 31/07, firmado por la logopeda
euskaldun de Ulertuz (`assets/verbal-approval.eu.json`, scope `bank`); el
castellano, el dominicano y el latinoamericano lo heredan del inventario
castellano y por eso no llevan registro propio.

Quedan `ca` y `en`, y su etiqueta de provisional **no es por falta de firma**:
sus voces las firmaron María (otorrinolaringóloga catalana) y Miguelina el
31/08/2026, pero esas actas cubren solo el audio de las consignas del corpus y
viven en `tools/nos/voices.json`. Su banco verbal es PRESTADO —se les presentan
las palabras castellanas, locutadas con voz castellana—, así que **no existe ni
debe existir** `assets/verbal-approval.ca.json` ni `…en.json`: firmar unas
locuciones verbales que no existen dejaría aprobadas por adelantado las del día
que esas lenguas tengan banco propio. Lo vigila una prueba de
`verbalAudiometryBanks.test.ts`.

Una firma RETIRADA (`status: "superseded"`) se queda en el registro a propósito
—el castellano conserva la de davefx, el dominicano la de ACOPROS— para que el
expediente cuente qué cambió y por qué. Lo que **no** puede hacer es viajar en
el manifiesto como si fuera la vigente: `verbal-assets.js` las descarta al
generar, y una prueba comprueba que ningún manifiesto cite una firma retirada.
Ocurrió: el manifiesto castellano declaró `audioProvisional: false` citando a
davefx cuando el banco ya era sharvard.

La sustitución es archivo a archivo (misma clave = mismo nombre): no requiere
tocar código. Tras sustituir, ejecutar `node scripts/verbal-assets.js manifest`
y cambiar `provisional` a `false` en el manifiesto.

## 6. Hoja de firma

| Ítem | Validador | Fecha | Firma |
|---|---|---|---|
| Listas banda A (contenido + edad) | | | |
| Listas banda B (contenido + edad) | | | |
| Listas banda C (pares mínimos) | | | |
| Listas banda D (pares mínimos, adultos) | | | |
| Cortes de interpretación (§4) | | | |
| Ilustraciones definitivas (A/B/C) | | | |
| Locuciones definitivas (todas) | | | |
| Protocolo (repeticiones, familiarización, niveles) | | | |

> Hasta completar esta hoja, el módulo debe considerarse **piloto técnico**:
> operativo de extremo a extremo, con estímulos provisionales y cortes
> pendientes de confirmación clínica.
