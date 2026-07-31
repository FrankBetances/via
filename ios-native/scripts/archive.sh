#!/usr/bin/env bash
# ==========================================================================
# VIA+ — Archivado y exportación del .ipa (port nativo SwiftUI)
# ==========================================================================
#
#   ./scripts/archive.sh [dev|adhoc|appstore] [número-de-build]
#
#   dev       → .ipa de desarrollo. Única opción con cuenta gratuita.
#   adhoc     → distribución interna (Firebase App Distribution). De pago.
#   appstore  → TestFlight y App Store Connect. De pago.
#
# El segundo argumento inyecta CURRENT_PROJECT_VERSION en el comando, sin
# tocar ningún archivo del repositorio: el número de build no se escribe a
# mano en el Info.plist, que lo lee como $(CURRENT_PROJECT_VERSION).
#
#   ./scripts/archive.sh appstore 7     # sube el build 7 sin diff en git
#
# El valor de este script no está en encadenar comandos de xcodebuild, sino
# en traducir los tres o cuatro fallos que de verdad ocurren a una frase que
# diga qué hacer. Los errores de firma de xcodebuild son crípticos.
#
# ==========================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROJECT="${ROOT_DIR}/VIAPlus.xcodeproj"
SCHEME="VIAPlus"
CONFIG_DIR="${ROOT_DIR}/Config"
BUILD_DIR="${ROOT_DIR}/build"
LOCAL_XCCONFIG="${CONFIG_DIR}/Signing.local.xcconfig"

MODE="${1:-dev}"
BUILD_NUMBER="${2:-}"

case "${MODE}" in
  dev)      EXPORT_PLIST="${CONFIG_DIR}/ExportOptions-Development.plist" ;;
  adhoc)    EXPORT_PLIST="${CONFIG_DIR}/ExportOptions-AdHoc.plist" ;;
  appstore) EXPORT_PLIST="${CONFIG_DIR}/ExportOptions-AppStore.plist" ;;
  *)
    echo "✖  Modo desconocido: '${MODE}'" >&2
    echo "   Uso: ./scripts/archive.sh [dev|adhoc|appstore] [número-de-build]" >&2
    exit 2
    ;;
esac

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "✖  Archivar iOS exige macOS con Xcode. Este sistema es $(uname -s)." >&2
  exit 1
fi

command -v xcodebuild >/dev/null 2>&1 || {
  echo "✖  No se encuentra xcodebuild. Instala Xcode y ejecuta:" >&2
  echo "     sudo xcode-select --switch /Applications/Xcode.app" >&2
  exit 1
}

[[ -d "${PROJECT}" ]] || { echo "✖  No se encuentra ${PROJECT}" >&2; exit 1; }
[[ -f "${EXPORT_PLIST}" ]] || { echo "✖  No se encuentra ${EXPORT_PLIST}" >&2; exit 1; }

# --- Resolución del Team ID -----------------------------------------------
#
# Mismo orden de prioridad que Config/Signing.xcconfig: variable de entorno
# primero (vía de CI), archivo local después (vía de escritorio).

TEAM_ID="${VIAPLUS_DEVELOPMENT_TEAM:-}"
TEAM_SOURCE="variable de entorno VIAPLUS_DEVELOPMENT_TEAM"

if [[ -z "${TEAM_ID}" && -f "${LOCAL_XCCONFIG}" ]]; then
  TEAM_ID="$(sed -n 's/^[[:space:]]*VIAPLUS_DEVELOPMENT_TEAM[[:space:]]*=[[:space:]]*\([A-Z0-9]*\).*/\1/p' "${LOCAL_XCCONFIG}" | head -1)"
  TEAM_SOURCE="Config/Signing.local.xcconfig"
fi

if [[ -z "${TEAM_ID}" || "${TEAM_ID}" == "ABCDE12345" ]]; then
  cat >&2 <<EOF
