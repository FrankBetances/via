# Audiometría verbal en euskera — banco de estímulos

**Estado: PROVISIONAL.** El banco cumple los invariantes estructurales que
verifica la CI, pero **no lo ha revisado todavía ningún logopeda euskaldun**.
Hasta esa firma, `VERBAL_BANK_PROVISIONAL` incluye `eu`, la pantalla lo
advierte y **no debe usarse para decidir clínicamente sobre un paciente**.

Código: `src/Screens/VerbalAudiometry/verbalAudiometryLists.eu.ts`
(ids 2000+, sin colisión con el castellano 0–40 ni con el gallego 1000–1037).

## Por qué un banco propio y no una traducción

El euskera no es una lengua romance: ni su inventario fonológico ni su
estructura silábica se solapan con los del castellano. Traducir las listas
castellanas produciría palabras correctas cuyos pares mínimos **ya no serían
pares mínimos**, y la prueba dejaría de medir discriminación para medir
vocabulario. Es el mismo razonamiento que llevó a construir un banco gallego
propio en el plan Nós (M3), y aquí se aplica con más motivo.

## Rasgos sobre los que se construye

| Rasgo | Por qué discrimina | Láminas |
|---|---|---|
| Sibilantes `z` /s̻/ · `s` /s̺/ · `tz`/`ts` · `tx` /tʃ/ | El contraste más característico del euskera y el primero que se pierde con hipoacusia de altas frecuencias | `gazi`/`gari`, `zubi`/`zuri`, `zapata`, `txakur`, `tximeleta` |
| Vibrante simple vs. múltiple | Par léxico frecuente y muy sensible al enmascaramiento | `hari`/`harri`, `ardi`/`aldi` |
| Diptongos decrecientes `ai · ei · au · oi` | Abundantísimos y ausentes de la estructura silábica castellana | `mahai`, `leiho`, `aulki`, `koilara`, `guraize`, `oilo`, `arrain` |
| `h` muda (estándar occidental) | Genera vecinos ortográficos sin alterar la sílaba | `hari`, `harri`, `handi`, `aho` |

## Estructura

Las cuatro bandas replican la aridad del banco base, de modo que la
puntuación y la interpretación son las mismas en todos los idiomas:

| Banda | Edad | Modalidad | Opciones | Láminas |
|---|---|---|---|---|
| A | < 4 urte | solo imágenes | 4 | 1 familiarización + 8 puntuables |
| B | 4–5 urte | imagen + palabra | 6 | 1 + 8 |
| C | 6–8 urte | mixta, pares mínimos | 6 | 1 + 8 |
| D | 9 urte – helduak | solo palabras | 6 | 1 + 9 |

Los invariantes se verifican en `verbalAudiometryValidation.test.ts`, que
aplica a **todos** los bancos registrados: objetivos únicos por banda,
distractores a ±1 sílaba, al menos un vecino a distancia ≤ 2 en C/D, y ≥ 3 de
5 distractores casi-mínimos en la banda D.

## Lo que falta

1. **Validación clínica** (bloqueante). Un logopeda euskaldun debe revisar
   familiaridad, imaginabilidad y adecuación al *euskara batua* frente a los
   dialectos, y firmar el acta. Al hacerlo se crea
   `assets/verbal-approval.eu.json` con `scope: "bank"` y se saca `eu` de
   `VERBAL_BANK_PROVISIONAL`; la prueba de trazabilidad de
   `verbalAudiometryBanks.test.ts` impide que el código se adelante al
   registro.
2. **Locuciones propias.** Todavía no existen: `eu` está en
   `VERBAL_AUDIO_PENDING` y el módulo dicta con la voz `eu-ES` del dispositivo
   (o degrada a la castellana declarándolo). La voz de build-time **ya está
   decidida: Maider**, el equivalente vasco de lo que Celtia es en gallego. Lo
   que falta para sintetizar es el identificador del repositorio de pesos, que
   se pasa en `NOS_EU_REPO` (ver la entrada `eu` de `tools/nos/voices.json`) y
   cuya licencia hay que auditar antes de empaquetar audio en una release
   clínica.
3. **Ilustraciones.** Hoy se heredan del banco castellano cuando la clave
   coincide y, si no, la tarjeta degrada a pictograma (`VERBAL_GLYPHS_EU`) y
   luego a inicial.
