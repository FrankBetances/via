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
    ├── ContentView.swift          # Pantalla raíz placeholder
    ├── Info.plist
    └── Assets.xcassets/           # AppIcon + AccentColor
```

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