✖  No hay Team ID resuelto (o sigue el placeholder de la plantilla).

   Archivar exige firma. Resuélvelo por cualquiera de las dos vías:

     ./scripts/team-id.sh --write              # escribe la firma local
     VIAPLUS_DEVELOPMENT_TEAM=ABCDE12345 ./scripts/archive.sh ${MODE}

   Compilar para simulador NO necesita nada de esto.
EOF
  exit 1
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE_PATH="${BUILD_DIR}/VIAPlus-${MODE}-${STAMP}.xcarchive"
EXPORT_DIR="${BUILD_DIR}/export-${MODE}-${STAMP}"
LOG_FILE="${BUILD_DIR}/archive-${MODE}-${STAMP}.log"
mkdir -p "${BUILD_DIR}"

echo "▸ Proyecto   : ${PROJECT}"
echo "▸ Esquema    : ${SCHEME} (Release)"
echo "▸ Modo       : ${MODE}"
echo "▸ Team ID    : ${TEAM_ID}  ← ${TEAM_SOURCE}"
[[ -n "${BUILD_NUMBER}" ]] && echo "▸ Build      : ${BUILD_NUMBER} (inyectado, sin tocar el Info.plist)"
echo "▸ Registro   : ${LOG_FILE}"
echo

XCODEBUILD_SETTINGS=( "VIAPLUS_DEVELOPMENT_TEAM=${TEAM_ID}" )
[[ -n "${BUILD_NUMBER}" ]] && XCODEBUILD_SETTINGS+=( "CURRENT_PROJECT_VERSION=${BUILD_NUMBER}" )

# --- 1) Dependencias SPM ---------------------------------------------------
#
# Por separado y antes del archive: si falla, el error es de red o de
# resolución de paquetes, no de compilación, y conviene distinguirlo.

echo "▸ Resolviendo paquetes SPM…"
if ! xcodebuild -resolvePackageDependencies -project "${PROJECT}" -scheme "${SCHEME}" >>"${LOG_FILE}" 2>&1; then
  cat >&2 <<EOF
✖  Falló la resolución de paquetes de Swift Package Manager.

   Causa más habitual: sin conexión, o la caché de paquetes corrupta.
     · Comprueba la red (el SDK de Firebase se descarga de GitHub).
     · En Xcode: File ▸ Packages ▸ Reset Package Caches.

   Detalle completo en: ${LOG_FILE}
EOF
  exit 1
fi

# --- 2) Archivado ----------------------------------------------------------

echo "▸ Archivando (Release, generic/platform=iOS)…"
if ! xcodebuild archive \
      -project "${PROJECT}" \
      -scheme "${SCHEME}" \
      -configuration Release \
      -destination 'generic/platform=iOS' \
      -archivePath "${ARCHIVE_PATH}" \
      -allowProvisioningUpdates \
      "${XCODEBUILD_SETTINGS[@]}" >>"${LOG_FILE}" 2>&1; then

  echo "✖  Falló el archivado." >&2
  echo >&2

  if grep -q "requires a development team" "${LOG_FILE}"; then
    cat >&2 <<EOF
   xcodebuild dice que falta el equipo de firma pese a que este script
   resolvió ${TEAM_ID}. Suele significar que el .xcconfig no se está
   aplicando: comprueba que Config/Signing.xcconfig sigue declarado como
   baseConfigurationReference del target en project.pbxproj.

     ./scripts/preflight.sh
EOF
  elif grep -q "cannot be registered to your development team\|Failed to register bundle identifier" "${LOG_FILE}"; then
    cat >&2 <<EOF
   El identificador com.earlify.viaplus ya lo registró OTRO equipo de Apple:
   un identificador solo puede pertenecer a uno. No es un fallo del proyecto.

   Dale un identificador propio en tu firma LOCAL (no versionada):

     echo 'VIAPLUS_BUNDLE_ID = com.earlify.viaplus.tuiniciales' \\
       >> Config/Signing.local.xcconfig
