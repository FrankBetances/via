/* -------------------------------------------------------------------------- */
/*  VIA+ · INTERFAZEKO kateen katalogoa · Euskara                               */
/*                                                                             */
/*  Gaztelaniazko oinarrizko katalogoaren aurka tipatua (`strings.es.ts`):      */
/*  han gehitutako eta hemen falta den edozein gakok `npx tsc --noEmit` hausten */
/*  du. Nahita da — falta den kate batek konpilazioa hautsi behar du, inoiz ez  */
/*  agertu hutsik logopeda baten tabletan.                                      */
/*                                                                             */
/*  Erregistroa: euskara batua (Euskaltzaindia) eta Osasun Hiztegia.            */
/*  AHOSKATZEN diren kateak ez daude hemen (ikus `strings.es.ts` goiburua).     */
/*                                                                             */
/*  KONTUZ, hemen jada gertatu da: fitxategi hau `strings.gl.ts`-tik kopiatuz   */
/*  gero, galegoa isilik sartzen da. `mejora2` adarrean horixe gertatu zen —    */
/*  «descende ata ≈%50era» euskarazko katalogoan—. Kate bakoitza euskaraz dago, */
/*  ez erromantze hizkuntza batetik kopiatua.                                   */
/* -------------------------------------------------------------------------- */
import { UiStrings } from './strings.es';

