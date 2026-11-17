# Guion de recorrido en el emulador · VIA+ (paquete G1)

- **Fecha:** 17/11/2026.
- **Escrito sobre el commit:** `2e1e918` (rama `main`, sin cambios de código posteriores).
- **Estado: borrador SIN aprobar por Frank.** No lo he ejecutado, ni he visto la app: no hay SDK de
  Android en las sesiones de Claude (regla 8 de `CLAUDE.md`). Todo lo que dice «debe verse» es **lo
  que el código indica**, no lo que se ha visto. Si el emulador muestra otra cosa, el hallazgo es
  esa diferencia: anótala con la plantilla del §6.
- **Fuente de verdad:** el código (`src/Navigators/Default.tsx`, `src/Screens/**`,
  `src/Navigators/finishModule.ts`, `src/PDF/reportFile.ts`) y el catálogo `src/I18n/strings.es.ts`.
  Cuando el README o el manual dicen otra cosa, manda el código y la diferencia está en el §7.

## Cómo leer este guion

- Cada paso es una casilla: `- [ ] M5.3 ...`. El identificador (`M5.3`) es lo que citas en la
  plantilla de fallo. `M5` es el bloque, `3` el paso.
- Los textos entre «comillas» son los que salen en pantalla, copiados de `strings.es.ts` con la clave
  entre paréntesis la primera vez que aparecen. El signo **†** marca un texto que **no** está en el
  catálogo: es literal en el `.tsx` o en un `.ts` de datos (los títulos de las tarjetas del hub, los
  textos del consentimiento, muchos avisos emergentes). Esos se citan del código tal cual.
- **Anotar:** es lo que hay que capturar aunque todo vaya bien. Un paso que sale como se esperaba
  también es un dato: es lo que hasta hoy no existe, porque ningún módulo se ha recorrido entero.
- **Emulador:** marca los módulos o pasos que el emulador no puede ejercer de verdad. Que fallen ahí
  **no es una avería** (regla 7 de `CLAUDE.md`); anótalo como «limitación del emulador» y sigue.

### Los trece módulos

Los «trece» del README, del manual y de la constelación de Créditos son: el CAP, el sonómetro de sala
y **once tarjetas** de la parrilla de `SeleccionEjercicios`. Es decir: la parrilla tiene **11**
tarjetas, no 13 (`src/Screens/SeleccionEjercicios/moduleCards.ts`). El CAP y el sonómetro se abren con
botones de la cabecera del hub y como pasos obligatorios del alta. Este guion los recorre como `M1` a
`M13`.

| Bloque | Módulo | Ruta |
| --- | --- | --- |
| M1 | CAP · Evaluación Clínica Previa | `ClinicalAssessment` |
| M2 | Sonómetro de sala | `RoomNoiseCheck` |
| M3 | Audiometría Infantil | `Audiometry` |
| M4 | Audiometría Condicionada (El Tren del Sonido) | `AudiometryConditioned` |
| M5 | Audiometría Verbal | `VerbalAudiometry` |
| M6 | Análisis Acústico de Voz | `VoiceAnalysis` |
| M7 | Análisis Prosódico | `ProsodyAnalysis` |
| M8 | Articulación · T.A.R. | `Articulation` |
| M9 | Funciones Ejecutivas | `ExecutiveFunctions` |
| M10 | Cuestionario Autismo (M-CHAT-R/F) | `Mchat` |
| M11 | Cribado SAHS Infantil | `SahsScreening` |
| M12 | Exploración de Disfagia | `DysphagiaTest` |
| M13 | Hitos del Lenguaje ASHA (Percentil 75) | `AshaScreening` |

## 1. Preparación

El emulador es el de Android Studio (regla 7). Estas tres cosas cambian lo que verás:

- **Formato de pantalla.** La referencia de diseño es la tableta (README). El hub reparte la parrilla
  en 4 columnas desde 980 dp de ancho, 2 desde 680 dp y 1 por debajo
  (`src/Screens/SeleccionEjercicios/seleccionLayout.ts`). Un AVD de teléfono es un recorrido válido
  pero distinto; el README dice que los trece módulos **no** se han recorrido en teléfono. Anota qué
  AVD usas (modelo, API, orientación).
- **Micrófono.** El emulador solo entrega audio real si, en sus controles extendidos, el micrófono
  virtual usa la entrada del ordenador. Sin eso, o con la entrada silenciada, M2, M6, M7 y M8 verán
  silencio. Anota el estado de ese ajuste antes de empezar. *No lo he comprobado aquí.*
- **Reconocimiento de voz del T.A.R.** Exige API 33 y el modelo de la lengua descargado; las imágenes
  de AVD no lo traen (`CLAUDE.md` § Zero-PHI). En el emulador la puerta está cerrada **por diseño**.

Pasos:

- [ ] P1 Instala el APK de release (o la compilación que vayas a probar) en un AVD limpio, con los
  datos de la app borrados. Anota: hash o nombre del APK, AVD, API, ancho en dp.
- [ ] P2 Pon el volumen de multimedia del emulador a un nivel audible y comprueba que no está en
  silencio.
- [ ] P3 Abre la app. Debe verse la pantalla de bienvenida. Si no abre, la app debe mostrar el fallo
  de arranque en pantalla (`@/Startup`, regla 4): captura el mensaje y la pila **antes** de seguir.
  Anota: lo que dice.
- [ ] P4 Idioma: la app arranca en castellano (`es` es el valor inicial de `localeSlice`). Déjalo
  así para este recorrido. El selector de idioma («Idioma de la aplicación», `langPicker.title`) está
  **solo en la cabecera de Créditos**, no en el hub.
- [ ] P5 **«Comprobar audio» primero.** La pantalla solo se abre desde el hub
  (`SeleccionEjercicios`): no hay otra puerta. Por eso este paso se hace **al llegar al hub por
  primera vez** (§2, paso A9d), antes de abrir ningún módulo, y no antes del alta. Qué hacer ahí:
  pulsa «Comprobar audio» (`seleccionEjercicios.comprobarAudio`), luego «Iniciar comprobación»
  (`diagnosticoAudio.iniciarComprobacion`) y, en «Prueba de escucha» (`diagnosticoAudio.pruebaEscucha`),
  reproduce las cuatro emisiones y contesta «¿Lo ha oído?» (`diagnosticoAudio.haOido`) a cada una:
  tono de prueba, palabra de la audiometría verbal, locución empaquetada y voz del sistema †.

**Qué anotar de «Comprobar audio»** (`CLAUDE.md` § Pendiente pide preguntárselo a Frank antes de tocar
más la capa de audio):

| Eslabón | Anota |
| --- | --- |
| «Reloj del hardware de salida» (`output-clock`) | El estado (verde, aviso o fallo) y el texto **completo** del detalle. Importa si dice que el motor estaba muerto y «se ha reabierto», o si salió verde de primeras: de eso depende si la causa del build mudo del 2/9 está demostrada o sigue suelta |
| «Locución real del sintetizador» (`tts-speak`) | Los **dos tiempos** que traiga el detalle: «arrancó a los X» y el total en segundos. Si dice «dictó la frase de prueba completa en N s», se cierra la duda del plazo corto. Si dice «arrancó… y no confirmó el final en 9,6 s» **y la frase sí se oyó entera**, el motor emite y no cierra la locución |
| Las cuatro escuchas | Para cada una: ¿se oyó? ¿Qué botón pulsaste? El titular final debe decir «SALIDA NO COMPROBADA» mientras falte alguna |
| Resto de eslabones | «Motor de audio nativo», «Contexto de salida (altavoz)», «Banco de locuciones», «Recortes de la audiometría verbal», «Sintetizador de voz del sistema», «Permiso de micrófono», «Captura real del micrófono» y «Reconocimiento de voz (T.A.R.)»: estado de cada uno |

- [ ] P6 Cuando termine la comprobación, **captura el bloque «Resumen para incidencia»**
  (`diagnosticoAudio.resumenIncidencia`). La propia pantalla lo pide («Haga una captura de este bloque
  y adjúntela»).
- [ ] P7 Anota si «Reconocimiento de voz (T.A.R.)» sale en aviso o fallo. En el emulador **es lo
  esperado** (no es avería): el motivo debe decir que falta API 33 o el modelo.

## 2. Alta del profesional y del paciente, consentimiento

Ruta: Bienvenida, Créditos, Lúa, Selección de profesional, Registro de profesional, Pacientes,
Registro de paciente, Consentimiento, CAP, Sonómetro, hub (`Default.tsx`).

### 2.1 Entrada y profesional

- [ ] A1 En Bienvenida pulsa «Comenzar Exploración» (`bienvenida.comenzarExploracion`). Lleva a
  Créditos («Créditos y Avales», `credits.navTitle`).
- [ ] A2 En Créditos pulsa «Conocer a Lúa» (`credits.dockButton`). Lleva a «Lúa · Mascota y
  Periférico» (`luaIntro.navTitle`). Anota: nada de esta pantalla debe afirmar que el aparato esté
  conectado (`luaIntro.bleDesc` dice que la conexión no está disponible en esta versión).
- [ ] A3 En Lúa pulsa «Comenzar Selección Profesional» (`luaIntro.dockButton`). Lleva a «¿Quién va a
  evaluar hoy?» (`seleccionProfesional.quienVaEvaluarHoy`). En un AVD limpio debe decir «Aún no hay
  profesionales en este dispositivo. Registra tu perfil para comenzar.»
  (`seleccionProfesional.aunHayProfesionalesEsteDispositivo`).
