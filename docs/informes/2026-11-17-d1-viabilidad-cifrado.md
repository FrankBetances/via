# D1 · Viabilidad del cifrado de `viaplus.db`

Fecha: 17/11/2026. Paquete D1 de la fase D. Es un INFORME: no se ha escrito
código ni se ha tocado `package.json`.

`docs/PLAN-MEJORA-APP.md` **no existe** en esta rama (comprobado con `ls`), así
que no he podido leer la definición exacta de D1; me he guiado por el encargo.

Convención: **[Hecho]** = leído en una fuente que se cita; **[Inferencia]** =
deducido de lo leído, sin ejecutarlo; **[Por verificar]** = nadie lo ha
comprobado en dispositivo ni compilando.

**Esto no lo he compilado ni lo he ejecutado en ningún dispositivo.** Todo lo
de abajo es lectura de código fuente de paquetes npm y del repositorio.

## 1. Resumen y recomendación

Recomendación única: **migrar de `react-native-nitro-sqlite` a
`@op-engineering/op-sqlite` compilado con SQLCipher, y guardar la clave de 256
bits en `expo-secure-store`**, con migración por `sqlcipher_export` y una
lectura de comprobación inmediata tras abrir que falle a la vista. Motivo: es la
única vía que encontré en las fuentes donde el cifrado de la base entera está
incluido y es compilable sin licencia de pago. El coste es real: se cambia el
motor de SQLite de toda la app y hay que reescribir el driver de TypeORM
(apartado 2.4).

Hay una condición previa que decide Frank, no yo: **la regla 1 exige usar lo que
está demostrado**, y ni `op-sqlite` ni `expo-secure-store` están demostrados en
VIA+ ni en Valeria+ (apartado 3). Es una librería nueva, no un porte. Si Frank
dice que no, la alternativa honesta es no cifrar la base y dejar escrito que la
protección es la del dispositivo (`allowBackup="false"` más bloqueo de pantalla
y cifrado de Android), no buscar un parche intermedio.

## 2. Pregunta 1: ¿admite cifrado la base actual?

### 2.1 `react-native-nitro-sqlite` instalada (9.6.0)

- **[Hecho]** Versión de `package-lock.json`: 9.6.0 (líneas 19283-19286).
- **[Hecho]** No admite cifrado. En `node_modules/react-native-nitro-sqlite/`
  (`src`, `cpp/*.cpp`, `cpp/hybridObjects`, `nitrogen`, `android/build.gradle`,
  `ios`, `RNNitroSQLite.podspec`, `package.json`) no hay ninguna mención de
  `sqlcipher`, `encryptionKey` ni `HAS_CODEC`. En `cpp/sqlite/sqlite3.c` solo
  aparecen `sqlite3_keyword_*`, que no tienen que ver. `SQLITE_FLAGS` existe
  (`android/build.gradle:76`, propiedad `nitroSqliteFlags`) pero solo pasa `-D`
  al SQLite incluido, que es el estándar.
- **[Hecho]** Abre con `sqlite3_open_v2` (`cpp/operations.cpp:31`) sin llamar a
  `sqlite3_key`.

### 2.2 `react-native-nitro-sqlite` 10.3.1 (la última en npm hoy)

- **[Hecho]** El tarball 10.3.1 sí trae un parámetro `encryptionKey`
  (`src/specs/NitroSQLite.nitro.ts:28-54`), pero su documentación dice: «Optional
  key for a licensed SEE build. Without SEE, a supplied key throws
  `EncryptionNotEnabled`». SEE es la *SQLite Encryption Extension* del
  fabricante de SQLite, de **pago**. **[Inferencia]** Los `sqlite3.c` del
  paquete no son SEE (no lo he comprobado línea a línea), así que subir de
  versión no daría cifrado utilizable.

### 2.3 Alternativa: `@op-engineering/op-sqlite` 19.0.5

- **[Hecho]** Versión publicada: 19.0.5 (npm, modificada el 5/11/2026).
  Peer dependencies: `react` y `react-native` con `*`, sin tope.
- **[Hecho]** Soporta SQLCipher como opción de compilación. Se activa con una
  clave `"op-sqlite": { "sqlcipher": true }` en el `package.json` de la app
  (`android/build.gradle:93-95`); entonces añade `io.github.ronickg:openssl`
  (`android/build.gradle:319-321`) y define `OP_SQLITE_USE_SQLCIPHER`. Trae
  `cpp/sqlcipher/sqlite3.c` con SQLCipher 4.19.0 «community» sobre SQLite 3.53.4
  (`CIPHER_VERSION_NUMBER`; `cpp/sqlcipher/sqlite3.h:149`) y contiene
  `sqlcipher_export`. README: «SQLCipher is supported as a compilation target»
  (`README.md:20`).
