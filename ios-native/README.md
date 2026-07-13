# VIA+ — Port nativo iOS (SwiftUI)

Port nativo enfocado en **iteración visual rápida** y validación de usabilidad
en dispositivos físicos vía **Firebase App Distribution**. La arquitectura
profunda no es el objetivo de esta fase.

## Estructura

```
ios-native/
├── .gitignore                     # Estricto para el ecosistema Apple
├── VIAPlus.xcodeproj/             # Proyecto Xcode (SPM + Firebase)
│   ├── project.pbxproj
│   └── xcshareddata/xcschemes/    # Esquema compartido "VIAPlus"
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
    │   └── DomainModels.swift     # Professional, Patient, ClinicalModule
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
    │   └── ModuleHubView.swift              # ← Selección de ejercicios (hub)
    ├── Info.plist
    └── Assets.xcassets/           # AppIcon + AccentColor
```

## Pantallas portadas (flujo core)

Se portó la **columna vertebral de navegación** del app RN, priorizando
iteración visual sobre dispositivo. Flujo: `Splash → Bienvenida → Créditos →
Selección de profesional →` (login) `→ Pacientes → Hub de módulos`. Los 8
módulos clínicos del hub (voz, audición ×3, articulación, disfagia, funciones
ejecutivas, M-CHAT, SAHS) se muestran como catálogo seleccionable; su lógica
dependiente de hardware se conectará en fases posteriores.

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
(`cap` / `dysphagia`) se propaga con `Route.consent(ConsentNext)`. La
persistencia (tabla `informed_consent`) y las pantallas CAP/Sala se portan
después; hoy, tras firmar se aterriza en el hub de módulos.

## Dependencias (Swift Package Manager)

Firebase se inyecta como paquete remoto SPM directamente en `project.pbxproj`:

- **Paquete:** `https://github.com/firebase/firebase-ios-sdk.git` (>= 11.0.0)
- **Productos vinculados:** `FirebaseCore`, `FirebaseAnalytics`

Al abrir el proyecto, Xcode resolverá los paquetes automáticamente
(*File ▸ Packages ▸ Resolve Package Versions* si hiciera falta).

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