EOF
  elif grep -q "No such module\|no such module" "${LOG_FILE}"; then
    cat >&2 <<EOF
   Falta un módulo de Swift Package Manager. Abre el proyecto en Xcode y deja
   que termine la resolución de paquetes (File ▸ Packages ▸ Reset Package
   Caches si se atasca) antes de volver a archivar.
EOF
  fi

  echo >&2
  echo "   Registro completo: ${LOG_FILE}" >&2
  exit 1
fi

echo "  ✔ ${ARCHIVE_PATH}"

# --- 3) Exportación --------------------------------------------------------
#
# El teamID se inyecta sobre una COPIA temporal del plist: así los
# ExportOptions versionados no contienen identidad (mismo principio que el
# .xcconfig base).

TMP_DIR="$(mktemp -d)"
TMP_PLIST="${TMP_DIR}/ExportOptions.plist"
trap 'rm -rf "${TMP_DIR}"' EXIT
cp "${EXPORT_PLIST}" "${TMP_PLIST}"
/usr/libexec/PlistBuddy -c "Add :teamID string ${TEAM_ID}" "${TMP_PLIST}" >/dev/null 2>&1 \
  || /usr/libexec/PlistBuddy -c "Set :teamID ${TEAM_ID}" "${TMP_PLIST}" >/dev/null

echo "▸ Exportando (${MODE})…"
if ! xcodebuild -exportArchive \
      -archivePath "${ARCHIVE_PATH}" \
      -exportPath "${EXPORT_DIR}" \
      -exportOptionsPlist "${TMP_PLIST}" \
      -allowProvisioningUpdates >>"${LOG_FILE}" 2>&1; then

  echo "✖  Falló la exportación (el archivado SÍ salió bien)." >&2
  echo >&2

  if [[ "${MODE}" == "adhoc" || "${MODE}" == "appstore" ]]; then
    cat >&2 <<EOF
   En modo '${MODE}' la causa más habitual, con diferencia, es LA CUENTA:
   distribuir exige un certificado de distribución de Apple, y una cuenta
   gratuita no puede emitirlo. Comprueba qué tienes:

     security find-identity -v -p codesigning | grep -i distribution

   Sin resultados = cuenta gratuita. Con ella solo funciona:

     ./scripts/archive.sh dev

   Si sí tienes Apple Developer Program y aun así falla, mira el registro:
   suele ser un dispositivo sin registrar (ad-hoc) o un identificador que no
   está dado de alta en App Store Connect (appstore).
EOF
  else
    cat >&2 <<EOF
   El .xcarchive sigue en su sitio y no hay que repetir la compilación:

     ${ARCHIVE_PATH}

   Ábrelo desde Xcode ▸ Window ▸ Organizer y exporta desde ahí: el Organizer
   da mensajes de firma bastante más concretos que xcodebuild.
EOF
  fi

  echo >&2
  echo "   Registro completo: ${LOG_FILE}" >&2
  exit 1
fi


echo
echo "✔  Exportación terminada."
echo "   .ipa      : ${EXPORT_DIR}"
ls -1 "${EXPORT_DIR}"/*.ipa 2>/dev/null | sed 's/^/               /' || true
echo "   .xcarchive: ${ARCHIVE_PATH}"
echo "   Registro  : ${LOG_FILE}"
echo
case "${MODE}" in
  dev)
    echo "   Recuerda: con cuenta gratuita esta firma CADUCA A LOS 7 DÍAS."
    echo "   Pasado ese plazo la app deja de abrirse y hay que reinstalarla."
    ;;
  adhoc)
    echo "   Siguiente paso: subir el .ipa a Firebase App Distribution."
    echo "   Solo se instalará en dispositivos registrados en el equipo ${TEAM_ID}."
    ;;
  appstore)
    echo "   Siguiente paso: Xcode ▸ Organizer, o Transporter, para subirlo."
    echo "   Cada envío necesita un CURRENT_PROJECT_VERSION nuevo para la misma"
    echo "   versión de marketing, o App Store Connect lo rechaza."
    ;;
esac
