# VIA+ — Port nativo iOS (SwiftUI)

Port nativo enfocado en **iteración visual rápida** y validación de usabilidad
en dispositivos físicos vía **Firebase App Distribution**. La arquitectura
profunda no es el objetivo de esta fase.

> ⚠️ Este port es un **demostrador de navegación y estética**. La app clínica
> real —la validada— es la de React Native (`src/`). El port tiene la lógica
> clínica portada solo en parte. Ver
> [`docs/design/arquitectura-exportacion-ios.md`](../docs/design/arquitectura-exportacion-ios.md).

## Empezar aquí (clon nuevo)

```bash
cd ios-native
./scripts/preflight.sh        # ¿le falta algo a este clon? Responde en segundos
open VIAPlus.xcodeproj        # ← ESTO, no un .xcworkspace
```

**Qué se abre: `VIAPlus.xcodeproj`. Qué NO: ningún `.xcworkspace`.** Este
proyecto usa Swift Package Manager, **no CocoaPods**: no hay `Podfile`, ni
`Pods/`, ni `pod install` que ejecutar. Si buscas un workspace es porque vienes
del flujo de la app React Native, que es otra cosa.

El `project.xcworkspace` que Xcode crea **dentro** del `.xcodeproj` guarda la
resolución de SPM y no es un workspace de CocoaPods. Confundirlos lleva a
buscar un `pod install` que no existe.

**La primera apertura tarda y necesita conexión.** Xcode descarga y resuelve el
SDK de Firebase: pueden ser varios minutos, y mientras tanto el editor marca
errores falsos de *«No such module FirebaseCore»*. Espera a que termine la
barra de *Package Dependencies*. Si se atasca: *File ▸ Packages ▸ Reset Package
Caches*.

`preflight.sh` no necesita cuenta de Apple ni credenciales: está pensado para
ejecutarse **antes** de abrir el IDE, y cada aviso incluye el comando que lo
resuelve. Sale con código 1 solo si hay algo que impide compilar.

## Estructura

```
ios-native/
├── .gitignore                     # Estricto para el ecosistema Apple
├── VIAPlus.xcodeproj/             # Proyecto Xcode (SPM + Firebase)
│   ├── project.pbxproj
│   ├── project.xcworkspace/       # Resolución de SPM (NO es un workspace de Pods)
│   └── xcshareddata/xcschemes/    # Esquema compartido "VIAPlus"
├── Config/                        # Firma y opciones de exportación
│   ├── Signing.xcconfig                # Base versionada, SIN identidad
│   ├── Signing.local.xcconfig.example  # Plantilla del Team ID local
│   ├── ExportOptions-Development.plist # La única válida con cuenta gratuita
│   ├── ExportOptions-AdHoc.plist       # App Distribution (cuenta de pago)
│   └── ExportOptions-AppStore.plist    # TestFlight y tienda (cuenta de pago)
├── scripts/
│   ├── preflight.sh               # ¿le falta algo a este clon para compilar?
│   ├── team-id.sh                 # Averigua el Team ID y escribe la firma local
│   └── archive.sh                 # archive + export del .ipa en tres modos
└── VIAPlus/
    ├── VIAPlusApp.swift           # @main + arranque de Firebase
    ├── ContentView.swift          # Host del router (splash + auth flow)
    ├── Theme/
    │   └── VIAColors.swift        # Paleta y gradiente de marca
    ├── Components/
    │   ├── ViaIcon.swift          # Isotipo nativo (tesela + onda + "+")
    │   ├── PrimaryButton.swift    # CTA de marca reutilizable
    │   ├── FormField.swift        # Campo etiquetado + estilo de input
    │   ├── FlexibleWrap.swift     # Layout flex-wrap (chips de rol)
    │   └── SignaturePad.swift     # Pad de firma (Canvas + gestos)
    ├── Models/
    │   ├── DomainModels.swift     # Professional, Patient, ClinicalModule
    │   └── ClinicalAssessmentLogic.swift  # Lógica pura del CAP (4 dominios)
    ├── Audio/
    │   ├── NoiseDSP.swift         # DSP puro del sonómetro (Leq + FFT)
    │   └── NoiseMeter.swift       # Captura AVAudioEngine + estado observable
    ├── Navigation/
    │   └── AppRouter.swift        # NavigationStack + patrón auth flow
    ├── Screens/
    │   ├── SplashView.swift                 # ← Splash (RN)
    │   ├── WelcomeView.swift                # ← Bienvenida
    │   ├── CreditsView.swift                # ← Créditos (Quisqueya Habla)
    │   ├── ProfessionalSelectionView.swift  # ← Selección de profesional
    │   ├── ProfessionalRegistrationView.swift # ← Alta de profesional
    │   ├── PatientsView.swift               # ← Pacientes
    │   ├── PatientRegistrationView.swift    # ← Alta de paciente
    │   ├── ConsentView.swift                # ← Consentimiento informado
    │   ├── ClinicalAssessmentView.swift     # ← Evaluación Clínica Previa (CAP)
    │   ├── RoomNoiseCheckView.swift         # ← Sonómetro ambiental (sala)
    │   └── ModuleHubView.swift              # ← Selección de ejercicios (hub)
    ├── Info.plist
    └── Assets.xcassets/           # AppIcon + AccentColor
```