- [ ] A4 Pulsa «Registrar nuevo profesional» (`seleccionProfesional.registrarNuevoProfesional`).
  Lleva a «Crea tu perfil» (`registroProfesional.creaTuPerfil`).
- [ ] A5 Rellena los cuatro obligatorios (el contador dice «n/4 obligatorios»,
  `registroProfesional.n4Obligatorios`): nombre y apellidos, rol, email con formato válido,
  contraseña de **6 o más** caracteres («Mínimo 6 caracteres», `registroProfesional.minimo6Caracteres`).
  **Rellena también «Nº colegiado · opcional»** (`registroProfesional.nColegiadoOpcional`): si lo
  dejas vacío, casi todos los módulos traerán el «Colegiado» vacío y su botón de guardar quedará
  deshabilitado (ver la tabla del §3). Eso no es un fallo, es el efecto de dejarlo en blanco.
- [ ] A6 Pulsa «Guardar y continuar» (`registroProfesional.guardarContinuar`). Debe verse el aviso
  «Registro completado» (`registroProfesional.registroCompletado`) con «Bienvenido/a, <nombre>.» y la
  app aterriza en **Pacientes** sin que pulses nada más (el navegador cambia de grupo al abrir
  sesión).
- [ ] A7 Contraseña (prueba de la contraseña local): pulsa «Cerrar sesión»
  (`pacientes.cerrarSesion`), vuelve a la lista de profesionales, toca tu perfil, escribe una
  contraseña **incorrecta** y pulsa «Acceder →» (`seleccionProfesional.acceder`): debe decir
  «Contraseña incorrecta.» (`seleccionProfesional.contrasenaIncorrecta`). Escribe la correcta: debe
  entrar en Pacientes. Anota cuánto tarda el «Acceder →» (el coste de las 10 000 iteraciones PBKDF2
  en Hermes **no está medido**, `CLAUDE.md`).

Anotar de A1 a A7: si algún botón no responde; los tiempos de A6 y A7; cualquier pantalla en blanco.

### 2.2 Paciente y consentimiento

- [ ] A8 En Pacientes («Pacientes», `pacientes.pacientes`) pulsa «Nuevo paciente»
  (`pacientes.nuevoPaciente`). Lleva a «Nuevo paciente» (`registroPaciente.nuevoPaciente`). Rellena:
  nombre, apellidos, fecha de nacimiento en formato `AAAA-MM-DD` y **no futura**
  (`registroPaciente.aaaaMmDd`), sexo (Femenino / Masculino / Otro †) y NHC. Debe cambiar «Edad»
  (`registroPaciente.edad`) y contar «n/4 campos obligatorios completados». **Usa un niño de unos 4
  años** (para que encajen M3 a M12): por ejemplo, una fecha de hace 4 años. Para ASHA y M-CHAT ver
  los avisos de edad en M10 y M13.
- [ ] A9a Pulsa «Continuar al consentimiento» (`registroPaciente.continuarConsentimiento`). Debe verse
  «Paciente: <nombre>» y «Consentimiento informado» (`consentimiento.consentimientoInformado`) con la
  etiqueta «OBLIGATORIO». Un paciente menor debe ofrecer solo la opción de firmar «Padre/Madre/Tutor» †.
- [ ] A9b Rellena el nombre de quien firma («Nombre completo», `consentimiento.nombreCompleto`) y la
  relación con el paciente (`consentimiento.relacionPaciente`; las sugerencias del código son
  «Madre», «Padre» y «Tutor/a legal» †), marca las dos casillas de declaración †, dibuja una firma
  con el dedo o el ratón («Firma», `consentimiento.firma`) y pulsa «Firmar y continuar al CAP»
  (`consentimiento.firmarContinuarCap`). Anota: si el trazo de la firma se dibuja bien con el ratón
  del emulador y si el botón se habilita solo con firma **y** las dos casillas.
- [ ] A9c Vuelve atrás y reabre el consentimiento (desde Pacientes, abriendo el paciente de nuevo):
  si ya hay uno firmado, debe decir «Consentimiento ya firmado» (`consentimiento.consentimientoYaFirmado`)
  con «Firmado por» (`consentimiento.firmado`) y un botón «Continuar» (`consentimiento.continuar`).
  Este es el dato que el PDF debe reflejar (§5, T3).
- [ ] A9d Pantalla de cierre del alta: tras A9b la app lleva al CAP (M1), luego al sonómetro (M2) y de
  ahí al hub. Aquí **haz «Comprobar audio» (P5, P6, P7)** en cuanto estés en el hub, antes de elegir
  ningún módulo.

Anotar: el texto exacto de los avisos si algún paso se bloquea; si el hub muestra al llegar la línea
de estado de la sala según lo hecho en M2 (§3, M2.7).

## 3. Un bloque por módulo

**Cómo llegar a un módulo de la parrilla (válido de M3 a M13).** En el hub, filtra si quieres por
categoría («Todas», «Pruebas auditivas», «Voz», «Neurodesarrollo», «Sueño», «Disfagia» †), toca la
tarjeta (queda numerada en la cola; la línea de abajo dice «n pruebas en cola»,
`seleccionEjercicios.pruebaCola`) y pulsa el botón de abajo: «Iniciar prueba» † con una sola tarjeta,
«Iniciar batería (n pruebas)» † con varias, «Selecciona pruebas» † si no hay ninguna (deshabilitado).
«Limpiar» (`seleccionEjercicios.limpiar`) vacía la cola. **Para este recorrido selecciona UN módulo cada
vez** (el motivo está en §7, discrepancia 2).

**Cómo termina cada módulo (todos).** Al guardar sale un aviso de éxito y la app **reemplaza** la
pantalla del módulo por «Resultados preliminares» (`finishModule`: `navigation.replace`). Debe verse
«Sesión de Evaluación» (`resultadosPreliminares.sesionEvaluacion`) con la tarjeta del módulo recién
guardado y, abajo, «Volver a pruebas» (`resultadosPreliminares.volverPruebas`) y «Ver Informe
Detallado» (`resultadosPreliminares.verInformeDetallado`). Al pulsar atrás **no** debe volver al
formulario ya guardado, sino al hub. Esto se comprueba en el último paso de cada bloque.

**Dónde pide «Colegiado».** Los módulos copian nombre y colegiado del profesional con sesión abierta.

| Módulo | Guardar exige |
| --- | --- |
| M1 CAP, M3, M4, M5, M6, M8, M9, M10, M11, M12 | Nombre **y** colegiado no vacíos |
| M7 Prosodia | Solo el nombre del explorador |
| M13 ASHA | Nada: si los dejas vacíos guarda con el nombre del profesional de la sesión o «Profesional Clínico» y «N/A» † |

### M1 · CAP · Evaluación Clínica Previa

Cómo se llega: tras firmar el consentimiento (A9b), o desde el hub con «Volver al CAP»
(`seleccionEjercicios.volverCap`). Título de pantalla: «Evaluación Clínica Previa»
(`clinicalAssessment.evaluacionClinicaPrevia`), con la etiqueta «PRERREQUISITO CLÍNICO · CAP».

- [ ] M1.1 Debe verse «Paciente: <nombre>» (`clinicalAssessment.paciente`) con el NHC.
- [ ] M1.2 «Dominio 1 · Otoscopia Clínica»: elige un hallazgo para «Oído Derecho (OD)» y para «Oído
  Izquierdo (OI)» entre Normal, Cerumen, OMA, OME, Perforación, DTT y Otro †. Prueba también que
  Cerumen u OMA u Perforación en **ambos** oídos marcan el dominio como bloqueo.
- [ ] M1.3 «Dominio 2 · Capacidad Visual Mínima»: contesta los cuatro ítems V-01 a V-04 †.
- [ ] M1.4 «Dominio 3 · Capacidad Verbal Mínima»: en «GRUPO DE EDAD DEL PACIENTE:» elige el grupo
  (A 18 m a 2 a 11 m, B 3 a a 4 a 11 m, C 5 años y mayores †) y contesta los tres ítems del grupo.
- [ ] M1.5 «Dominio 4 · Capacidad Motora Mínima»: contesta los cuatro ítems M-01 a M-04 †.
- [ ] M1.6 «Perfil de Aptitud y Gating de Pruebas» (`clinicalAssessment.perfilAptitudGatingPruebas`):
  debe aparecer el «VEREDICTO CLÍNICO GLOBAL» (`clinicalAssessment.veredictoClinicoGlobal`) como APTO ·
  COMPLETO, APTO PARCIAL o NO APTO †, y la lista de cinco juegos habilitados o bloqueados (J01 a J05 †).
  Cambia respuestas y comprueba que el veredicto cambia.
- [ ] M1.7 «Profesional Evaluador Responsable» (`clinicalAssessment.profesionalEvaluadorResponsable`):
  nombre y «Nº Colegiado». Pulsa «Confirmar y Generar CAP» (`clinicalAssessment.confirmarGenerarCap`).
- [ ] M1.8 Debe verse el aviso «CAP generado» † y la app va al sonómetro (M2). Aquí **no** aterriza en
  Resultados preliminares: el CAP no usa `finishModule`.
- [ ] M1.9 Prueba el atajo «Ir directo a exploración de disfagia»
  (`clinicalAssessment.irDirectoExploracionDisfagia`): debe abrir M12 sin pasar por el sonómetro.
  Vuelve atrás sin guardar nada.

