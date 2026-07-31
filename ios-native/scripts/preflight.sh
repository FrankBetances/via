#!/usr/bin/env bash
# ==========================================================================
# VIA+ — Preflight del port nativo iOS
# ==========================================================================
#
#   ./scripts/preflight.sh            Comprobación rápida (segundos)
#   ./scripts/preflight.sh --build    Además compila para simulador
#
# EJECÚTALO NADA MÁS CLONAR, ANTES DE ABRIR XCODE.
#
# Responde a una sola pregunta: «¿le falta algo a este clon para compilar?».
# Cada aviso dice QUÉ HACER, no solo qué pasa: la documentación se lee cuando
# ya ha fallado algo, y un preflight se ejecuta antes de que falle.
#
# Código de salida:
#   0  todo bien (posiblemente con avisos de cosas opcionales)
#   1  hay algo que impide compilar o archivar
#
# ==========================================================================
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

PROJECT="${ROOT_DIR}/VIAPlus.xcodeproj"
PBXPROJ="${PROJECT}/project.pbxproj"
SOURCES_DIR="${ROOT_DIR}/VIAPlus"
CONFIG_DIR="${ROOT_DIR}/Config"
BASE_XCCONFIG="${CONFIG_DIR}/Signing.xcconfig"
LOCAL_XCCONFIG="${CONFIG_DIR}/Signing.local.xcconfig"
APPICON_DIR="${SOURCES_DIR}/Assets.xcassets/AppIcon.appiconset"
MIN_XCODE_MAJOR=15

ERRORS=0
WARNINGS=0

ok()   { printf '  ✔ %s\n' "$1"; }
warn() { printf '  ⚠ %s\n' "$1"; WARNINGS=$((WARNINGS + 1)); }
bad()  { printf '  ✖ %s\n' "$1"; ERRORS=$((ERRORS + 1)); }
fix()  { printf '      → %s\n' "$1"; }
head_() { printf '\n%s\n' "$1"; }

echo "════════════════════════════════════════════════════════════════"
echo " VIA+ · preflight del port nativo iOS"
echo " ${ROOT_DIR}"
echo "════════════════════════════════════════════════════════════════"

# --------------------------------------------------------------------------
head_ "1 · Sistema y herramientas"
# --------------------------------------------------------------------------

IS_MACOS=0
if [[ "$(uname -s)" == "Darwin" ]]; then
  IS_MACOS=1
  ok "macOS $(sw_vers -productVersion 2>/dev/null || echo '?')"
else
  warn "Este sistema es $(uname -s), no macOS."
  fix "Compilar y archivar iOS exige un Mac con Xcode. Las comprobaciones"
  fix "de estructura y del pbxproj sí se ejecutan aquí; las de Xcode no."
fi

XCODE_OK=0
if [[ "${IS_MACOS}" -eq 1 ]]; then
  if ! command -v xcodebuild >/dev/null 2>&1; then
    bad "No se encuentra xcodebuild."
    fix "Instala Xcode desde la App Store y luego:"
    fix "sudo xcode-select --switch /Applications/Xcode.app"
  else
    XCODE_VER="$(xcodebuild -version 2>/dev/null | head -1 | awk '{print $2}')"
    XCODE_MAJOR="${XCODE_VER%%.*}"
    if [[ -z "${XCODE_MAJOR}" ]]; then
      bad "xcodebuild no responde: probablemente falta aceptar la licencia."
      fix "sudo xcodebuild -license accept"
    elif [[ "${XCODE_MAJOR}" -lt "${MIN_XCODE_MAJOR}" ]]; then
      bad "Xcode ${XCODE_VER}: el proyecto necesita ${MIN_XCODE_MAJOR} o superior (iOS 16 · Swift 5.9)."
      fix "Actualiza Xcode desde la App Store."
    else
      ok "Xcode ${XCODE_VER}  ($(xcode-select -p 2>/dev/null))"
      XCODE_OK=1
    fi
  fi
fi