## Pantallas portadas (flujo core)

Se portó la **columna vertebral de navegación** del app RN, priorizando
iteración visual sobre dispositivo. Flujo: `Splash → Bienvenida → Créditos →
Selección de profesional →` (login) `→ Pacientes → Consentimiento → CAP →
Sonómetro → Hub de módulos`. Los 8 módulos clínicos del hub (voz, audición ×3,
articulación, disfagia, funciones ejecutivas, M-CHAT, SAHS) se muestran como
catálogo seleccionable; su lógica dependiente de hardware se conectará en fases
posteriores.

Abrir un paciente de la lista reinicia el contexto clínico de la sesión
(`AppRouter.clearSession`) y arranca por el consentimiento, de modo que la
cadena de prerrequisitos se recorre entera. En el RN el punto de entrada
depende de lo ya persistido (consentimiento firmado, CAP vigente); aquí, sin
base de datos todavía, siempre se empieza por el primero.

### Formularios de alta (funcionales)

**Alta de profesional** (nombre, rol con chips, email, contraseña ≥6 +
colegiado/servicio/centro opcionales) con **vista previa en vivo** del perfil,
y **alta de paciente** (nombre/apellidos, fecha de nacimiento validada
`AAAA-MM-DD` con edad calculada, sexo, NHC, lengua) con stepper de 5 pasos.
Ambos son **funcionales dentro de la sesión**: `AppRouter` actúa como store en
memoria (`professionals`/`patients`), así que registrar un profesional abre
sesión y registrar un paciente lo añade a la lista. La persistencia real
(SQLite/Firebase) se conecta más adelante.

### Consentimiento informado (bloqueante)

Paso obligatorio entre el alta de paciente y las pruebas. Texto legal versión
1.0 (4 párrafos), **régimen de firma según la edad** del paciente (menor →
tutor; adulto → paciente o familiar/representante con motivo de incapacidad),
relación con el paciente, dos declaraciones a marcar y **firma manuscrita** en
un `SignaturePad` nativo (`Canvas` + `DragGesture`). El destino tras firmar
(`cap` / `dysphagia`) se propaga con `Route.consent(ConsentNext)`: `cap`
continúa a la Evaluación Clínica Previa y `dysphagia` la salta (su módulo aún
no está portado, así que aterriza en el hub). La persistencia (tabla
`informed_consent`) se conecta después.

### Evaluación Clínica Previa · CAP (prerrequisito)

Certifica las condiciones **mínimas de viabilidad** de la prueba en cuatro
dominios —otoscopia (hallazgo por oído), capacidad visual, verbal y motora— y
deriva qué juegos quedan habilitados. La lógica clínica se portó **1:1** desde
`clinicalAssessmentResult.ts` a `Models/ClinicalAssessmentLogic.swift`, sin
dependencias de UI: mismos ítems y códigos (V-0x, VB-x-0x, M-0x), mismas
severidades otoscópicas (cerumen, OMA y perforación bloquean ese oído), mismo
gating de los cinco juegos (J01–J05) y mismo veredicto global
(`APTO · COMPLETO` / `APTO PARCIAL` / `NO APTO`).

El grupo de edad verbal se **presugiere** con la fecha de nacimiento del
paciente y el evaluador se precarga con el profesional en sesión. Al confirmar,
el resumen queda en `AppRouter.capSummary` y se navega al sonómetro. La
exploración de disfagia mantiene su atajo: no requiere CAP ni sonómetro.

