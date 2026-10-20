# Plan de trabajo · VIA+ como dispositivo llave en mano

> **Estado: DECIDIDO por la dirección (20/10/2026). PENDIENTE de contrastar con el organismo
> notificado.** Este documento recoge la decisión de producto y regulatoria, la separa en lo que
> ya es un hecho, lo que es un objetivo y lo que falta por verificar, y la convierte en fases con
> criterio de salida.
>
> No existía un plan de trabajo general: el único plan del repositorio era el de prosodia
> ([`design/plan-prosodia-y-asr.md`](./design/plan-prosodia-y-asr.md)), que sigue vigente para
> su alcance. Este documento es el plan **del producto**.

---

## 1. La decisión

VIA+ **sigue siendo legalmente un Software como Dispositivo Médico (SaMD) de Clase IIa** (Regla
11 del MDR 2017/745). Lo que cambia es **cómo se entrega**: cerrado y preconfigurado sobre **un
único modelo de tableta comercial (COTS)**, en modo quiosco gestionado por MDM, con la
calibración acústica de fábrica fijada en el código y el almacenamiento cifrado.

Se añade además un **motor de generación de lenguaje natural (NLG) determinista**: redacta la
síntesis narrativa del informe a partir de reglas clínicas y de matrices de evidencia, sin
ningún modelo estadístico.

