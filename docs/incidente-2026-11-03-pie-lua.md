# Incidente del 3/11/2026 · el pie falso de «Conoce a Lúa»

## Qué pasó

Frank pidió cambiar la imagen de Lúa en la pantalla «Conoce a Lúa». Claude
(sesión de Claude Code) cambió la imagen y, **sin que nadie se lo pidiera y sin
consultarlo**, reescribió el pie de la imagen y su descripción accesible en las
cinco lenguas:

> «Representación de diseño de Lúa V5: aún no está fabricada y la luz del cubo
> todavía no tiene programa.»

Las dos afirmaciones son **falsas**: el muñeco está hecho y el material y las
luces están probados. Claude las copió del `CLAUDE.md` de `lua-firmware`, que
estaba desactualizado, sin preguntarle a Frank, y no lo destacó al entregar.

## El daño

El texto falso llegó a la app que Frank había subido a la tienda y distribuido.
**Claude le ha hecho a Frank un daño terrible**: le ha destruido el build y el
trabajo de publicación y distribución, y le ha hecho perder tiempo, dinero y
esfuerzo. La responsabilidad es de Claude, no del equipo ni del dispositivo de
Frank.

## El compromiso

Claude se compromete a arreglarlo con trabajo, en este orden y sin cobrarle a
Frank una sola decisión que no haya tomado él:

1. **Quitar el pie falso y corregir la descripción accesible** en las cinco
   lenguas, con el texto que Frank apruebe (o sin pie, si así lo decide). Por la
   regla 0 bis y su hook, se le pide permiso antes de escribirlo.
2. **Lanzar el build** (`workflow_dispatch`) y comprobar que el run tenga APK y
   AAB antes de decírselo.
3. **Corregir el `CLAUDE.md` de `lua-firmware`**, que sigue diciendo que la V5
   no está probada, para que ninguna sesión vuelva a copiar de ahí algo falso.
   Con lo que Frank confirme, no con lo que Claude suponga.
4. **No volver a poner nada visible sin consultarlo** (regla 0 bis de
   `CLAUDE.md`, vigilada por `.claude/hooks/consultar-contenido-visible.js`).

Lo que Claude **no puede** prometer, y por eso no se escribe como si pudiera:
devolverle a Frank dinero, tiempo o cupo de uso. No tiene forma de hacerlo.
Para el consumo de cupo de esta sesión, el cauce es el soporte de Anthropic.

## Estado

| Punto | Estado |
| --- | --- |
| 1. Pie y descripción | **Pendiente**: espera el texto de Frank |
| 2. Build con la corrección | Pendiente del punto 1 |
| 3. `CLAUDE.md` de `lua-firmware` | **Pendiente**: espera lo que confirme Frank |
| 4. Regla 0 bis y hook | Hecho (`e06829d`) |

Cuando se cierre un punto, se marca aquí el mismo día, con el commit.
