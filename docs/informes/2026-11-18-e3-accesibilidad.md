# Informe E3 · Accesibilidad de `src/Screens` y `src/Components` (análisis estático)

**Este informe no cambia nada en la app**: es un inventario de hallazgos, sin una sola línea de código tocada, y no propone textos de etiquetas (son contenido visible/locutado y los aprueba Frank). Fecha: 18/11/2026. Rama: `worktree-agent-a7148fe3c304c6b42`.

## 0. Qué es y qué NO es este informe (regla 0)

- **Comprobado con** un script de AST (API del compilador de TypeScript) que recorre los 58 `.tsx` de `src/Screens` y `src/Components` (sin `__tests__`) y cuenta lo que está *escrito* en el código. El script completo está en el anexo A.
- **No verificado**: nada de esto se ha visto en el emulador ni con TalkBack, ni se ha medido un solo dp o contraste sobre pantalla real. «Faltan 14 etiquetas» significa que **el código no declara** etiqueta ni texto hijo, no que TalkBack lea mal ese control. Tampoco se ha compilado nada.
- Los umbrales son los de WCAG 2.1 para el contraste (4,5:1) y los 48 dp de la guía de accesibilidad de Android/Material para el objetivo táctil (no es un criterio AA de WCAG 2.1). Que un número esté por debajo es un hecho del código; que sea un defecto clínico o de uso real lo decide Frank.
- La prioridad (pantallas que usa el profesional **durante una prueba**, frente a flujo administrativo y decorativas) la clasifiqué yo, no Frank; está en el §2.

## 1. Recuentos por categoría

| Categoría | Recuento | Base |
| --- | ---: | --- |
| 1a · Controles táctiles sin `accessibilityLabel` **ni** texto hijo | 14 | 181 controles propios (Pressable 121, Button 60) |
| 1b · Controles cuyo nombre es solo una expresión suelta, sin `<Text>` (§3.2) | 6 | no se cuentan como falta de nombre; ver nota |
| 1c · `Pressable` sin `accessibilityRole`/`role` | 96 | 121 Pressable (el `Button` de gluestack pone `role="button"` por defecto: leído en `node_modules/@gluestack-ui/button/lib/Button.jsx`) |
| 1d · Campos de texto (`InputField`/`TextInput`/`TextareaInput`) sin `accessibilityLabel`/`aria-label` | 58 | 60 campos; no hay ningún `FormControl` en el código |
| 2a · Objetivo táctil declarado < 48 dp, **sin** `hitSlop` | 63 | 5 Pressable (medidas del hijo) + 58 Button (altura del tema) |
| 2b · Ídem, pero con `hitSlop` (§4) | 8 | huella efectiva = medida + 2×hitSlop |
| 2c · Controles sin medida declarada (la fija el contenido): **no evaluables** | 105 | de 181 controles |
| 3a · Gráficos sueltos o en control sin nombre, sin etiqueta ni ocultar | 118 | 210 gráficos (Icon 159, Svg raíz 35, Image 4, otros 12) |
| 3b · Iconos dentro de un control con nombre, sin ocultar (decorativos probables) | 82 | higiene, no defecto funcional (§5) |
| 4 · Pares texto/fondo literales con contraste < 4,5:1 | 35 | 164 pares atribuibles medidos; 15 por debajo de 3:1 |
| 5a · `<Text size="2xs">` (10 px por el tema de gluestack) | 240 | token resuelto en `@gluestack-ui/config` |
| 5b · `fontSize` numérico < 12 en estilos / props de Text | 51 | 48 en hojas de estilo y objetos, 3 en prop |
| 5c · `fontSize` < 12 en `SvgText` (unidades de viewBox, **no** px) | 18 | informativo, §7 |

Contexto: en todo el código ya hay 44 `accessibilityLabel`, 31 `accessibilityRole`, 5 `accessibilityState`, 5 `accessible` y 2 `importantForAccessibility` (contados con `grep`). La accesibilidad no está ausente: está aplicada de forma desigual.

## 2. Por pantalla

Columnas: **Ctrl** = controles propios; **1a** sin nombre; **1c** Pressable sin rol; **1d** campos sin etiqueta; **2a** < 48 dp sin hitSlop; **2c** sin medida (no evaluable); **3a** gráficos sin tratar; **4** contrastes < 4,5; **5** textos < 12 (2xs + numéricos, sin SvgText).

| Pantalla / componente | Nivel | Ctrl | 1a | 1c | 1d | 2a | 2c | 3a | 4 | 5 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Articulation | A | 15 | 2 | 8 | 4 | 8 | 6 | 12 | 0 | 25 |
| SahsScreening | A | 11 | 0 | 6 | 5 | 5 | 6 | 9 | 0 | 23 |
| VoiceAnalysis | A | 9 | 3 | 5 | 3 | 4 | 3 | 8 | 0 | 19 |
| VerbalAudiometry | A | 14 | 3 | 8 | 3 | 5 | 6 | 5 | 0 | 17 |
| ExecutiveFunctions | A | 14 | 3 | 7 | 3 | 6 | 5 | 5 | 0 | 11 |
| DysphagiaTest | A | 8 | 0 | 3 | 4 | 5 | 3 | 5 | 0 | 17 |
| ClinicalAssessment | A | 7 | 0 | 3 | 6 | 0 | 7 | 0 | 0 | 23 |
| Audiometry | A | 9 | 1 | 7 | 3 | 3 | 6 | 2 | 0 | 12 |
| RoomNoiseCheck | A | 8 | 0 | 3 | 1 | 6 | 2 | 4 | 0 | 14 |
| AutismScreening | A | 8 | 0 | 3 | 2 | 5 | 3 | 7 | 0 | 9 |
| AshaScreening | A | 5 | 0 | 3 | 3 | 2 | 3 | 7 | 0 | 10 |
| AudiometryConditioned | A | 7 | 0 | 3 | 3 | 2 | 3 | 2 | 1 | 14 |
| ProsodyAnalysis | A | 7 | 1 | 0 | 3 | 7 | 0 | 6 | 0 | 2 |
| Components/Common | S | 6 | 0 | 3 | 0 | 0 | 5 | 3 | 1 | 3 |
| Components/Survey | S | 2 | 0 | 2 | 0 | 0 | 2 | 0 | 0 | 3 |
| SeleccionEjercicios | B | 9 | 0 | 7 | 0 | 0 | 8 | 17 | 4 | 10 |
| Consentimiento | B | 5 | 0 | 3 | 3 | 2 | 3 | 4 | 0 | 8 |
| RegistroProfesional | B | 2 | 0 | 2 | 5 | 0 | 2 | 0 | 7 | 6 |
| ResultadosFinal | B | 6 | 1 | 4 | 0 | 0 | 6 | 2 | 3 | 8 |
| SeleccionProfesional | B | 4 | 0 | 4 | 1 | 0 | 4 | 0 | 7 | 6 |
| DiagnosticoAudio | B | 6 | 0 | 6 | 0 | 0 | 6 | 0 | 6 | 3 |
| RegistroPaciente | B | 3 | 0 | 2 | 5 | 1 | 2 | 0 | 0 | 5 |
| ResultadosPreliminares | B | 2 | 0 | 2 | 0 | 0 | 2 | 4 | 4 | 2 |
| HistorialPaciente | B | 1 | 0 | 0 | 0 | 1 | 0 | 1 | 0 | 9 |
| Pacientes | B | 4 | 0 | 2 | 1 | 1 | 3 | 1 | 0 | 6 |
| Creditos | C | 4 | 0 | 0 | 0 | 0 | 4 | 5 | 0 | 11 |
| Bienvenida | C | 1 | 0 | 0 | 0 | 0 | 1 | 4 | 1 | 5 |
| PresentacionLua | C | 4 | 0 | 0 | 0 | 0 | 4 | 1 | 1 | 6 |
| Components/Mascot | C | 0 | 0 | 0 | 0 | 0 | 0 | 4 | 0 | 4 |
| **Total** | | 181 | 14 | 96 | 58 | 63 | 105 | 118 | 35 | 291 |

Niveles: **A** pruebas clínicas y cuestionario clínico (Audiometry, AudiometryConditioned, VerbalAudiometry, VoiceAnalysis, ProsodyAnalysis, Articulation, AshaScreening, AutismScreening, DysphagiaTest, SahsScreening, RoomNoiseCheck, ExecutiveFunctions, ClinicalAssessment); **S** componentes compartidos (Common, Survey: los usan las pantallas A); **B** flujo del profesional (consentimiento, registro, selección, resultados, comprobar audio); **C** decorativas (Bienvenida, Creditos, PresentacionLua, Mascot, Themed).