```
┌────────────────────────────────────────────────────────────────────────┐
│                     DISPOSITIVO VIA+ LLAVE EN MANO                     │
│                                                                        │
│   [ Hardware COTS ]        Samsung Galaxy Tab S9 (11", IP68, AKG)      │
│   [ Capa de control ]      Samsung Knox (quiosco bloqueado, MDM)       │
│   [ Audio calibrado ]      Offset dB SPL/HL por modelo, en build-time  │
│   [ Cifrado ]              Claves en Knox Vault + SQLite cifrada       │
│                                                                        │
│   [ Software SaMD ]        VIA+ (Clase IIa · Regla 11 MDR)             │
│   [ Informes ]             Motor NLG determinista (TypeScript local)   │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Por qué esta y no otra

El argumento de más peso **no es comercial, sino metrológico**. Hoy la audiometría tonal es
**orientativa por construcción**: `src/Screens/Audiometry/audiometryCalibration.ts` corrige la
relación entre bandas con los RETSPL de campo libre (ISO 389-7), pero lo dice en su cabecera:
«esto NO es una calibración ABSOLUTA. El nivel real en el oído del niño depende del altavoz y
del volumen del dispositivo». Con cualquier tableta Android del mercado ese problema no tiene
solución. Si el transductor es siempre el mismo modelo, con el volumen y el procesado de audio
bloqueados, empieza a tenerla. Lo mismo vale para el sonómetro de sala, cuya calibración hoy la
introduce a mano el clínico (`noiseCalibrationStore.ts`).

Lo segundo es el **perímetro del expediente**. Con un solo modelo y un sistema operativo
congelado, la lista de SOUP (IEC 62304) y la superficie de ciberseguridad pasan a ser finitas y
verificables. Con «cualquier Android 10+» no lo son.

### 1.2 Lo que NO cambia

- La **finalidad prevista** y la clase: apoyo a la decisión, Clase IIa, IEC 62304 Clase B.
- La tabla «¿Qué NO hace VIA+?» del README. **El motor NLG no la relaja**: ver §4.3.
- El principio **«cero IA en el dispositivo»** del
  [ADR de inferencia](./design/adr-inferencia-en-dispositivo.md). El NLG es por reglas
  precisamente para no romperlo.
- Las reglas de trabajo de `CLAUDE.md`: nada de esto se da por hecho sin la evidencia al lado.

---

## 2. Rigor sobre la formulación: hecho, objetivo y dato por verificar

La decisión se formuló con varias afirmaciones que, tal como estaban escritas, **no se pueden
sostener todavía**. No cambian la decisión, pero sí cómo se escribe: un expediente técnico o
una presentación externa con una afirmación no demostrada vale menos que sin ella (regla 0 de
`CLAUDE.md`).

| Afirmación original | Qué es hoy | Cómo se escribe |
| --- | --- | --- |
| «Hardware **homologado**» | La tableta es un producto de consumo **sin marcado CE como producto sanitario**. Nadie la ha homologado para uso clínico | «Hardware COTS **cualificado**» o «modelo único validado». «Homologado» induce a error sobre el estado de un componente, que es lo que prohíbe el art. 7 del MDR (la misma figura que el pie del render de Lúa) |
| «Curva de calibración acústica **sellada** en el código» | **No existe.** Lo que hay es una corrección relativa por frecuencia y un sonómetro con offset manual | Objetivo de la fase F4. Exige una campaña de medida con equipo patrón (§5.4) |
| «Almacenamiento **cifrado por hardware** (Knox Vault + SQLite en reposo)» | Hoy la base `viaplus.db` **no está cifrada**, y la seudonimización no está cableada (README, *Controles de seguridad*). Knox Vault custodia **claves**, no cifra una base SQLite | Objetivo de la fase F2: SQLCipher (o equivalente) con la clave guardada en el almacén respaldado por hardware |
| «NLG en **2 milisegundos**» | **No medido.** No existe el motor | Requisito de rendimiento con un banco de medida en CI. El orden de magnitud es razonable para concatenar plantillas, pero la cifra se publica cuando se haya medido en la tableta |
| «**Cero** alucinaciones» | En sentido estricto, un motor de reglas no inventa contenido. **Sí puede** decir algo falso si una regla o un umbral están mal | «Sin generación estocástica: cada frase es trazable a una regla y a un dato medido». El riesgo residual se gestiona en ISO 14971, no se declara inexistente |
| «Auditable **al 100 %** bajo IEC 62304 Clase B» | La norma no certifica porcentajes de auditabilidad | «Cada frase del informe lleva el identificador de la regla que la produjo», y eso es verificable con tests |
| «**Sin coste** computacional» | Despreciable, no nulo | «Coste computacional despreciable, sin red y sin modelo» |
| Tab S9: IP68, altavoces AKG, Knox Vault | Especificaciones del fabricante, **no comprobadas** desde este repositorio | Verificar contra la ficha técnica y la ficha de Knox del modelo exacto (SM-X710 / SM-X716B) antes de citarlas en el expediente |

---

## 3. Objeciones y riesgos que hay que resolver antes de comprometer fechas

Ordenados por capacidad de tumbar la decisión.

1. **¿Sigue siendo SaMD o pasa a ser un sistema?** Si comercialmente se entrega software más
   tableta como un solo producto, el organismo notificado puede leerlo como un **sistema** (art.
   22 MDR) o pedir que la tableta forme parte de la documentación técnica como componente. La
   tesis de «SaMD sobre COTS» es defendible —el software es el producto; la tableta es una
   plataforma especificada—, pero **es una pregunta para el ON, no una conclusión nuestra**.
   *Dato por verificar.*
2. **Norma de audiómetros.** En cuanto la audiometría deje de ser «orientativa» y emita niveles
   calibrados, entra en juego la **IEC 60645-1** (equipos audiométricos). Hay que decidir si la
   finalidad prevista la reivindica o si la audiometría sigue declarada como **cribado** con un
   error máximo publicado. Esto condiciona el alcance de F4. *Decisión de producto pendiente.*
3. **Variabilidad entre unidades.** Un offset por **modelo** solo vale si la dispersión entre
   unidades del mismo modelo es menor que la tolerancia clínica. No lo sabemos. Si no se cumple,
   el offset tiene que ser **por unidad** (calibración en fábrica con número de serie), lo que
   cambia la logística y el coste. *Hipótesis a medir en F4.*
4. **El sistema operativo cambia el audio.** Una actualización de One UI, Dolby Atmos, el
   ecualizador adaptativo o «Sonido adaptable» alteran la respuesta del altavoz sin tocar
   una línea de VIA+. Sin **congelar el firmware** (Knox E-FOTA o equivalente) y bloquear esos
   ajustes, la calibración caduca en silencio. Que «nada pueda fallar en silencio» (regla 4)
   obliga además a que la app **compruebe** al arrancar que está en la versión de firmware
   validada y lo diga si no.
5. **Ciclo de vida del modelo.** Una tableta comercial tiene ventana de venta y de parches de
   seguridad limitada. Hay que tener desde el principio un **procedimiento de cambio de modelo**
   (nueva cualificación, nueva campaña de calibración, cambio significativo o no a efectos del
   MDR). *La ventana de soporte del Tab S9 está por verificar con Samsung.*
6. **El quiosco y la identidad del profesional.** Hoy el acceso se hace con Firebase Auth, que
   necesita red. En un dispositivo cerrado hay que decidir si el acceso sigue siendo en línea,
   pasa a local (PIN o biometría del profesional) o es mixto. Afecta a GDPR y a la operación en
   el hospital.
7. **iOS sale de la ruta comercial.** El README describe tabletas «iOS/Android» y hay un port
   SwiftUI parcial (`ios-native/`). Con un único modelo Samsung, ese port deja de estar en la
   ruta del producto. Hay que decirlo para no seguir invirtiendo en él por inercia.
8. **El estímulo verbal y las locuciones también son salida calibrada.** La audiometría verbal
   reproduce recortes normalizados a −20 LUFS (`tools/nos/`). Con un altavoz fijo, el nivel de
   presentación en dB SPL pasa a poder declararse; hoy no se puede. Entra en F4, no en otra fase.

---

## 4. Motor NLG determinista

### 4.1 De dónde se parte (hecho, comprobado con `grep` el 20/10/2026)

No se parte de cero. Ya hay **seis funciones de interpretación por reglas**, una por módulo,
puras y con tests:

| Función | Fichero |
| --- | --- |
| `interpretAudiometry` | `src/Screens/Audiometry/audiometryResult.ts` |
| `interpretVerbal` | `src/Screens/VerbalAudiometry/verbalAudiometryResult.ts` |
| `buildInterpretation` | `src/Screens/VoiceAnalysis/voiceAnalysisResult.ts` |
| `prosodyInterpretation` | `src/Screens/ProsodyAnalysis/prosodyResult.ts` |
| `interpretExecutiveFunctions` | `src/Screens/ExecutiveFunctions/executiveFunctionsGame.ts` |
| Interpretación de la disfagia | en línea en `DysphagiaTestScreen.tsx` |

Su texto acaba en el campo `interpretation` de cada entidad y de ahí en el PDF. Tres problemas
que el motor tiene que resolver, y que justifican hacerlo:

- **Están en castellano literal**, fuera del catálogo de `src/I18n/`. Un informe de una sesión en
  gallego o en euskera sale con la síntesis en castellano. `check-ui-strings.js` no lo caza
  porque solo mira los `.tsx`.
- **No hay trazabilidad**: nada dice qué regla produjo cada frase ni con qué umbral.
- **Hay lenguaje normativo** que choca con la tabla «¿Qué NO hace VIA+?». Ejemplo:
  `buildInterpretation` escribe «Parámetros acústicos dentro de los rangos normativos para voz
  infantil». Eso es interpretar un resultado como normal, que el README declara fuera de alcance.

### 4.2 Arquitectura propuesta

```
 datos medidos ──► reglas (puras, versionadas) ──► hechos con id ──► plantillas del catálogo ──► texto
  (entidad)          umbral + fuente de evidencia      «R-AUD-003»        (7 variedades)           + traza
