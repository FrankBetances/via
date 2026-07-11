# Plan de implementación — Audiometría Verbal en Campo Libre

> **Estado:** diseño (Iteración 1). El desarrollo se aborda en la Iteración 2.
> **Mockup visual:** `docs/design/audiometria-verbal.dc.html` (interactivo:
> pantalla de la prueba + especificación de la tarjeta `WordCard`).
> **Módulo nuevo:** `VerbalAudiometry` — logoaudiometría de reconocimiento
> por selección de tarjetas, en **campo libre** (altavoces de la tableta),
> **sin audífonos**, con listas adaptadas a la **edad** del paciente.
> **Clase / marco regulatorio:** SaMD Clase IIa (MDR 2017/745). Medida
> **orientativa**; no sustituye equipo certificado ni constituye diagnóstico.

---

## 1. Objetivo clínico

Explorar la **inteligibilidad / discriminación verbal** del paciente cuando el
estímulo se presenta por **campo libre** a través del altavoz del dispositivo
(sin auriculares ni audífonos). El paciente **oye una palabra** y **selecciona
la tarjeta** correspondiente de un conjunto cerrado (*closed-set*):

- **Niños pequeños** → tarjetas con **imágenes**.
- **Niños en transición lectora** → tarjetas con **imagen + palabra**.
- **Niños mayores y adultos** → tarjetas con **solo palabra**.

Es una prueba de **reconocimiento de conjunto cerrado** (el paciente elige entre
N alternativas), que es la forma clínicamente válida de logoaudiometría cuando
el sujeto **no puede o no debe repetir** (niños prelectores, cribado rápido). Se
diferencia así de la logoaudiometría abierta clásica por repetición.

### Qué mide (salidas)

1. **Discriminación verbal (%)** — porcentaje de aciertos sobre la lista, a un
   **nivel de presentación** fijo (p. ej. voz conversacional ≈ 65 dB y, opcional,
   voz baja ≈ 50 dB). Es la salida primaria.
2. **URV / SRT estimado (opcional)** — *Umbral de Recepción Verbal*: nivel más
   bajo (dB) al que el paciente reconoce ≈ 50 % de las palabras, hallado por
   descenso. Solo si el profesional activa el "modo umbral".

> ⚠️ El nivel **absoluto** en campo libre por altavoz es **orientativo** (igual
> que en la audiometría tonal del proyecto: `audiometryCalibration.ts`). La UI
> y el PDF deben advertirlo. La salida robusta es el **% de discriminación**
> a nivel de "voz conversacional", no un umbral absoluto en dB.

---

## 2. Encaje en la arquitectura VIA+

El módulo replica **exactamente** el patrón de los módulos existentes
(`Audiometry`, `Articulation`, `VoiceAnalysis`, `DysphagiaTest`), para no
introducir estilo nuevo:

| Capa | Módulo análogo de referencia | Archivo(s) nuevos |
|---|---|---|
| Modelo/entidad TypeORM + DTO | `Models/ArticulationTest` | `Models/VerbalAudiometry/VerbalAudiometryTest.ts` + `index.ts` |
| Lógica pura (sin UI/DB) | `Screens/Articulation/articulationResult.ts` | `Screens/VerbalAudiometry/verbalAudiometryResult.ts` |
| Banco de estímulos (listas) | `articulationResult.ts` (inventario) | `Screens/VerbalAudiometry/verbalAudiometryLists.ts` |
| Adaptador de audio (degradable) | `Screens/Articulation/articulationAudio.ts` | `Screens/VerbalAudiometry/verbalAudiometryAudio.ts` |
| Pantalla | `Screens/Audiometry/AudiometryScreen.tsx` | `Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx` |
| Componente de tarjeta | (nuevo) | `Screens/VerbalAudiometry/components/WordCard.tsx` |
| Servicio RTK (CRUD local) | `Services/local/modules/audiometry/*` | `Services/local/modules/verbalAudiometry/*` |
| Repositorio | `Repositories/AudiometryRepository.ts` | `Repositories/VerbalAudiometryRepository.ts` |
| Migración (opcional; hay `synchronize:true`) | `1718900000350-CreateArticulation.ts` | `1718900000400-CreateVerbalAudiometry.ts` |
| Bloque PDF | `PDF/blocks/AudiometryDetail.ts` | `PDF/blocks/VerbalAudiometryDetail.ts` |
| Hoja de resultados | `Screens/ResultadosFinal/ResultadosFinalScreen.tsx` | (editar: añadir bloque) |
| Hub de selección | `Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx` | (editar: añadir tarjeta de módulo) |
| Rutas | `Navigators/screenTypeNavigator.ts` + `Default.tsx` | (editar) |
| Registro de entidad | `Database/config.ts` | (editar) |

