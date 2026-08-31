/* -------------------------------------------------------------------------- */
/*  VIA+ · Catálogo de cadeas de INTERFACE · Galego                             */
/*                                                                             */
/*  Tipado contra o catálogo base en castelán (`strings.es.ts`): calquera clave */
/*  engadida alí e ausente aquí rompe `npx tsc --noEmit`. É deliberado — unha   */
/*  cadea que falta ten que romper a compilación, nunca aparecer en branco na   */
/*  tableta dunha logopeda.                                                     */
/*                                                                             */
/*  Rexistro normativo: Real Academia Galega e Dicionario de Galego de          */
/*  Termos Médicos. As cadeas LOCUTADAS non viven aquí (ver a cabeceira de      */
/*  `strings.es.ts`).                                                           */
/* -------------------------------------------------------------------------- */
import { UiStrings } from './strings.es';

export const GL: UiStrings = {
  common: {
    continue: 'Continuar',
    back: 'Atrás',
    cancel: 'Cancelar',
    save: 'Gardar',
    close: 'Pechar',
    accept: 'Aceptar',
    loading: 'Cargando…',
    retry: 'Tentar de novo',
    next: 'Seguinte',
    finish: 'Rematar',
    yes: 'Si',
    no: 'Non',
    notAvailable: 'Non dispoñible',
  },

  langPicker: {
    title: 'Idioma da aplicación',
    subtitle: 'A escolla cambia os textos e as locucións de toda a app',
    navA11y: (label: string) => `Idioma actual: ${label}. Toca para cambiar de idioma.`,
    openA11y: 'Cambiar o idioma da aplicación',
    change: (code: string) => `Cambiar idioma (${code})`,
    closeA11y: 'Pechar o selector de idioma',
    optionA11y: (name: string, hint: string) => `${name}: ${hint}`,
    hintEs: 'Idioma base da batería clínica',
    hintGl: 'Proxecto Nós · voz Celtia · aval ACOPROS',
    hintEu: 'HiTZ · AhoTTS · voz Maider · aval Ulertuz',
    hintCa: 'Voz Piper · UPC ona',
    hintEs419: 'Variante neutra latinoamericana · voz Piper',
    hintEsDO: 'Quisqueya Habla · banco e locucións propios · FONDOCYT',
    hintEn: 'Inglés americano · Piper Lessac',
  },

  credits: {
    navBackA11y: 'Volver á pantalla de benvida',
    navTitle: 'Créditos e Avais',
    samdBadge: 'Clase IIa',
    emblemFootnote:
      'Arquitectura integrada de valoración audiolóxica, fonética e deglutoria',
    authorBadge: 'AUTORÍA E DIRECCIÓN CLÍNICA',
    authorRole: 'Otorrinolaringólogo e investigador principal',
    partnersTitle: 'ALIANZAS E COLABORADORES',
    quisqueyaDesc: 'Proxecto FONDOCYT · adaptación lingüística dominicana',
    acoprosDesc: 'Asociación de Colaboración e Promoción do Xordo',
    earlifyDesc: 'Tecnoloxía e enxeñaría clínica sanitaria',
    voicesTitle: 'VOCES E LOCALIZACIÓN',
    qualityTitle: 'CALIDADE E REGULACIÓN SANITARIA',
    sealTitle: 'Selo de Calidade ITEMAS 2024',
    sealSubtitle: 'Innovación tecnolóxica en saúde',
    chipSamd: 'SaMD Clase IIa',
    chipLocation: 'Lugo, Galicia',
    dockButton: 'Comezar Selección Profesional',

    langEs: 'Idioma base da batería de avaliación clínica',
    langGl: 'Voz neuronal Celtia, banco aprobado por ACOPROS',
    langEu: 'Voz neuronal Maider, banco aprobado por Ulertuz',
    langCa: 'Voz neuronal Piper · UPC ona (CC BY-SA 4.0)',
    langEs419: 'Variante neutra latinoamericana · Piper (CC BY 4.0)',
    langEsDO: 'Variante dominicana: banco e locucións propios (FONDOCYT)',
    langEn: 'Interface e voz en inglés americano · Piper Lessac',
    enginePiper: 'Voces neuronais VITS para castelán, catalán, inglés e variantes',
    engineEspeak: 'Síntese de apoio sen conexión, sen pesos neuronais',
  },
};