Anotar: el veredicto con **todo vacío** (el código solo exige nombre y colegiado para guardar, así que
puede guardarse un CAP sin responder ningún dominio: dilo si ocurre); si un veredicto «NO APTO» aun así
deja continuar al sonómetro y al hub.

**Emulador:** sin limitaciones. Es un formulario.

### M2 · Sonómetro de sala

Cómo se llega: tras el CAP, o desde el hub con «Sonómetro de sala»
(`seleccionEjercicios.sonometroSala`). Título: «Sonómetro Ambiental» (`roomNoise.sonometroAmbiental`).

- [ ] M2.1 Debe verse «MICRÓFONO INACTIVO» (`roomNoise.microfonoInactivo`) y el veredicto «PENDIENTE» †.
- [ ] M2.2 Pulsa «Activar micrófono» (`roomNoise.activarMicrofono`). Si pide permiso de micrófono,
  concédelo. El medidor debe moverse con el audio del emulador.
- [ ] M2.3 Pulsa «Medir 5 s» (`roomNoise.medirS`, con 5 como parámetro). Al terminar debe dar uno de
  «SALA APTA», «RUIDO LIMÍTROFE» o «DEMASIADO RUIDO» †, con LAeq, fondo L90 y picos L10 †. El umbral
  por defecto es ≤ 45 dB(A).
- [ ] M2.4 Marca los cuatro requisitos † (puertas y ventanas, sin conversaciones, climatización y
  equipos apagados, móviles silenciados). El botón «Continuar a los ejercicios»
  (`roomNoise.continuarEjercicios`) solo debe habilitarse con veredicto «SALA APTA» **y** las cuatro
  casillas.
- [ ] M2.5 Si el emulador no da «SALA APTA», pulsa «Saltar el sonómetro e ir a las pruebas»
  (`roomNoise.saltarSonometroEIrPruebas`). Debe llevar al hub **sin** marcar la sala como apta.
- [ ] M2.6 (opcional) «CALIBRACIÓN DE CAMPO» (`roomNoise.calibracionCampo`): escribe un valor en «dB(A)
  del patrón» y pulsa «Ajustar». No hay sonómetro patrón en el emulador: solo comprueba que no
  revienta.
- [ ] M2.7 En el hub, la línea de estado de la sala debe corresponder a lo hecho: «Sala verificada ·
  sonómetro OK», «Sala en el límite · repita la medición», «Sala DEMASIADO RUIDOSA · pruebas auditivas
  no válidas», «Sala sin verificar · sonómetro omitido» o «Sala sin medir · ejecute el sonómetro» †.
  Prueba el caso peligroso: mide con «DEMASIADO RUIDO», vuelve atrás con el botón del sistema y
  comprueba que el hub **no** dice «Sala verificada» (regla 4, `roomNoise.test.ts`).

Anotar: el veredicto, los tres números y la fuente («Micrófono en vivo» o «Micrófono no disponible» †).

**Emulador:** el micrófono. Si el emulador entrega silencio o ruido sintético, el veredicto no dice
nada de una sala real. Un «SALA APTA» en el emulador **no** es una verificación acústica. Además el
propio texto de la pantalla dice que la lectura «no sustituye a un sonómetro patrón»
(`roomNoise.dbRuidoFondoLecturaPonderacion`).

### M3 · Audiometría Infantil

Tarjeta †: «Audiometría Infantil», 8–10 min, 2–6 años, categoría «Pruebas auditivas». Título de
pantalla: «Audiometría infantil» (`audiometry.audiometriaInfantil`), «JUEGO DE TONOS».

- [ ] M3.1 En «Oído» (`audiometry.oido`) elige OD u OI, en «Estímulo» (`audiometry.estimulo`) una
  frecuencia (500, 1000, 2000 o 4000 Hz) y en «Intensidad · dB HL» (`audiometry.intensidadDbHl`) un
  nivel (20 a 80 dB en pasos de 10).
- [ ] M3.2 Pulsa «Emitir» (`audiometry.emitir`). **Debe sonar un tono** y verse «SONANDO…»
  (`audiometry.sonando`). Anota si suena y por dónde (altavoz del emulador).
- [ ] M3.3 Con el tono sonando, toca el instrumento que corresponde a la frecuencia (Tambor 500, Piano
  1000, Campana 2000, Flauta 4000 †). Debe animarse la celebración y contar como respuesta. Con el
  instrumento equivocado no debe contar.
- [ ] M3.4 Prueba también los botones «Sí respondió» (`audiometry.respondio`) y «No respondió»
  (`audiometry.respondio2`) y el panel que explica el protocolo («HUGHSON-WESTLAKE» †: «Sí» baja 10,
  «No» sube 5, el umbral se confirma con 2 respuestas).
- [ ] M3.5 Confirma al menos un umbral por oído. El «Audiograma clínico» (`audiometry.audiogramaClinico`)
  y la tabla «Umbrales registrados · dB HL» deben llenarse, y «PTA OD», «PTA OI» y «FIABILIDAD» deben
  calcularse.
- [ ] M3.6 Prueba los controles de «control» «Ambulancia» y «Tren» †: no son tonos y no deben contar
  como umbral.
- [ ] M3.7 «Evaluador responsable»: nombre y colegiado; escribe unas «Observaciones clínicas…»
  (`audiometry.observacionesClinicas`). Pulsa «Guardar audiometría» (`audiometry.guardarAudiometria`).
- [ ] M3.8 Debe verse el aviso «Audiometría guardada» † con los PTA y la app aterriza en Resultados
  preliminares con la tarjeta «Audiometría Infantil» †. Pulsa atrás: debe ir al hub.

Anotar: si suena; ¿cuántos tonos se oyen **a nivel muy bajo** (20 dB)? Eso es intensidad física
sin calibrar, no dB HL; la propia cabecera de `audiometryCalibration.ts` dice que es calibración
**relativa** entre bandas, no absoluta.

**Emulador:** el sonido es real (Oboe), el nivel **no está calibrado** y sale por un altavoz virtual.
La separación OD/OI es de paneo: sobre el altavoz del emulador no distingue oídos. No lo apuntes como
avería; sí anota si el tono suena o no.

### M4 · Audiometría Condicionada (El Tren del Sonido)

Tarjeta †: «Audiometría Condicionada (El Tren del Sonido)». Pantalla: «El Tren Mágico de Lúa»
(`audiometryConditioned.trenMagicoLua`), «CPA INFANTIL». Es autónoma: la hace el niño; el clínico mira.

- [ ] M4.1 Debe verse una introducción «¿Cómo jugamos?» (`audiometryConditioned.comoJugamos`) con
  cuatro pasos (Prepara la sala, Escucha con Lúa, Toca la pantalla, ¡Recoge a los amigos! †). Si el
  motor de audio no está, dice «Motor de audio no disponible. Reinicie la aplicación antes de realizar
  la prueba.» (`audiometryConditioned.motorAudioDisponibleReinicieAplicacion`): captúralo.
- [ ] M4.2 Pulsa «¡Empezar a jugar!» (`audiometryConditioned.empezarJugar`). Fase de práctica:
  «Práctica — Aprende la magia». Cuando suene la música y salga «¡TOCA LA PANTALLA!», toca el botón
  grande; hacen falta dos aciertos para pasar («¡Genial! Ya estás listo para el gran viaje…»).
  Prueba **una vez** a tocar sin que suene nada: debe salir un aviso suave, no un fallo.
- [ ] M4.3 «El Gran Viaje de las 4 Estaciones» (`audiometryConditioned.granViaje4Estaciones`): la
  prueba corre sola. Responde tocando a algunos sonidos y deja pasar otros. Prueba «Pausar» y
  «Reanudar» (`audiometryConditioned.pausar`, `audiometryConditioned.reanudar`) y «Reiniciar»
  (`audiometryConditioned.reiniciar`). Abre el «PANEL CLÍNICO ·» (`audiometryConditioned.panelClinico`)
  y comprueba que muestra los umbrales «n/4 confirmados».
- [ ] M4.4 Al final debe verse «¡Gran Viaje Completado!» (`audiometryConditioned.granViajeCompletado`),
  con «n/4 umbrales confirmados · Fiabilidad», el «Audiograma de cribado» y «Campo libre (binaural)».
  Con muchos umbrales sin respuesta puede salir «Indicios de hipoacusia — Derivación recomendada»
  (`audiometryConditioned.indiciosHipoacusiaDerivacionRecomendada`): anota con qué recorrido.
- [ ] M4.5 «Evaluador responsable»: nombre, colegiado, observaciones. «Guardar audiometría»
  (`audiometryConditioned.guardarAudiometria`).
- [ ] M4.6 Debe aterrizar en Resultados preliminares con la tarjeta «Audiometría Condicionada» † y
  métrica «Campo libre … dB HL» †. Atrás: al hub.

Anotar: cuántos minutos dura la prueba entera; si el tren avanza al tocar; si suena la música/tono; si
la vibración o la animación dan problemas; la tarjeta con la que aterriza.

**Emulador:** sin vibración real. El sonido es el mismo que en M3, sin calibrar.

### M5 · Audiometría Verbal

Tarjeta †: «Audiometría Verbal». Pantalla: «Audiometría verbal» (`verbalAudiometry.audiometriaVerbal`),
«CAMPO LIBRE · SIN AUDÍFONOS». Tres fases: preparación, juego, resultados.