```

- **Reglas**: funciones puras `(datos) → hecho[]`. Cada hecho lleva `ruleId`, los valores que lo
  dispararon y la referencia de la **matriz de evidencia** (umbral, fuente bibliográfica, versión).
- **Matriz de evidencia**: tabla versionada por módulo (umbral, población, fuente, nivel de
  evidencia, quién la revisó). Es documento del expediente, no solo código.
- **Plantillas**: en el catálogo de `src/I18n/`, accedidas por propiedad como el resto de la
  interfaz (patrón portado de Valeria+, regla 1). Una lengua sin plantilla **rompe `tsc`**, igual
  que hoy un catálogo incompleto.
- **Salida**: texto + traza (`ruleId[]`). La traza se guarda con el resultado y puede imprimirse
  en un anexo del informe.
- **Ensamblado de la síntesis de sesión**: un orden fijo de módulos y de hechos. Mismos datos →
  mismo texto, byte a byte.

### 4.3 Límites clínicos (no negociables)

- El motor **describe y señala**; no diagnostica ni etiqueta como normal o patológico. El
  vocabulario permitido se fija en una lista y un **gate** (test) rechaza las plantillas que
  usen términos vetados («normal», «patológico», «diagnóstico de…», «descarta»…), con excepción
  escrita y motivo, como `// i18n-exempt`.
- Cuando un dato no existe, la frase lo dice; **nunca cae en la rama favorable** (regla 4,
  caso del sonómetro).