## 3. Categoría 1 · Controles táctiles

### 3.1 Sin `accessibilityLabel` ni texto hijo (solo icono)

14 controles. En todos el único hijo visible es un icono sin texto: no hay nombre que un lector de pantalla pueda anunciar. Son los botones de atrás, cerrar, reproducir, borrar, repetir y la estrella del Likert. No propongo texto; solo indico dónde falta.

**A · prueba clínica** (13)

- `src/Screens/Articulation/ArticulationTestScreen.tsx`: 604 (Pressable), 733 (Button)
- `src/Screens/Audiometry/AudiometryScreen.tsx`: 347 (Pressable)
- `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx`: 416 (Pressable), 474 (Pressable), 527 (Pressable)
- `src/Screens/ProsodyAnalysis/ProsodyAnalysisScreen.tsx`: 421 (Button)
- `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx`: 499 (Pressable), 526 (Pressable), 594 (Pressable)
- `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx`: 205 (Pressable), 215 (Pressable), 496 (Button)

**B · flujo del profesional** (1)

- `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx`: 1037 (Pressable)

### 3.2 Nombre solo como expresión de texto suelta (observación, no verificada)

6 `Button` de `src/Screens/ProsodyAnalysis/ProsodyAnalysisScreen.tsx` (líneas 294, 326, 357, 407, 415, 531) llevan su texto como expresión directa dentro del `Button` (`{t.prosody.…}`, `{PROSODY_AGE_BAND_LABEL[band]}`) y **sin** `<ButtonText>`/`<Text>`. No lo cuento como falta de nombre porque hay texto, pero **no he comprobado** cómo lo renderiza gluestack/React Native con un hijo de cadena dentro de un contenedor: React Native exige texto dentro de `<Text>` y el `Button` de gluestack pasa `children` tal cual (`Button.jsx`). Podría ser un fallo de render y no solo de accesibilidad. Es una duda para comprobar en el emulador, no una afirmación.

### 3.3 `Pressable` sin `accessibilityRole`/`role`

96 de 121 Pressable. Sin rol, TalkBack no anuncia «botón»/«casilla»/«pestaña», y las opciones seleccionables no comunican su tipo. `accessibilityState` (5 usos en todo el código) tampoco informa de seleccionado/desactivado en la mayoría.

**A · prueba clínica** (59)

- `src/Screens/Articulation/ArticulationTestScreen.tsx`: 365, 399, 510, 593, 604, 661, 692, 788
- `src/Screens/AshaScreening/AshaScreeningScreen.tsx`: 246, 340, 367
- `src/Screens/Audiometry/AudiometryScreen.tsx`: 256, 283, 295, 307, 331, 339, 347
- `src/Screens/AudiometryConditioned/AudiometryConditionedScreen.tsx`: 582, 745
- `src/Screens/AudiometryConditioned/components/WhistleButton.tsx`: 123
- `src/Screens/AutismScreening/AutismScreeningScreen.tsx`: 422, 531, 553
- `src/Screens/ClinicalAssessment/ClinicalAssessmentScreen.tsx`: 515, 608, 739
- `src/Screens/DysphagiaTest/DysphagiaTestScreen.tsx`: 155, 244, 592
- `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx`: 296, 349, 416, 444, 474, 527
- `src/Screens/ExecutiveFunctions/components/PlanningGame.tsx`: 131
- `src/Screens/RoomNoiseCheck/RoomNoiseCheckScreen.tsx`: 415, 431, 517
- `src/Screens/SahsScreening/SahsScreeningScreen.tsx`: 411, 545, 592, 621, 650, 703
- `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx`: 286, 333, 404, 425, 442, 499, 526, 594
- `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx`: 163, 205, 215, 572, 645

**S · componentes compartidos** (5)

- `src/Components/Common/FontSizeControl.tsx`: 24
- `src/Components/Common/LanguagePickerModal.tsx`: 92
- `src/Components/Common/SignaturePad.tsx`: 116
- `src/Components/Survey/QuestionDots.tsx`: 46
- `src/Components/Survey/YesNoAnswer.tsx`: 46

**B · flujo del profesional** (32)

- `src/Screens/Consentimiento/ConsentimientoScreen.tsx`: 457, 508, 566
- `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx`: 273, 285, 330, 362, 367, 374
- `src/Screens/Pacientes/PacientesScreen.tsx`: 75, 336
- `src/Screens/RegistroPaciente/RegistroPacienteScreen.tsx`: 307, 354
- `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx`: 222, 302
- `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx`: 990, 1037, 1335, 1343
- `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx`: 443, 449
- `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx`: 350, 360, 428, 439, 457, 504, 518
- `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx`: 83, 262, 334, 340

### 3.4 Campos de texto sin etiqueta propia

58 de 60 campos no declaran `accessibilityLabel`/`aria-label` y no hay `FormControl` que asocie una etiqueta visible. **No verificado**: cómo los anuncia TalkBack (puede leer el `placeholder` como pista, pero el nombre del campo se pierde en cuanto se escribe).

**A · prueba clínica** (43)

- `src/Screens/Articulation/ArticulationTestScreen.tsx`: 721, 887, 899, 902
- `src/Screens/AshaScreening/AshaScreeningScreen.tsx`: 469, 484, 493
- `src/Screens/Audiometry/AudiometryScreen.tsx`: 360, 363, 367
- `src/Screens/AudiometryConditioned/AudiometryConditionedScreen.tsx`: 723, 726, 730
- `src/Screens/AutismScreening/AutismScreeningScreen.tsx`: 705, 708
- `src/Screens/ClinicalAssessment/ClinicalAssessmentScreen.tsx`: 631, 693, 776, 824, 948, 961
- `src/Screens/DysphagiaTest/DysphagiaTestScreen.tsx`: 626, 751, 874, 877
- `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx`: 618, 621, 625
- `src/Screens/ProsodyAnalysis/ProsodyAnalysisScreen.tsx`: 511, 522, 525
- `src/Screens/RoomNoiseCheck/RoomNoiseCheckScreen.tsx`: 450
- `src/Screens/SahsScreening/SahsScreeningScreen.tsx`: 542, 666, 730, 837, 840
- `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx`: 710, 713, 717
- `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx`: 768, 785, 788

**B · flujo del profesional** (15)

- `src/Screens/Consentimiento/ConsentimientoScreen.tsx`: 494, 526, 543
- `src/Screens/Pacientes/PacientesScreen.tsx`: 378
- `src/Screens/RegistroPaciente/RegistroPacienteScreen.tsx`: 254, 257, 271, 323, 331
- `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx`: 206, 236, 251, 264, 275
- `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx`: 314

### 3.5 Usos de componentes propios con `onPress`

20 usos (StepButton, AnswerButton, WhistleButton, AlterationRow, GameCard, PatientListItem, NavAction, CategoryFilterChip, WordCard, AnimatedPressable) no se cuentan arriba: su nombre y rol se deciden **dentro** de su definición, y esos `Pressable`/`Button` internos ya están en las listas anteriores. Revisar la definición una vez cubre todos sus usos.

## 4. Categoría 2 · Objetivos táctiles < 48 dp

Criterio: se lee la medida declarada en el propio control o, si no tiene, en su hijo único (hasta dos niveles; p. ej. `Pressable > Center w={38} h={38}`). Para `Button` de gluestack se usa la altura que fija el tema por `size`: xs 32, sm 36, md 40 (el `size` por omisión del tema es `md`), lg 44, xl 48; leído en `node_modules/@gluestack-ui/config/build/theme/Button.js`, no medido en pantalla.

- **Botones de gluestack por debajo de 48 dp: 58** de 60. Desglose: sin size (md por omisión del tema): 55; size="xs": 2; size="sm": 1. La mayoría es la altura por omisión del tema (40 dp): es una decisión de tema/`Button` común, no 58 arreglos sueltos.
- **Pressable con huella declarada < 48 dp: 13** (8 con `hitSlop`).

Pressable con medida declarada < 48 dp (huella efectiva = medida + 2×hitSlop cuando lo hay):