---

## 3. Franjas de edad, modalidad y listas de estímulos

El profesional **selecciona la franja** al iniciar (se **autopropone** desde la
edad del paciente cuando esté disponible en memoria, con **override manual**;
en Fase 1 la fecha de nacimiento va cifrada — `Patient.dobEnc` — por lo que la
selección es principalmente manual).

Cada franja define: **modalidad de tarjeta**, **nº de opciones por lámina** y una
**lista de láminas** (cada lámina = 1 palabra objetivo + distractores mostrados).
Los distractores se eligen **fonéticamente confundibles** (pares mínimos cuando
es posible) para que la prueba mida **discriminación**, no vocabulario.

> Las listas siguientes son una **propuesta base** y **deben ser validadas por
> el logopeda/fonoaudiólogo** y localizadas (variante de español). Cada palabra
> requiere: (a) un **recorte de audio** grabado por locutor y (b) una
> **ilustración** (bandas con imagen). Ver §7 (assets).

### Banda A — Solo imágenes · ≈ 18 m – 3;11 · 4 opciones/lámina

Palabras bisílabas muy familiares; distractores confundibles.

| # | Objetivo | Opciones mostradas (imágenes) |
|---|----------|-------------------------------|
| 1 | **pato** | pato · gato · pan · mano |
| 2 | **gato** | gato · pato · vaca · mano |
| 3 | **casa** | casa · taza · mesa · boca |
| 4 | **taza** | taza · casa · pala · vaca |
| 5 | **mano** | mano · mono · pan · gato |
| 6 | **pelota** | pelota · galleta · zapato · manzana |
| 7 | **zapato** | zapato · pato · plátano · pelota |
| 8 | **flor** | flor · sol · pan · pez |

### Banda B — Imagen + palabra · ≈ 4 – 5 años · 6 opciones/lámina

Bi/trisílabas; primeras aproximaciones a la lectura (imagen dominante, palabra
de apoyo debajo).

| # | Objetivo | Opciones mostradas |
|---|----------|--------------------|
| 1 | **ventana** | ventana · manzana · campana · cabaña · semana · mañana |
| 2 | **caballo** | caballo · cebolla · pastilla · botella · rodilla · zapato |
| 3 | **mariposa** | mariposa · manguera · escalera · tijeras · bandera · pelota |
| 4 | **plátano** | plátano · pájaro · sábana · lámpara · cámara · número |
| 5 | **tijeras** | tijeras · orejas · abejas · cerezas · maderas · escoba |
| 6 | **escoba** | escoba · escuela · estrella · ballena · botella · cadena |
| 7 | **botella** | botella · ballena · estrella · botón · pelota · maleta |
| 8 | **cebolla** | cebolla · rodilla · pastilla · caballo · semilla · gallina |

### Banda C — Mixto (imagen + palabra) · ≈ 6 – 8 años · 6 opciones/lámina

Foco explícito en **pares mínimos** (imagen + palabra); la modalidad "mixta"
permite lectura incipiente sin depender de ella.

