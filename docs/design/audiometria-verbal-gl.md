# Banco de estímulos gallego — audiometría verbal

> **Estado: APROBADO por ACOPROS** (28 de julio de 2026), comunicado por el
> responsable del proyecto. Registro legible por máquina en
> `assets/verbal-approval.gl.json`.
>
> El alcance de esta firma son **las listas A–D**. El paquete de audio gallego
> **no** está cubierto: todavía no existe (hito M4 del plan Nós, voz Celtia).

Este documento es el entregable **T3.3** de
`docs/design/integracion-proxecto-nos.md`: el banco firmado. Cumple la misma
función que `validacion-clinica-verbal.md` para el castellano.

## 1. Criterio de diseño

El banco gallego **no es una traducción** del castellano. Traducir palabra a
palabra habría destruido los pares mínimos, que son el instrumento de medida:
la prueba mide discriminación fonética, no vocabulario. Las listas se
construyeron sobre contrastes propios del gallego:

| Rasgo | Realización | Dónde se ejercita |
|---|---|---|
| /ʃ/ grafía «x» | ausente en castellano, muy discriminativa | xeso, xerra, queixo, fixo, roxa, páxaro |
| Diptongos decrecientes «ou» / «ei» | frente a los monoptongos castellanos | lousa, moura, roupa, vasoira, tesoiras, bandeira, peite, cereixas |
| Lateral palatal /ʎ/ | vs /l/ | abella, ovella, botella / cadela, canela, estrela |
| Nasal palatal /ɲ/ | vs /n/ | piño, viño, niño, liño / fino |
| Oxítonas en -á | patrón propio del gallego | ventá, mazá, campá, mañá |
| Monosílabos de punto de articulación | contraste inicial y final | man/pan/can/sal · ben/ten/den/sen/ren/cen · sol/sal/col/gol/son/sor |

## 2. Invariantes verificados por máquina

`verbalAudiometryValidation.test.ts` corre los **mismos** invariantes sobre
todos los bancos registrados (`describe.each(VERBAL_BANK_LANGS)`), de modo que
ninguna edición futura puede degradar el banco gallego sin romper CI:

- las cuatro bandas con su aridad de opciones declarada;
- objetivo siempre presente entre las opciones de su lámina;
- objetivos puntuables únicos dentro de cada banda;
- cada distractor a **±1 sílaba** del objetivo (mide discriminación, no longitud);
- sin colisiones de clave de asset dentro de una lámina (dos palabras que
  colapsaran a la misma clave compartirían ilustración);
- bandas C/D: al menos un vecino a distancia de Levenshtein ≤ 2;
- banda D: ≥ 3 de 5 distractores a distancia ≤ 2;
- bandas A/B: objetivos de 1–4 sílabas;
- exactamente una lámina de familiarización por banda.

Lo que la máquina **no** puede validar —familiaridad, imaginabilidad, variante
normativa, adecuación por edad— es justo lo que cubre la firma de ACOPROS.

## 3. Contenido firmado

Ids globales y estables (espacio propio a partir de `GL_ID_BASE = 1000`, sin
colisión con el banco castellano). Fuente:
`src/Screens/VerbalAudiometry/verbalAudiometryLists.gl.ts`.
### Banda A · Só imaxes · < 4 anos · 4 opcións

| id | Obxectivo | Distractores | |
|---|---|---|---|
| 1000 | **pan** | flor, peixe, sol | familiarización |
| 1001 | **pato** | gato, pan, man |  |
| 1002 | **gato** | pato, vaca, man |  |
| 1003 | **casa** | taza, mesa, boca |  |
| 1004 | **taza** | casa, pala, vaca |  |
| 1005 | **man** | pan, can, sal |  |
| 1006 | **pelota** | galleta, zapato, mazá |  |
| 1007 | **zapato** | pato, plátano, pelota |  |
| 1008 | **flor** | sol, pan, peixe |  |

### Banda B · Imaxe + palabra · 4–5 anos · 6 opcións