- [ ] M5.1 Preparación: en «¿Qué edad tiene el paciente?» (`verbalAudiometry.edadTienePaciente`) elige
  banda: «Solo imágenes» (< 4 años), «Imagen + palabra» (4–5), «Mixto · pares mínimos» (6–8) o «Solo
  palabras» (9 años – adulto) †. Revisa «Lengua de la prueba» (`verbalAudiometry.lenguaPrueba`): debe
  poner castellano. Abre «Opciones avanzadas» (`verbalAudiometry.opcionesAvanzadas`): «Modo»
  (Discriminación, Umbral · URV †) y «Nivel de presentación».
- [ ] M5.2 Si el motor de audio no está: «Motor de audio no disponible: modo demostración (presente el
  modelo con su voz).» (`verbalAudiometry.motorAudioDisponibleModoDemostracion`). Anótalo.
- [ ] M5.3 Pulsa «Empezar la prueba» (`verbalAudiometry.empezarPrueba`). Primero hay láminas de
  práctica («Vamos a practicar», `verbalAudiometry.vamosPracticar`). En cada lámina **la palabra debe
  sonar sola** («Escucha…», «Atento, va a sonar una palabra»); toca la tarjeta correcta
  («¿Cuál has oído? Toca su tarjeta»). La pantalla avanza sola. Prueba también el altavoz para oírla
  otra vez («Toca el altavoz para oírla otra vez (n restantes)»).
- [ ] M5.4 Contesta con aciertos y fallos mezclados. Con un fallo debe resaltarse la tarjeta correcta.
- [ ] M5.5 Al terminar: «¡Juego terminado, muy bien!» (`verbalAudiometry.juegoTerminadoMuyBien`) y
  después la hoja «Resultados» (`verbalAudiometry.resultados`) con «Marcador de la prueba»,
  «DISCRIMINACIÓN», «ACIERTOS», «FIABILIDAD» y, si usaste ayudas, «repeticiones de ayuda».
- [ ] M5.6 Prueba «Nueva prueba» (`verbalAudiometry.nuevaPrueba`) y una segunda pasada a otro nivel
  («Más pasadas», «▶ Pasada a»). Anota si se conservan los resultados por nivel.
- [ ] M5.7 «Evaluador responsable» y «Guardar audiometría verbal»
  (`verbalAudiometry.guardarAudiometriaVerbal`). Con cero palabras presentadas el botón debe estar
  deshabilitado.
- [ ] M5.8 Debe aterrizar en Resultados preliminares con la tarjeta «Audiometría Verbal» †. Atrás: al
  hub.

Anotar: **¿suena la palabra?** Es exactamente la vía de «Palabra de la audiometría verbal» de
«Comprobar audio» (P5); compara. Si no suena, ¿la palabra se dicta con la voz del sistema como
respaldo? ¿Se oye dos veces solapada?

**Emulador:** el sonido es real. «No está calibrado clínicamente» lo dice la propia pantalla
(`verbalAudiometry.nivelOrientativoPresentacionAltavozEsta`).

### M6 · Análisis Acústico de Voz

Tarjeta †: «Análisis Acústico de Voz», «Vocal sostenida /a/ · Frecuencia fundamental y formantes».
Pantalla: «Análisis acústico de voz» (`voiceAnalysis.analisisAcusticoVoz`).

- [ ] M6.1 «Captura de voz» (`voiceAnalysis.capturaVoz`) debe decir «Micrófono disponible»
  (`voiceAnalysis.microfonoDisponible`). Si dice «Micrófono no disponible en este dispositivo», el
  botón de grabar queda deshabilitado: captura y sigue a M7.
- [ ] M6.2 Pulsa «Grabar voz» (`voiceAnalysis.grabarVoz`). Debe verse «GRABANDO»
  (`voiceAnalysis.grabando`), «PITCH EN VIVO» y «NIVEL DE SEÑAL». Emite o reproduce una «a» sostenida
  unos 5 s y pulsa el **botón cuadrado de parar**, que no tiene texto.
- [ ] M6.3 Debe aparecer la toma en «Grabaciones» (`voiceAnalysis.grabaciones`). Reprodúcela y
  comprueba que se oye. Graba una segunda toma («Grabar otra toma», `voiceAnalysis.grabarOtraToma`).
- [ ] M6.4 Pulsa «Analizar toma» (`voiceAnalysis.analizarToma2`). Con voz válida deben verse F0, HNR,
  jitter y shimmer y el «ESPACIO VOCÁLICO · F1 × F2». Con una toma silenciosa debe salir «Captura
  insuficiente» (`voiceAnalysis.capturaInsuficiente`) con su motivo, y «Repetir grabación»
  (`voiceAnalysis.repetirGrabacion`).
- [ ] M6.5 «VALORACIÓN PERCEPTUAL · GRBAS» (`voiceAnalysis.valoracionPerceptualGrbas`): puntúa de 0 a 3
  las cinco dimensiones (Grado, Aspereza, Soplo, Astenia, Tensión †).
- [ ] M6.6 «Evaluador responsable», nombre, colegiado, «Observaciones». Pulsa «Guardar análisis»
  (`voiceAnalysis.guardarAnalisis`).
- [ ] M6.7 Prueba el **cierre manual** (si el análisis falla): GRBAS completo, firma del explorador
  («Firma del explorador», `voiceAnalysis.firmaExplorador`) y «Registrar prueba con firma»
  (`voiceAnalysis.registrarPruebaFirma`). Sin firma debe quedar deshabilitado.
- [ ] M6.8 Debe aterrizar en Resultados preliminares con la tarjeta «Análisis Acústico de Voz» †.

Anotar: el **recorrido** de nivel que publica la toma de prueba (bloque más flojo a más fuerte) con
la voz y con silencio (`CLAUDE.md`: «el micrófono no cambia de nivel al acercarse» sigue abierto);
los valores F0, jitter, shimmer, HNR; la duración mínima de una toma válida (el código rechaza menos
de 0,5 s).

**Emulador:** el micrófono es el del ordenador solo si lo activaste (§1). Los valores sobre una
senoide o un micrófono virtual **no dicen nada** de la voz de un niño (regla 0): los números son
descriptivos y la propia pantalla advierte «sin baremo poblacional infantil».

### M7 · Análisis Prosódico

Tarjeta †: «Análisis Prosódico», 3–12 años. Pantalla «Análisis prosódico» (`prosody.analisisProsodico`),
«HABLA CONECTADA». **Ojo:** el repositorio de referencia del análisis de prosodia no está registrado
(`CLAUDE.md`, regla 1). Este bloque solo recorre lo que ya hace la pantalla; no valida la prosodia.

- [ ] M7.1 En «Tarea» (`prosody.tarea`) elige banda de edad y lámina (las dos del código son «Un día
  en el parque» y «La excursión» †). Si el micrófono falta: «No hay micrófono disponible en este
  dispositivo. La prueba no puede realizarse.» (`prosody.hayMicrofonoDisponibleEsteDispositivo`).
- [ ] M7.2 Pulsa «Reproducir la consigna» (`prosody.reproducirConsigna`) **antes** de la toma. Si no
  hay voz: «Sin voz disponible: lea la consigna en voz alta ANTES de iniciar la toma.»
  (`prosody.sinVozDisponibleLeaConsigna`).
- [ ] M7.3 Pulsa «Iniciar toma» (`prosody.iniciarToma`), habla unos 15 s (el objetivo del código es 15
  s de habla, mínimo 3 s) y pulsa «Detener» (`prosody.detener`). Debe verse «Procesando análisis
  prosódico…» y luego «Parámetros medidos».
- [ ] M7.4 Con muy poco habla debe salir el aviso «Muestra corta (…)» y la opción «Repetir toma»
  (`prosody.repetirToma`). Con señal saturada, «La señal satura: aleje el dispositivo o baje la
  ganancia y repita la toma.»
- [ ] M7.5 «Observaciones», «Explorador» (nombre) y «Nº de colegiado». Pulsa «Guardar muestra»
  (`prosody.guardarMuestra`). El código permite guardar también si el análisis acabó en error: anota si
  ocurre.
- [ ] M7.6 Debe aterrizar en Resultados preliminares con la tarjeta «Análisis Prosódico» †.

Anotar: tiempos de toma; los parámetros que salen como «no medido» (`prosody.medido`).

**Emulador:** igual que M6 (micrófono). «No sustituye la valoración clínica» está en la pantalla.

### M8 · Articulación (T.A.R)

Tarjeta †: «Articulación · T.A.R.», 3–7 años, «SODA Fonética». Pantalla «Articulación · T.A.R.»
(`articulation.articulacionTR`), «REPETICIÓN». Tres vistas: preparación, prueba, informe.

- [ ] M8.1 «Preparación del registro» (`articulation.preparacionRegistro`): lee «Voz del modelo
  hablado» (`articulation.vozModeloHablado`) y el aviso de modo que corresponda. Si faltan motores:
  «Modo limitado: sin motor de grabación ni reconocimiento de voz disponible…»
  (`articulation.modoLimitadoSinMotorGrabacion`) o «Sin voz disponible para el modelo hablado…»
  (`articulation.sinVozDisponibleModeloHablado`). **En el emulador es esperable** (ver Zero-PHI).
  Captura cuál sale.
- [ ] M8.2 Marca las cuatro condiciones de aplicación † («Condiciones de aplicación»,
  `articulation.condicionesAplicacion`) y pulsa «Comenzar registro» (`articulation.comenzarRegistro`),
  que solo se habilita con las cuatro.