- Recomendaciones de derivación: solo las que ya existen hoy y con su umbral en la matriz
  (por ejemplo, la derivación a ORL/audiología de `interpretVerbal`). Ninguna nueva sin revisión
  clínica firmada.
- Cada plantilla nueva o modificada pasa por **revisión clínica** en cada lengua, igual que las
  locuciones. El acta queda en el repositorio.
- Encuadre regulatorio: un sistema de reglas definido íntegramente por personas queda,
  previsiblemente, fuera de la definición de «sistema de IA» del Reglamento (UE) 2024/1689. Es una
  **inferencia**, no una conclusión: se añade al ADR y se contrasta con el ON.

### 4.4 Criterios de verificación

- **Tests de oro** (*golden*) por módulo y por lengua: entrada fija → texto exacto esperado.
- **Determinismo**: la misma entrada, dos ejecuciones, misma salida y misma traza.
- **Cobertura de reglas**: cada `ruleId` tiene al menos un test que lo dispara y otro que no.
- **Rendimiento**: banco de medida en CI (Node) y medida en la tableta. El objetivo de «del orden
  de milisegundos» se publica **con el número medido y el dispositivo**, no antes.
- **Gate de léxico** dentro de `npx jest`, para que entre en la lista de gates locales existente.

---

## 5. Fases

Cada fase tiene un **criterio de salida** que es evidencia, no actividad. «Escrito» no es
«hecho» (regla 8): lo nativo que no se pueda compilar desde aquí se entrega diciendo que no se
ha compilado.

### F0 · Ratificar la decisión (bloquea F3–F5)

- Consulta previa al **organismo notificado**: SaMD sobre COTS frente a sistema; papel de la
  tableta en la documentación técnica; si la audiometría reivindica IEC 60645-1.
- Decidir si el producto declara la audiometría como **cribado con error máximo publicado** o
  como audiometría calibrada.
- Fijar el **modelo exacto** (referencia comercial, variante Wi-Fi/5G, región) y pedir a Samsung
  la ventana de soporte y la disponibilidad de Knox (licencias, E-FOTA).
- **Salida:** acta de la consulta con el ON y modelo exacto registrado en este documento.

### F1 · Motor NLG determinista (solo software; puede empezar ya)

- Extraer las seis funciones a un módulo `src/Reports/` (nombre provisional) con el contrato de
  §4.2, **sin cambiar ningún texto** en un primer paso, y con los tests actuales en verde.
- Mover las plantillas al catálogo de `src/I18n/` y añadir la traza.
- Corregir las frases normativas (empezando por la de voz) con revisión clínica.
- Gate de léxico, tests de oro, banco de rendimiento.
- Matriz de evidencia por módulo en `docs/design/`.
- **Salida:** los gates de `CLAUDE.md` §2 en verde; tests de oro de los módulos con
  interpretación en las cuatro lenguas completas (es · gl · eu · es-DO); acta de revisión clínica
  de las plantillas.

### F2 · Cifrado en reposo y seudonimización (solo software; puede empezar ya)

- Cifrado de `viaplus.db` (SQLCipher o equivalente compatible con `react-native-nitro-sqlite`;
  la compatibilidad **está por verificar** y es lo primero que se mira).
- Clave generada en el dispositivo y guardada en el **Android Keystore respaldado por hardware**
  (que en el modelo elegido debería apoyarse en Knox Vault: *por verificar*).
- Cablear el HMAC-SHA256 del NHC y el AES-256-GCM de `nameEnc`/`dobEnc`, hoy en claro.
- Migración de bases existentes y fallo **visible** si la clave no se puede abrir (regla 4).
- **Salida:** test que demuestra que el fichero en disco no contiene el nombre en claro; la
  política de privacidad (`site/privacidad.html`) solo se actualiza después.

### F3 · Plataforma: quiosco y MDM

- Perfil Knox (Knox Configure o Knox Manage; elegir según licencias de F0): quiosco de una sola
  app, ajustes bloqueados, sin tienda, depuración USB desactivada.