# --------------------------------------------------------------------------
head_ "2 · Estructura del proyecto"
# --------------------------------------------------------------------------

if [[ -d "${PROJECT}" && -f "${PBXPROJ}" ]]; then
  ok "VIAPlus.xcodeproj encontrado"
else
  bad "No se encuentra ${PROJECT}"
  fix "Ejecuta este script desde ios-native/ o con su ruta completa."
  echo
  exit 1
fi

# El port usa Swift Package Manager, NO CocoaPods. Si alguien busca un
# .xcworkspace es porque viene del flujo de la app React Native.
if [[ -f "${ROOT_DIR}/Podfile" ]]; then
  warn "Hay un Podfile en ios-native/: este proyecto NO usa CocoaPods."
  fix "El port se abre con VIAPlus.xcodeproj y xcodebuild recibe -project."
else
  ok "Sin CocoaPods (SPM). Se abre VIAPlus.xcodeproj, no un .xcworkspace"
fi

SCHEME_FILE="${PROJECT}/xcshareddata/xcschemes/VIAPlus.xcscheme"
if [[ -f "${SCHEME_FILE}" ]]; then
  ok "Esquema compartido VIAPlus.xcscheme"
else
  bad "Falta el esquema COMPARTIDO ${SCHEME_FILE}"
  fix "Sin él, xcodebuild y App Distribution no ven el esquema."
  fix "Xcode ▸ Product ▸ Scheme ▸ Manage Schemes ▸ marca «Shared»."
fi

# --------------------------------------------------------------------------
head_ "3 · Gobernanza del project.pbxproj (la regla que más se olvida)"
# --------------------------------------------------------------------------
#
# Un .swift en disco pero no registrado en la fase Sources no da un error de
# sintaxis: da un «símbolo no encontrado» a mitad de la compilación, que
# despista muchísimo más. Se comprueba ANTES de compilar.

DISK_SWIFT="$(cd "${SOURCES_DIR}" && find . -name '*.swift' -type f 2>/dev/null | sed 's|^\./||' | sort)"