- [ ] M8.3 Por cada ítem: pulsa «Escuchar modelo» (`articulation.escucharModelo`) y comprueba que
  suena (vía voz del sistema o locución empaquetada); «Grabar» (`articulation.grabar`) y «Detener»
  (`articulation.detener`). Si el reconocimiento no está disponible no hay propuesta automática;
  clasifica a mano.
- [ ] M8.4 En «Registro de la producción» (`articulation.registroProduccion`) clasifica cada ítem con
  SODA: Correcto, Sustitución, Omisión, Distorsión o Adición †. En Sustitución, transcribe «¿Qué
  produjo?» (`articulation.produjo`). Usa «Siguiente» (`articulation.siguiente`); volver al ítem anterior es un botón de flecha sin texto.
- [ ] M8.5 **Prueba de H1 (ver §5, T2).** Clasifica ítems hasta tener un porcentaje de correctos entre
  el 85 % y el 90 % (por ejemplo 17 correctos de 20 clasificados = 85 %) y pulsa «Finalizar»
  (`articulation.finalizar`). Anota **el color** del resumen que aparece al terminar.
- [ ] M8.6 En el informe debe verse «Resumen articulatorio» (`articulation.resumenArticulatorio`),
  «ítems registrados», «Acierto» (`articulation.acierto`), «Recuento por categoría (SODA)», «Fonemas a
  intervenir» y «Inventario fonético» con Logrado / En proceso / No logr. (`articulation.logrado`,
  `articulation.proceso`, `articulation.logr`).
- [ ] M8.7 Escribe «Observaciones clínicas» (`articulation.observacionesClinicas`), nombre y
  colegiado en «Profesional responsable» y pulsa «Guardar en la evaluación»
  (`articulation.guardarEvaluacion`). Para guardar basta con 1 ítem clasificado.
- [ ] M8.8 Debe aterrizar en Resultados preliminares con la tarjeta «Articulación · T.A.R.» † y el
  titular «n% de producción correcta» †. **Anota el color de esa tarjeta** (T2).

Anotar: qué motores del T.A.R. están (modelo, grabación, reconocimiento); cuántos ítems tiene el
inventario completo (no lo he contado) y cuánto tardas; los dos colores de M8.5 y M8.8.

**Emulador:** el **reconocimiento de voz** (API 33 + modelo) no está: no es avería. La grabación y el
modelo hablado sí deberían funcionar (ver las escuchas de P5).

### M9 · Funciones Ejecutivas

Tarjeta †: «Funciones Ejecutivas», 3–12 años, «Cinco mini-juegos». Pantalla «Funciones ejecutivas»
(`executiveFunctions.funcionesEjecutivas`), «JUEGO DE TARJETAS».

- [ ] M9.1 «¿Qué edad tiene el paciente?» (`executiveFunctions.edadTienePaciente`): banda A 3–4, B
  5–6, C 7–8 o D 9–12 años †. Revisa «Voz de las consignas» (`executiveFunctions.vozConsignas`).
- [ ] M9.2 Pulsa «Empezar los juegos» (`executiveFunctions.empezarJuegos`). Cada juego muestra su
  consigna («JUEGO», `executiveFunctions.juego`) y un botón «¡A jugar! 🎮» (`executiveFunctions.jugar`)
  más «Oír la consigna otra vez» (`executiveFunctions.oirConsignaOtraVez`). Anota si la consigna se
  dicta.
- [ ] M9.3 Juega los cinco: «Busca y encuentra» (atención), «No despiertes al lobo» (inhibición),
  «El juego de las normas» (flexibilidad), «El loro repetidor» (memoria de trabajo), «Ordena la
  historia» (planificación) †. Cada uno debe avanzar solo tras responder.
- [ ] M9.4 «Perfil ejecutivo» (`executiveFunctions.perfilEjecutivo`): puntuación 0–100 por dominio. Un
  dominio sin jugar debe decir «no jugado». Prueba «Repetir los juegos» y «Cambiar edad».
- [ ] M9.5 «Evaluador responsable», nombre, colegiado, «Observaciones clínicas…». «Guardar exploración»
  (`executiveFunctions.guardarExploracion`) solo se habilita si hay puntuación global.
- [ ] M9.6 Debe aterrizar en Resultados preliminares con la tarjeta «Funciones Ejecutivas» †.

Anotar: duración total (la pantalla dice ≈ 8–12 min); si algún juego se atasca; si el tiempo de
reacción se ve afectado por el emulador (es un emulador, no una tableta táctil).

**Emulador:** los cortes por dominio son «provisionales» según la propia pantalla
(`executiveFunctions.cribadoOrientativoMedianteJuegoCortes`). No son una avería.

### M10 · Cuestionario Autismo (M-CHAT-R/F)

Tarjeta †: «Cuestionario Autismo (M-CHAT-R/F)», 16–30 meses. Pantalla «Cribado de autismo»
(`autismScreening.cribadoAutismo`). **Aviso de edad:** el instrumento es de 16 a 30 meses; el
paciente de A8 tiene unos 4 años. La primera condición de aplicación dice «Edad del niño/a entre 16 y
30 meses.» †: ¿la app lo bloquea o lo deja marcar? (el código solo comprueba las cuatro casillas).

- [ ] M10.1 «Preparación del cribado» (`autismScreening.preparacionCribado`): marca las cuatro
  condiciones † y pulsa «Comenzar cuestionario» (`autismScreening.comenzarCuestionario`).
- [ ] M10.2 Contesta las 20 preguntas («Pregunta n de 20», `autismScreening.pregunta20`), Sí / No. Debe
  indicar los bloques («Bloque», «Empieza un bloque nuevo»). Prueba «Anterior» y «Siguiente».
- [ ] M10.3 Deja alguna **sin contestar** y llega a la pregunta 20: el botón de avance debe decir «Ir
  a pendientes» (`autismScreening.irPendientes`) en lugar de «Ver resultado»
  (`autismScreening.verResultado2`) y llevar a la primera pendiente. Desde la vista de resultado, con
  pendientes, «Confirmar y guardar» no debe dejar guardar y debe decir «Quedan n preguntas por
  responder…» (`autismScreening.quedan`).
- [ ] M10.4 Con las 20 contestadas pulsa «Ver resultado →» (`autismScreening.verResultado`). Debe verse
  «Recomendación clínica» (`autismScreening.recomendacionClinica`), «Respuestas de riesgo por bloque»
  y «Ítems de riesgo marcados». El rango es «Bajo (0–2)», «Medio (3–7)» o «Alto (8–20)» †. Prueba un
  recorrido con todo «No» (sin riesgo) y otro con muchas respuestas de riesgo.
- [ ] M10.5 «Evaluador responsable», nombre y colegiado; «Confirmar y guardar»
  (`autismScreening.confirmarGuardar`). «Modificar» (`autismScreening.modificar`) debe volver al
  cuestionario.
- [ ] M10.6 Debe aterrizar en Resultados preliminares con la tarjeta «Cuestionario Autismo» †.

Anotar: si deja aplicar el cuestionario a un niño fuera de edad; la tarjeta y su color con riesgo bajo
y alto.

**Emulador:** sin limitaciones.

### M11 · Cribado SAHS Infantil

Tarjeta †: «Cribado SAHS Infantil», 2–12 años. Pantalla «Cribado de SAHS infantil»
(`sahs.cribadoSahsInfantil`), «PSQ-CHERVIN». Cinco vistas: preparación, PSQ, exploración, factores de
riesgo, informe.

- [ ] M11.1 «Preparación del cribado» (`sahs.preparacionCribado`): marca las condiciones † y pulsa
  «Comenzar cribado» (`sahs.comenzarCribado`).
- [ ] M11.2 Contesta las 22 preguntas del PSQ («Pregunta n de 22», `sahs.pregunta`), Sí / No. Las
  preguntas 6 y 7 son «señal de alarma» (`sahs.senalAlarma`): debe aparecer el aviso «Señal de alarma
  presente: prioriza la derivación en el resultado.» (`sahs.senalAlarmaPresentePriorizaDerivacion`)
  con un «Sí».
- [ ] M11.3 Al terminar el PSQ: «Las 22 preguntas están respondidas» † y «Exploración →»
  (`sahs.exploracion`).
- [ ] M11.4 «Tamaño amigdalar · escala de Brodsky» (`sahs.tamanoAmigdalarEscalaBrodsky`): elige grado;
  «Estado ponderal · IMC por percentil» (`sahs.estadoPonderalImcPercentil`) y «Signos exploratorios»
  (`sahs.signosExploratorios`). Sin Brodsky y estado ponderal debe avisar «Complete el grado de Brodsky
  y el estado ponderal.» (`sahs.completeGradoBrodskyEstadoPonderal`) y no dejar guardar.
- [ ] M11.5 «Factores de riesgo y comorbilidades» (`sahs.factoresRiesgoComorbilidades`): marca alguno.
- [ ] M11.6 Informe: «Puntuación» (`sahs.puntuacion`), «Recomendación · derivación»
  (`sahs.recomendacionDerivacion`), «Desglose de puntuación» y «Puntuación total».
- [ ] M11.7 «Profesional responsable», nombre y colegiado; «Confirmar y guardar»
  (`sahs.confirmarGuardar`).
- [ ] M11.8 Debe aterrizar en Resultados preliminares con «Cribado SAHS Infantil» † y la métrica «PSQ
  n/22 · Puntuación n/…» †.

