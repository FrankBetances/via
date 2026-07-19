# Audiometría verbal — banco de estímulos es-DO (Quisqueya Habla)

> **Estado:** REGISTRO DE ESTADO v1. Este es el documento donde el plan
> Quisqueya Habla (`integracion-quisqueya-habla.md`) firma el banco es-DO
> (Q3.3). Hoy recoge el estado de herencia, el resultado de la auditoría
> automática Q3.1 y la aprobación de audio comunicada; la **firma clínica del
> banco sigue pendiente** de las sesiones con el logopeda dominicano.

## 1 · Banco vigente

- El banco es-DO **hereda íntegramente el banco español** (mismas bandas A–D,
  mismos ids): `ES_DO_ITEM_OVERRIDES` está vacío en
  `src/Screens/VerbalAudiometry/verbalAudiometryLists.es-DO.ts`.
- Toda sustitución de lámina se declara ahí (id + palabras + motivo) y debe
  quedar firmada en la §3 de este documento antes de mergear.

## 2 · Auditoría fonética automática (Q3.1)

`node scripts/verbal-assets.js audit --lang es-DO` — transcripción fonológica
simplificada con seseo, yeísmo, /s/ en coda, líquidas en coda y /d/
intervocálica (`verbalAudiometryAudit.es-DO.ts`, con suite de tests en CI).

Resultado sobre el banco heredado (2026-07-19):

| Banda | Ítem | Lámina | Colapso | Rasgo |
|---|---|---|---|---|
| D | 30 | «callo» | ≈ «cayo» | yeísmo (homófonos también en gran parte del es peninsular) |
| D | 37 | «vaca» | ≈ «baca» | **general** — b/v homófonas en todo el español (hallazgo aplicable también al banco base es) |

Ambas láminas son de **banda D (solo palabras escritas)**: el estímulo
auditivo no permite discriminar la tarjeta correcta entre las homófonas.
**Acción pendiente (Q3.3):** el logopeda debe sustituir estos pares (y valorar
si «vaca/baca» se corrige también en el banco base es).

Además de los colapsos totales, el logopeda debe revisar en sesión los
contrastes **frágiles** (no colapsados pero debilitados): /s/ final en campo
libre («tos», «dos», «seso»…) y familiaridad léxica es-DO de los estímulos
(cruce con el léxico de O. Alba, Q3.2 pendiente de digitalización de fuentes).

## 3 · Firma clínica del banco (Q3.3) — PENDIENTE

| Campo | Valor |
|---|---|
| Logopeda/fonoaudiólogo | _pendiente_ |
| Nº de colegiación / exequátur | _pendiente_ |
| Láminas sustituidas | _pendiente (mínimo: ítems 30 y 37, ver §2)_ |
| Fecha y firma | _pendiente_ |

## 4 · Audio de la variante

- 37/37 locuciones propias en `assets/audio/verbal/es-DO/` (misma clave que
  es, voz distinta), normalizadas al mismo objetivo de sonoridad que es
  (`loudnorm I=-20:TP=-3:LRA=7`).
- Voz actual: **espeak-ng es-419** (degradación documentada: la política de
  red del entorno de build impidió descargar la voz neural Piper es_MX; la
  regeneración neural sustituye archivo a archivo conservando claves —
  `tools/nos/README.md`).
- **Aprobación para producción** comunicada por el responsable del proyecto
  (2026-07-19) y registrada en `assets/verbal-approval.es-DO.json`, que el
  manifiesto incrusta (`audioProvisional: false`). Adjuntar al expediente la
  checklist de escucha firmada (Q4.4). Una regeneración con otra voz invalida
  esta aprobación y exige una nueva.

## 5 · Ilustraciones

100 % heredadas del banco es (97/97, pictogramas provisionales). Las láminas
que Q3.3 sustituya con palabras nuevas generarán claves e imágenes propias en
`assets/img/verbal/es-DO/`.

## 6 · Localización léxica (Q2)

- **Glosario es → es-DO aprobado para producción** por el revisor dominicano
  (2026-07-19, comunicado por el responsable del proyecto): las 5 entradas de
  `tools/nos/glosario-es-do.csv` pasan a `estado = aprobado` (guagua, chichí,
  china, lechosa, funda). Adjuntar al expediente la firma del revisor.
- Aplicado con `tools/nos/localize-catalog.py`: el catálogo actual de la
  audiometría verbal **no contiene ninguna de esas palabras**, así que el
  delta `locales/es-DO/` permanece vacío y todo resuelve por el fallback
  es-DO → es. El glosario actúa como salvaguarda: cualquier texto futuro que
  las use quedará localizado al regenerar el delta.
- Las consignas/textos nuevos que se añadan al catálogo deben pasar por el
  mismo ciclo (localize-catalog + revisión Q2.3) antes de release.