| # | Objetivo | Opciones mostradas (incluye su par mínimo) |
|---|----------|--------------------------------------------|
| 1 | **pino** | pino · vino · fino · niño · lino · pila |
| 2 | **boca** | boca · foca · roca · loca · toca · bota |
| 3 | **gota** | gota · bota · nota · rota · pota · gorra |
| 4 | **rata** | rata · lata · pata · bata · gata · rana |
| 5 | **caña** | caña · casa · cara · cana · gana · maña |
| 6 | **peine** | peine · reina · aceite · fuente · puente · diente |
| 7 | **queso** | queso · beso · peso · hueso · yeso · seso |
| 8 | **jarra** | jarra · barra · parra · garra · marca · carta |

### Banda D — Solo palabras · ≈ 9 – 15 años **y ADULTOS** · 6 opciones/lámina

Tarjetas **solo texto** (sin imagen). Listas quasi–fonéticamente balanceadas con
pares mínimos que estresan consonantes sonoras/sordas y punto de articulación.
**Los adultos usan esta banda.**

| # | Objetivo | Opciones mostradas |
|---|----------|--------------------|
| 1 | **peso** | peso · beso · queso · yeso · hueso · seso |
| 2 | **coma** | coma · goma · toma · loma · roma · cama |
| 3 | **callo** | callo · gallo · rayo · mayo · cayo · fallo |
| 4 | **pala** | pala · bala · mala · gala · sala · tala |
| 5 | **tos** | tos · dos · voz · sol · gol · flor |
| 6 | **higo** | higo · hijo · hilo · fijo · rico · trigo |
| 7 | **mora** | mora · hora · gorra · zorra · torre · morra |
| 8 | **ven** | ven · den · ten · fen · sien · bien |
| 9 | **rosa** | rosa · loza · roja · roca · ropa · sosa |
| 10 | **vaca** | vaca · baca · faca · maca · saca · placa |

> **Selección de banda por edad (autopropuesta):**
> `< 4a → A` · `4–5a → B` · `6–8a → C` · `9–15a → D` · `adulto (≥16a) → D`.
> Siempre con override manual del profesional.

---

## 4. Protocolo de la prueba

**Vía:** campo libre, binaural (mejor oído), estímulo **centrado** en ambos
altavoces (`pan = 0`, igual que el canal `CL` de la audiometría tonal).

### Flujo por ítem

1. El sistema **reproduce la palabra objetivo** (asset grabado; *fallback* TTS).
2. Se muestran las **N tarjetas** de esa lámina (orden aleatorizado).
3. El paciente **toca la tarjeta**. El sistema registra **acierto/fallo**.
4. Opción de **repetir el estímulo** (máx. configurable, p. ej. 2 repeticiones,
   registradas como *ayuda*).
5. Avanza al siguiente ítem. Barra de progreso + refuerzo lúdico en niños.

### Niveles de presentación

- **Modo discriminación (por defecto):** lista completa a **nivel conversacional**
  (≈ 65 dB; etiqueta "voz normal"). Opcional repetir a **voz baja** (≈ 50 dB) para
  cribar. Se calcula **% de aciertos por nivel**.
- **Modo umbral URV (opcional):** se desciende el nivel en pasos (p. ej. 10 dB)
  usando bloques de ítems; se estima el nivel al 50 % de aciertos.

### Aleatorización y control

- Orden de láminas y de opciones **aleatorizado** (semilla por sesión) para evitar
  aprendizaje entre repeticiones.
- **Ítem de familiarización** inicial (no puntúa) para enseñar la mecánica.
- **Fiabilidad** estimada de forma análoga al resto (coherencia de respuestas,
  repeticiones usadas, tiempo de reacción atípico).

### Puntuación (lógica pura)

```
discriminationPct(level) = round(100 * correct(level) / presented(level))
```

Interpretación orientativa del % (voz conversacional, campo libre):

| Discriminación | Interpretación orientativa |
|---|---|
| ≥ 90 % | Reconocimiento verbal dentro de lo esperado |
| 70 – 89 % | Reconocimiento reducido — **revisar** |
| < 70 % | Reconocimiento alterado — **derivar a ORL/audiología** |