Anotar: la navegación «Modificar» (`sahs.modificar`) atrás entre las cinco vistas: si se pierde alguna
respuesta. La pantalla no tiene ni un test (plan de mejora, §2.1), así que este recorrido es la
primera comprobación que tiene.

**Emulador:** sin limitaciones.

### M12 · Exploración de Disfagia

Tarjeta †: «Exploración de Disfagia», «MECV-V volumen-viscosidad con pulsioximetría integrada · sin CAP
ni sonómetro». Pantalla «Disfagia MECV-V» (`dysphagia.disfagiaMecvV`), «MÉTODO CLÍNICO». Puede
abrirse desde el hub o con el atajo del alta («Ir directo a exploración de disfagia»,
`registroPaciente.irDirectoExploracionDisfagia`; el consentimiento sí se firma antes).

- [ ] M12.1 «Preparación de la exploración» (`dysphagia.preparacionExploracion`): marca los cuatro
  «Requisitos previos de seguridad» † (`dysphagia.requisitosPreviosSeguridad`) y pon la «Saturación
  basal (SpO₂)» (`dysphagia.saturacionBasalSpo`). El campo del pulsioxímetro debe decir **«Sensor demo
  (sin BLE)»** (`dysphagia.sensorDemoSinBle`). Pulsa «Iniciar exploración»
  (`dysphagia.iniciarExploracion`).
- [ ] M12.2 Por cada bolo: se presenta «Bolo» (`dysphagia.bolo`) con su textura y volumen (Néctar,
  Líquido, Pudin; 5, 10, 20 mL †). «Seguridad» (`dysphagia.seguridad`): Tos y Cambio de voz †.
  «Eficacia» (`dysphagia.eficacia`): sello labial, residuos, deglución fraccionada †. Teclea una SpO₂
  o pulsa «Capturar» (`dysphagia.capturar`) para tomar la lectura del sensor.
- [ ] M12.3 Prueba **una desaturación ≥ 3 puntos** respecto a la basal: debe marcarse «Desaturación
  SpO₂ (≥3%)» como «Detectada» (`dysphagia.desaturacionSpo3`, `dysphagia.detectada`) y el bolo como de
  riesgo crítico («Riesgo crítico», `dysphagia.riesgoCritico`). Según el código, desde los bolos 1 a 6
  un bolo inseguro salta directamente al bolo 7 (pudin 5 mL), y desde el 7 al 9 termina la
  exploración; con un bolo seguro avanza al siguiente.
- [ ] M12.4 Usa «Registrar y continuar» (`dysphagia.registrarContinuar`), «Anterior»
  (`dysphagia.anterior`) y «Finalizar» (`dysphagia.finalizar`). El mapa de bolos (1 a 9) debe cambiar
  de color: seguro, fallo de eficacia, fallo de seguridad, saltado.
- [ ] M12.5 En el informe: «Dieta recomendada:» (`dysphagia.dietaRecomendada`), «Detalle por bolo» y la
  SpO₂ basal, mínima y caída máxima. Escribe nombre y colegiado; «Confirmar y guardar»
  (`dysphagia.confirmarGuardar`).
- [ ] M12.6 Debe aterrizar en Resultados preliminares con «Exploración de Disfagia» †.

Anotar: la lectura del sensor demo (¿cambia cada segundo?) y qué fuente de SpO₂ queda guardada
(`spo2Source`: el PDF debe decir «demo» o «manual», ver T4 del §5).

**Emulador:** el **pulsioxímetro BLE no se puede ejercer**. El código no instala nunca el adaptador
BLE (`installBlePulseOximeter` solo se exporta) y la pantalla cae al modo demo con lecturas
simuladas. Lo que verás es la lógica clínica con un sensor falso o con valores tecleados; **no es una
medición**. No lo apuntes como avería, y tampoco lo des por «módulo comprobado con pulsioxímetro».

### M13 · Hitos del Lenguaje ASHA (Percentil 75)

Tarjeta †: «Hitos del Lenguaje ASHA (Percentil 75)», 0–5 años. Pantalla «Cribado de Hitos ASHA»
(`ashaScreening.cribadoHitosAsha`), «Apoyo a la Decisión Clínica (Percentil 75)».

- [ ] M13.1 Al entrar debe aparecer un aviso modal «Control de Riesgo Crítico (ISO 14971)»
  (`ashaScreening.controlRiesgoCriticoIso14971`) con la declaración «Confirmo que esta evaluación se
  realizará mediante observación clínica directa y entrevista profesional…». Pulsa «Aceptar y
  continuar» (`ashaScreening.aceptarContinuar`). Si intentas guardar sin aceptarlo debe reaparecer.
- [ ] M13.2 «Banda de Edad Normativa» (`ashaScreening.bandaEdadNormativa`): por el código, **el
  paciente que registra la app no trae la fecha de nacimiento** en el estado de la sesión, así que lo
  esperable es «La ficha no trae una fecha de nacimiento utilizable: ELIJA la banda a mano.»
  (`ashaScreening.fichaTraeFechaNacimientoUtilizable`). Si en cambio dice «Deducida de la fecha de
  nacimiento de la ficha (n meses)…» (`ashaScreening.deducidaFechaNacimientoFichaMeses`), dilo: la
  deducción funcionaría. *Es una lectura del código, no la he visto.* Elige la banda «4 a 5 años» †.
- [ ] M13.3 Contesta todos los hitos con «Cumple» / «No Cumple» (`ashaScreening.cumple`,
  `ashaScreening.cumple2`). Los hitos de «Bandera Roja» (`ashaScreening.banderaRoja`) deben
  distinguirse. El «Dictamen CDSS Preliminar» (`ashaScreening.dictamenCdssPreliminar`) se calcula en
  vivo, con «Rutas de Derivación Recomendadas:» y «Banderas Rojas Detectadas (n)».
- [ ] M13.4 Cambia de banda con respuestas puestas: las respuestas se reinician (el código lo hace).
  Anota si se avisa antes.
- [ ] M13.5 Intenta guardar con hitos sin contestar: debe salir «Evaluación incompleta» † con el
  recuento n/N.
- [ ] M13.6 «Observaciones Clínicas y Firma» (`ashaScreening.observacionesClinicasFirma`): nombre del
  evaluador y «Nº Colegiado / Licencia»; «Guardar y Finalizar Cribado»
  (`ashaScreening.guardarFinalizarCribado`).
- [ ] M13.7 Debe aterrizar en Resultados preliminares con «Hitos del Lenguaje ASHA» † (aviso
  «Cribado ASHA Guardado» † con el nivel de riesgo). Es el módulo que se perdió en la lectura el
  2/11/2026: comprueba también que aparece en Resultados finales y en el PDF (§4 y §5).

Anotar: el mensaje de la banda (M13.2); el nivel de riesgo y las derivaciones de un recorrido todo
«Cumple» y otro con varios «No Cumple».

**Emulador:** sin limitaciones.

## 4. Resultados preliminares, resultados finales, PDF, finalizar, historial

Para esta sección conviene haber guardado **al menos cinco módulos distintos** (propongo M1, M3, M8,
M10 y M13 como mínimo; cuantos más mejor) en una **misma evaluación**.

### 4.1 Resultados preliminares

- [ ] R1 Desde el hub pulsa «Ver resultados preliminares»
  (`seleccionEjercicios.verResultadosPreliminares`). Debe verse «Sesión de Evaluación» con «Índice
  global de normalidad» (`resultadosPreliminares.indiceGlobalNormalidad`), los contadores «Normales»,
  «En Observación» y «Alterados» y una tarjeta por módulo guardado, con el estado «Normal», «Revisar»
  o «Alterado» †.
- [ ] R2 Con una evaluación sin pruebas debe decir «Sin pruebas completadas»
  (`resultadosPreliminares.sinPruebasCompletadas`) y «Aquí aparecerá el resumen de cada módulo en
  cuanto guarde su resultado…». Comprueba el caso abriendo un paciente nuevo.
- [ ] R3 Cuenta las tarjetas contra los módulos que guardaste. **Anota la lista exacta** (T1).
- [ ] R4 «Volver a pruebas» (`resultadosPreliminares.volverPruebas`) debe llevar al hub.

### 4.2 Resultados finales («Ver Informe Detallado»)

- [ ] R5 Pulsa «Ver Informe Detallado». Debe verse la pantalla de dos paneles: a la izquierda «Pruebas
  de la sesión» (`resultadosFinal.pruebasSesion`) con un módulo por línea y su estado entre
  paréntesis, y a la derecha el detalle («Parámetros Objetivos», «Interpretación clínica»).
  **Anota la lista exacta de módulos** (T1) y el texto de la píldora de la cabecera: dice «Sesión
  Sellada · Informe Listo» (`resultadosFinal.sesionSelladaInformeListo`) **desde que entras**, aunque
  todavía no hayas pulsado «Finalizar y Archivar» (el código no la condiciona a nada). Anota si te
  parece engañoso.
- [ ] R6 Debe verse la síntesis clínica («Síntesis clínica global», «Borrador calculado por reglas.
  Revíselo antes de firmar.», `nlg.ui.draftTitle`, `nlg.ui.draftSubtitle`), los contadores («Módulos
  con registro», «Avisos», «Hallazgos cruzados», «Derivaciones sugeridas») y «Ver trazabilidad de
  reglas» (`nlg.ui.auditTrailToggle`). Los estados dicen «Sin desvíos», «Revisar» o «Fuera de
  referencia» (`nlg.ui.statusOk`, `nlg.ui.statusWarn`, `nlg.ui.statusAlt`). Si un módulo no tiene
  registro debe figurar «Sin registro en esta sesión» (`nlg.ui.missingModulesLabel`).