| Fichero:línea | Medida declarada | hitSlop | Huella efectiva |
| --- | --- | --- | --- |
| `src/Screens/Articulation/ArticulationTestScreen.tsx:788` (Pressable > Center) | minWidth 34 | no | = medida |
| `src/Screens/Audiometry/AudiometryScreen.tsx:347` (Pressable > Center) | width 44 | no | = medida |
| `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx:416` (Pressable > Center) | width 38, height 38 | 10 | width 58, height 58 |
| `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx:474` (Pressable > Center) | width 38, height 38 | 10 | width 58, height 58 |
| `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx:527` (Pressable > Center) | width 38, height 38 | 10 | width 58, height 58 |
| `src/Screens/RoomNoiseCheck/RoomNoiseCheckScreen.tsx:415` (Pressable > Center) | width 38, height 38 | no | = medida |
| `src/Screens/RoomNoiseCheck/RoomNoiseCheckScreen.tsx:431` (Pressable > Center) | width 38, height 38 | no | = medida |
| `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx:499` (Pressable > Center) | width 38, height 38 | 10 | width 58, height 58 |
| `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx:594` (Pressable > Center) | width 38, height 38 | 10 | width 58, height 58 |
| `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx:205` (Pressable > Center) | width 36, height 36 | 8 | width 52, height 52 |
| `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx:215` (Pressable > Center) | width 36, height 36 | 8 | width 52, height 52 |
| `src/Components/Common/FontSizeControl.tsx:24` (Pressable > Center) | width 38, height 30 | 8 | width 54, height 46 |
| `src/Screens/Pacientes/PacientesScreen.tsx:321` (Pressable > Center) | width 36, height 36 | no | = medida |

Con `hitSlop` todos menos uno alcanzan 48 dp en lo declarado (36+16=52, 38+20=58); la excepción es `src/Components/Common/FontSizeControl.tsx:24` (alto 30 + 2×8 = 46). Sin `hitSlop` quedan 5 Pressable con huella declarada < 48 dp.

**No evaluables: 105 de 181 controles** (casi todos `Pressable` con la huella fijada por padding y contenido, p. ej. tarjetas de opción). Este análisis no puede decir si miden menos de 48 dp: hace falta el inspector de diseño del emulador o medir en dispositivo. Distribución por pantalla en la columna 2c del §2.

## 5. Categoría 3 · Imágenes e iconos

210 gráficos inventariados (se cuenta el `<Svg>` raíz, no sus hijos). Estado: 10 tratados (etiquetados, ocultos, o cubiertos por la etiqueta u ocultación de un ancestro), 82 dentro de un control con nombre (decorativos probables, sin ocultar), **118 sin tratar**: 104 sueltos y 14 dentro de un control sin nombre (son los mismos botones del §3.1: no es un defecto nuevo, se cuenta dos veces).

Distinguir «con significado» de «decorativo» es un juicio que este análisis no puede hacer. La lista siguiente es la de gráficos que **no** están etiquetados ni ocultos y no cuelgan de un control con nombre. Un icono de estado (aviso, correcto) sin etiqueta pierde información; uno meramente decorativo solo necesita `accessible={false}`/`importantForAccessibility="no"` por higiene. Mi lectura, sin verificar, de los que probablemente **sí** llevan significado: el audiograma (`src/Screens/Audiometry/components/Audiogram.tsx:36`), la imagen estímulo de la audiometría verbal (`src/Screens/VerbalAudiometry/components/WordCard.tsx:85`), las láminas de `ProsodyStimulusScene.tsx` y el cuadro de firma (`SignaturePad.tsx:98`); el resto parece decorativo o de estado. Lo decide Frank, igual que las etiquetas.

Gráficos sin tratar, por fichero (línea y tipo):

**A · prueba clínica** (72)

- `src/Screens/Articulation/ArticulationTestScreen.tsx`: 356 Icon, 385 Icon, 438 Icon, 455 Icon, 464 Icon, 473 Icon, 606 Icon, 616 Icon, 628 Icon, 734 Icon, 809 Icon, 861 Icon
- `src/Screens/AshaScreening/AshaScreeningScreen.tsx`: 210 Icon, 228 Icon, 310 Icon, 405 Icon, 430 Icon, 442 Icon, 528 Icon
- `src/Screens/Audiometry/AudiometryScreen.tsx`: 349 Icon
- `src/Screens/Audiometry/components/Audiogram.tsx`: 36 Svg
- `src/Screens/AudiometryConditioned/AudiometryConditionedScreen.tsx`: 420 Icon, 650 Icon
- `src/Screens/AutismScreening/AutismScreeningScreen.tsx`: 413 Icon, 444 Icon, 484 Icon, 522 Icon, 596 Icon, 646 Icon, 743 Icon
- `src/Screens/DysphagiaTest/DysphagiaTestScreen.tsx`: 234 Icon, 583 Icon, 663 Icon, 683 Icon, 737 Icon
- `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx`: 335 Icon, 418 Icon, 476 Icon, 529 Icon, 640 Icon
- `src/Screens/ProsodyAnalysis/ProsodyAnalysisScreen.tsx`: 276 Icon, 397 Icon, 422 Icon, 461 Icon
- `src/Screens/ProsodyAnalysis/ProsodyStimulusScene.tsx`: 91 Svg, 182 Svg
- `src/Screens/RoomNoiseCheck/RoomNoiseCheckScreen.tsx`: 283 Svg, 353 Icon, 476 Icon, 507 Icon
- `src/Screens/SahsScreening/SahsScreeningScreen.tsx`: 402 Icon, 426 Icon, 480 Icon, 523 Icon, 576 Icon, 610 Icon, 673 Icon, 745 Icon, 875 Icon
- `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx`: 501 Icon, 532 Icon, 596 Icon, 732 Icon
- `src/Screens/VerbalAudiometry/components/WordCard.tsx`: 85 Image
- `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx`: 75 Svg, 210 Icon, 220 Icon, 409 Icon, 497 Icon, 552 Icon, 588 Icon, 827 Icon

**S · componentes compartidos** (3)

- `src/Components/Common/SignaturePad.tsx`: 98 Svg, 108 Icon
- `src/Components/Common/ViaIcon.tsx`: 48 Svg

**B · flujo del profesional** (29)

- `src/Screens/Consentimiento/ConsentimientoScreen.tsx`: 352 Icon, 373 Icon, 407 Icon, 433 Icon
- `src/Screens/HistorialPaciente/HistorialPacienteScreen.tsx`: 117 Icon
- `src/Screens/Pacientes/PacientesScreen.tsx`: 377 Icon
- `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx`: 184 Svg, 949 ViaIcon
- `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx`: 70 Svg, 94 Svg, 242 ViaIcon, 281 Svg
- `src/Screens/SeleccionEjercicios/CategoryBadgeIcon.tsx`: 18 Svg, 31 Svg, 55 Svg, 70 Svg, 87 Svg, 109 Svg
- `src/Screens/SeleccionEjercicios/ModuleIllustration.tsx`: 45 Svg, 75 Svg, 108 Svg, 133 Svg, 157 Svg, 182 Svg, 206 Svg, 231 Svg, 258 Svg, 279 Svg
- `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx`: 253 ViaIcon

**C · decorativa/presentación** (14)

- `src/Components/Mascot/LuaCompanionWidget.tsx`: 196 Icon, 205 Icon, 228 Icon
- `src/Components/Mascot/LuaPixel.tsx`: 209 Svg
- `src/Screens/Bienvenida/BienvenidaScreen.tsx`: 250 Svg, 268 Svg, 458 Svg, 500 ViaIcon
- `src/Screens/Creditos/BrandMarks.tsx`: 55 Svg, 86 Svg, 146 Svg, 172 Svg
- `src/Screens/Creditos/CreditosScreen.tsx`: 472 Image
- `src/Screens/PresentacionLua/PresentacionLuaScreen.tsx`: 319 Image

## 6. Categoría 4 · Contraste texto/fondo (literales)

Se midieron 164 pares atribuibles con certeza (8 del mismo objeto o elemento, 153 de un `Text` con color literal y su antecesor más cercano, hasta 3 niveles, con fondo literal y sin ningún fondo no literal por medio). **35 no llegan a 4,5:1**, 15 no llegan ni a 3:1. Fórmula WCAG 2.1 de luminancia relativa (funciones `lum` y `contrast` del anexo A). Los textos grandes (≥ 24 px, o ≥ 18,66 px en negrita) solo exigen 3:1; se indica el tamaño cuando se pudo leer.

