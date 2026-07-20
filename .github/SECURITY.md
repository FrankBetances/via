# Política de seguridad — VIA+

VIA+ es software sanitario (SaMD, Clase IIa según MDR 2017/745) que maneja
datos clínicos. Nos tomamos muy en serio cualquier vulnerabilidad.

## Cómo reportar una vulnerabilidad

**No abras un issue público** para vulnerabilidades de seguridad.

Usa uno de estos canales privados:

1. **GitHub Security Advisories** (preferido): pestaña *Security* →
   *Report a vulnerability*. Esto abre un canal privado con el mantenedor.
2. **Correo**: escribe a `drbetances@hotmail.com` con el asunto
   `[SECURITY] VIA+`.

Incluye, si puedes:

- Descripción del problema y su impacto.
- Pasos para reproducirlo (o prueba de concepto).
- Versión / commit afectado.
- Cualquier mitigación temporal que conozcas.

## Qué esperar

- **Acuse de recibo**: en un plazo de 5 días laborables.
- **Evaluación inicial**: en un plazo de 10 días laborables.
- Te mantendremos informado del progreso y coordinaremos la fecha de
  divulgación pública una vez publicada la corrección.

Agradecemos la divulgación responsable y reconoceremos tu contribución
(si así lo deseas) cuando se publique el parche.

## Alcance

Entra en alcance cualquier problema que pueda:

- Exponer datos clínicos de pacientes almacenados en el dispositivo.
- Saltarse las reglas de acceso de Firestore (`firestore.rules`).
- Filtrar PHI a través de la telemetría, los logs o Sentry.
- Comprometer el proceso de firmado/publicación (secretos de CI, keystore).

## Fuera de alcance

- Vulnerabilidades que requieran un dispositivo ya comprometido con root/jailbreak.
- Ingeniería social sobre los profesionales usuarios.
- Ataques que exijan acceso físico prolongado sin las mitigaciones de la app.
