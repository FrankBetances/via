#!/usr/bin/env bash
# ==========================================================================
# VIA+ — Resolución del Team ID de Apple
# ==========================================================================
#
#   ./scripts/team-id.sh            Muestra el Team ID (o los que haya)
#   ./scripts/team-id.sh --write    Además escribe Config/Signing.local.xcconfig
#
# Con una cuenta gratuita el Team ID NO aparece en developer.apple.com. La
# única fuente fiable es el campo OU del subject del certificado de firma que
# ya está en el llavero.
#
# ⚠️ El certificado se llama «Apple Development: correo (XXXXXXXXXX)» y ese
#    código entre paréntesis NO es el Team ID: es el identificador del propio
#    certificado. Por eso este script lee el OU y no el nombre.
#
# ==========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
LOCAL_XCCONFIG="${ROOT_DIR}/Config/Signing.local.xcconfig"
EXAMPLE_XCCONFIG="${ROOT_DIR}/Config/Signing.local.xcconfig.example"

WRITE=0
[[ "${1:-}" == "--write" ]] && WRITE=1

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "✖  Este script necesita macOS: lee el llavero del sistema." >&2
  exit 1
fi

# --- 1) Team IDs desde los certificados del llavero -----------------------
#
# Se recorren los certificados de firma de código y se extrae el OU del
# subject. `sort -u` porque un mismo equipo suele tener varios certificados.

teams_from_keychain() {
  local work pem f
  work="$(mktemp -d)"
  trap 'rm -rf "${work}"' RETURN

  # Cada certificado "Apple Development" / "Apple Distribution" del llavero.
  for cn in "Apple Development" "Apple Distribution" "iPhone Developer" "iPhone Distribution"; do
    pem="$(security find-certificate -a -c "${cn}" -p 2>/dev/null || true)"
    [[ -z "${pem}" ]] && continue
    # `-a` concatena un bloque PEM por certificado; openssl los procesa de
    # uno en uno, así que hay que separarlos antes.
    awk -v dir="${work}" '
      /-----BEGIN CERTIFICATE-----/ { n++ }
      n { print > (dir "/cert-" n ".pem") }
    ' <<<"${pem}"
    for f in "${work}"/cert-*.pem; do
      [[ -e "${f}" ]] || continue
      openssl x509 -noout -subject -in "${f}" 2>/dev/null \
        | tr ',/' '\n\n' \
        | sed -n 's/.*OU[[:space:]]*=[[:space:]]*\([A-Z0-9]\{10\}\).*/\1/p' || true
      rm -f "${f}"
    done
  done | sort -u
}

# --- 2) Respaldo: perfiles de aprovisionamiento ya descargados ------------

teams_from_profiles() {
  local dir="${HOME}/Library/MobileDevice/Provisioning Profiles"
  [[ -d "${dir}" ]] || return 0
  local p plist
  while IFS= read -r -d '' p; do
    plist="$(security cms -D -i "${p}" 2>/dev/null || true)"
    [[ -z "${plist}" ]] && continue
    /usr/libexec/PlistBuddy -c "Print :TeamIdentifier:0" /dev/stdin <<<"${plist}" 2>/dev/null || true
  done < <(find "${dir}" -name '*.mobileprovision' -print0 2>/dev/null)
}

FOUND="$(teams_from_keychain || true)"
SOURCE="certificado del llavero (campo OU)"

if [[ -z "${FOUND}" ]]; then
  FOUND="$(teams_from_profiles | sort -u || true)"
  SOURCE="perfil de aprovisionamiento descargado"
fi

if [[ -z "${FOUND}" ]]; then
  cat >&2 <<EOF
✖  No se encontró ningún Team ID en este Mac.

   Significa que todavía no hay ningún certificado de firma en el llavero.
   Se crea solo la primera vez que Xcode firma algo:

     1. Xcode ▸ Settings ▸ Accounts ▸ + ▸ añade tu Apple ID
        (basta una cuenta gratuita).
     2. Abre ios-native/VIAPlus.xcodeproj y compila una vez sobre un
        dispositivo conectado. Xcode emitirá el certificado.
     3. Vuelve a ejecutar este script.

   Mientras tanto el simulador compila igual: no necesita firma.
EOF
  exit 1
fi

COUNT="$(wc -l <<<"${FOUND}" | tr -d ' ')"

if [[ "${COUNT}" -gt 1 ]]; then
  echo "⚠  Este Mac tiene ${COUNT} equipos de Apple (${SOURCE}):"
  echo
  sed 's/^/     /' <<<"${FOUND}"
  echo
  cat <<EOF
   No elijo por ti: firmar con el equipo equivocado da errores de
   identificador que cuesta relacionar con la causa. Escribe a mano el que
   corresponda en:

     ${LOCAL_XCCONFIG}

   Partiendo de la plantilla:

     cp "${EXAMPLE_XCCONFIG}" "${LOCAL_XCCONFIG}"
EOF
  exit 1
fi

TEAM_ID="${FOUND}"
echo "✔  Team ID: ${TEAM_ID}"
echo "   Origen:  ${SOURCE}"

if [[ "${WRITE}" -eq 0 ]]; then
  echo
  echo "   Para dejarlo escrito y que el botón Archive de Xcode funcione:"
  echo "     ./scripts/team-id.sh --write"
  exit 0
fi

# --- 3) Escritura del archivo local ---------------------------------------

if [[ -f "${LOCAL_XCCONFIG}" ]]; then
  EXISTING="$(sed -n 's/^[[:space:]]*VIAPLUS_DEVELOPMENT_TEAM[[:space:]]*=[[:space:]]*\([A-Z0-9]*\).*/\1/p' "${LOCAL_XCCONFIG}" | head -1)"
  if [[ "${EXISTING}" == "${TEAM_ID}" ]]; then
    echo "   Config/Signing.local.xcconfig ya tiene ese Team ID. No toco nada."
    exit 0
  fi
  echo
  echo "⚠  Config/Signing.local.xcconfig ya existe con VIAPLUS_DEVELOPMENT_TEAM = ${EXISTING:-<vacío>}."
  echo "   No lo sobrescribo (puede tener también un VIAPLUS_BUNDLE_ID propio)."
  echo "   Cámbialo a mano si quieres usar ${TEAM_ID}."
  exit 1
fi

mkdir -p "$(dirname "${LOCAL_XCCONFIG}")"
cat > "${LOCAL_XCCONFIG}" <<EOF
// Firma local de VIA+ — generado por scripts/team-id.sh
// NO se versiona (está en .gitignore). Regenerable en cualquier momento.

VIAPLUS_DEVELOPMENT_TEAM = ${TEAM_ID}

// Descomenta y personaliza SOLO si al firmar recibes
// «cannot be registered to your development team because it is not available»:
// VIAPLUS_BUNDLE_ID = com.earlify.viaplus.tuiniciales
EOF

echo "✔  Escrito: ${LOCAL_XCCONFIG}"
echo
echo "   Comprueba que el repositorio sigue limpio:"
echo "     git status --short   # no debe aparecer nada de ios-native/"