- **[Hecho]** API de apertura con clave:
  `open({ name, location?, encryptionKey? })` (`src/types.ts:385`). La clave se
  aplica con `sqlite3_key_v2` justo tras abrir (`cpp/OPBridge.cpp:164-177`).
- **[Hecho, y clave para la regla 4]** Tras `sqlite3_key_v2`, `OPBridge.cpp` no
  ejecuta ninguna lectura. **[Inferencia]** Como SQLCipher no comprueba la clave
  hasta la primera lectura, `open()` **no lanzará** con una clave mala; fallará
  en la primera consulta. El diseño debe forzar esa lectura (apartado 4).
- **[Hecho]** Ruta en Android: `context.getDatabasePath(...)`
  (`android/.../OPSQLiteBridge.kt:27`), el directorio estándar `databases/`.
  **[Por verificar]** que nitro-sqlite con `location: 'default'` escribe en el
  mismo directorio: no encontré dónde lo decide. Importa para la migración.
- **[Hecho]** Tiene `executeSync` (`src/types.ts:176,257`), que es lo que usa hoy
  nuestro driver (el `execute` síncrono de nitro) por el problema de promesas
  documentado en `src/Database/nitroTypeOrmDriver.ts:5-9`. **[Por verificar]**
  que `op-sqlite` no tenga un problema análogo.
- **[Por verificar]** Que compile con **React Native 0.81.5** y arquitectura
  nueva. Su `devDependencies` apunta a RN 0.87.0 (`package.json:89`) y el peer es
  `*`: nada impide instalarlo, pero «el peer no lo impide» no es «compila». Es
  lo primero que hay que comprobar con un build real.
- No leí la fuente de `react-native-quick-sqlite` (8.2.8 en npm): **no lo
  evalúo**.

### 2.4 Qué cambiaría en `src/Database/nitroTypeOrmDriver.ts` y cuánto

El fichero tiene 78 líneas.

- **[Inferencia]** Cambiar el `import { open }` por el de `op-sqlite` y pasar
  `encryptionKey` a `open(...)`.
- **[Hecho]** TypeORM lee los resultados con `raw.rows.item(i)` y
  `raw.rows.length`
  (`node_modules/typeorm/driver/react-native/ReactNativeQueryRunner.js:65-66`).
  **[Hecho]** `op-sqlite` devuelve `rows` como array normal
  (`src/types.ts:80-92`); nitro lo devuelve con `item()`
  (`react-native-nitro-sqlite/src/types.ts:58`). **[Inferencia]** Hay que
  envolver `rows` en `{ length, item(i) }`: unas veinte líneas.
- **[Hecho]** `attach`/`detach` cambian de firma
  (`{ secondaryDbFileName, alias, location }`, `src/types.ts:173,230`) y
  `transaction` es asíncrono. **[Por verificar]** si TypeORM llega a usar
  `transaction()` del driver o solo `BEGIN`/`COMMIT` por `executeSql`: solo vi
  que `ReactNativeDriver.js:30` declara `transactionSupport = "nested"`.
- **[Hecho]** `AppDataSource` (`src/Database/config.ts`) tiene
  `synchronize: true`. **[Inferencia]** Sobre una base cifrada nueva crearía el
  esquema desde cero, así que la migración de datos debe ocurrir **antes** de
  `initialize()`.
- **[Inferencia]** Estimación: el driver son 1-2 horas de escritura; el coste
  real está en el build nativo y en probarlo en dispositivo. Los tests que
  mockean el módulo nativo (regla 3) tendrán que reproducir el contrato de
  `op-sqlite` leído de su fuente, no el de nitro.

## 3. Pregunta 2: custodia de la clave

### 3.1 Qué usa Valeria+ (referencia obligatoria, regla 1)

Clonado `github.com/FrankBetances/Valeria` (`--depth 1`):

- **[Hecho]** **No guarda secretos en almacenamiento seguro.** Su `package.json`
  no lista `expo-secure-store` ni ninguna librería SQLite. Su cifrado
  (`src/valeriaCrypto.ts:1-9`) deja la clave en AsyncStorage
  (`KEY_STORAGE = '@valeria_tlm_key'`, línea 14) junto a los datos que protege, y
  la semilla sale de `Math.random()` más SHA-256 (líneas 76-78). Su propia
  cabecera dice: «mover esa clave a expo-secure-store» para producción
  regulatoria.
- **[Hecho]** La ficha del paciente de Valeria+ se guarda **en claro**
  (`docs/play-console-seguridad-datos.md:195-205`, lo admite el propio
  documento) y `docs/PLAN-MEJORAS-2026-11-16.md:23` plantea *añadir*
  `expo-secure-store` como mejora futura: no está hecho.