- [ ] R7 Escribe unas «Observaciones del profesional» (`nlg.ui.observationsLabel`) y dibuja una «Firma
  del profesional» (`nlg.ui.signatureLabel`). Anota si el trazo se dibuja bien.
- [ ] R8 Anota si aparece el bloque «Telemetría Zero-PHI» con el «QR anónimo de la sesión»
  (`resultadosFinal.telemetriaZeroPhi`, `resultadosFinal.qrAnonimoSesion`) y el mensaje de Lúa
  («¡Enhorabuena! Has completado la sesión…», `resultadosFinal.luaFinalMessage`).
- [ ] R9 Recorre **cada módulo** del panel izquierdo. Anota los que se queden en blanco o den error.
  Los fallos de lectura de un módulo van **solo** a `console.warn` (plan de mejora, H3): si falta un
  módulo, la pantalla no avisa.

### 4.3 «Exportar PDF» y el selector de carpetas de Android

Es lo primero que `CLAUDE.md` dice que hay que probar. Nadie ha visto aún el selector abrirse.

- [ ] R10 Pulsa «Exportar PDF» (`resultadosFinal.exportarPdf`). Debe mostrar un indicador de trabajo
  mientras genera.
- [ ] R11 **Debe abrirse el selector de carpetas del sistema Android** (Storage Access Framework,
  `requestDirectoryPermissionsAsync`). Anota: ¿se abre? ¿En qué carpeta empieza? ¿Hay botón para
  «usar esta carpeta» / conceder acceso? Captura la pantalla.
- [ ] R12 Elige una carpeta (por ejemplo Documentos) y concede el acceso. Debe salir el aviso verde
  «Informe PDF guardado» (`resultadosFinal.toastPdfOkTitle`) con «Guardado en el archivo de la app.» y
  «Copia guardada en la carpeta elegida.» (`resultadosFinal.toastPdfSavedInApp`,
  `resultadosFinal.toastPdfCopySaved`).
- [ ] R13 Repite «Exportar PDF» y esta vez **cancela** el selector. Debe decir «No se eligió carpeta:
  solo queda la copia de la app.» (`resultadosFinal.toastPdfCopyCancelled`).
- [ ] R14 Comprueba que el fichero **existe** en la carpeta elegida, con el nombre
  `VIA-informe-<id de evaluación>-<AAAAMMDD-HHMMSS>.pdf` (no lleva datos del paciente), y que **se
  abre** con un visor de PDF del emulador. Anota el tamaño y si abre. Si no tienes visor, descárgalo
  al ordenador. La copia privada de la app (`<documents>/informes/`) no es accesible desde fuera en un
  APK de release: *no lo he comprobado, es lo que cabe esperar de Android*.
- [ ] R15 Si sale un aviso rojo, copia **el motivo completo** (el aviso lo lleva entre paréntesis:
  «No se pudo compilar el PDF. (motivo)»; o «La copia externa no se pudo guardar: …»; o «La síntesis
  firmada no se pudo archivar: …»). Un carácter fuera de WinAnsi tumbó el PDF entero el 2/11/2026:
  si vuelve a pasar, el motivo lo dirá.
- [ ] R16 Pulsa «Exportar PDF» una **segunda vez** tras haber firmado y escrito observaciones. Anota
  si hace falta repetir la firma y si la firma sale en el PDF (§5, T5).

### 4.4 «Finalizar y Archivar»

- [ ] R17 Pulsa «Finalizar y Archivar» (`resultadosFinal.finalizarArchivar`). Debe salir «Sesión
  finalizada» con «La evaluación queda marcada como completada.» (`resultadosFinal.toastFinishOkTitle`,
  `resultadosFinal.toastFinishOkBody`) y la app va a **Pacientes**.
- [ ] R18 En Pacientes, la fila del paciente debe decir «Completado» (`pacientes.completado`) y
  ofrecer «Ver resultados de pruebas realizadas» (`pacientes.verResultadosPruebasRealizadas`); antes de
  finalizar decía «En curso» (`pacientes.curso`). Anota el texto exacto de la fila.

### 4.5 Historial del paciente

- [ ] R19 Entra por «Ver resultados de …» en Pacientes, o desde el hub con «Historial del paciente»
  (`seleccionEjercicios.historialPaciente`). Debe verse «Historial de pruebas»
  (`historialPaciente.historialPruebas`), con una entrada por sesión («Completada» / «En curso») y las
  pruebas con su estado, y la leyenda «Resumen orientativo de pruebas ya registradas. No constituye un
  informe clínico definitivo.»
- [ ] R20 Compara las tarjetas de la sesión finalizada con las de Resultados preliminares (R3): deben
  ser las mismas (leen por el mismo camino, `evaluationResults.ts`). Pulsa «Volver a pacientes»
  (`historialPaciente.volverPacientes`).
- [ ] R21 Abre un paciente que no tenga ninguna evaluación: «Sin sesiones registradas»
  (`historialPaciente.sinSesionesRegistradas`).
- [ ] R22 Desde Pacientes, abre al paciente finalizado de nuevo: la app debe crear una **evaluación
  nueva** (por el código, con el consentimiento sin firmar, así que lo volverá a pedir). Anota qué
  ocurre.

## 5. Comprobaciones transversales

Estas tres salen del plan de mejora (`docs/PLAN-MEJORA-APP.md` §2.2, hallazgos H1, H2 y H3 bis). Son
las que no puede ver ningún test.

### T1 · La misma evaluación, los mismos módulos (H2)

Hay **tres caminos de lectura** de los resultados: tarjetas (`evaluationResults.ts`, que usan
Resultados preliminares e Historial), pantalla final (`ResultadosFinalScreen.tsx`, que relee los once
repositorios) y PDF (`Report.ts`). Con la evaluación de §4:

- [ ] T1.1 Rellena esta tabla con una marca por casilla (módulo guardado y visible). **Debe ser la
  misma columna de módulos en las tres.**

| Módulo guardado | Resultados preliminares | Resultados finales | PDF (página) |
| --- | --- | --- | --- |
| M1 CAP | | | |
| M3 Audiometría Infantil | | | |
| M4 Audiometría Condicionada | | | |
| M5 Audiometría Verbal | | | |
| M6 Voz | | | |
| M7 Prosodia | | | |
| M8 T.A.R. | | | |
| M9 Funciones Ejecutivas | | | |
| M10 Cuestionario Autismo | | | |
| M11 SAHS | | | |
| M12 Disfagia | | | |
| M13 ASHA | | | |

- [ ] T1.2 **Lo que dice el código y debes confirmar o desmentir:** el CAP **no** tiene tarjeta en
  Resultados preliminares ni panel en Resultados finales, pero el PDF sí le dedica página
  (`ClinicalAssessmentDetail`) y la síntesis lo lee. Si lo ves así, es una divergencia real entre
  pantalla y documento firmado.
- [ ] T1.3 Compara el **estado** (Normal / Revisar / Alterado, o Sin desvíos / Revisar / Fuera de
  referencia) del mismo módulo en las tres. Para una audiometría con un PTA moderado el código usa
  cortes distintos en las tarjetas (por gravedad del PTA, solo «Normal» o «Revisar») y en la pantalla
  final (cualquier umbral > 20 dB es «Revisar», > 40 dB «Alterado»). Si ves dos colores distintos para
  la misma audiometría, anota los dos y el PTA.

### T2 · El color del T.A.R. al terminar frente a la tarjeta (H1)

- [ ] T2.1 En M8.5 (al «Finalizar» la prueba) y M8.8 (tarjeta en Resultados preliminares) y en R5
  (Resultados finales) y en la página del PDF, anota el **color** del mismo T.A.R. con un porcentaje
  entre 85 y 89 (por ejemplo 85 %).

| Dónde | Corte según el código | Color esperado con un 85 % |
| --- | --- | --- |
| Resumen al terminar la prueba (`ArticulationTestScreen.tsx`) | ≥ 85 verde, ≥ 60 ámbar | Verde |
| Tarjeta de Resultados preliminares (`evaluationResults.ts`) | ≥ 90 normal, ≥ 70 revisar | Ámbar («Revisar») |
| Resultados finales (`ResultadosFinalScreen.tsx`) | ≥ 90 normal, ≥ 70 revisar | Ámbar |
| Página del T.A.R. en el PDF (`ArticulationDetail.ts`) | ≥ 85 verde, ≥ 60 ámbar | Verde |

- [ ] T2.2 Repite con un porcentaje entre 60 y 69 (el resumen dice ámbar y la tarjeta «Alterado»).
  Cuál de los dos juegos de cortes es el correcto, y de qué fuente sale, **no consta**: es decisión de
  Frank, y este guion solo mide si el desacuerdo se ve. Tampoco he mirado qué corte usa la **frase**
  de la síntesis clínica para el T.A.R. (no está en `nlgThresholds.ts`).

### T3 · El PDF lleva la línea del consentimiento (H3 bis)

- [ ] T3.1 En el PDF exportado, en la **portada** debe haber una línea del estilo «Consentimiento
  informado v1.0 firmado el DD-MM-AAAA por <nombre>, <relación>.» †, debajo de «Evaluación #n».
