# Arquitectura de exportación a iOS

> Portado desde el blueprint de **Valeria+** y adaptado a lo que VIA+ es de
> verdad. Donde el original describe un flujo gestionado de Expo, aquí se
> documenta la divergencia en vez de fingir que no existe: **VIA+ no usa Expo**.

Este documento responde a tres preguntas que, sin él, cuestan horas cada vez
que alguien nuevo se sienta delante del proyecto:

1. ¿De cuál de las dos vías de iOS estamos hablando?
2. ¿Dónde vive la identidad de firma, y por qué no en el repositorio?
3. ¿Cómo sale un `.ipa`, y qué se puede hacer sin pagar los 99 €/año?

---

## 1 · Dos vías, y no son alternativas de lo mismo

VIA+ toca iOS por dos caminos distintos. Confundirlos es el error caro:
la respuesta a «¿qué se abre en Xcode?», «¿hay que hacer `pod install`?» y
«¿cómo se exporta?» **cambia según la vía**.

| | **Vía A** · app React Native | **Vía B** · port nativo SwiftUI |
|---|---|---|
| Qué produce | La app clínica real (SaMD Clase IIa) | Un demostrador de navegación y estética |
| Estado en iOS | 🔴 **Sin proyecto iOS** (ver §2) | 🟢 Operativo |
| Dónde vive | `src/`, `android/` | `ios-native/` |
| Gestor de dependencias nativas | CocoaPods (cuando exista `ios/`) | Swift Package Manager, **sin CocoaPods** |
| ¿Carpeta nativa versionada? | Sí — flujo *bare*, es la fuente de verdad | Sí, `ios-native/` entero |
| Qué se abre en Xcode | `ios/VIAPlus.xcworkspace` (hay Pods) | `ios-native/VIAPlus.xcodeproj` (no hay Pods) |
| Bandera de `xcodebuild` | `-workspace` | `-project` |
| Cómo se exporta | Pendiente (ver §2) | `ios-native/scripts/archive.sh` |
| Identificador | `eu.futureforkids.via` (el de Play) | `com.earlify.viaplus` |

> **Regla de oro.** Antes de contestar a cualquier pregunta de build de iOS en
> este repositorio, decide primero de qué vía se habla. La mitad de las
> respuestas cambian.

### La ficha de App Store le pertenece a la vía A

Hoy las dos vías usan identificadores distintos, así que **no colisionan**. Eso
es una suerte, no un diseño: dos binarios distintos no pueden compartir ficha
en App Store Connect, y si algún día se unificaran los identificadores habría
que elegir cuál se publica.

La decisión de fondo ya está tomada y conviene dejarla escrita: **la ficha le
pertenece a la app React Native**, que es la validada clínicamente. El port
nativo tiene la lógica clínica portada solo en parte; publicarlo bajo la marca
VIA+ sería distribuir como producto sanitario algo que no lo es. Si alguna vez
se distribuye en paralelo, necesita ficha e identificador propios **antes** de
la primera subida, no después.

---

## 2 · Vía A: la app React Native no tiene proyecto iOS

VIA+ usa **React Native 0.80 en flujo *bare*** (CLI de la comunidad), no Expo.
La consecuencia importante:

> En un proyecto bare, `ios/` **no es un artefacto regenerable**: es la fuente
> de verdad de la configuración nativa y hay que versionarla. El principio de
> Valeria+ «la carpeta nativa generada no se versiona» **no aplica aquí**, y
> copiarlo tal cual sería un error: en Valeria+ funciona porque `app.json` y
> los config plugins pueden regenerar `ios/` en cualquier momento. VIA+ no
> tiene esa maquinaria: su `app.json` solo declara `name` y `displayName`.

### Estado real, sin adornos

- `android/` está completo y con release automatizada (`.github/workflows/android-release.yml`).
- **`ios/` no existe en el repositorio.** `npm run ios` no puede funcionar hoy.
- El README raíz menciona `ios/GoogleService-Info.plist` y `Xcode >= 15` en los
  prerrequisitos: describe la intención, no el estado.

### Qué haría falta (decisión pendiente, no trabajo mecánico)

Generar `ios/` para este proyecto no es ejecutar un comando: hay que decidir y
verificar varias cosas que solo se comprueban en un Mac.