| Fichero:línea | Texto | Fondo | Ratio | Tamaño | Atribución |
| --- | --- | --- | ---: | --- | --- |
| `src/Screens/AudiometryConditioned/components/TrainScene.tsx:488` | `#B78103` | `#FFF9C4` | 3,18 | 13 px | antecesor a 1 nivel(es) (Box, línea 487) |
| `src/Components/Common/LanguagePickerModal.tsx:106` | `#64748B` | `#FAF8F5` | 4,49 | 12 px | antecesor a 3 nivel(es) (View, línea 99) |
| `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:168` | `#B3A791` | `#F1ECE2` | 2,01 | 10 px negrita | antecesor a 3 nivel(es) (View, línea 154) |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:255` | `#B3A791` | `#F1ECE2` | 2,01 | 11 px negrita | antecesor a 3 nivel(es) (View, línea 240) |
| `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:181` | `#FFFFFF` | `#FF7F00` | 2,53 | 16 px | antecesor a 1 nivel(es) (View, línea 180) |
| `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:204` | `#FF7F00` | `#FFFFFF` | 2,53 | n/d | antecesor a 2 nivel(es) (View, línea 201) |
| `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:216` | `#FF7F00` | `#FFFFFF` | 2,53 | n/d | antecesor a 2 nivel(es) (View, línea 201) |
| `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:234` | `#FF7F00` | `#FFFFFF` | 2,53 | n/d | antecesor a 2 nivel(es) (View, línea 201) |
| `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:249` | `#FF7F00` | `#FFFFFF` | 2,53 | n/d | antecesor a 2 nivel(es) (View, línea 201) |
| `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:1347` | `#FFFFFF` | `#FF7F00` | 2,53 | 14 px negrita | antecesor a 1 nivel(es) (Pressable, línea 1343) |
| `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx:452` | `#FFFFFF` | `#FF7F00` | 2,53 | 14 px negrita | antecesor a 1 nivel(es) (Pressable, línea 449) |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:266` | `#FFFFFF` | `#FF7F00` | 2,53 | 26 px negrita | antecesor a 1 nivel(es) (View, línea 265) |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:307` | `#FFFFFF` | `#FF7F00` | 2,53 | 17 px | antecesor a 1 nivel(es) (View, línea 306) |
| `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx:414` | `#94A3B8` | `#FFFFFF` | 2,56 | 11 px | antecesor a 2 nivel(es) (View, línea 391) |
| `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx:492` | `#94A3B8` | `#FFFFFF` | 2,56 | 14 px | antecesor a 3 nivel(es) (View, línea 480) |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:102` | `#A89F93` | `#FFFFFF` | 2,61 | 10 px | antecesor a 3 nivel(es) (View, línea 85) |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:310` | `#A89F93` | `#FFFFFF` | 2,61 | 11 px | antecesor a 1 nivel(es) (View, línea 305) |
| `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:170` | `#8A8274` | `#F1ECE2` | 3,23 | 13 px | antecesor a 3 nivel(es) (View, línea 154) |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:259` | `#8A8274` | `#F1ECE2` | 3,23 | 13 px | antecesor a 3 nivel(es) (View, línea 240) |
| `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:293` | `#8A8274` | `#F1ECE2` | 3,23 | 13 px | antecesor a 3 nivel(es) (View, línea 240) |
| `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:960` | `#EA580C` | `#FFF7ED` | 3,35 | 13 px | antecesor a 1 nivel(es) (View, línea 959) |
| `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx:252` | `#EA580C` | `#FFF7ED` | 3,35 | 13 px | antecesor a 1 nivel(es) (View, línea 251) |
| `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:299` | `#8C8275` | `#F5F2EC` | 3,38 | 12 px | antecesor a 2 nivel(es) (View, línea 271) |
| `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:408` | `#8C8275` | `#F5F2EC` | 3,38 | 12 px | antecesor a 2 nivel(es) (View, línea 271) |
| `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:332` | `#0D9488` | `#FFFFFF` | 3,74 | 13 px negrita | antecesor a 2 nivel(es) (View, línea 318) |
| `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:379` | `#0D9488` | `#FFFFFF` | 3,74 | 13 px negrita | antecesor a 3 nivel(es) (View, línea 344) |
| `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:305` | `#0D9488` | `#FFFFFF` | 3,74 | 13 px negrita | antecesor a 3 nivel(es) (View, línea 181) |
| `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx:431` | `#0D9488` | `#FFFFFF` | 3,74 | 12 px negrita | antecesor a 1 nivel(es) (HStack, línea 429) |
| `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:370` | `#DC2626` | `#FEE2E2` | 3,95 | 14 px negrita | antecesor a 1 nivel(es) (Pressable, línea 367) |
| `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx:375` | `#64748B` | `#F5F2EC` | 4,26 | 14 px | antecesor a 3 nivel(es) (View, línea 234) |
| `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx:509` | `#64748B` | `#F1F5F9` | 4,34 | 12 px | antecesor a 2 nivel(es) (Pressable, línea 504) |
| `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx:463` | `#DC2626` | `#FEF2F2` | 4,41 | 12 px negrita | antecesor a 1 nivel(es) (HStack, línea 461) |
| `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:278` | `#B45309` | `#F5F2EC` | 4,49 | 11 px negrita | antecesor a 2 nivel(es) (View, línea 271) |
| `src/Screens/PresentacionLua/PresentacionLuaScreen.tsx:364` | `#9A9183` | `#FFFFFF` | 3,11 | 12 px | antecesor a 1 nivel(es) (View, línea 363) |
| `src/Screens/Bienvenida/BienvenidaScreen.tsx:433` | `#8C8275` | `#FFFFFF` | 3,77 | 11 px | antecesor a 2 nivel(es) (View, línea 426) |

Observaciones, todas sobre el código:

- El naranja de marca `#FF7F00` interviene en 9 de los pares medidos, y todos dan **2,53:1** (blanco sobre naranja o naranja sobre blanco): no llega ni a 3:1. El literal aparece 61 veces entre comillas simples en `src/Screens` y `src/Components` (`grep`); solo medí los usos atribuibles.
- **Los hallazgos están casi todos en pantallas B y C**; en A solo `TrainScene.tsx:488` (3,18:1). Las pantallas clínicas A usan sobre todo tokens de gluestack (`$textLight500`, `$primary700`…), que este informe **no mide** porque no son literales y no los resolví. Que A salga casi limpia aquí no significa que sea correcta: no es medible con este método. Candidatos a medir con la paleta del tema: `$textLight400`/`$textLight500` sobre `$white`/`$backgroundLight50`, muy usados en las pantallas A.
- Hay pares en 4,49:1 (`LanguagePickerModal.tsx:106`, `DiagnosticoAudioScreen.tsx:278`): fallan por una centésima, sin redondear (WCAG no redondea).
- No se consideraron superposiciones con opacidad, degradados ni sombras: un fondo literal con una capa semitransparente encima podría cambiar el par real.

## 7. Categoría 5 · Texto con `fontSize` < 12

- **`<Text size="2xs">`: 240 usos.** `2xs` vale 10 px en el tema (comprobado en `node_modules/@gluestack-ui/config/build/gluestack-ui.config.js`; `src/Theme/gluestack-ui.config.ts` no sobrescribe `fontSizes`). Es con diferencia el hallazgo más numeroso. Dentro de `ScaledTextScope` (pantallas de cuestionario) el factor `theme.fontScale` lo agranda; fuera, no (`src/Components/Common/Text.tsx`).
- **`fontSize` numérico < 12: 51** (48 en estilos, 3 en prop de `Text`). En `src/Theme/styleAtoms.ts` hay 5 átomos con tamaño < 12: `color0D9488FontSize11` (11 px, línea 121, 1 usos); `color475569FontSize11` (11 px, línea 162, 4 usos); `fontSize10` (10 px, línea 291, 1 usos); `fontSize11LineHeight14` (11 px, línea 294, 1 usos); `fontSize11LineHeight15` (11 px, línea 298, 1 usos).
- **`SvgText` con `fontSize` < 12: 18.** Son unidades de viewBox, no px: el tamaño real depende de la escala del SVG. No los cuento en los totales de la columna 5.
- Entradas de `StyleSheet` con `fontSize` < 12 que **no aparecen referenciadas** (solo su definición; pueden ser estilos muertos): `src/Components/Common/LanguagePickerModal.tsx:271` styles.langSubtitle, `src/Screens/Bienvenida/BienvenidaScreen.tsx:743` styles.signalLiveText, `src/Screens/Bienvenida/BienvenidaScreen.tsx:750` styles.signalSamplingText, `src/Screens/Bienvenida/BienvenidaScreen.tsx:899` styles.samdHeaderText, `src/Screens/Bienvenida/BienvenidaScreen.tsx:909` styles.titleEyebrow, `src/Screens/Bienvenida/BienvenidaScreen.tsx:1070` styles.regulatoryNote, `src/Screens/Creditos/CreditosScreen.tsx:768` styles.langNavButtonText, `src/Screens/Creditos/CreditosScreen.tsx:785` styles.samdBadgeNavText, `src/Screens/Creditos/CreditosScreen.tsx:865` styles.emblemHeading, `src/Screens/Creditos/CreditosScreen.tsx:937` styles.authorBadgeText, `src/Screens/Creditos/CreditosScreen.tsx:1033` styles.changeLangButtonText, `src/Screens/Creditos/CreditosScreen.tsx:1085` styles.langRole, `src/Screens/Creditos/CreditosScreen.tsx:1099` styles.sealSubtitle, `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:425` styles.eyebrow, `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:448` styles.pillText, `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx:470` styles.summaryText, `src/Screens/PresentacionLua/PresentacionLuaScreen.tsx:758` styles.emblemHeading, `src/Screens/PresentacionLua/PresentacionLuaScreen.tsx:765` styles.emblemHeadingSmall, `src/Screens/PresentacionLua/PresentacionLuaScreen.tsx:794` styles.renderCaption, `src/Screens/PresentacionLua/PresentacionLuaScreen.tsx:804` styles.renderCaptionSmall, `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:355` styles.overline, `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:400` styles.previewLabel, `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:458` styles.previewRoleText, `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:466` styles.previewLicense, `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:548` styles.hintText, `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx:576` styles.progressText, `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:1550` styles.telemetrySubtitle, `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:1771` styles.signatureDoctorName, `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:1893` styles.nlgFactBadge, `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx:1900` styles.nlgDisclaimer, `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx:712` styles.resultCardMetric, `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:398` styles.greeting, `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:455` styles.newSubtitle, `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:475` styles.sectionLabel, `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:539` styles.roleChipText, `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:544` styles.cardLicense, `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx:628` styles.modalSubtitle.

