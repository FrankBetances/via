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
    │   └── PrimaryButton.swift    # CTA de marca reutilizable
    ├── Models/
    │   └── DomainModels.swift     # Professional, Patient, ClinicalModule
    ├── Navigation/
    │   └── AppRouter.swift        # NavigationStack + patrón auth flow
    ├── Screens/
    │   ├── SplashView.swift               # ← Splash (RN)
    │   ├── WelcomeView.swift              # ← Bienvenida
    │   ├── CreditsView.swift              # ← Créditos (Quisqueya Habla)
    │   ├── ProfessionalSelectionView.swift# ← Selección de profesional
    │   ├── PatientsView.swift             # ← Pacientes
    │   └── ModuleHubView.swift            # ← Selección de ejercicios (hub)
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