1. Generar el proyecto nativo desde la plantilla de RN 0.80 con el nombre y el
   identificador correctos (`eu.futureforkids.via`, el mismo que Play, para que
   Firebase resuelva la configuración).
2. Declarar en `Info.plist` los permisos que la app usa de verdad —micrófono
   (sonómetro y análisis acústico), Bluetooth LE (audiómetro), reconocimiento
   de voz y síntesis— cada uno con su texto de justificación. Sin ellos, Apple
   rechaza; con textos genéricos, también.
3. Resolver los módulos nativos que hoy solo se han validado en Android:
   `react-native-ble-plx`, `react-native-nitro-sqlite`, `react-native-audio-api`,
   `react-native-tts` y `@react-native-voice/voice`. Cada uno puede necesitar
   ajustes de Podfile o entitlements propios.
4. Decidir la firma: aplicar **el mismo patrón de la vía B** (`.xcconfig` base
   versionado sin valores + archivo local ignorado) al proyecto generado, para
   que `ios/` tampoco contenga el Team ID.
5. Actualizar el README raíz para que deje de prometer lo que no hay.

Hasta que eso ocurra, el único camino a un dispositivo iOS es la vía B.

---

## 3 · Vía B: el port nativo, y cómo exporta

Todo lo de este apartado vive en [`ios-native/`](../../ios-native/README.md).

```
ios-native/
├── VIAPlus.xcodeproj/
│   ├── project.pbxproj                 # Índice del compilador; grupos explícitos
│   ├── project.xcworkspace/            # Resolución de SPM (NO es un workspace de Pods)
│   └── xcshareddata/xcschemes/         # Esquema COMPARTIDO: sin él, CI no ve el scheme
├── Config/
│   ├── Signing.xcconfig                # Base versionada, SIN valores de identidad
│   ├── Signing.local.xcconfig.example  # Plantilla del Team ID local
│   ├── ExportOptions-Development.plist # La única válida con cuenta gratuita
│   ├── ExportOptions-AdHoc.plist       # Distribución interna (App Distribution)
│   └── ExportOptions-AppStore.plist    # TestFlight y tienda
├── scripts/
│   ├── preflight.sh                    # ¿le falta algo a este clon para compilar?
│   ├── team-id.sh                      # Averigua el Team ID y escribe la firma local
│   └── archive.sh                      # archive + export del .ipa en tres modos
└── VIAPlus/                            # Swift, Info.plist, Assets.xcassets
```

### El repositorio no contiene identidad de firma

Ni Team ID, ni certificados, ni perfiles, ni `GoogleService-Info.plist`. El
Team ID no es un secreto, pero tampoco es un dato del repositorio: cada persona
que compila puede tener el suyo (cuenta personal, de Earlify Health, de un
centro clínico).

`Config/Signing.xcconfig` es la configuración base (`baseConfigurationReference`)
de Debug y Release, y declara los ajustes en función de variables:

```
DEVELOPMENT_TEAM          = $(VIAPLUS_DEVELOPMENT_TEAM)
PRODUCT_BUNDLE_IDENTIFIER = $(VIAPLUS_BUNDLE_ID)
```

**Cadena de resolución**, de mayor a menor prioridad:

1. `VIAPLUS_DEVELOPMENT_TEAM` pasado a `xcodebuild` como ajuste de build → vía de CI y de scripts.
2. `Config/Signing.local.xcconfig`, incluido con `#include?` **al final** del
   archivo base → vía cómoda para trabajar desde Xcode.
3. Ninguna de las dos → `DEVELOPMENT_TEAM` vacío. **El simulador sigue
   compilando** y el archivado falla con un error explícito.

Ese tercer caso es el comportamiento deseado, no un defecto: es preferible un
error claro a un archivo firmado con la cuenta equivocada, que se descubre
tarde y obliga a repetir el envío.

> **Detalle que cuesta ver.** El `#include?` va **al final** porque en un
> `.xcconfig` gana la última asignación. Invertir el orden hace que el archivo
> local no tenga ningún efecto, y ese fallo no rompe el build: aparece más
> tarde, al archivar, disfrazado de «falta el equipo de firma».
>
> **Gobernanza silenciosa.** El `.xcconfig` figura como
> `baseConfigurationReference` en `project.pbxproj`. Renombrarlo sin actualizar
> el pbxproj **no rompe el build**: Xcode simplemente deja de aplicar la
> configuración base. `preflight.sh` lo comprueba.