> Umbrales de corte a **validar clínicamente**; parametrizables en
> `verbalAudiometryResult.ts`. En **campo libre sin discriminación de oído**, un
> resultado normal **no descarta** pérdida unilateral (mismo *disclaimer* que el
> cribado tonal `CL`).

---

## 5. Modelo de datos

Nueva entidad `VerbalAudiometryTest` → tabla `verbal_audiometry_test`, siguiendo
literalmente el patrón de `ArticulationTest` (tabla dedicada + `simple-json` para
el mapa de resultados + `@Transform`/`@Exclude` para DTO).

```ts
// src/Screens/VerbalAudiometry/verbalAudiometryResult.ts  (tipos compartidos)
export type AgeBand = 'A' | 'B' | 'C' | 'D';
export type CardModality = 'images' | 'mixed' | 'words';
export type VerbalMode = 'discrimination' | 'threshold';

/** Respuesta a un ítem presentado. */
export interface VerbalItemResult {
  itemId: number;
  level: number;          // dB de presentación
  chosenWord: string;     // palabra de la tarjeta elegida
  correct: boolean;
  repeats: number;        // veces que se repitió el estímulo (ayuda)
}

export type VerbalResults = Record<string, VerbalItemResult>; // key = `${itemId}@${level}`

export interface LevelScore {
  level: number;
  presented: number;
  correct: number;
  pct: number;            // 0..100
}
```

```ts
// src/Models/VerbalAudiometry/VerbalAudiometryTest.ts
@Entity('verbal_audiometry_test')
export class VerbalAudiometryTest {
  @PrimaryGeneratedColumn() id: number;

  @Column({ type: 'varchar', default: 'Audiometría verbal (campo libre)' })
  instrument: string;

  @Column({ type: 'varchar', default: 'soundfield' })
  transducer: string;                 // siempre 'soundfield'

  @Column({ type: 'varchar', default: 'A' })
  ageBand: AgeBand;                   // A | B | C | D

  @Column({ type: 'varchar', default: 'images' })
  modality: CardModality;            // images | mixed | words

  @Column({ type: 'varchar', default: 'discrimination' })
  mode: VerbalMode;                  // discrimination | threshold

  @Column('simple-json') results: VerbalResults;

  @Column('simple-json') levelScores: LevelScore[];   // % por nivel presentado

  @Column({ type: 'integer', nullable: true }) srtDb: number | null; // URV opcional

  @Column({ type: 'integer', default: 0 }) presentedCount: number;
  @Column({ type: 'integer', default: 0 }) correctCount: number;
  @Column({ type: 'integer', default: 0 }) discriminationPct: number; // nivel principal

  @Column({ type: 'integer', nullable: true }) reliability: number | null;

  @Column({ type: 'varchar', default: '' }) interpretation: string;
  @Column({ type: 'varchar', default: '' }) notes: string;
  @Column({ type: 'varchar', default: '' }) evaluatorName: string;
  @Column({ type: 'varchar', default: '' }) evaluatorLicense: string;

  @Column({ type: 'datetime' }) /* @Transform ISO<->Date */ completedAt: Date;

  @ManyToOne(() => Evaluation, { eager: true })
  @Exclude({ toPlainOnly: true }) @Type(() => Evaluation)
  evaluation: Evaluation;

  @CreateDateColumn() createdAt: Date;   // + @Transform
  @UpdateDateColumn() updatedAt: Date;   // + @Transform
}
```

`VerbalAudiometryTestDTO` espeja los campos con `completedAt/createdAt/updatedAt`
como `string` ISO y `evaluationId: number` (idéntico a `ArticulationTestDTO`).

**Registro de entidad:** añadir `VerbalAudiometryTest` al array `entities` de
`src/Database/config.ts` (con `synchronize:true` la tabla se crea sola; la
migración `1718900000400-CreateVerbalAudiometry.ts` queda como respaldo, mismo
patrón que `CreateArticulation`).

---

## 6. Banco de estímulos — `verbalAudiometryLists.ts`

Lógica pura, sin UI/DB (como `articulationResult.ts`), fuente única para pantalla
y PDF.

