#!/usr/bin/env node
/* -------------------------------------------------------------------------- */
/*  Hook PreToolUse · NADA visible en la app sin consultarlo con Frank.        */
/*                                                                            */
/*  Orden de Frank (4/11/2026), después de que una sesión reescribiera por su */
/*  cuenta el pie de la imagen de «Conoce a Lúa» con dos afirmaciones falsas  */
/*  («aún no está fabricada», «la luz del cubo todavía no tiene programa») y  */
/*  eso llegara a la app publicada: «si te vas a tomar la libertad de poner   */
/*  algo, queda totalmente prohibido ponerlo sin antes consultarlo».          */
/*                                                                            */
/*  Cualquier escritura sobre lo que ve el usuario —el catálogo de textos     */
/*  (src/I18n/), las pantallas (.tsx), las imágenes de assets/— PIDE          */
/*  PERMISO: Claude Code se para y Frank decide. También cuando la escritura  */
/*  va por Bash (sed, python, scripts), que es por donde entró el texto falso.*/
/* -------------------------------------------------------------------------- */
let raw = '';
process.stdin.on('data', d => (raw += d));
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    process.exit(0);
  }
  const tool = input.tool_name || '';
  const ti = input.tool_input || {};
  const VISIBLE = /(src\/I18n\/|\.tsx\b|assets\/img\/|assets\/audio\/|site\/)/;
  let target = '';
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    target = ti.file_path || '';
  } else if (tool === 'Bash') {
    const cmd = ti.command || '';
    // Solo lo que ESCRIBE: lecturas (cat, grep, git diff…) no piden nada.
    const writes = /(>|\bsed\s+-i|\bpython3?\b|\bnode\b|\bperl\b|\btee\b|\bcp\b|\bmv\b|\brm\b|git\s+(checkout|restore|apply|rm))/;
    if (VISIBLE.test(cmd) && writes.test(cmd)) target = cmd.slice(0, 160);
  }
  if (!target || !VISIBLE.test(target)) process.exit(0);
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason:
          'Toca lo que VE el usuario de la app (textos, pantallas, imágenes). Regla 0 bis de CLAUDE.md: ' +
          'nada visible que Frank no haya pedido, y nada sin consultarle antes. Frank decide: ' +
          target,
      },
    }),
  );
  process.exit(0);
});