### El identificador también es una variable

Un identificador solo puede registrarlo **un** equipo de Apple. Si
`com.earlify.viaplus` ya está registrado por la cuenta de Earlify Health, una
cuenta personal recibirá:

> *Failed to register bundle identifier … cannot be registered to your
> development team because it is not available.*

No es un fallo del proyecto. La solución es sobrescribir `VIAPLUS_BUNDLE_ID` en
la firma **local**, para que el identificador de pruebas de cada persona no
cambie el que se publica.

### La numeración vive en los ajustes de build

`Info.plist` declara `$(MARKETING_VERSION)` y `$(CURRENT_PROJECT_VERSION)`.
Ningún número escrito a mano: eso crearía dos fuentes de verdad que divergen y
App Store Connect rechazaría por build repetido sin que se vea por qué.

Un envío nuevo no toca ningún archivo:

```bash
./scripts/archive.sh appstore 7     # inyecta CURRENT_PROJECT_VERSION=7
```

### Los tres scripts

```bash
cd ios-native

./scripts/preflight.sh              # ANTES de abrir Xcode. Segundos.
./scripts/preflight.sh --build      # + compila para simulador. La respuesta definitiva.

./scripts/team-id.sh                # ¿cuál es mi Team ID?
./scripts/team-id.sh --write        # escribe Config/Signing.local.xcconfig

./scripts/archive.sh dev            # .ipa de desarrollo
./scripts/archive.sh adhoc 12       # distribución interna, build 12
./scripts/archive.sh appstore 12    # App Store Connect, build 12
```

**`preflight.sh`** comprueba sistema y versión de Xcode, estructura del
proyecto, esquema compartido, numeración por variables, cumplimiento de
exportación, estado de la firma, certificados del llavero, icono y
credenciales opcionales — y, sobre todo, **que todos los `.swift` del disco
están registrados en la fase Sources del `pbxproj`**. Sale con código 1 si algo
impide compilar; 0 con avisos si solo faltan cosas opcionales. Cada aviso
incluye el comando que lo resuelve.

**`team-id.sh`** lee el campo **OU** del subject del certificado del llavero,
con los perfiles de aprovisionamiento como respaldo. Evita la confusión más
habitual: el certificado se llama *«Apple Development: correo (XXXXXXXXXX)»* y
ese código entre paréntesis **no** es el Team ID, es el del propio certificado.
Con varios equipos los lista pero no elige: firmar con el equipo equivocado da
errores de identificador que cuesta relacionar con la causa.

**`archive.sh`** encadena `-resolvePackageDependencies`, `archive` y
`-exportArchive`. Su valor no está en encadenar comandos, sino en **traducir**
los tres o cuatro fallos que de verdad ocurren: si falla la exportación en
`adhoc` o `appstore` explica que la causa habitual es la cuenta (hace falta
certificado de distribución) en vez de dejar un error críptico; si falla en
`dev` recuerda que el `.xcarchive` sigue ahí y que el Organizer da mensajes de
firma más concretos.

El `teamID` se inyecta sobre una **copia temporal** del `ExportOptions`, para
que los plists versionados tampoco contengan identidad.

---

## 4 · Gobernanza del `project.pbxproj`

El proyecto usa **grupos explícitos, no carpetas sincronizadas**. Cada `.swift`
o recurso que se cree, borre o renombre se registra a mano en `PBXBuildFile`,
`PBXFileReference`, `PBXGroup` y la build phase correspondiente.

Es deliberado, y es la regla que más se olvida al portar este patrón. Un
`.swift` en disco pero no en la fase Sources **no da un error de sintaxis**:
da un «símbolo no encontrado» a mitad de la compilación, que despista
muchísimo más.

Por eso `preflight.sh` compara el disco con el `pbxproj` **antes** de compilar.

---

## 5 · Cuenta gratuita vs. Apple Developer Program

| Capacidad | Gratuita | De pago (99 €/año) |
|---|:---:|:---:|
| Compilar y ejecutar en el simulador | ✅ | ✅ |
| Instalar en tu propio iPhone/iPad | ✅ | ✅ |
| Exportar `.ipa` de desarrollo | ✅ | ✅ |
| Firebase App Distribution / TestFlight | ❌ | ✅ |
| App Store | ❌ | ✅ |

**Límites de la cuenta gratuita:**