```ts
export interface VerbalCardOption {
  word: string;
  image?: string;   // clave del asset de imagen (bandas A/B/C)
}
export interface VerbalItem {
  id: number;
  band: AgeBand;
  targetWord: string;
  audio: string;    // clave del asset de audio de la palabra
  options: VerbalCardOption[];   // incluye el objetivo; se baraja en runtime
}
export interface VerbalBandDef {
  band: AgeBand;
  label: string;            // 'Solo imágenes (2–3 años)'
  modality: CardModality;
  optionsPerCard: number;   // 4 (A) | 6 (B/C/D)
  items: VerbalItem[];
}

export const VERBAL_BANDS: VerbalBandDef[] = [ /* Bandas A–D del §3 */ ];

export const bandForAge = (years: number | null): AgeBand =>
  years == null ? 'A' : years < 4 ? 'A' : years <= 5 ? 'B' : years <= 8 ? 'C' : 'D';

export const shuffleOptions = (item: VerbalItem, seed: number): VerbalCardOption[] => /* … */;
export const computeVerbalScore = (results: VerbalResults): {
  levelScores: LevelScore[]; presentedCount: number; correctCount: number; discriminationPct: number;
} => { /* agrega por nivel */ };
export const interpretVerbal = (band: AgeBand, levelScores: LevelScore[], srtDb: number | null): string => /* … */;
export const verbalDiscriminationStatus = (pct: number): 'ok' | 'warn' | 'alt' =>
  pct >= 90 ? 'ok' : pct >= 70 ? 'warn' : 'alt';
```

---

## 7. Audio — `verbalAudiometryAudio.ts` (degradable)

Reproducción de **palabras en campo libre**, con el **principio VIA+ de
degradación** (si falta una librería o un asset, el módulo sigue: el clínico
presenta el modelo con su voz y clasifica manualmente).

**Motor primario — assets grabados calibrados** (recomendado clínicamente):
`react-native-audio-api` ya se usa en el proyecto y expone `decodeAudioData` +
`createBufferSource` (ver `VoiceAnalysis/voiceMicAdapter.ts`). Cadena:

```
AudioBuffer(palabra) → BufferSource → GainNode(nivel dB, orientativo) → StereoPanner(pan=0) → destination
```

- Sesión de audio idéntica al tono: `defaultToSpeaker` + Bluetooth (ver
  `audiometryToneAdapter.ts`).
- Nivel dB→ganancia **orientativo** (reutilizar el enfoque de
  `audiometryCalibration.ts`, calibrando contra el nivel de voz de los assets).

**Fallback — TTS** (`react-native-tts`, ya integrado en `articulationAudio.ts`):
si no hay assets grabados, `speakWord(word)` en `es-ES`. Se marca la prueba como
**"nivel no calibrado (TTS)"** en UI/PDF.

**Assets necesarios (Iteración 2):**
- `assets/audio/verbal/<word>.m4a` — 1 por palabra objetivo (locutor neutro).
- `assets/img/verbal/<word>.png` — ilustración por palabra (bandas A/B/C).
- Nomenclatura estable = claves `audio`/`image` de `verbalAudiometryLists.ts`.

---

## 8. Diseño de la **tarjeta de selección** — `components/WordCard.tsx`

Componente presentacional reutilizable (Gluestack, mismo lenguaje visual que las
tarjetas de `SeleccionEjercicios` y los instrumentos de `AudiometryScreen`).

### Props

```ts
interface WordCardProps {
  word: string;
  image?: string;                 // asset; requerido si modality != 'words'
  modality: 'images' | 'mixed' | 'words';
  state: 'idle' | 'correct' | 'wrong' | 'revealTarget' | 'disabled';
  onPress: () => void;
  size?: 'lg' | 'md';             // lg para bandas A/B (niños), md para D
}
```

### Anatomía por modalidad