### Sonómetro ambiental · sala (prerrequisito)

Medición **real** del ruido de fondo con el micrófono del dispositivo, no una
maqueta: `Audio/NoiseDSP.swift` es el port del DSP del RN (promedio energético
Leq entre bloques y espectro por bandas log con FFT radix-2 + ventana de Hann)
y `Audio/NoiseMeter.swift` sustituye al par `useNoiseMeter` + `noiseMicAdapter`
con `AVAudioEngine` (tap de entrada, sesión `.record`/`.measurement`) y un
muestreo de UI cada 90 ms.

Se conserva la regla clínica del RN: **nunca se simulan lecturas**. Sin permiso
o sin micrófono el medidor queda en estado de error y no emite veredicto, y una
medición sin ~1 s de señal real tampoco lo emite (evita un falso «SALA APTA»).
El umbral por defecto es **≤ 45 dB** con medición de 5 s, y el gate para
continuar es doble: veredicto apto **y** checklist de sala completa.

> La lectura es una estimación **relativa** anclada en
> `NoiseDSP.splAtFullScale` (92 dB a 0 dBFS). No sustituye a un sonómetro
> calibrado; ajuste ese único valor si dispone de una referencia.

## Permisos del sistema

`NSMicrophoneUsageDescription` está declarado en `Info.plist` (sonómetro de
sala y, más adelante, análisis acústico de la voz). Sin la autorización del
usuario, el sonómetro muestra el error y el flujo queda bloqueado a propósito.

## Dependencias (Swift Package Manager)

Firebase se inyecta como paquete remoto SPM directamente en `project.pbxproj`:

- **Paquete:** `https://github.com/firebase/firebase-ios-sdk.git` (>= 11.0.0)
- **Productos vinculados:** `FirebaseCore`, `FirebaseAnalytics`

Al abrir el proyecto, Xcode resolverá los paquetes automáticamente
(*File ▸ Packages ▸ Resolve Package Versions* si hiciera falta).

`Package.resolved` (dentro de `project.xcworkspace/xcshareddata/swiftpm/`)
**sí se versiona**: fija las versiones exactas del SDK y evita que cada persona
compile contra «la última que hubiera ese día». Solo lo puede generar Xcode al
resolver los paquetes, así que todavía no está en el repositorio; commitéalo la
primera vez que abras el proyecto en un Mac.

## Firma: por qué no está en el repositorio

Ni el Team ID, ni certificados, ni perfiles. `Config/Signing.xcconfig` es la
configuración base del target y declara los ajustes en función de variables que
resuelve, por este orden:

1. `VIAPLUS_DEVELOPMENT_TEAM` pasado a `xcodebuild` (vía de CI y de scripts).
2. `Config/Signing.local.xcconfig` — copia local **sin versionar**.
3. Ninguna de las dos → el simulador compila igual; el **archivado falla** con
   *«Signing for "VIAPlus" requires a development team»*. Eso es el diseño
   funcionando: mejor un error claro que un archivo firmado con la cuenta
   equivocada.

Para dejarlo resuelto:

```bash
./scripts/team-id.sh            # ¿cuál es mi Team ID? (lo lee del llavero)
./scripts/team-id.sh --write    # lo escribe en Config/Signing.local.xcconfig
```

> ⛔ **No elijas el equipo en la pestaña *Signing & Capabilities*.** Xcode lo
> escribe dentro de `project.pbxproj` y deja un cambio accidental en el
> repositorio. Si `git status` marca el `.pbxproj` después de firmar, es esto.
>
> ⚠️ El certificado se llama *«Apple Development: correo (XXXXXXXXXX)»* y ese
> código entre paréntesis **no** es el Team ID, es el del propio certificado.
> `team-id.sh` lee el campo **OU** del subject precisamente por eso.

Si al firmar recibes *«…cannot be registered to your development team because
it is not available»*, el identificador `com.earlify.viaplus` ya lo registró
otro equipo: solo puede pertenecer a uno. Dale uno propio **en tu archivo
local**, sin tocar el que se publica:

```
VIAPLUS_BUNDLE_ID = com.earlify.viaplus.tuiniciales
```

## Exportación del `.ipa`