Por fichero (línea:tamaño), pantallas A primero:

**A · prueba clínica** (196)

- `src/Screens/Articulation/ArticulationTestScreen.tsx` (25): 313:10, 407:10, 415:10, 428:10, 498:10, 501:10, 527:10, 533:10, 541:10, 617:10, 630:10, 639:10, 652:10, 656:10, 684:10, 703:10, 716:10, 766:10, 770:10, 774:10, 816:10, 825:10, 845:10, 882:10, 935:10
- `src/Screens/AshaScreening/AshaScreeningScreen.tsx` (10): 217:10, 233:10, 264:10, 303:10, 311:10, 319:10, 330:10, 412:10, 424:10, 449:10
- `src/Screens/Audiometry/AudiometryScreen.tsx` (12): 154:10, 180:10, 181:10, 220:10, 222:10, 225:10, 227:10, 230:10, 247:10, 266:10, 318:10, 324:10
- `src/Screens/AudiometryConditioned/AudiometryConditionedScreen.tsx` (11): 373:10, 542:10, 546:10, 586:10, 597:10, 605:10, 613:10, 677:10, 705:10, 707:10, 710:10
- `src/Screens/AudiometryConditioned/components/TrainScene.tsx` (3): 642:9p, 649:8p, 728:11p
- `src/Screens/AutismScreening/AutismScreeningScreen.tsx` (9): 386:10, 487:10, 492:10, 499:10, 602:10, 615:10, 653:10, 674:10, 681:10
- `src/Screens/ClinicalAssessment/ClinicalAssessmentScreen.tsx` (23): 165:10, 238:10, 249:10, 449:10, 461:10, 473:10, 497:10, 533:10, 562:10, 648:10, 668:10, 688:10, 715:10, 725:10, 771:10, 798:10, 819:10, 859:10, 890:10, 918:10, 943:10, 956:10, 987:10
- `src/Screens/DysphagiaTest/DysphagiaTestScreen.tsx` (17): 134:10, 206:10, 236:10, 239:10, 246:10, 557:10, 620:10, 670:10, 676:10, 698:10, 727:10, 744:10, 769:10, 820:10, 849:10, 854:10, 858:10
- `src/Screens/ExecutiveFunctions/ExecutiveFunctionsScreen.tsx` (10): 246:10, 274:10, 288:10, 357:10, 365:10, 376:10, 385:10, 434:10, 462:10, 641:10
- `src/Screens/ExecutiveFunctions/components/FlexibilityGame.tsx` (1): 139:10
- `src/Screens/ProsodyAnalysis/ProsodyAnalysisScreen.tsx` (2): 246:10, 484:10
- `src/Screens/RoomNoiseCheck/RoomNoiseCheckScreen.tsx` (14): 247:10, 268:10, 274:10, 341:10, 354:10, 365:10, 369:10, 405:10, 444:10, 492:10, 531:10, 541:10, 546:10, 574:10
- `src/Screens/SahsScreening/SahsScreeningScreen.tsx` (23): 120:10, 124:10, 373:10, 456:10, 462:10, 483:10, 488:10, 495:10, 503:10, 537:10, 582:10, 597:10, 626:10, 642:10, 661:10, 693:10, 713:10, 725:10, 751:10, 764:10, 783:10, 806:10, 811:10
- `src/Screens/VerbalAudiometry/VerbalAudiometryScreen.tsx` (17): 250:10, 362:10, 381:10, 387:10, 394:10, 428:10, 447:10, 458:10, 539:10, 624:10, 628:10, 631:10, 635:10, 638:10, 642:10, 680:10, 733:10
- `src/Screens/VoiceAnalysis/VoiceAnalysisScreen.tsx` (19): 129:10, 133:10, 141:10, 192:10, 199:10, 378:10, 416:10, 422:10, 440:10, 449:10, 510:10, 514:10, 612:10, 618:10, 629:10, 637:10, 655:10, 674:10, 802:10

**S · componentes compartidos** (6)

- `src/Components/Common/FontSizeControl.tsx` (1): 64:10
- `src/Components/Common/LanguagePickerModal.tsx` (1): 272:11.5e
- `src/Components/Common/SignaturePad.tsx` (1): 109:10
- `src/Components/Survey/QuestionDots.tsx` (1): 54:10
- `src/Components/Survey/SurveyProgress.tsx` (2): 39:10, 42:10

**B · flujo del profesional** (63)

- `src/Screens/Consentimiento/ConsentimientoScreen.tsx` (8): 320:10, 354:10, 359:10, 380:10, 414:10, 440:10, 467:10, 617:10
- `src/Screens/DiagnosticoAudio/DiagnosticoAudioScreen.tsx` (3): 425:11e, 448:10e, 470:11e
- `src/Screens/HistorialPaciente/HistorialPacienteScreen.tsx` (9): 155:10, 160:10, 175:10, 186:10, 195:10, 210:10, 215:10, 219:10, 236:10
- `src/Screens/Pacientes/PacientesScreen.tsx` (6): 88:10, 94:10, 100:10, 127:10, 312:10, 370:10
- `src/Screens/RegistroPaciente/RegistroPacienteScreen.tsx` (5): 233:10, 237:10, 293:10, 339:10, 372:10
- `src/Screens/RegistroProfesional/RegistroProfesionalScreen.tsx` (6): 357:10e, 402:9e, 459:11e, 468:10e, 550:11.5e, 578:10e
- `src/Screens/ResultadosFinal/ResultadosFinalScreen.tsx` (8): 1514:11e, 1551:10e, 1657:11e, 1698:10e, 1772:11e, 1894:11e, 1901:11e, 1983:11e
- `src/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen.tsx` (2): 620:11e, 713:11e
- `src/Screens/SeleccionEjercicios/ModuleCardItem.tsx` (6): 163:10, 170:10, 199:10, 208:10, 232:10, 242:10
- `src/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen.tsx` (4): 265:10, 345:10, 352:10, 362:10
- `src/Screens/SeleccionProfesional/SeleccionProfesionalScreen.tsx` (6): 400:11e, 456:11.5e, 477:9e, 540:10.5e, 546:10e, 630:11e

**C · decorativa/presentación** (26)

- `src/Components/Mascot/LuaCompanionWidget.tsx` (4): 197:10, 206:10, 213:10, 229:10
- `src/Screens/Bienvenida/BienvenidaScreen.tsx` (5): 745:11e, 752:11e, 901:11e, 911:11e, 1072:11e
- `src/Screens/Creditos/CreditosScreen.tsx` (11): 750:9.5e, 770:11e, 787:11e, 867:11e, 938:10.5e, 1014:11e, 1034:11e, 1062:11.5e, 1086:11.5e, 1100:11.5e, 1117:11e
- `src/Screens/PresentacionLua/PresentacionLuaScreen.tsx` (6): 683:11e, 688:9.5e, 760:11e, 766:10e, 795:11.5e, 805:10.5e