```
 images (Banda A)         mixed (Bandas B/C)        words (Banda D)
┌──────────────┐        ┌──────────────┐         ┌──────────────┐
│              │        │              │         │              │
│   🖼  IMAGEN  │        │   🖼 IMAGEN   │         │              │
│   (grande)   │        │              │         │    PESO      │
│              │        │──────────────│         │  (texto      │
│              │        │    perro     │         │   grande)    │
└──────────────┘        └──────────────┘         └──────────────┘
   toque = elegir           imagen + palabra          solo palabra
```

- **Rejilla:** `HStack flexWrap` — 2 columnas × 2 (banda A, 4 tarjetas) o
  3 × 2 / 2 × 3 (bandas B/C/D, 6 tarjetas). Anchos `~46%`/`~31%` como en el juego
  de instrumentos.
- **Radio/estilo base:** `borderRadius: 18–20`, `borderWidth: 1.5`, sombra suave
  (idéntico a `ModuleCardItem` / instrumentos).

### Estados visuales (tokens del tema)

| Estado | Borde | Fondo | Señal |
|---|---|---|---|
| `idle` | `$borderLight200` | `$white` | — |
| `correct` (elegida y acierto) | `$success400` (2.5) | `$success50` | ✓ verde, micro‑celebración |
| `wrong` (elegida y fallo) | `$error400` (2.5) | `$error50` | ✕ rojo (breve) |
| `revealTarget` (mostrar correcta tras fallo, si el protocolo lo permite) | `$primary400` | `$primary0` | halo/anillo |
| `disabled` (bloqueada tras responder) | `$borderLight100` | `$backgroundLight50` | opacidad 0.6 |

- **Niños (A/B/C):** tamaño `lg`, imagen ≥ 96–120 px, refuerzo positivo
  (estrella/emoji) al acertar, sin penalización visual agresiva en el fallo.
- **Adultos (D):** tamaño `md`, tipografía grande legible, sin decoración lúdica;
  estética sobria y clínica.
- **Accesibilidad:** `accessibilityLabel = word`, área táctil ≥ 64 px, alto
  contraste; no depender solo del color (icono ✓/✕ + borde).

---

## 9. Pantalla de la prueba — `VerbalAudiometryScreen.tsx`

Estructura calcada de `AudiometryScreen` (`Content` + `RadialBackground` +
`Header` + `ScrollView` de tarjetas), con estas secciones:

1. **Cabecera** — título "Audiometría verbal", chip "CAMPO LIBRE · SIN
   AUDÍFONOS", nombre del paciente, progreso (ítem X/N, estrellas en niños).
2. **Configuración de sesión** (colapsable) — selector de **banda de edad**
   (A/B/C/D, autopropuesta), **modo** (discriminación / umbral), **nivel(es)**
   de presentación. Aviso de "nivel orientativo".
3. **Panel de estímulo** — botón grande **"▶ Escuchar palabra"** (con estado
   "SONANDO…") + **"Repetir"**; el evaluador controla el avance.
4. **Rejilla de tarjetas** — `WordCard[]` de la lámina actual (barajadas). Al
   tocar: fija estado `correct`/`wrong`, registra `VerbalItemResult`, deshabilita
   la lámina y ofrece **"Siguiente"**.
5. **Marcador en vivo** — % de discriminación por nivel, aciertos/total,
   fiabilidad (mismas *stat boxes* que `AudiometryScreen`).
6. **Panel del evaluador + guardar** — nombre/colegiado, observaciones, botón
   **"Guardar audiometría verbal"** → `createVerbalAudiometry` (RTK) → toast →
   `navigation.goBack()` (idéntico a `handleSave` de `AudiometryScreen`).

Estado del hook (`useVerbalAudiometryTest`, análogo a `useAudiometryTest`):
`band`, `mode`, `level`, `itemIndex`, `results`, `levelScores`,
`discriminationPct`, `reliability`, acciones `play/repeat/choose(optionId)/next/
reset`, y `thresholds`→aquí `levelScores`.

---

## 10. Actualización de la **hoja de resultados**

### 10.1 `ResultadosFinalScreen.tsx` (vista en app)