COMPILED_SWIFT="$(awk '
  /^\/\* Begin PBXBuildFile section \*\//        { section = "buildfile"; next }
  /^\/\* End PBXBuildFile section \*\//          { section = "";          next }
  /^\/\* Begin PBXFileReference section \*\//    { section = "fileref";   next }
  /^\/\* End PBXFileReference section \*\//      { section = "";          next }
  /^\/\* Begin PBXSourcesBuildPhase section \*\// { section = "sources";  next }
  /^\/\* End PBXSourcesBuildPhase section \*\//   { section = "";         next }

  section == "buildfile" && /isa = PBXBuildFile/ {
    if (match($0, /fileRef = [0-9A-Fa-f]+/)) {
      buildfile[$1] = substr($0, RSTART + 10, RLENGTH - 10)
    }
    next
  }

  section == "fileref" && /isa = PBXFileReference/ {
    p = ""
    if (match($0, /path = "[^"]*"/)) {
      p = substr($0, RSTART + 8, RLENGTH - 8)
      gsub(/"/, "", p)
    } else if (match($0, /path = [^;]+;/)) {
      p = substr($0, RSTART + 7, RLENGTH - 8)
    }
    if (p != "") { fileref[$1] = p }
    next
  }

  # Dentro de la fase Sources, las líneas de miembros son «ID /* ... */,».
  # La cabecera de la fase también empieza por un ID, pero lleva «isa =».
  section == "sources" && /^[ \t]+[0-9A-Fa-f]+ \/\*/ && !/isa = / {
    id = $1
    ref = buildfile[id]
    if (ref != "" && fileref[ref] != "") { print fileref[ref] }
  }
' "${PBXPROJ}" | sort)"

# El pbxproj guarda solo el nombre del archivo (el grupo aporta la carpeta),
# así que la comparación se hace por nombre de archivo.
DISK_NAMES="$(sed 's|.*/||' <<<"${DISK_SWIFT}" | sort)"
COMPILED_NAMES="$(grep '\.swift$' <<<"${COMPILED_SWIFT}" | sed 's|.*/||' | sort -u)"

MISSING="$(comm -23 <(echo "${DISK_NAMES}") <(echo "${COMPILED_NAMES}"))"
ORPHAN="$(comm -13 <(echo "${DISK_NAMES}") <(echo "${COMPILED_NAMES}"))"

DISK_COUNT="$(grep -c . <<<"${DISK_NAMES}")"
COMPILED_COUNT="$(grep -c . <<<"${COMPILED_NAMES}")"

if [[ -n "${MISSING}" ]]; then
  bad "Hay .swift en disco que NO están en la fase Sources del pbxproj:"
  sed 's/^/        · /' <<<"${MISSING}"
  fix "Regístralos a mano en PBXFileReference + PBXBuildFile + PBXGroup"
  fix "+ PBXSourcesBuildPhase. Sin eso quedan fuera del target y el fallo"
  fix "aparece como «símbolo no encontrado» a mitad de la compilación."
else
  ok "${DISK_COUNT} archivos .swift, todos registrados en la fase Sources"
fi

if [[ -n "${ORPHAN}" ]]; then
  bad "El pbxproj compila archivos que ya NO existen en disco:"
  sed 's/^/        · /' <<<"${ORPHAN}"
  fix "Retíralos de todas las secciones del pbxproj (se borraron o renombraron"
  fix "sin actualizar el proyecto)."
fi

# Duplicados de nombre: el pbxproj los referencia solo por nombre, así que dos
# archivos homónimos en carpetas distintas son ambiguos.
DUPES="$(sed 's|.*/||' <<<"${DISK_SWIFT}" | sort | uniq -d)"
if [[ -n "${DUPES}" ]]; then
  warn "Nombres de archivo .swift repetidos en carpetas distintas:"
  sed 's/^/        · /' <<<"${DUPES}"
  fix "Esta comprobación no puede distinguirlos. Renómbralos para que sean únicos."
fi

[[ "${COMPILED_COUNT}" -eq 0 ]] && bad "No se pudo leer ninguna fuente del pbxproj: ¿está corrupto?"

# --------------------------------------------------------------------------
head_ "4 · Numeración de versión"
# --------------------------------------------------------------------------

INFO_PLIST="${SOURCES_DIR}/Info.plist"
if grep -q 'MARKETING_VERSION' "${INFO_PLIST}" && grep -q 'CURRENT_PROJECT_VERSION' "${INFO_PLIST}"; then
  ok "Info.plist usa \$(MARKETING_VERSION) y \$(CURRENT_PROJECT_VERSION)"
else
  bad "El Info.plist tiene números escritos a mano."
  fix "Debe usar \$(MARKETING_VERSION) y \$(CURRENT_PROJECT_VERSION), o habrá"
  fix "dos fuentes de verdad y App Store Connect rechazará por build repetido."
fi

if grep -q 'ITSAppUsesNonExemptEncryption' "${INFO_PLIST}"; then
  ok "ITSAppUsesNonExemptEncryption declarado (evita el trámite manual por subida)"
else
  warn "Falta ITSAppUsesNonExemptEncryption en el Info.plist."
  fix "Sin esa clave, CADA subida a App Store Connect se queda parada"
  fix "preguntando por el cumplimiento de exportación."
fi

# --------------------------------------------------------------------------
head_ "5 · Arquitectura de firma"
# --------------------------------------------------------------------------

if [[ -f "${BASE_XCCONFIG}" ]]; then
  ok "Config/Signing.xcconfig presente"
else
  bad "Falta ${BASE_XCCONFIG}"
  fix "Es la configuración base de firma. Sin ella, el equipo tendría que"
  fix "elegirse en Xcode, que lo escribe dentro del pbxproj."
fi

if grep -q 'baseConfigurationReference' "${PBXPROJ}"; then
  ok "El .xcconfig está declarado como baseConfigurationReference del target"
else
  bad "Ningún baseConfigurationReference en el pbxproj: el .xcconfig NO se aplica."
  fix "Este fallo no rompe el build: aparece tarde, al archivar, disfrazado"
  fix "de «falta el equipo de firma». Revisa el pbxproj."
fi

if grep -qE '^[[:space:]]*DEVELOPMENT_TEAM = [A-Z0-9]' "${PBXPROJ}"; then
  bad "Hay un DEVELOPMENT_TEAM con valor escrito dentro del project.pbxproj."
  fix "El repositorio no debe contener identidad de firma. Bórralo del"
  fix "pbxproj y usa Config/Signing.local.xcconfig (./scripts/team-id.sh --write)."
else
  ok "Sin Team ID escrito en el project.pbxproj"
fi

TEAM_RESOLVED=""
if [[ -n "${VIAPLUS_DEVELOPMENT_TEAM:-}" ]]; then
  TEAM_RESOLVED="${VIAPLUS_DEVELOPMENT_TEAM}"
  ok "Team ID por variable de entorno: ${TEAM_RESOLVED}"
elif [[ -f "${LOCAL_XCCONFIG}" ]]; then
  TEAM_RESOLVED="$(sed -n 's/^[[:space:]]*VIAPLUS_DEVELOPMENT_TEAM[[:space:]]*=[[:space:]]*\([A-Z0-9]*\).*/\1/p' "${LOCAL_XCCONFIG}" | head -1)"
  if [[ "${TEAM_RESOLVED}" == "ABCDE12345" ]]; then
    warn "Config/Signing.local.xcconfig todavía tiene el Team ID de la plantilla."
    fix "./scripts/team-id.sh --write   (o edítalo a mano)"
    TEAM_RESOLVED=""
  elif [[ -z "${TEAM_RESOLVED}" ]]; then
    warn "Config/Signing.local.xcconfig existe pero no define VIAPLUS_DEVELOPMENT_TEAM."
    fix "./scripts/team-id.sh   para averiguarlo"
  else
    ok "Team ID por firma local: ${TEAM_RESOLVED}"
  fi
else
  warn "Sin Team ID resuelto: el SIMULADOR compila, el ARCHIVE fallará."
  fix "Es el comportamiento previsto, no un error del proyecto."
  fix "Cuando necesites archivar: ./scripts/team-id.sh --write"
fi

if git -C "${ROOT_DIR}" check-ignore -q "${LOCAL_XCCONFIG}" 2>/dev/null; then
  ok "Signing.local.xcconfig está ignorado por git"
elif [[ -f "${LOCAL_XCCONFIG}" ]]; then
  bad "¡Signing.local.xcconfig NO está en .gitignore y existe en disco!"
  fix "Tu identidad de firma podría acabar versionada. Añádelo al .gitignore."
fi

# --------------------------------------------------------------------------
head_ "6 · Certificados del llavero"
# --------------------------------------------------------------------------

if [[ "${IS_MACOS}" -eq 1 ]]; then
  IDENTITIES="$(security find-identity -v -p codesigning 2>/dev/null || true)"
  if grep -qi 'Apple Development\|iPhone Developer' <<<"${IDENTITIES}"; then
    ok "Certificado de desarrollo en el llavero"
  else
    warn "Sin certificado de desarrollo: no podrás instalar en un dispositivo físico."
    fix "Xcode ▸ Settings ▸ Accounts ▸ + ▸ tu Apple ID (basta la gratuita) y"
    fix "compila una vez sobre un dispositivo conectado."
    fix "El simulador NO necesita certificado."
  fi

  if grep -qi 'Apple Distribution\|iPhone Distribution' <<<"${IDENTITIES}"; then
    ok "Certificado de DISTRIBUCIÓN presente: adhoc y appstore disponibles"
  else
    warn "Sin certificado de distribución (lo normal con cuenta gratuita)."
    fix "Con cuenta gratuita solo funciona ./scripts/archive.sh dev, y esa"
    fix "firma CADUCA A LOS 7 DÍAS. TestFlight y App Distribution exigen el"
    fix "Apple Developer Program."
  fi
else
  warn "No se puede leer el llavero fuera de macOS: firma sin comprobar."
fi

# --------------------------------------------------------------------------
head_ "7 · Recursos y credenciales"
# --------------------------------------------------------------------------

ICON_PNG="$(find "${APPICON_DIR}" -name '*.png' -type f 2>/dev/null | head -1)"
if [[ -n "${ICON_PNG}" ]]; then
  ok "AppIcon con imagen: $(basename "${ICON_PNG}")"
  if [[ "${IS_MACOS}" -eq 1 ]] && command -v sips >/dev/null 2>&1; then
    if sips -g hasAlpha "${ICON_PNG}" 2>/dev/null | grep -q 'hasAlpha: yes'; then
      bad "El icono tiene canal ALFA: App Store lo rechaza automáticamente (ITMS-90717)."
      fix "Reexpórtalo opaco, sin transparencia, a 1024×1024."
    else
      ok "Icono sin canal alfa"
    fi
  fi
else
  warn "AppIcon.appiconset no contiene ninguna imagen: el icono sale en blanco."
  fix "Añade el PNG de 1024×1024 SIN canal alfa y decláralo en su Contents.json."
  fix "Bloquea el envío a App Store, no la compilación."
fi

if [[ -f "${SOURCES_DIR}/GoogleService-Info.plist" ]]; then
  ok "GoogleService-Info.plist presente (Firebase activo)"
else
  warn "Sin GoogleService-Info.plist: la app arranca igual, pero sin Firebase."
  fix "Es deliberado (arranque defensivo): un clon nuevo compila sin pedir"
  fix "credenciales a nadie. Descárgalo de la consola de Firebase para el"
  fix "bundle com.earlify.viaplus y arrástralo al target en Xcode si lo necesitas."
fi

# --------------------------------------------------------------------------
head_ "8 · Compilación de verdad"
# --------------------------------------------------------------------------

if [[ "${1:-}" == "--build" ]]; then
  if [[ "${XCODE_OK}" -ne 1 ]]; then
    bad "No se puede compilar: revisa el apartado 1."
  else
    LOG="${ROOT_DIR}/build/preflight-$(date +%Y%m%d-%H%M%S).log"
    mkdir -p "$(dirname "${LOG}")"
    echo "  ▸ Compilando para simulador (sin firma). Puede tardar varios minutos"
    echo "    la primera vez: Xcode tiene que resolver los paquetes SPM."
    echo "    Registro: ${LOG}"
    if xcodebuild build \
        -project "${PROJECT}" \
        -scheme VIAPlus \
        -configuration Debug \
        -destination 'generic/platform=iOS Simulator' \
        CODE_SIGNING_ALLOWED=NO >"${LOG}" 2>&1; then
      ok "Compila para simulador"
    else
      bad "La compilación falló."
      if grep -q "No such module\|no such module" "${LOG}"; then
        fix "Falta un módulo SPM: abre el proyecto en Xcode y espera a que"
        fix "termine Package Dependencies (Reset Package Caches si se atasca)."
      fi
      fix "Registro completo: ${LOG}"
    fi
  fi
else
  echo "  · Omitido. La respuesta definitiva es: ./scripts/preflight.sh --build"
fi

# --------------------------------------------------------------------------
echo
echo "════════════════════════════════════════════════════════════════"
if [[ "${ERRORS}" -gt 0 ]]; then
  echo " ✖  ${ERRORS} problema(s) que impiden compilar o archivar · ${WARNINGS} aviso(s)"
  echo "════════════════════════════════════════════════════════════════"
  exit 1
fi

if [[ "${WARNINGS}" -gt 0 ]]; then
  echo " ✔  Sin problemas bloqueantes · ${WARNINGS} aviso(s) de cosas opcionales"
else
  echo " ✔  Todo en orden"
fi
echo "════════════════════════════════════════════════════════════════"
exit 0