```bash
./scripts/archive.sh dev             # desarrollo — único modo con cuenta gratuita
./scripts/archive.sh adhoc 12        # App Distribution, build 12 (cuenta de pago)
./scripts/archive.sh appstore 12     # App Store Connect, build 12 (cuenta de pago)
```

El segundo argumento inyecta `CURRENT_PROJECT_VERSION` **en el comando**: el
número de build no se escribe a mano en el `Info.plist`, que lo lee como
`$(CURRENT_PROJECT_VERSION)`. Un envío nuevo no toca ningún archivo del
repositorio.

Cuando algo falla, el script traduce el error de `xcodebuild` a una frase que
dice qué hacer: los mensajes de firma de Apple son crípticos, y la causa
habitual de que fallen `adhoc` y `appstore` no es el proyecto sino la cuenta.

## Qué se puede hacer con una cuenta gratuita

| Capacidad | Gratuita | De pago (99 €/año) |
|---|:---:|:---:|
| Simulador | ✅ | ✅ |
| Instalar en tu propio iPhone/iPad | ✅ | ✅ |
| Exportar `.ipa` de desarrollo | ✅ | ✅ |
| Firebase App Distribution / TestFlight | ❌ | ✅ |
| App Store | ❌ | ✅ |

Con cuenta gratuita, **la firma caduca a los 7 días**: pasado ese plazo la app
deja de abrirse y hay que reinstalarla desde Xcode. Es el límite que más
molesta si quieres dejar un iPad en manos de una logopeda una semana larga.
También hay tope de 10 App IDs nuevos cada 7 días y de 3 apps instaladas a la
vez en un dispositivo.

Esto se sostiene porque el port **no usa capacidades de pago**: no hay ningún
archivo `.entitlements` (sin push, sin App Groups, sin dominios asociados), así
que una cuenta gratuita compila el proyecto entero.

En la primera instalación el dispositivo pedirá confiar en el certificado:
*Ajustes ▸ General ▸ VPN y gestión de dispositivos ▸ tu Apple ID ▸ Confiar*.

## Configuración de Firebase (paso manual)

1. Descarga `GoogleService-Info.plist` desde la consola de Firebase
   (proyecto `valoracion-interactiva`) para el bundle `com.earlify.viaplus`.
2. Arrástralo al target **VIAPlus** en Xcode (marca *Copy items if needed*).
3. El arranque es defensivo (`FirebaseBootstrap.configureIfPossible`): sin el
   plist la app **corre igualmente** sin inicializar Firebase, lo que permite
   iterar sobre las pantallas sin bloquear la compilación.

> ⚠️ El `GoogleService-Info.plist` está en `.gitignore`. **Nunca** se versiona.

## ⛔ Regla innegociable de gobernanza del `project.pbxproj`

Cada vez que se **cree, elimine o renombre** un archivo `.swift` o un recurso,
**debe** registrarse el cambio en `VIAPlus.xcodeproj/project.pbxproj`, en sus
secciones correspondientes:

| Acción                     | Secciones a actualizar en el `.pbxproj`                        |
|----------------------------|----------------------------------------------------------------|
| Nuevo `.swift`             | `PBXFileReference` + `PBXBuildFile` + `PBXGroup` + `PBXSourcesBuildPhase` |
| Nuevo recurso (assets, …)  | `PBXFileReference` + `PBXBuildFile` + `PBXGroup` + `PBXResourcesBuildPhase` |
| Renombrar / mover          | Actualizar `path`/nombre en `PBXFileReference` y el `PBXGroup` |
| Eliminar                   | Retirar el objeto de **todas** las secciones anteriores        |

Omitir este registro deja el archivo fuera del target y **corrompe el build**.
Un `.swift` en disco pero no en la fase Sources no da un error de sintaxis: da
un «símbolo no encontrado» a mitad de la compilación, que despista muchísimo
más. Por eso `./scripts/preflight.sh` compara el disco con el `pbxproj`
**antes** de compilar, y por eso el proyecto usa grupos explícitos en vez de
carpetas sincronizadas.

---

## Documento de referencia

La arquitectura completa de exportación a iOS —las dos vías del repositorio,
la cadena de resolución de la firma, el checklist del primer envío a App Store
y el catálogo de errores frecuentes— está en
[`docs/design/arquitectura-exportacion-ios.md`](../docs/design/arquitectura-exportacion-ios.md).