Reutiliza el tipo `TestDetail` existente. La audiometría verbal encaja como
`kind: 'rows'` (filas etiqueta/valor/estado) o un `kind` nuevo `'verbal'` para
una tabla `nivel → %`. Propuesta mínima con `kind: 'rows'`:

```ts
const verbals = await VerbalAudiometryRepository.getVerbalByEvaluation(evaluationId);
verbals.forEach(v => {
  const status: StatusKind = verbalDiscriminationStatus(v.discriminationPct);
  const rows: SimpleRow[] = [
    { label: 'Banda / modalidad', value: BAND_LABEL[v.ageBand], status: 'ok', tag: MODALITY_LABEL[v.modality] },
    ...v.levelScores.map(ls => ({
      label: `Discriminación · ${ls.level} dB`, value: `${ls.pct} %`,
      status: verbalDiscriminationStatus(ls.pct), tag: `${ls.correct}/${ls.presented}`,
    })),
    ...(v.srtDb != null ? [{ label: 'URV (umbral verbal)', value: `${v.srtDb} dB`, status: 'ok', tag: 'estimado' }] : []),
  ];
  result.push({
    id: `verbal-${v.id}`, kind: 'rows', status,
    title: 'Audiometría Verbal',
    subtitle: 'Reconocimiento por tarjetas · campo libre · sin audífonos',
    icon: Ear,   // o MessageSquare / Volume2 (lucide)
    rows,
    interp: v.interpretation,
  });
});
```

- Aparece automáticamente en el **panel lateral** de pruebas y en el detalle,
  con su semáforo (`ok`/`warn`/`alt`) por el mismo `STATUS_TOKENS`.
- Añadir `VerbalAudiometryRepository` a los imports y su carga en el `useEffect`.

> **Alternativa recomendada (más rica):** un `kind: 'verbal'` con una **tabla
> nivel × %** (como la tabla `audio` de umbrales) y leyenda de cortes
> (≥90 verde / 70–89 ámbar / <70 rojo). Requiere un pequeño bloque de render
> nuevo en el panel de detalle, análogo al bloque `kind === 'audio'`.

### 10.2 PDF — `PDF/blocks/VerbalAudiometryDetail.ts`

Nueva página de detalle (patrón `AudiometryDetail.ts`): título "Audiometría
verbal (campo libre)", banda/modalidad, **tabla nivel → % (aciertos/total)**,
URV si existe, interpretación, notas, evaluador + fecha, `Logo`. Registrar el
bloque en `PDF/blocks/index.ts` y llamarlo en `PDF/templates/Report.ts` tras el
bucle de audiometrías (una página por resultado verbal):

```ts
const verbals = await VerbalAudiometryRepository.getVerbalByEvaluation(evaluation.id);
for (const test of verbals) {
  const page = pdfDoc.addPage();
  await blocks.VerbalAudiometryDetail({ test }, { page, fonts, t });
}
```

---

## 11. Cableado (ediciones de integración)

1. **`Navigators/screenTypeNavigator.ts`** — añadir ruta:
   `VerbalAudiometry: undefined;` en `RootStackParamList`.
2. **`Navigators/Default.tsx`** — `import { VerbalAudiometryScreen }` +
   `<RootStack.Screen name="VerbalAudiometry" component={VerbalAudiometryScreen} />`.
3. **`Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx`** — nueva
   `ModuleCard` en `MODULES`:
   ```ts
   { id: 'VerbalAudiometry', title: 'Audiometría Verbal',
     description: 'Reconocimiento verbal por tarjetas · campo libre, sin audífonos.',
     duration: '5–8 min', ages: '2 a – adulto', emoji: '🗣️', deco: '🔊',
     tag: 'AUDICIÓN', color: '#2563EB', soft: '#DBEAFE' },
   ```
4. **`Database/config.ts`** — importar y registrar `VerbalAudiometryTest` en
   `entities`.