Leyenda: sin sufijo = `size="2xs"` (10 px); `e` = `fontSize` numérico en estilo; `p` = prop `fontSize` en `Text`.

## 8. Limitaciones

- **Análisis estático, sin lector de pantalla real.** No se ejecutó TalkBack ni la app; no hay SDK de Android en esta sesión. Todo lo dicho es lo que el código declara.
- **Atributos heredados o calculados**: etiquetas o roles pasados por spread (`{...props}`: ninguno en los controles medidos) o construidos en ejecución no se ven. Los componentes propios con `onPress` se juzgan por su definición, no por cada uso.
- **Texto como nombre**: se da por «nombre» cualquier texto hijo (un `<Text>`, texto JSX o una expresión sin JSX), sin evaluar si es descriptivo.
- **Tamaños**: solo medidas numéricas o tokens `$N` de espacio resueltos; los controles dimensionados por contenido, `flex`, porcentaje o padding no son evaluables (§4). La altura del `Button` sale del tema, no de una medición.
- **Contraste**: solo literales hex/rgb opacos atribuibles; los tokens de gluestack, los colores condicionales, las capas con opacidad y los degradados quedan fuera. Es el error que avisa la regla 0: que A salga casi limpia **no** prueba que su contraste sea correcto.
- **Prioridad**: la clasificación A/B/C/S es mía, no de Frank.
- **Doble cómputo**: un icono dentro de un botón sin nombre aparece en 3a y en 1a (se avisa en el §5).
- El script no está en el repositorio, solo en este anexo. Si Frank quiere un comando reutilizable, es una decisión aparte.

## Anexo A · Script usado (`a11y-audit.js`)

Se ejecutó desde la raíz del repositorio con `node a11y-audit.js .` (necesita `node_modules/typescript`). Emite JSON; de ese JSON salen todas las tablas de arriba. El contraste usa la fórmula WCAG 2.1: canal sRGB linealizado, `L = 0,2126 R + 0,7152 G + 0,0722 B`, ratio `(L1 + 0,05)/(L2 + 0,05)`.