- La firma **caduca a los 7 días**: pasado ese plazo la app deja de abrirse y
  hay que reinstalarla desde Xcode. Es el límite que más molesta si quieres
  dejar un iPad en manos de una logopeda una semana larga.
- 10 App IDs nuevos por cada 7 días.
- Máximo 3 apps de cuenta gratuita instaladas a la vez en un dispositivo.
- Nada de distribución: `adhoc` y `appstore` fallan siempre.

Esto solo se sostiene mientras el port no use capacidades de pago.
**Comprobación rápida:** si no hay ningún archivo `.entitlements` (sin push,
sin App Groups, sin dominios asociados), una cuenta gratuita compila el
proyecto entero. Hoy no lo hay.

En la primera instalación el dispositivo pedirá confiar en el certificado:
*Ajustes ▸ General ▸ VPN y gestión de dispositivos ▸ tu Apple ID ▸ Confiar*.

---

## 6 · Checklist del primer envío a App Store

| Ítem | Estado | Por qué importa |
|---|---|---|
| `ITSAppUsesNonExemptEncryption` en el `Info.plist` | ✅ (`false`) | Sin esa clave, **cada** subida se queda parada preguntando por el cumplimiento de exportación. Revisar si algún día se añade cifrado propio. |
| Icono 1024×1024 **sin canal alfa** | 🔴 Falta la imagen | La transparencia en el icono es rechazo automático (ITMS-90717). Hoy `AppIcon.appiconset` no tiene PNG. |
| Identificador único por ficha | ⚠️ Decisión pendiente | Ver §1: la ficha le pertenece a la vía A. |
| Número de build nuevo en cada envío | ✅ | Se inyecta en el comando, nunca se edita el plist. |
| Credenciales de Firebase | ✅ por diseño | No se versionan. Sin ellas la app **arranca igual**, sin Analytics. |
| Fase de subida de dSYM | 🟡 Pendiente a propósito | Ver abajo. |

**Sobre los dSYM.** El proyecto enlaza Firebase pero **no** tiene fase de
subida de símbolos de caída. En envíos a App Store Connect da igual
(`uploadSymbols` va a `true` en el `ExportOptions`); en los `.ipa` ad-hoc los
informes de caída llegan como direcciones de memoria. Añadirla es una *Run
Script Phase* final que ejecuta el script `run` del SDK desde
`SourcePackages/checkouts`, con `$(TARGET_BUILD_DIR)/$(INFOPLIST_PATH)` y
`${DWARF_DSYM_FOLDER_PATH}` como archivos de entrada y
`ENABLE_USER_SCRIPT_SANDBOXING = NO` (con el sandbox activo el script no puede
leer los dSYM). No está de serie porque depende de una ruta interna de la
resolución de SPM que cambia entre versiones de Xcode, y un build que falla por
eso confunde más que unos informes sin simbolizar en un demostrador.

---

## 7 · Errores frecuentes

| Síntoma | Causa | Arreglo |
|---|---|---|
| *«Signing for "VIAPlus" requires a development team»* al archivar, pero el simulador compila | No es un error: es el diseño funcionando. No hay Team ID resuelto por ninguna vía | `./scripts/team-id.sh --write`, o pasar la variable a `xcodebuild` |
| *«…cannot be registered to your development team because it is not available»* | Ese identificador ya tiene dueño: solo puede registrarlo un equipo | Identificador propio en la firma **local**. No cambies el que se publica |
| *«No such module FirebaseCore»* nada más abrir el proyecto | Xcode todavía está resolviendo los paquetes SPM. Son errores falsos del editor | Esperar a que acabe *Package Dependencies*. Si se atasca: *File ▸ Packages ▸ Reset Package Caches* |
| El compilador no encuentra un símbolo de un archivo que existe en disco | El archivo no está en la fase Sources del `pbxproj` | Registrarlo a mano. `preflight.sh` lo detecta antes de compilar |
| El `.xcconfig` parece no aplicarse: `DEVELOPMENT_TEAM` sigue vacío | O el `#include?` local está antes de la asignación base, o el `.xcconfig` dejó de ser `baseConfigurationReference` | Comprobar el orden dentro del archivo y la referencia en el `pbxproj` |
| «El Team ID que copié no funciona» | Se copió el código entre paréntesis del nombre del certificado, que es el id del certificado | Leer el campo OU: `./scripts/team-id.sh` |
| La app instalada deja de abrirse a los pocos días | Firma de cuenta gratuita: caduca a los 7 días | Reinstalar desde Xcode, o pasar al Developer Program |
| «No se encuentra el `.xcworkspace`» en el port nativo | Se busca un workspace de CocoaPods que no existe: el port usa SPM | Abrir el `.xcodeproj` y usar `-project` |
| `git status` marca `project.pbxproj` después de firmar | Se eligió el equipo en *Signing & Capabilities* y Xcode lo escribió dentro del proyecto | Revertir el archivo y usar `Config/Signing.local.xcconfig` |