5. **`Services/local/modules/verbalAudiometry/`** — crear `index.ts` +
   `create/update/delete/getById/getByEvaluation` (copia de `audiometry/*`,
   cambiando entidad/tabla y nombres de hooks
   `useCreateVerbalAudiometryMutation`, `useLazyGetVerbalByEvaluationQuery`, …).
6. **`Repositories/VerbalAudiometryRepository.ts`** — `getVerbalByEvaluation`,
   `getVerbalById` (copia de `AudiometryRepository`).
7. **`Store`** — registrar el reducer/endpoints del nuevo módulo RTK si el
   proyecto lo hace explícitamente (revisar cómo se agregan los de `audiometry`).

---

## 12. Checklist de implementación (Iteración 2)

- [x] `src/Models/VerbalAudiometry/VerbalAudiometryTest.ts` (+ `index.ts`)
- [x] `src/Screens/VerbalAudiometry/verbalAudiometryResult.ts` (tipos + lógica)
- [x] `src/Screens/VerbalAudiometry/verbalAudiometryLists.ts` (bandas A–D)
- [ ] `src/Screens/VerbalAudiometry/verbalAudiometryAudio.ts` (assets + TTS fallback)
- [ ] `src/Screens/VerbalAudiometry/useVerbalAudiometryTest.ts` (hook de estado)
- [x] `src/Screens/VerbalAudiometry/components/WordCard.tsx`
- [ ] `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx` (+ `index.ts`)
- [ ] `src/Services/local/modules/verbalAudiometry/*` (CRUD RTK)
- [ ] `src/Repositories/VerbalAudiometryRepository.ts`
- [x] `src/Database/migrations/1718900000400-CreateVerbalAudiometry.ts`
- [x] `src/Database/config.ts` (registrar entidad)
- [ ] `src/PDF/blocks/VerbalAudiometryDetail.ts` (+ `blocks/index.ts` + `templates/Report.ts`)
- [ ] `src/Navigators/screenTypeNavigator.ts` + `Default.tsx` (ruta)
- [ ] `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx` (tarjeta módulo)
- [ ] `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx` (bloque de resultado)
- [ ] **Assets:** `assets/audio/verbal/*.m4a`, `assets/img/verbal/*.png`
- [x] **Tests:** `verbalAudiometryResult.test.ts` + `verbalAudiometryLists.test.ts` (31 tests: puntuación, cortes, banda por edad, invariantes de listas, barajado determinista, inventario de assets)
- [ ] **Validación clínica** de listas y cortes por el logopeda; localización es-XX
- [ ] `i18next`: claves de textos y del PDF

---

## 13. Consideraciones regulatorias (SaMD IIa)

- **Etiquetado "orientativo"** obligatorio en pantalla y PDF: el nivel absoluto
  en campo libre por altavoz **no está calibrado clínicamente**; la salida
  robusta es el **% de discriminación** a voz conversacional.
- **Campo libre binaural** = estima el **mejor oído**; **no descarta** pérdida
  unilateral (mismo *disclaimer* que el cribado tonal `CL`).
- **Sin audífonos** por diseño: la prueba **no** valida beneficio protésico
  (dejar claro para no confundir con audiometría verbal con adaptación).
- **Trazabilidad:** guardar banda, modalidad, nivel(es), ítems y respuestas
  íntegros (`results`) para auditoría/reproducibilidad.
- **Prerrequisitos de sala:** exigir CAP + sonómetro de sala igual que el resto
  de pruebas de audición (el ruido de sala afecta más en campo libre).

## 14. Fuera de alcance (futuras iteraciones)

- Logoaudiometría **abierta** por repetición con reconocimiento de voz
  (reutilizaría `@react-native-voice/voice` de `articulationAudio.ts`).
- Curva **articulación‑intensidad** completa (varios niveles, % vs dB).
- Presentación **monoaural** en campo libre con enmascaramiento contralateral.
- **Calibración certificada** del altavoz por dispositivo/modelo.
- Listas grabadas por **varios locutores** y en **ruido** (SNR variable, tipo
  matrix/HINT).