- **Conclusión [Hecho]:** Valeria+ **no es una referencia demostrada** de
  custodia de claves ni de SQLite cifrado. No hay camino probado que copiar, y
  no debe presentarse `expo-secure-store` como «lo que usa Valeria+»: no lo usa.
  Lo digo y espero a Frank (regla 1).

### 3.2 `expo-secure-store` (SDK 54: 15.0.8)

- **[Hecho]** Versión 15.0.8 publicada, peer `expo: *`. **[Inferencia]** La serie
  15 corresponde a SDK 54 (VIA+ declara `expo` `>=54.0.0-0 <55.0.0`,
  `package.json:30`); la última, 58.0.3, es de SDK 58 y no sirve.
- **[Hecho]** En Android guarda en `SharedPreferences` un valor cifrado con AES
  en modo GCM (`encryptors/AESEncryptor.kt:137`), con la clave generada en
  **AndroidKeyStore** (`SecureStoreModule.kt:381`, `AESEncryptor.kt:55-71`).
- **[Hecho]** La clave del Keystore se crea con `KeyGenParameterSpec` sin
  `setIsStrongBoxBacked` (no aparece en el módulo): **no pide StrongBox**; si
  vive en TEE, StrongBox o software lo decide el dispositivo, y el módulo no
  expone ninguna función para saberlo.
- **[Hecho]** Límite de valor: 2048 bytes (`build/SecureStore.d.ts:117,128`); una
  clave de 32 bytes en hexadecimal cabe de sobra.
- **[Hecho]** La API tiene opciones sobre copias de seguridad
  (`SecureStore.d.ts:10,26,37`) y `CHANGELOG.md:108` cita un arreglo de errores de
  descifrado tras restaurar una copia automática de Android.
- **Cómo comprobar el respaldo por hardware [Por verificar]:** habría que leer el
  `KeyInfo` de la clave (`isInsideSecureHardware`; `getSecurityLevel()` en API
  31 o superior) con código nativo propio o un módulo que lo haga. Eso es código
  nativo nuevo que aquí no puedo compilar. Haría falta además una pantalla o
  eslabón de diagnóstico (regla 4) que lo muestre, solo si Frank lo quiere.
- **[Inferencia]** La clave tiene que estar en memoria para abrir la base: esto
  protege el fichero en reposo (una copia, un dispositivo robado sin
  desbloquear), no frente a un atacante con la app en ejecución y el dispositivo
  desbloqueado.

### 3.3 Android Keystore directo

**[Inferencia]** Un módulo propio sobre Keystore es posible, pero es inventar
donde ya hay algo (regla 1) y habría que compilarlo sin poder.
`expo-secure-store` ya lo hace.

## 4. Pregunta 3: migrar una `viaplus.db` en claro a una cifrada

Procedimiento propuesto. Es **[Inferencia]** sobre el procedimiento estándar de
SQLCipher (`ATTACH ... KEY` más `sqlcipher_export`, función presente en el
`sqlite3.c` incluido); **no lo he ejecutado**.

1. Al arrancar, antes de `AppDataSource.initialize()`: leer o generar la clave en
   `expo-secure-store` (32 bytes de un generador criptográfico, **no**
   `Math.random()` como hace Valeria+).
2. Decidir el estado del fichero: no existe (instalación nueva: crearla
   cifrada), existe en claro (migrar) o existe cifrada (abrir con clave). Para
   distinguir «en claro» de «cifrada» se prueba a abrir **sin** clave y
   ejecutar `SELECT count(*) FROM sqlite_master`: si funciona, está en claro.
3. Migrar: abrir la base en claro; `ATTACH DATABASE 'viaplus.enc.db' AS enc KEY
   '<clave>'`; `SELECT sqlcipher_export('enc')`; copiar `PRAGMA user_version`;
   `DETACH`.
4. **Verificar antes de borrar:** abrir `viaplus.enc.db` con la clave releída de
   `expo-secure-store` y comparar el número de filas de cada tabla con el
   original. Solo si coincide, renombrar la cifrada a `viaplus.db` y borrar el
   fichero en claro y sus `-wal`/`-journal`.
5. **Punto de no retorno:** el borrado del fichero en claro. Hasta ahí el
   original sigue intacto y un fallo permite reintentar. Conviene un marcador
   «migración completada» para que un cierre brusco entre los pasos 4 y 5 no se
   malinterprete en el arranque siguiente. **[Por verificar]** qué pasa si la
   app muere justo en medio: hay que provocarlo en un dispositivo.
6. **[Inferencia]** Borrar el fichero no sobrescribe los bloques de la memoria
   flash: no garantiza que el contenido en claro sea irrecuperable, y no debe
   afirmarse en ningún sitio.

**Cómo falla de forma VISIBLE (regla 4):**