- [ ] T3.2 Si **no** está, anota que falta y **que la app no avisó**: el código la omite en silencio si
  no puede leer el consentimiento (`Report.ts`, solo `console.warn`).
- [ ] T3.3 Comprueba también el caso del consentimiento firmado por familiar o representante: la línea
  debe incluir el motivo de la incapacidad.

### T4 · Otras comprobaciones del PDF

- [ ] T4.1 Recorre todas las páginas: portada, síntesis, trazabilidad, y una página por cada módulo
  guardado. Anota cuántas páginas y si alguna sale cortada o con «?» en lugar de un símbolo (los
  símbolos fuera de WinAnsi se sustituyen: ≤ pasa a <=, ₂ a 2, el resto a ?).
- [ ] T4.2 En la página de disfagia, la fuente de la SpO₂ debe decir «demo» (si usaste «Capturar» con
  el sensor demo) o «manual» (si tecleaste). Si dice «pulsioxímetro BLE» en el emulador, es un fallo.
- [ ] T4.3 En voz y prosodia, comprueba que los números no vienen presentados como «normales»: la app
  dice que no hay baremo infantil.

### T5 · Más cosas que el código sugiere vigilar

- [ ] T5.1 **Firma en el PDF.** La síntesis admite firma dibujada. Si no se pudo reproducir debe salir
  «La firma dibujada no se pudo reproducir en el PDF. Fírmese a mano.» (`nlg.ui.signatureUnreadable`).
  Comprueba qué ocurre con tu firma.
- [ ] T5.2 **Cola de pruebas.** Selecciona **dos** tarjetas en el hub y pulsa «Iniciar batería (2
  pruebas)». Por el código solo debe abrirse la **primera** (`navigate(selected[0])`) y, al guardar,
  la segunda **no** se abre sola. Anota qué ves: es la discrepancia 2 del §7.
- [ ] T5.3 **Atrás.** Desde Resultados preliminares tras guardar un módulo, el botón atrás del sistema
  debe volver al hub y **no** al formulario del módulo.
- [ ] T5.4 **Cerrar sesión.** Desde el hub o Pacientes («Cerrar sesión»): vuelve a la lista de
  profesionales y no deja nada de la sesión anterior en pantalla.
- [ ] T5.5 **Recuperación.** Con un módulo a medias, cierra la app desde el selector de aplicaciones y
  ábrela. Anota con qué estado vuelve (sesión, paciente, evaluación activa).

## 6. Plantilla para anotar un fallo

Copia el bloque tantas veces como haga falta. Un fallo por bloque. **Sin captura no es un fallo
completo**: la regla 4 de `CLAUDE.md` pide que se pueda nombrar el eslabón roto.

```text
FALLO n.º:
Identificador del paso (por ejemplo M8.5):
Pantalla (título que se ve en pantalla):
Módulo y ruta (por ejemplo Articulación · T.A.R. / Articulation):
Qué esperaba (lo que decía el guion):
Qué vi (literal, con los textos exactos de pantalla):
¿Es limitación del emulador? (sí / no / no sé) y por qué:
¿Se repite? (siempre / a veces / una vez) y cuántas veces lo probé:
Captura(s) (nombre de fichero):
APK / commit, AVD, API, orientación:
Estado de «Comprobar audio» en esa sesión (si es de audio):
Texto de un aviso rojo, completo, si lo hubo:
```

Qué NO anotar como fallo (limitaciones conocidas del emulador, ver §3):

- Reconocimiento de voz del T.A.R. cerrado (API 33 y modelo de la lengua).
- Pulsioxímetro BLE inexistente: el sensor es el demo.
- Micrófono silencioso si no activaste la entrada del ordenador.
- Niveles en dB HL sin calibrar (audiometrías) y sonómetro sin calibración certificada.
- Sin vibración ni sensores táctiles reales.

## 7. Discrepancias entre el código y la documentación

Mandan el código y los ficheros leídos. Cada punto cita dónde.

1. **«13 módulos disponibles» en el hub.** El manual (`docs/manual/manual.html`, sección «Selección de
   pruebas (hub)») dice «13 módulos disponibles». La parrilla del hub tiene **11 tarjetas**
   (`moduleCards.ts`); el CAP y el sonómetro son botones y pasos previos. El README (tabla «Batería de
   evaluación — 13 módulos») sí cuenta los trece como CAP + sonómetro + 11 tarjetas, igual que el
   catálogo de Créditos (`orbitModules.ts`).
2. **«Iniciar batería» y «las pruebas se ejecutarán en ese orden».** El manual lo afirma. El código de
   `handleStart` (`SeleccionEjerciciosScreen.tsx:207-213`) solo hace `navigation.navigate(selected[0])`
   y no hay en `src/` ninguna cola que abra las siguientes (búsqueda hecha por nombres de cola y
   siguiente-módulo, no exhaustiva). Al guardar, `finishModule` va a Resultados preliminares. La
   etiqueta «Iniciar batería (n pruebas)» promete más de lo que el código hace. *Por confirmar en el
   emulador (T5.2).*
3. **«Sin CAP “apto” no se habilita ningún módulo».** El manual dice que el consentimiento y el CAP
   son bloqueantes. El consentimiento sí lo es (sin firma no se llega al CAP). El CAP **no bloquea
   nada**: guardarlo solo exige nombre y colegiado, un veredicto «NO APTO» deja pasar igual, y
   `capApproved` solo se escribe como `false` en todo `src/` y el hub no lo lee. La lista de «juegos
   habilitados» del CAP no se aplica a las tarjetas del hub.
4. **El idioma de la sesión «se elige en el hub».** El manual lo dice. El selector de idioma
   (`LanguagePickerModal`) solo se usa en `CreditosScreen`; el hub no lo tiene. Las pantallas de M5, M8
   y M9 traen su propio selector de lengua o de voz.
5. **Orden del alta.** El manual sitúa el sonómetro tras el CAP, como hace el código. Pero «Comprobar
   audio» solo es alcanzable desde el hub (`SeleccionEjerciciosScreen.tsx:332, 360`): no hay forma de
   ejecutarla **antes** del alta del profesional y del paciente. De ahí P5.
6. **README: «BLE pulsioxímetro 🟢 Construido».** La tabla de hardware del README da por construido el
   módulo de disfagia con BLE. El código solo exporta `installBlePulseOximeter` (`DysphagiaTest/index.ts`)
   y nadie lo llama: la app **siempre** usa el sensor demo. (`CLAUDE.md` lo registra como decisión
   pendiente de `react-native-ble-plx`.)
7. **Plan de mejora, H1.** El plan cuenta «dos juegos de cortes» y cita cuatro sitios (`ArticulationTestScreen`
   85/60 y tres con 90/70). **El PDF añade un quinto sitio con el juego 85/60**
   (`src/PDF/blocks/ArticulationDetail.ts:19-20`): el resumen al terminar y la página del PDF coinciden y las
   dos tarjetas de pantalla disienten. Incluido en T2.
8. **«Ítems acertados» en Resultados finales.** La fila del T.A.R. se titula «Ítems acertados» pero
   muestra `evaluatedCount / totalCount`, es decir ítems **evaluados** sobre el total, no aciertos
   (`ResultadosFinalScreen.tsx:~643`). Es una lectura del código; confírmalo en pantalla (M8, R9).
9. **Píldora «Sesión Sellada · Informe Listo».** Se pinta siempre al abrir Resultados finales, antes de
   «Finalizar y Archivar», que es lo que marca la evaluación como completada
   (`EvaluationRepository.markCompleted`). Ver R5.
10. **«Textos fuera del catálogo» (H6 del plan).** Los títulos y descripciones de las tarjetas del hub,
    los textos del consentimiento y el CAP, y muchos avisos emergentes no están en `strings.es.ts`. Por
    eso muchos textos de este guion llevan †: salen del código, no del catálogo.

## 8. Lo que no he podido anclar en el código

- **Cuántos ítems tiene el T.A.R. completo** y por tanto cuánto dura. No lo he contado.
- **Cómo se comporta el emulador con el micrófono, el selector de carpetas y el reloj de audio.** El
  ajuste del micrófono virtual es del emulador, no del repositorio, y lo conozco de forma general:
  *no lo he verificado*.
- **Si el emulador de Frank tiene un visor de PDF.** No consta.
- **Los colores exactos de las tarjetas** («Normal», «Revisar», «Alterado») y de los resúmenes: los
  tokens están en el código, pero el color que el usuario ve depende del tema. El guion pide que anotes
  el color visto.
- **Los textos de los idiomas distintos del castellano.** Este recorrido es solo en castellano; no
  cubre gallego, euskera, catalán, inglés, `es-419` ni `es-DO`.
- **Qué hace la app en un teléfono pequeño.** El README dice que no se ha recorrido; este guion no
  fija el formato.
- **El tiempo real de cada módulo.** Las duraciones de las tarjetas (8–10 min, etc.) son cifras del
  código (`moduleCards.ts`), no medidas.
- **El comportamiento de «Comprobar audio» en una corrida real.** Lo que el guion pide anotar de los
  eslabones `output-clock` y `tts-speak` es justo lo que `CLAUDE.md` § Pendiente deja abierto; no
  tengo el resultado.
- **Qué corte usa la síntesis clínica NLG para el T.A.R.** No lo he leído (T2.2).
- **No he ejecutado la app.** Todo «debe verse» es lectura del código de este commit.
