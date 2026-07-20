<!--
  Plantilla de Pull Request de VIA+.
  Rellena las secciones que apliquen. Los cambios que toquen datos clínicos,
  autenticación, telemetría o secretos de CI requieren revisión de CODEOWNERS.
-->

## Qué cambia

<!-- Resumen breve del cambio y por qué. -->

## Tipo de cambio

- [ ] Corrección de error (fix)
- [ ] Nueva funcionalidad (feat)
- [ ] Refactor / mantenimiento
- [ ] Documentación
- [ ] Cambio de seguridad

## Verificación

- [ ] `npm run lint` pasa
- [ ] `npm run tsc` pasa
- [ ] `npm test` pasa
- [ ] Probado en dispositivo/emulador cuando aplica

## Revisión de seguridad y privacidad

- [ ] No introduce PHI de pacientes en la nube, los logs, Sentry ni la telemetría
- [ ] No añade secretos, claves ni tokens al repositorio
- [ ] Los cambios en `firestore.rules` mantienen el principio de denegación por defecto
- [ ] Las dependencias nuevas se han revisado (licencia y seguridad)