export const EU: UiStrings = {
  common: {
    continue: 'Jarraitu',
    back: 'Atzera',
    cancel: 'Utzi',
    save: 'Gorde',
    close: 'Itxi',
    accept: 'Ados',
    loading: 'Kargatzen…',
    retry: 'Saiatu berriro',
    next: 'Hurrengoa',
    finish: 'Amaitu',
    yes: 'Bai',
    no: 'Ez',
    notAvailable: 'Ez dago erabilgarri',
  },

  langPicker: {
    title: 'Aplikazioaren hizkuntza',
    subtitle: 'Aukerak aplikazio osoko testuak eta ahoskatzeak aldatzen ditu',
    navA11y: (label: string) => `Uneko hizkuntza: ${label}. Ukitu hizkuntza aldatzeko.`,
    openA11y: 'Aldatu aplikazioaren hizkuntza',
    change: (code: string) => `Aldatu hizkuntza (${code})`,
    closeA11y: 'Itxi hizkuntza hautatzailea',
    optionA11y: (name: string, hint: string) => `${name}: ${hint}`,
    hintEs: 'Bateria klinikoaren oinarrizko hizkuntza',
    hintGl: 'Proxecto Nós · Celtia ahotsa · ACOPROS bermea',
    hintEu: 'HiTZ · AhoTTS · Maider ahotsa · Ulertuz bermea',
    hintCa: 'Piper ahotsa · UPC ona',
    hintEs419: 'Latinoamerikako aldaera neutroa · Piper ahotsa',
    hintEsDO: 'Quisqueya Habla · bere bankua eta ahoskatzeak · FONDOCYT',
    hintEn: 'Ingeles amerikarra · Piper Lessac',
  },

  credits: {
    navBackA11y: 'Itzuli ongietorri pantailara',
    navTitle: 'Kredituak eta Bermeak',
    samdBadge: 'IIa Klasea',
    emblemFootnote:
      'Balorazio audiologiko, fonetiko eta irenste-balorazioaren arkitektura integratua',
    authorBadge: 'EGILETZA ETA ZUZENDARITZA KLINIKOA',
    authorRole: 'Otorrinolaringologoa eta ikertzaile nagusia',
    partnersTitle: 'ALIANTZAK ETA LAGUNTZAILEAK',
    quisqueyaDesc: 'FONDOCYT proiektua · dominikar egokitzapen linguistikoa',
    acoprosDesc: 'Gorren Lankidetza eta Sustapenerako Elkartea',
    earlifyDesc: 'Teknologia eta ingeniaritza kliniko sanitarioa',
    voicesTitle: 'AHOTSAK ETA LOKALIZAZIOA',
    qualityTitle: 'KALITATEA ETA ARAUDI SANITARIOA',
    sealTitle: 'ITEMAS Kalitate Zigilua 2024',
    sealSubtitle: 'Berrikuntza teknologikoa osasunean',
    chipSamd: 'SaMD IIa Klasea',
    chipLocation: 'Lugo, Galizia',
    dockButton: 'Hasi Profesionalaren Hautaketa',

    langEs: 'Ebaluazio klinikoaren baterien oinarrizko hizkuntza',
    langGl: 'Celtia ahots neuronala, ACOPROSek onartutako bankua',
    langEu: 'Maider ahots neuronala, Ulertuzek onartutako bankua',
    langCa: 'Piper ahots neuronala · UPC ona (CC BY-SA 4.0)',
    langEs419: 'Latinoamerikako aldaera neutroa · Piper (CC BY 4.0)',
    langEsDO: 'Dominikar aldaera: bere bankua eta ahoskatzeak (FONDOCYT)',
    langEn: 'Interfazea eta ahotsa ingeles amerikarrez · Piper Lessac',
    enginePiper: 'VITS ahots neuronalak gaztelaniarako, katalanerako, ingeleserako eta aldaeretarako',
    engineEspeak: 'Lineaz kanpoko ordezko sintesia, pisu neuronalik gabe',
  },

  components: {
    volver: 'Itzuli',
    borrarFirma: 'Ezabatu sinadura',
    firmeAqui: 'Sinatu hemen hatzarekin edo arkatz ukikorrarekin',
    tamanoLetra: 'Letra-tamaina',
    lua: 'Lúa ·',
    respiracionGuiada: 'Arnasketa Gidatua',
    esp32Ble: 'ESP32 BLE',
    nivel: 'Maila',
    filtroPrueba: (a: string | number, b: string | number) => `Iragazkia ${a}, ${b} proba`,
    duracionEdades: (a: string | number, b: string | number, c: string | number, d: string | number) =>
      `${a}. ${b} Iraupena ${c}. Adinak ${d}.`,
    calibracionOk: 'Kalibrazioa OK',
    normal: 'NORMALA',
    leve: 'ARINA',
    moderada: 'ERTAINA',
    severa: 'LARRIA',
    frecuenciaHz: 'Maiztasuna (Hz)',
    genial: 'BIKAIN! ⭐',
  },
  seleccionProfesional: {
    col: 'Kol.',
    quienVaEvaluarHoy: 'Nork ebaluatuko du gaur?',
    eligeTuPerfilAccedeTu: 'Hautatu zure profila eta sartu zure pasahitzarekin',
    registrarNuevoProfesional: 'Erregistratu profesional berria',
    creaTuPerfilSolaVez: 'Sortu zure profila behin bakarrik gailu honetan',
    n1PerfilRegistrado: 'PROFIL 1 ERREGISTRATUTA',
    perfilesRegistrados: (a: string | number) => `${a} PROFIL ERREGISTRATUTA`,
    cargandoPerfiles: 'Profilak kargatzen…',
    aunHayProfesionalesEsteDispositivo: 'Oraindik ez dago profesionalik gailu honetan. Erregistratu zure profila hasteko.',
    contrasena: 'Pasahitza',
    cancelar: 'Utzi',
    acceder: 'Sartu →',
  },

  seleccionEjercicios: {
    volverCap: 'Itzuli CAPera',
    sonometroSala: 'Gelaren sonometroa',
    comprobarAudio: 'Egiaztatu audioa',
    reintentando: 'Berriro saiatzen…',
    reintentarVozSistema: 'Saiatu berriro sistemaren ahotsarekin',
    comprobarTodaCadena: 'Egiaztatu kate osoa',
    verResultadosPreliminares: 'Ikusi aurretiazko emaitzak',
    historialPaciente: 'Pazientearen historia',
    cerrarSesion: 'Amaitu saioa',
    ningunaPruebaCola: 'Ez dago probarik ilaran',
    pruebaCola: (a: string | number) => `${a} proba ilaran`,
    tiempoTotal: '⏱️ Guztizko denbora: ~',
    min: 'min',
    limpiar: 'Garbitu',
  },

  bienvenida: {
    procesamientoDsp: 'DSP PROZESAMENDUA',
    n48Khz24Bit: '48 kHz · 24 bit',
    ruido: 'ZARATA',
    informacionClinica: 'INFORMAZIO KLINIKOA',
    samdClaseIia: 'SaMD IIa Klasea',
    valoracionInteractivaAudicionLenguaje: 'ENTZUMENAREN ETA HIZKUNTZAREN BALORAZIO INTERAKTIBOA',
    ruido2: 'Zaratatik',
    informacionClinica2: 'informazio klinikora',
    plataformaAvanzadaEvaluacionAudiologicaLenguaje: 'Entzumena eta hizkuntza ebaluatzeko plataforma aurreratua. Ahotsaren akustika eta entzumen-jokabidea objektiboki prozesatzen ditu, erabaki klinikoak zehaztasun handienaz hartzeko.',
    modulosBateria: (a: string | number) => `Bateria klinikoaren ${a} modulu`,
    audiometriaTonalCpaVerbalVoz: 'Audiometria (tonala, CPA eta hitzezkoa), ahots akustikoa, prosodia, artikulazioa, disfagia, SAHS eta funtzio exekutiboak.',
    n100OnDeviceZeroPhi: '%100 gailuan · Zero-PHI',
    dspAcusticoLocalSinSubida: 'DSP akustikoa bertan, audioa hodeira igo gabe. Pribatutasun osoa eta araudia zorrotz betetzea.',
    selloCalidadItemas2024: 'ITEMAS Kalitate Zigilua 2024',
    innovacionSanitariaAvaladaInstitutoSalud: 'Carlos III.a Osasun Institutuak bermatutako berrikuntza sanitarioa eta zentro anitzeko balidazioa.',
    comenzarExploracionClinica: 'Hasi Esplorazio Klinikoa',
    navegaPantallaCreditosEInicio: 'Joan kredituen eta saio-hasieraren pantailara',
    comenzarExploracion: 'Hasi Esplorazioa',
    viaMedicalSystemMdr2017: 'VIA+ Medical System · MDR 2017/745 · IEC 62304 / ISO 14971',
  },
};