| id | Obxectivo | Distractores | |
|---|---|---|---|
| 1009 | **pelota** | zapato, estrela, vasoira, tesoiras, botella | familiarización |
| 1010 | **ventá** | mazá, campá, cabana, semana, mañá |  |
| 1011 | **abella** | ovella, botella, cadela, canela, estrela |  |
| 1012 | **bolboreta** | mangueira, escaleira, tesoiras, bandeira, pelota |  |
| 1013 | **plátano** | páxaro, sábado, lámpada, cámara, número |  |
| 1014 | **tesoiras** | orellas, abellas, cereixas, madeiras, vasoira |  |
| 1015 | **vasoira** | escola, estrela, balea, botella, cadea |  |
| 1016 | **botella** | balea, estrela, botón, pelota, maleta |  |
| 1017 | **cebola** | rodela, pastilla, cabalo, semente, galiña |  |

### Banda C · Mixto · pares mínimos · 6–8 anos · 6 opcións

| id | Obxectivo | Distractores | |
|---|---|---|---|
| 1018 | **bota** | gota, nota, rata, lata, boca | familiarización |
| 1019 | **piño** | viño, fino, niño, liño, pila |  |
| 1020 | **boca** | foca, roca, louca, toca, bota |  |
| 1021 | **gota** | bota, nota, rota, pota, gorra |  |
| 1022 | **rata** | lata, pata, bata, gata, ra |  |
| 1023 | **cana** | casa, cara, lama, gaña, maza |  |
| 1024 | **peite** | aceite, ponte, fonte, dente, monte |  |
| 1025 | **xeso** | peso, seso, óso, queixo, bico |  |
| 1026 | **xerra** | barra, parra, garra, marca, carta |  |

### Banda D · Só palabras · 9 anos – adulto · 6 opcións

| id | Obxectivo | Distractores | |
|---|---|---|---|
| 1027 | **cama** | coma, goma, toma, soma, roma | familiarización |
| 1028 | **pote** | ponte, monte, fonte, corte, dente |  |
| 1029 | **coma** | goma, toma, soma, roma, cama |  |
| 1030 | **galo** | calo, malo, ralo, valo, falo |  |
| 1031 | **pala** | bala, mala, gala, sala, tala |  |
| 1032 | **sol** | sal, col, gol, son, sor |  |
| 1033 | **figo** | fixo, fillo, fío, rico, trigo |  |
| 1034 | **mora** | hora, morra, moura, porra, torre |  |
| 1035 | **ben** | ten, den, sen, ren, cen |  |
| 1036 | **rosa** | roxa, roca, sosa, roupa, lousa |  |
| 1037 | **vaca** | baca, faca, maca, saca, placa |  |

**Totales:** 38 láminas — 4 de familiarización (no puntúan) + 34 puntuables.

## 4. Assets

- **Audio.** No hay locuciones gallegas. El adaptador **no** sustituye por los
  recortes castellanos —«ventá» dictado con el recorte de «ventana» sería otro
  estímulo— sino que degrada a la voz del dispositivo, prefiriendo una voz
  `gl-*` si está instalada y declarando la caída a voz castellana cuando no
  (`pickVoiceForLang`). La pantalla lo advierte al profesional.
- **Ilustraciones.** Se resuelven por clave de asset: las palabras que
  coinciden con el castellano (pan, gato, casa, pelota, vaca, flor, sol…)
  reutilizan el archivo existente sin duplicarlo. El resto cae a pictograma
  (`VERBAL_GLYPHS_GL`) y, en su defecto, a tile de inicial.

## 5. Qué invalida esta firma

- **Modificar cualquier lámina.** La aprobación deja de aplicar a la lámina
  tocada; requiere nueva revisión de esa lámina.
- **Cambiar los cortes de interpretación** (§4 de
  `validacion-clinica-verbal.md`): son comunes al módulo y no están cubiertos
  aquí.
- La firma **no** habilita el uso diagnóstico mientras el audio siga sin
  producir: el estímulo que oye el paciente no es todavía el definitivo.

## 6. Pendiente para cerrar el gallego

| Hito | Tarea | Estado |
|---|---|---|
| M3 | T3.1/T3.2 · anclaje léxico a `proxectonos/corpora` | Pendiente (el banco se diseñó sin las métricas de frecuencia) |
| M3 | T3.3 · firma del banco | **Hecho — ACOPROS** |
| M3 | T3.4 · código + validación CI | Hecho |
| M3 | T3.5 · inventario de ilustraciones propias | Parcial (herencia por clave) |
| M4 | T4.1/T4.2 · locuciones con voz Celtia | Pendiente |
| M4 | T4.4 · QA acústico y checklist de escucha | Pendiente |
| M6 | T6.1 · protocolo clínico gl firmado | Pendiente |