- Tras abrir con clave, ejecutar de inmediato una lectura (`SELECT count(*)
  FROM sqlite_master`), porque `open()` no la valida (apartado 2.3).
- Si esa lectura falla, **no crear una base nueva vacía**: sería un fallo
  silencioso con pérdida aparente de todos los datos. Hay que lanzar un error con
  motivo nombrado («la clave no abre la base», distinto de «falta la clave» y de
  «fichero corrupto») que `@/Startup` pinte (existe `src/Startup/StartupReport.tsx`;
  **[Por verificar]** que muestre bien un error lanzado desde aquí).

## 5. Pregunta 4: riesgos

- **Pérdida de la clave = pérdida total de los datos clínicos.** [Hecho, propiedad
  de cualquier cifrado] No hay recuperación. Es el riesgo dominante.
- **Copia de seguridad de Android.** [Hecho] `android:allowBackup="false"`
  (`android/app/src/main/AndroidManifest.xml:102`): ni la base ni la clave van a
  la nube. [Inferencia] Es coherente con una clave de Keystore (es de ese
  dispositivo), pero significa que **cambiar de teléfono pierde la base**, igual
  que hoy. Si algún día se activa la copia, hay que decidir qué pasa con la clave
  (la restauración de `expo-secure-store` ya dio errores, `CHANGELOG.md:108`).
- **Reinstalación.** [Inferencia] Al desinstalar desaparecen a la vez fichero y
  clave. El peligro es perder **solo** una de las dos (p. ej. un fallo del
  Keystore tras una actualización del sistema): el fichero quedaría ilegible para
  siempre. Por eso el paso 4 no borra el original hasta que la clave está releída
  y ha abierto la base.
- **Keystores defectuosos.** [Por verificar] Hay dispositivos con Keystore
  problemático; no encontré una lista en las fuentes leídas. Hay que probarlo en
  los modelos reales.
- **Coste en arranque.** [Inferencia] SQLCipher 4 deriva la clave con PBKDF2 si se
  le da una frase; con una clave binaria de 32 bytes en formato `x'<hex>'` se
  evita (formato propio de SQLCipher; **[Por verificar]** que `sqlite3_key_v2` lo
  trate así en esta compilación). No está medido: hay que medirlo en el
  dispositivo más lento. Se suma la lectura asíncrona de `expo-secure-store`.
- **Tamaño y tiempo de build.** [Por verificar] `op-sqlite` con SQLCipher añade
  OpenSSL (`io.github.ronickg:openssl:3.6.2-3`) y compila SQLCipher entero: más
  tiempo de build y más peso del APK. No lo medí.
- **Auditoría de dependencias nativas (CLAUDE.md).** Al sustituir nitro-sqlite hay
  que quitar `react-native-nitro-sqlite` y `react-native-nitro-modules` si nada
  más los usa (no lo comprobé), o se seguirían compilando sin uso.
- **Lo que el cifrado NO cubre.** Los PDF se guardan en `<documents>/informes/`
  fuera de la base, en claro (CLAUDE.md, «El PDF ya se guarda»). Cifrar la base
  no cifra los informes. `ios-native/` (demostrador) queda fuera.

## 6. Por verificar en dispositivo (lista)

- Que `op-sqlite` 19.0.5 con SQLCipher compile con React Native 0.81.5 y
  arquitectura nueva, y el tiempo de build resultante.
- Que el driver TypeORM reescrito funcione (lecturas, escrituras, `synchronize`)
  y que no reaparezca un cuelgue como el de nitro asíncrono.
- Que `viaplus.db` actual esté en el directorio que usaría `op-sqlite`.
- La migración completa con una base real con datos de todos los módulos, y la
  muerte de la app entre los pasos 3 y 5.
- Dónde vive la clave en los dispositivos de prueba (TEE, StrongBox o software):
  `expo-secure-store` no lo informa.
- Que una clave mala dé el error visible en pantalla y no una base vacía.
- Tiempo de arranque con y sin cifrado, y tamaño del APK.
- Decisión de Frank sobre la regla 1: usar librerías no demostradas en Valeria+.

## 7. Lo que no he podido comprobar

- Nada se ha compilado ni ejecutado: no hay SDK de Android.
- No leí `react-native-quick-sqlite`; no lo evalúo.
- No comprobé si TypeORM usa `transaction()` del driver.
- No leí `docs/PLAN-MEJORA-APP.md` (no existe en esta rama).
- Lo dicho sobre el comportamiento de SQLCipher (clave mala, PBKDF2, `x'...'`,
  procedimiento de exportación) es conocimiento general del producto, salvo la
  presencia de `sqlcipher_export` y `sqlite3_key_v2` en el código instalado; no
  lo ejecuté.