- **Firmware congelado** (E-FOTA o equivalente) y procedimiento controlado de actualización.
- Audio bloqueado: volumen fijo, Dolby Atmos y ecualizador desactivados, sin «Sonido adaptable».
- Distribución del APK por Managed Google Play o por el MDM, no por la ficha pública.
- **Comprobación en arranque** (nueva, en `@/Startup` y en «Comprobar audio»): modelo, versión de
  firmware y estado de los ajustes de audio contra los validados. Si no coinciden, la app lo dice
  y las pruebas calibradas quedan bloqueadas o marcadas como orientativas.
- **Salida:** perfil versionado en el repositorio (exportado del MDM) y comprobación de arranque
  con tests.

### F4 · Calibración acústica de fábrica

- Campaña de medida con **sonómetro patrón clase 1** (IEC 61672) en cámara o sala tratada:
  respuesta del altavoz por frecuencia y nivel, a la distancia y ángulo del protocolo.
- Medir **N unidades** del mismo modelo para cuantificar la variabilidad entre unidades (N y
  tolerancia a fijar con audiología). Decide si el offset es por modelo o por unidad (§3.3).
- Lo mismo para el **micrófono** del sonómetro de sala: la calibración de campo actual
  (`via.noise.calibrationOffsetDb`) pasa a valor de fábrica, y la pantalla de calibración pasa
  de **ajustar** a **verificar** (o queda tras un rol de servicio técnico).
- Las constantes van a un módulo de calibración **generado** a partir de las actas de medida, con
  gate `--check` como los de Lúa y de las ilustraciones: el número en el código no se edita a mano.
- Comprobación periódica en el centro (frecuencia a fijar con el ON) y su registro.
- **Salida:** actas de medida firmadas, módulo generado y gate en CI. Hasta entonces, los avisos
  de «orientativo» del PDF **no se quitan**.

### F5 · Expediente técnico

- Lista de SOUP (IEC 62304): Android/One UI de la versión congelada, Knox, librerías nativas.
- Gestión de riesgos (ISO 14971): el expediente pendiente en `docs/risk-management/`, ahora con
  los modos de fallo de la plataforma (actualización no controlada, deriva de calibración, fallo
  de apertura de la clave) y del NLG (regla errónea, plantilla mal traducida).
- Ciberseguridad (MDCG 2019-16): la superficie es el perfil Knox de F3.
- Ingeniería de usabilidad (IEC 62366-1): el quiosco cambia el flujo de arranque y de acceso.
- **Salida:** documentos en el repositorio, enlazados desde el README.

### F6 · Verificación en dispositivo y piloto

- Recorrer **los trece módulos** de principio a fin **en la tableta elegida**, no en el emulador.
  Hoy ningún módulo clínico se ha recorrido entero en dispositivo (ver `CLAUDE.md`, *Pendiente*).
- Piloto en el **Hospital Ribera Polusa (Lugo)** con el dispositivo cerrado: telemetría Zero-PHI
  de usabilidad y registro de incidencias.
- **Salida:** informe del recorrido y del piloto.

### Dependencias

```
F0 ─┬─► F3 ─► F4 ─┐
    │             ├─► F5 ─► F6
F1 ─┤             │
F2 ─┴─────────────┘
```

F1 y F2 no dependen de la tableta ni del ON y **son el siguiente paso de mayor valor**: cierran
dos huecos que el README ya declara abiertos (síntesis no traducida y base de datos sin cifrar),
y valen igual si F0 obligara a cambiar de modelo.

---

## 6. Preguntas abiertas para la dirección

1. ¿La audiometría del producto final es **cribado** (con error máximo publicado) o
   **audiometría calibrada** con IEC 60645-1? Cambia el alcance de F4 entero.
2. ¿Modelo exacto: Wi-Fi o 5G? (El 5G añade módem y otra superficie de red en un quiosco que
   quizá no la necesite.)
3. ¿Acceso del profesional en línea (Firebase), local o mixto dentro del quiosco?
4. ¿Se congela el port iOS (`ios-native/`)?
5. ¿Quién firma las plantillas del NLG en cada lengua: los mismos equipos que firmaron las
   locuciones (ACOPROS, Ulertuz, Quisqueya Habla)?

---

## 7. Lo que este documento no afirma

- Que la tableta, el perfil Knox, el cifrado o la calibración **existan** hoy: no existen.
- Que el ON acepte el encuadre «SaMD sobre COTS»: no se le ha preguntado.
- Ninguna cifra de rendimiento del NLG: no se ha medido.
- Ninguna especificación del Tab S9: se cita del fabricante y está por verificar.