---

## 8 · Qué nunca entra en git

Cubierto entre [`.gitignore`](../../.gitignore) y
[`ios-native/.gitignore`](../../ios-native/.gitignore):

- Firma local: `Config/Signing.local.xcconfig`, `*.mobileprovision`, `*.p8`, `*.p12`, `*.cer`.
- Artefactos: `build/`, `DerivedData/`, `*.xcarchive`, `*.ipa`, `*.dSYM/`.
- Estado local de Xcode: `*.xcuserstate`, `**/xcuserdata/`.
- Credenciales: `GoogleService-Info.plist`, `google-services.json`, `.env`.

**Excepción deliberada:** `Package.resolved` **sí** se versiona. Fija las
versiones exactas del SDK de Firebase; sin él, cada persona compila contra «la
última que hubiera ese día» y un fallo reproducible en un Mac deja de serlo en
otro. Vive en `xcshareddata` (no en `xcuserdata`), así que no es estado local
de nadie — pero solo lo puede generar Xcode al resolver los paquetes, así que
**todavía no está en el repositorio**: hay que abrir el proyecto una vez en un
Mac y commitearlo.

> ⚠️ Cuidado con las reglas demasiado anchas. Un `project.xcworkspace` a secas
> en el `.gitignore` raíz se llevaba por delante ese `Package.resolved`, porque
> el `.xcworkspace` que Xcode crea **dentro** del `.xcodeproj` no es un
> workspace de CocoaPods: guarda la resolución de SPM. La regla se ha
> estrechado para ignorar solo su estado por-usuario.

---

## 9 · Antipatrones

| Antipatrón | Por qué duele |
|---|---|
| Elegir el equipo en *Signing & Capabilities* y commitear | Xcode escribe el Team ID en `project.pbxproj`. A partir de ahí, cada persona genera un diff espurio y alguien acabará firmando con la cuenta de otro |
| Escribir el número de build a mano en el `Info.plist` | Dos fuentes de verdad. App Store Connect rechaza por build repetido y el mensaje no dice dónde mirar |
| Usar carpetas sincronizadas de Xcode | Se pierde el control de qué entra en el target. Este proyecto usa grupos explícitos a propósito, aunque cueste registrar cada archivo |
| Un script de archivado que solo encadena comandos de `xcodebuild` | Los errores de firma son crípticos. Sin traducción a lenguaje humano, el script no ahorra el trabajo que de verdad cuesta |
| Dejar que el demostrador muestre contenido caducado «porque es solo un demo» | Lo que se ve en un dispositivo se toma por lo que hace la app. Aquí el riesgo es mayor que en un producto normal: VIA+ es un producto sanitario y el port tiene la lógica clínica portada solo en parte |
| Copiar de Valeria+ el «no versionar `ios/`» | Allí funciona porque Expo la regenera desde `app.json`. VIA+ es *bare*: sin `ios/` versionada no hay configuración nativa de iOS en ninguna parte |

---

## 10 · Cómo verificar que el patrón sigue vivo

Cuatro comprobaciones que valen más que releer este documento:

1. En un clon limpio y **sin ninguna cuenta de Apple**: `./scripts/preflight.sh`
   pasa con avisos (código 0) y `--build` compila para simulador.
2. Con el Team ID en la firma local: `./scripts/archive.sh dev` produce un
   `.ipa` **y `git status` sale limpio**. Si aparece `project.pbxproj`
   modificado, la firma se está escribiendo donde no debe.
3. Renombrar un `.swift` y olvidarse del `pbxproj`: el preflight lo detecta
   **antes** de compilar.
4. `git check-ignore -v ios-native/Config/Signing.local.xcconfig` responde que
   está ignorado.