```js
#!/usr/bin/env node
/*
 * Auditoría estática de accesibilidad de VIA+ (paquete E3).
 * Uso: node a11y-audit.js <raíz del repo>  -> JSON por stdout
 * Análisis por AST (typescript). NO ejecuta la app ni usa lector de pantalla.
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(process.argv[2] || '.');
const ts = require(path.join(root, 'node_modules/typescript'));

function walkDir(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) {
      if (e.name === '__tests__') continue;
      walkDir(p, out);
    } else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}
const files = [...walkDir(path.join(root, 'src/Screens')), ...walkDir(path.join(root, 'src/Components'))].sort();

/* ---------- utilidades ---------- */
const SPACE = { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 5: 20, 6: 24, 7: 28, 8: 32, 9: 36, 10: 40, 11: 44, 12: 48, 16: 64, 20: 80, 24: 96 };
const BTN_H = { xs: 32, sm: 36, md: 40, lg: 44, xl: 48 }; // theme/Button.js de @gluestack-ui/config (h: $8,$9,$10,$11,$12)
const FONT_TOKEN = { '2xs': 10, xs: 12, sm: 14, md: 16 };

function numVal(node) {
  if (!node) return undefined;
  if (ts.isJsxExpression(node)) return numVal(node.expression);
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken && ts.isNumericLiteral(node.operand)) return -Number(node.operand.text);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    const s = node.text;
    if (/^\$[0-9.]+$/.test(s)) { const v = SPACE[s.slice(1)]; return v; }
    if (/^[0-9.]+$/.test(s)) return Number(s);
  }
  return undefined;
}
function strVal(node) {
  if (!node) return undefined;
  if (ts.isJsxExpression(node)) return strVal(node.expression);
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}
function parseColor(s) {
  if (!s) return null;
  s = s.trim();
  let m = /^#([0-9a-f]{3})$/i.exec(s);
  if (m) return m[1].split('').map((c) => parseInt(c + c, 16));
  m = /^#([0-9a-f]{6})$/i.exec(s);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16));
  m = /^#([0-9a-f]{8})$/i.exec(s);
  if (m) { const a = parseInt(m[1].substr(6, 2), 16); if (a === 255) return [0, 2, 4].map((i) => parseInt(m[1].substr(i, 2), 16)); return null; }
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) { if (m[4] !== undefined && Number(m[4]) !== 1) return null; return [Number(m[1]), Number(m[2]), Number(m[3])]; }
  if (s.toLowerCase() === 'white') return [255, 255, 255];
  if (s.toLowerCase() === 'black') return [0, 0, 0];
  return null;
}
function lum([r, g, b]) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const l1 = lum(a), l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/* ---------- hojas de estilo (StyleSheet.create) ---------- */
function collectProps(objLit) {
  const o = {};
  for (const p of objLit.properties) {
    if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
      o[p.name.text] = { node: p.initializer, line: null, prop: p };
    }
  }
  return o;
}
const sheetsByFile = new Map(); // file -> Map(varName -> Map(key -> {props, node}))
function parse(file) {
  const text = fs.readFileSync(file, 'utf8');
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
function collectSheets(sf) {
  const sheets = new Map();
  function visit(n) {
    if (ts.isVariableDeclaration(n) && n.initializer && ts.isCallExpression(n.initializer) &&
      /StyleSheet\.create$/.test(n.initializer.expression.getText(sf)) && ts.isIdentifier(n.name)) {
      const arg = n.initializer.arguments[0];
      const m = new Map();
      if (arg && ts.isObjectLiteralExpression(arg)) {
        for (const p of arg.properties) {
          if (ts.isPropertyAssignment(p) && ts.isObjectLiteralExpression(p.initializer)) {
            m.set(p.name.getText(sf).replace(/['"]/g, ''), { props: collectProps(p.initializer), node: p, sf });
          }
        }
      }
      sheets.set(n.name.text, m);
    }
    ts.forEachChild(n, visit);
  }
  visit(sf);
  return sheets;
}
const atomsSf = parse(path.join(root, 'src/Theme/styleAtoms.ts'));
const atomsSheet = collectSheets(atomsSf).get('atoms');
const sfCache = new Map();
for (const f of files) { const sf = parse(f); sfCache.set(f, sf); sheetsByFile.set(f, collectSheets(sf)); }
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
const rel = (f) => path.relative(root, f);

/* Resuelve una expresión de estilo a una lista de {props, uncertain}. */
function resolveStyle(expr, f, sf) {
  const out = [];
  let uncertain = false;
  function go(e, cond) {
    if (!e) return;
    if (ts.isJsxExpression(e)) return go(e.expression, cond);
    if (ts.isParenthesizedExpression(e)) return go(e.expression, cond);
    if (ts.isObjectLiteralExpression(e)) { out.push({ props: collectProps(e), cond }); return; }
    if (ts.isArrayLiteralExpression(e)) { e.elements.forEach((x) => go(x, cond)); return; }
    if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression)) {
      const v = e.expression.text, k = e.name.text;
      if (v === 'atoms' && atomsSheet && atomsSheet.has(k)) { out.push({ props: atomsSheet.get(k).props, cond, ref: `atoms.${k}` }); return; }
      const sh = sheetsByFile.get(f).get(v);
      if (sh && sh.has(k)) { out.push({ props: sh.get(k).props, cond, ref: `${v}.${k}` }); return; }
      uncertain = true; return;
    }
    if (ts.isConditionalExpression(e)) { go(e.whenTrue, true); go(e.whenFalse, true); return; }
    if (ts.isBinaryExpression(e) && (e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)) { go(e.right, true); return; }
    if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword) return;
    uncertain = true;
  }
  go(expr, false);
  return { list: out, uncertain };
}

/* ---------- JSX ---------- */
function tagName(el) { return el.tagName.getText(); }
function attrsOf(el) {
  const m = new Map(); let spread = false;
  for (const a of el.attributes.properties) {
    if (ts.isJsxAttribute(a)) m.set(a.name.text, a.initializer || null);
    else spread = true;
  }
  return { m, spread };
}
const INTERACTIVE = new Set(['Pressable', 'TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'TouchableNativeFeedback', 'Button', 'Switch', 'Checkbox', 'Radio', 'Slider', 'Fab', 'Link', 'ActionsheetItem', 'Input', 'InputField', 'TextInput', 'Textarea', 'TextareaInput']);
const FIELD = new Set(['Input', 'InputField', 'TextInput', 'Textarea', 'TextareaInput']);
const GRAPHIC = new Set(['Image', 'Svg', 'Icon', 'IconComp', 'IconGlyph', 'ViaIcon', 'ModuleIllustration', 'CategoryBadgeIcon', 'LuaPixel', 'BrandMarks']);

function hasAttr(m, ...names) { return names.some((n) => m.has(n)); }
function boolAttr(m, name) { // true / false / undefined
  if (!m.has(name)) return undefined;
  const v = m.get(name);
  if (v === null) return true;
  const e = ts.isJsxExpression(v) ? v.expression : v;
  if (e && e.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (e && e.kind === ts.SyntaxKind.TrueKeyword) return true;
  return undefined;
}
function hiddenAttr(m) {
  if (boolAttr(m, 'accessible') === false) return true;
  const imp = strVal(m.get('importantForAccessibility'));
  if (imp === 'no' || imp === 'no-hide-descendants') return true;
  if (boolAttr(m, 'aria-hidden') === true) return true;
  if (boolAttr(m, 'accessibilityElementsHidden') === true) return true;
  return false;
}
function hasLabelAttr(m) { return hasAttr(m, 'accessibilityLabel', 'aria-label', 'accessibilityLabelledBy', 'alt', 'accessibilityHint') && hasAttr(m, 'accessibilityLabel', 'aria-label', 'accessibilityLabelledBy', 'alt'); }
function hasRoleAttr(m) { return hasAttr(m, 'accessibilityRole', 'role'); }

function elementOf(opening) { return ts.isJsxSelfClosingElement(opening) ? opening : opening.parent; }
function descendantsText(node, sf) {
  // devuelve 'texto' | 'expresion' | 'ninguno' para los hijos del elemento
  if (!ts.isJsxElement(node)) return 'ninguno';
  let kind = 'ninguno';
  function visit(n) {
    if (ts.isJsxText(n) && n.text.trim()) { kind = 'texto'; return; }
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const t = tagName(n);
      if (/(^|\.)(Text|GSText|ButtonText|Heading|SvgText|Label|FormControlLabelText)$/.test(t) || t === 'RNText') { if (kind !== 'texto') kind = 'texto'; }
    }
    if (ts.isJsxExpression(n) && ts.isJsxElement(n.parent) && n.expression && !ts.isJsxElement(n.expression) && !ts.isJsxFragment(n.expression)) {
      const tx = n.expression.getText(sf);
      let hasJsx = false;
      (function f2(x) { if (ts.isJsxElement(x) || ts.isJsxSelfClosingElement(x) || ts.isJsxFragment(x) || ts.isArrowFunction(x) || ts.isFunctionExpression(x)) hasJsx = true; else ts.forEachChild(x, f2); })(n.expression);
      if (!hasJsx && kind === 'ninguno') kind = 'expresion';
    }
    ts.forEachChild(n, visit);
  }
  node.children.forEach(visit);
  return kind;
}

const res = { interactive: [], small: [], graphics: [], contrast: [], fonts: [], notes: { filesScanned: files.length } };

for (const f of files) {
  const sf = sfCache.get(f);
  const sheets = sheetsByFile.get(f);

  /* ---- categoría 5 + definiciones: todo fontSize numérico < 12 ---- */
  (function scanFont(n) {
    if (ts.isPropertyAssignment(n) && n.name.getText(sf) === 'fontSize') {
      const v = numVal(n.initializer);
      if (v !== undefined && v < 12) res.fonts.push({ file: rel(f), line: lineOf(sf, n), size: v, kind: 'estilo' });
    }
    if (ts.isJsxAttribute(n) && n.name.text === 'fontSize') {
      const v = numVal(n.initializer);
      const parent = n.parent.parent;
      if (v !== undefined && v < 12) res.fonts.push({ file: rel(f), line: lineOf(sf, n), size: v, kind: 'prop:' + tagName(parent) });
    }
    if (ts.isJsxAttribute(n) && n.name.text === 'size') {
      const parent = n.parent.parent;
      const t = tagName(parent);
      if (/Text$/.test(t) && strVal(n.initializer) === '2xs') res.fonts.push({ file: rel(f), line: lineOf(sf, n), size: 10, kind: 'size=2xs:' + t });
    }
    ts.forEachChild(n, scanFont);
  })(sf);

  /* ---- JSX ---- */
  const stack = [];
  (function visit(n) {
    const isEl = ts.isJsxElement(n), isSelf = ts.isJsxSelfClosingElement(n);
    if (isEl || isSelf) {
      const opening = isEl ? n.openingElement : n;
      const tag = tagName(opening);
      const { m, spread } = attrsOf(opening);
      const info = { node: n, opening, tag, m, spread };
      handle(info, stack.slice());
      stack.push(info);
      opening.attributes.properties.forEach((a) => { if (ts.isJsxAttribute(a) && a.initializer) visit(a.initializer); else if (!ts.isJsxAttribute(a)) visit(a); });
      if (isEl) n.children.forEach(visit);
      stack.pop();
      return;
    }
    ts.forEachChild(n, visit);
  })(sf);

  function styleOf(info) {
    const attrs = [];
    const s = info.m.get('style');
    const r = s ? resolveStyle(s, f, sf) : { list: [], uncertain: false };
    return r;
  }
  function flatProp(info, key, alias = []) {
    // propiedades directas (JSX) + estilos; devuelve {value, cond}
    for (const k of [key, ...alias]) {
      if (info.m.has(k)) return { value: info.m.get(k), cond: false, jsx: true };
    }
    const r = styleOf(info);
    let found;
    for (const item of r.list) for (const k of [key, ...alias]) if (item.props[k]) found = { value: item.props[k].node, cond: item.cond };
    return found;
  }

  function handle(info, anc) {
    const { tag, m, opening } = info;
    const line = lineOf(sf, opening);

    /* categoría 1 y 2 */
    const hasOnPress = m.has('onPress') || m.has('onLongPress');
    const isInteractive = (INTERACTIVE.has(tag) && !(tag === 'Input' || tag === 'Textarea')) || (hasOnPress && !GRAPHIC.has(tag) && !/^(View|Box|Text)$/.test(tag));
    if (isInteractive) {
      const textKind = descendantsText(info.node, sf);
      const label = hasLabelAttr(m);
      const role = hasRoleAttr(m);
      const own = INTERACTIVE.has(tag);
      // para campos: ¿lo nombra un FormControl/Label ancestro? (no se asume)
      res.interactive.push({
        file: rel(f), line, tag, own, field: FIELD.has(tag), custom: !own, label, role, textKind,
        spread: info.spread, hidden: hiddenAttr(m),
        disabledNoRole: false,
      });
      /* tamaño */
      const hit = m.has('hitSlop');
      const hitVal = hit ? (numVal(m.get('hitSlop')) ?? (m.get('hitSlop').getText(sf))) : null;
      const dims = {};
      let dimSource = tag;
      const collect = (inf, into) => {
        for (const [k, al] of [['width', ['w']], ['height', ['h']], ['minWidth', ['minW']], ['minHeight', ['minH']]]) {
          const p = flatProp(inf, k, al);
          if (p) { const v = numVal(p.value); if (v !== undefined) into[k] = { v, cond: p.cond }; }
        }
      };
      collect(info, dims);
      if (!Object.keys(dims).length && ts.isJsxElement(info.node)) {
        // huella táctil declarada en hijos (Pressable sin medidas propias): hasta 2 niveles por la primera rama
        let cur = info.node;
        for (let depth = 0; depth < 2 && !Object.keys(dims).length; depth++) {
          const kids = cur.children.filter((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
          if (kids.length !== 1) break;
          const k0 = kids[0];
          const op = ts.isJsxElement(k0) ? k0.openingElement : k0;
          const inf = { m: attrsOf(op).m, opening: op, tag: tagName(op) };
          collect(inf, dims);
          if (Object.keys(dims).length) dimSource = tag + ' > ' + inf.tag;
          cur = k0;
          if (!ts.isJsxElement(cur)) break;
        }
      }
      let sizeNote = null;
      if (tag === 'Button' && !dims.height && !dims.minHeight) {
        const s3 = m.has('size') ? strVal(m.get('size')) : 'md';
        if (s3 && BTN_H[s3]) { dims.heightBySize = { v: BTN_H[s3], cond: false }; sizeNote = m.has('size') ? 'size="' + s3 + '"' : 'sin size (md por omisión del tema)'; dimSource = 'Button(tema)'; }
      }
      const small = Object.entries(dims).filter(([, d]) => d.v < 48);
      const anyDim = Object.keys(dims).length > 0;
      res.small.push({
        file: rel(f), line, tag, hit, hitVal, anyDim, dimSource, dims: Object.fromEntries(Object.entries(dims).map(([k, d]) => [k, d.v])),
        small: small.map(([k, d]) => `${k}=${d.v}${d.cond ? '?' : ''}`),
        ok: anyDim && small.length === 0,
        sizeNote, hasLabelOrText: label || textKind !== 'ninguno',
      });
    }

    /* categoría 3 */
    if (GRAPHIC.has(tag) && !(tag === 'Svg' && anc.some((a) => a.tag === 'Svg'))) {
      const label = hasLabelAttr(m);
      const hidden = hiddenAttr(m);
      let ancLabel = false, ancHidden = false, ancControl = null;
      for (const a of anc) {
        if (hasLabelAttr(a.m)) ancLabel = true;
        if (hiddenAttr(a.m) && (boolAttr(a.m, 'accessible') === false ? false : true)) ancHidden = true;
        if (INTERACTIVE.has(a.tag) || a.m.has('onPress')) ancControl = a;
      }
      // accessible={false} en ancestro no oculta hijos en Android; sólo no-hide-descendants.
      let ancHideDesc = anc.some((a) => strVal(a.m.get('importantForAccessibility')) === 'no-hide-descendants' || boolAttr(a.m, 'aria-hidden') === true);
      const ctrlNamed = ancControl ? (hasLabelAttr(ancControl.m) || descendantsText(ancControl.node, sf) !== 'ninguno') : false;
      res.graphics.push({ file: rel(f), line, tag, label, hidden, ancLabel, ancHideDesc, inControl: !!ancControl, ctrlNamed });
    }

    /* categoría 4 */
    pairFor(info, anc, line);
  }

  function colorsOf(info) {
    // devuelve {color, bg, uncertainStyle}
    const out = { color: null, bg: null, cond: false, unresolved: false, bgAny: false };
    const direct = { color: info.m.get('color'), bg: info.m.get('bg') || info.m.get('backgroundColor') };
    if (direct.color) { const v = strVal(direct.color); if (v !== undefined) out.color = { raw: v }; else out.unresolved = true; }
    if (direct.bg) { out.bgAny = true; const v = strVal(direct.bg); if (v !== undefined) out.bg = { raw: v }; else out.unresolved = true; }
    const s = info.m.get('style');
    if (s) {
      const r = resolveStyle(s, f, sf);
      if (r.uncertain) out.unresolved = true;
      for (const item of r.list) {
        for (const [k, tgt] of [['color', 'color'], ['backgroundColor', 'bg']]) {
          const p = item.props[k];
          if (!p) continue;
          if (tgt === 'bg') out.bgAny = true;
          const v = strVal(p.node);
          if (item.cond) { out.cond = true; if (tgt === 'color' && !out.color) out.unresolved = true; continue; }
          if (v !== undefined) out[tgt] = { raw: v }; else out.unresolved = true;
        }
        if (item.props.background) { out.bgAny = true; out.unresolved = true; }
      }
    }
    if (info.m.has('bgColor')) { out.bgAny = true; out.unresolved = true; }
    return out;
  }
  function sizeOfText(info) {
    const p = flatProp(info, 'fontSize');
    let size = p ? numVal(p.value) : undefined;
    const sz = strVal(info.m.get('size'));
    if (size === undefined && sz && FONT_TOKEN[sz]) size = FONT_TOKEN[sz];
    let bold = false;
    const w = info.m.get('weight') ? strVal(info.m.get('weight')) : undefined;
    const fw = flatProp(info, 'fontWeight');
    const fwv = fw ? strVal(fw.value) : undefined;
    if (w === 'bold' || w === 'semiBold' || fwv === '700' || fwv === 'bold' || fwv === '600') bold = true;
    return { size, bold };
  }
  function pairFor(info, anc, line) {
    const c = colorsOf(info);
    const isTextual = /(Text|Icon|Heading)$/.test(info.tag) || info.tag === 'SvgText';
    // 1) mismo elemento/objeto
    if (c.color && c.bg && !c.cond) {
      const fg = parseColor(c.color.raw), bg = parseColor(c.bg.raw);
      if (fg && bg) record(info, line, fg, bg, c.color.raw, c.bg.raw, 'mismo elemento/objeto');
      return;
    }
    // 2) texto con color literal y antecesor con fondo literal (sin fondos intermedios inciertos)
    if (c.color && !c.cond && isTextual && !c.bg) {
      const fg = parseColor(c.color.raw);
      if (!fg) return;
      for (let i = anc.length - 1; i >= 0; i--) {
        const cc = colorsOf(anc[i]);
        if (cc.bg) {
          const bg = parseColor(cc.bg.raw);
          if (cc.cond || cc.unresolved || !bg) return;
          if (cc.bgAny && !cc.bg) return;
          // el antecesor debe ser un contenedor directo (hasta 3 niveles) para dar certeza
          if (anc.length - i > 3) return;
          record(info, line, fg, bg, c.color.raw, cc.bg.raw, `antecesor a ${anc.length - i} nivel(es) (${anc[i].tag}, línea ${lineOf(sf, anc[i].opening)})`);
          return;
        }
        if (cc.bgAny || cc.unresolved) return;
        // gluestack Button/Card etc. con color de fondo propio del tema
        if (/^(Button|Card|Input|InputField|Actionsheet\w*|Modal\w*|Badge|Alert)$/.test(anc[i].tag)) return;
      }
    }
  }
  function record(info, line, fg, bg, fgRaw, bgRaw, how) {
    const ratio = contrast(fg, bg);
    const { size, bold } = sizeOfText(info);
    res.contrast.push({ file: rel(f), line, tag: info.tag, fg: fgRaw, bg: bgRaw, ratio, how, size, bold });
  }

  /* Pares en objetos de StyleSheet (color + backgroundColor en la misma entrada) */
  for (const [vn, sh] of sheets) {
    for (const [k, e] of sh) {
      const c = e.props.color, b = e.props.backgroundColor;
      if (c && b) {
        const fgR = strVal(c.node), bgR = strVal(b.node);
        const fg = parseColor(fgR), bg = parseColor(bgR);
        if (fg && bg) res.contrast.push({ file: rel(f), line: lineOf(sf, e.node), tag: `StyleSheet:${vn}.${k}`, fg: fgR, bg: bgR, ratio: contrast(fg, bg), how: 'misma entrada de hoja de estilo', size: e.props.fontSize ? numVal(e.props.fontSize.node) : undefined, bold: false });
      }
    }
  }
}

/* átomos: pares y fontSize dentro de styleAtoms (definiciones usadas por pantallas) */
const atomUse = new Map();
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8').split('\n');
  text.forEach((ln, i) => { for (const m of ln.matchAll(/\batoms\.(\w+)/g)) { const a = atomUse.get(m[1]) || []; a.push({ file: rel(f), line: i + 1 }); atomUse.set(m[1], a); } });
}
const atomFonts = [];
const atomPairs = [];
if (atomsSheet) for (const [k, e] of atomsSheet) {
  const fsz = e.props.fontSize ? numVal(e.props.fontSize.node) : undefined;
  if (fsz !== undefined && fsz < 12) atomFonts.push({ name: k, size: fsz, defLine: lineOf(atomsSf, e.node), uses: atomUse.get(k) || [] });
  const c = e.props.color, b = e.props.backgroundColor;
  if (c && b) atomPairs.push({ name: k, defLine: lineOf(atomsSf, e.node), fg: strVal(c.node), bg: strVal(b.node), uses: atomUse.get(k) || [] });
}
res.atomFonts = atomFonts;
res.atomPairs = atomPairs.map((p) => { const fg = parseColor(p.fg), bg = parseColor(p.bg); return { ...p, ratio: fg && bg ? contrast(fg, bg) : null }; });

/* referencias de estilos locales de fontSize<12: ¿están en uso? */
const sheetFontUse = [];
for (const f of files) {
  const sf = sfCache.get(f);
  const src = fs.readFileSync(f, 'utf8');
  for (const [vn, sh] of sheetsByFile.get(f)) for (const [k, e] of sh) {
    const fsz = e.props.fontSize ? numVal(e.props.fontSize.node) : undefined;
    if (fsz !== undefined && fsz < 12) {
      const re = new RegExp(`\\b${vn}\\.${k}\\b`, 'g');
      const n = (src.match(re) || []).length;
      sheetFontUse.push({ file: rel(f), line: lineOf(sf, e.node), key: `${vn}.${k}`, size: fsz, refs: n });
    }
  }
}
res.sheetFontUse = sheetFontUse;
console.log(JSON.stringify(res));
```
