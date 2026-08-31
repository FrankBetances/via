import React, { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Box, Card, Center, HStack, Icon, Input, InputField, ScrollView, VStack } from '@gluestack-ui/themed';
import { useDispatch, useSelector } from 'react-redux';
import { Check, ChevronLeft, Languages, Play, RotateCcw, Save, Volume2, X } from 'lucide-react-native';

import { Button, Content, Header, Text } from '@/Components/Common';
import RadialBackground from '@/Components/Themed/RadialBackground';
import { finishModule, RootStackParamList } from '@/Navigators';
import { AppDispatch, RootState } from '@/Store';
import { SESSION_LANG_LABEL, setSessionLanguage } from '@/Store/slices/localeSlice';
import type { SessionLang } from '@/Store/slices/sessionLangs';
import { EF_CONSIGNA_LANGS } from '@/Voice';
import { Evaluation } from '@/Models/Evaluation/Evaluation';
import { ExecutiveFunctionsTest } from '@/Models/ExecutiveFunctions/ExecutiveFunctionsTest';
import { useClassSelector } from '@/Helpers/ClassTransformer';
import { useTelemetryTracker } from '@/Telemetry';
import { useCreateExecutiveFunctionsMutation } from '@/Services/local/modules/executiveFunctions';
import { showErrorToast, showSuccessToast } from '@/Helpers/showToast';

import {
  buildAttentionPlan,
  buildFlexibilityPlan,
  buildInhibitionPlan,
  buildMemoryPlan,
  buildPlanningPlan,
  EF_BANDS,
  EF_DOMAIN_META,
  EF_DOMAIN_ORDER,
  EfAgeBand,
  EfDomain,
  EfDomainScores,
  EfRawResults,
  efOverallLabel,
  efOverallScore,
  efStatus,
  EMPTY_EF_SCORES,
  interpretExecutiveFunctions,
  scoreAttention,
  scoreFlexibility,
  scoreInhibition,
  scoreMemory,
  scorePlanning,
} from './executiveFunctionsGame';
import AttentionGame from './components/AttentionGame';
import InhibitionGame from './components/InhibitionGame';
import FlexibilityGame from './components/FlexibilityGame';
import MemoryGame from './components/MemoryGame';
import PlanningGame from './components/PlanningGame';
import { speakConsigna, stopConsigna } from './efSpeech';
import { LuaCompanionWidget } from '@/Components/Mascot/LuaCompanionWidget';
import { useLuaCompanion, LuaEmotion } from '@/Lua';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
type Props = NativeStackScreenProps<RootStackParamList, 'ExecutiveFunctions'>;

/* -------------------------------------------------------------------------- */
/*  ExecutiveFunctionsScreen — batería lúdica de funciones ejecutivas.         */
/*                                                                            */
/*  Mismas fases que la audiometría verbal rediseñada:                         */
/*   1. setup   — selección de banda de edad (gradúa la dificultad de los 5    */
/*               mini-juegos) y arranque.                                      */
/*   2. intro   — antesala amable de CADA mini-juego (mascota + consigna en    */
/*               una línea); el niño (o el clínico en banda A) pulsa «¡A       */
/*               jugar!». Sirve de descanso entre juegos para que no se        */
/*               cansen.                                                       */
/*   3. play    — el mini-juego en sí, autónomo (avanza solo).                 */
/*   4. results — perfil por dominios para el clínico + evaluador + guardar.   */
/* -------------------------------------------------------------------------- */

type Phase = 'setup' | 'intro' | 'play' | 'results';

export default function ExecutiveFunctionsScreen({ navigation }: Props) {
  const t = useT();
  const activeEvaluation = useClassSelector(Evaluation, (state: RootState) => state.activeEvaluation.evaluation);
  const [createExecutiveFunctions, { isLoading: isSaving }] = useCreateExecutiveFunctionsMutation();
  const tracker = useTelemetryTracker(); // telemetría silenciosa (useRef, sin re-render)

  // Idioma/variante de la sesión: el MISMO estado que fijan el hub, la
  // audiometría verbal y el T.A.R., así que cambiarlo aquí lo cambia en toda
  // la batería. Las consignas se dictaban siempre con la voz castellana
  // (`speakConsigna` sin lengua caía a su valor por defecto), de modo que una
  // sesión dominicana oía los mini-juegos con acento peninsular y no había
  // dónde elegir.
  const dispatch = useDispatch<AppDispatch>();
  const sessionLanguage = useSelector((state: RootState) => state.locale.language);

  const [phase, setPhase] = useState<Phase>('setup');
  const [band, setBand] = useState<EfAgeBand>('A');
  const [gameIndex, setGameIndex] = useState(0);
  const [seed, setSeed] = useState<number>(() => Math.floor(Math.random() * 0xffffffff));
  const [scores, setScores] = useState<EfDomainScores>(EMPTY_EF_SCORES);
  const [raw, setRaw] = useState<EfRawResults>({});

  const [notes, setNotes] = useState('');
  const [evaluatorName, setEvaluatorName] = useState(activeEvaluation?.professional?.name ?? '');
  const [evaluatorLicense, setEvaluatorLicense] = useState(activeEvaluation?.professional?.licenseNumber ?? '');

  const patient = activeEvaluation?.patient;
  const patientName = patient ? `${patient.name} ${patient.lastName}`.trim() : null;

  const lua = useLuaCompanion({
    moduleKey: 'executive_functions',
    initialEmotion: LuaEmotion.Tranquility,
    initialLevel: 1,
  });

  const domain: EfDomain = EF_DOMAIN_ORDER[Math.min(gameIndex, EF_DOMAIN_ORDER.length - 1)];
  const meta = EF_DOMAIN_META[domain];
  const overall = efOverallScore(scores);

  useEffect(() => {
    if (phase === 'setup') {
      lua.setPhase(0);
      lua.setEmotion(LuaEmotion.Tranquility);
    } else if (phase === 'intro') {
      lua.setPhase(0);
      lua.setEmotion(LuaEmotion.Tranquility);
    } else if (phase === 'play') {
      lua.setPhase(1);
      lua.setEmotion(LuaEmotion.Fun);
      lua.setProgressLevel((gameIndex + 1) * 2);
    } else if (phase === 'results') {
      lua.setVerdict(2);
      lua.triggerReward('executive_functions', 2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, gameIndex]);

  // Dictado de la consigna al entrar en la antesala de cada juego (motor
  // es-ES de la audiometría verbal; silencioso si no hay voz española). Al
  // salir de la antesala se corta cualquier dictado en curso.
  useEffect(() => {
    if (phase !== 'intro') {
      stopConsigna();
      return;
    }
    const currentDomain = EF_DOMAIN_ORDER[Math.min(gameIndex, EF_DOMAIN_ORDER.length - 1)];
    const timer = setTimeout(() => speakConsigna(currentDomain, sessionLanguage), 500);
    return () => {
      clearTimeout(timer);
      stopConsigna();
    };
  }, [phase, gameIndex, sessionLanguage]);

  // Los planes se generan al entrar en cada juego (semilla de sesión estable).
  const plans = useMemo(
    () => ({
      attention: buildAttentionPlan(band, seed),
      inhibition: buildInhibitionPlan(band, seed),
      flexibility: buildFlexibilityPlan(band, seed),
      workingMemory: buildMemoryPlan(band),
      planning: buildPlanningPlan(band, seed),
    }),
    [band, seed],
  );

  /* ------------------------------- acciones -------------------------------- */

  const startBattery = () => {
    setSeed(Math.floor(Math.random() * 0xffffffff));
    setScores(EMPTY_EF_SCORES);
    setRaw({});
    setGameIndex(0);
    setPhase('intro');
  };

  const restartAll = () => {
    setSeed(Math.floor(Math.random() * 0xffffffff));
    setScores(EMPTY_EF_SCORES);
    setRaw({});
    setGameIndex(0);
    setPhase('setup');
  };

  // Telemetría: cada mini-juego es un reactivo; abre su ventana al empezar a
  // jugarse. `domain` deriva de `gameIndex` (5 dominios ordenados).
  useEffect(() => {
    if (phase === 'play') tracker.enterReactivo(`ef-${domain}`);
  }, [phase, domain, tracker]);

  const finishGame = (gameDomain: EfDomain, score: number, detail: EfRawResults[keyof EfRawResults]) => {
    tracker.classifyReactivo(`ef-${gameDomain}`);
    setScores(prev => ({ ...prev, [gameDomain]: score }));
    setRaw(prev => ({ ...prev, [gameDomain]: detail }) as EfRawResults);
    lua.setVerdict(2);
    if (gameIndex + 1 >= EF_DOMAIN_ORDER.length) {
      setPhase('results');
    } else {
      setGameIndex(i => i + 1);
      setPhase('intro');
    }
  };

  /** Salida anticipada del clínico: conserva los juegos ya completados. */
  const exitBattery = () => {
    setPhase(overall !== null ? 'results' : 'setup');
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!evaluatorName.trim() || !evaluatorLicense.trim() || overall === null) return;
    if (!activeEvaluation) {
      showErrorToast('No se puede guardar', 'No hay una evaluación activa asociada al paciente.');
      return;
    }
    try {
      const item = new ExecutiveFunctionsTest();
      item.ageBand = band;
      item.results = raw;
      item.attentionScore = scores.attention;
      item.inhibitionScore = scores.inhibition;
      item.flexibilityScore = scores.flexibility;
      item.workingMemoryScore = scores.workingMemory;
      item.planningScore = scores.planning;
      item.overallScore = overall;
      item.interpretation = interpretExecutiveFunctions(band, scores);
      item.notes = notes.trim();
      item.evaluatorName = evaluatorName.trim();
      item.evaluatorLicense = evaluatorLicense.trim();
      item.completedAt = new Date();
      item.evaluation = { id: activeEvaluation.id } as Evaluation;

      await createExecutiveFunctions(item);
      showSuccessToast('Exploración guardada', `Índice global ${efOverallLabel(scores)} · banda ${band}.`);
      // Aterriza en los resultados, no de vuelta al hub (ver finishModule).
      finishModule(navigation);
    } catch {
      showErrorToast('Error al guardar', 'No se pudo registrar la exploración. Inténtelo de nuevo.');
    }
  };

  /* ------------------------------ fase: setup ------------------------------ */

  const renderSetup = () => (
    <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
      <VStack>
        <HStack alignItems="center" space="sm">
          <Text size="2xl" weight="bold" color="$textLight900">
            
            {t.executiveFunctions.funcionesEjecutivas}
          </Text>
          <Box bg="$primary50" px="$2" py="$0.5" borderRadius="$full">
            <Text size="2xs" weight="bold" color="$primary800" style={atoms.letterSpacing04}>
              
              {t.executiveFunctions.juegoTarjetas}
            </Text>
          </Box>
        </HStack>
        <Text size="xs" color="$textLight500">
          {patientName ?? 'Atención · inhibición · flexibilidad · memoria de trabajo · planificación'}
        </Text>
      </VStack>

      {/* Acompañamiento Lúa (Guardiana de Normas y Progresión por Dominios) */}
      <LuaCompanionWidget
        emotion={lua.currentEmotion}
        activeBadge={lua.activeBadge}
        connected={lua.connected}
        level={lua.currentLevel}
        message="¡Vamos a jugar a 5 mini-juegos de retos mentales! Supera cada reto para ganar insignias."
      />

      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" color="$textLight700" style={atoms.lineHeight20}>
          
          {t.executiveFunctions.cincoMiniJuegosCortos} <Text size="sm" weight="bold" color="$textLight900">{t.executiveFunctions.unoDominioEjecutivo}</Text>{t.executiveFunctions.ninoJuegaSoloApoyoMinimo}
        </Text>
        <HStack flexWrap="wrap" mt="$3" style={atoms.gap6}>
          {EF_DOMAIN_ORDER.map(d => (
            <Box key={d} bg="$backgroundLight50" borderRadius="$full" px="$2.5" py="$1">
              <Text size="2xs" weight="bold" color="$textLight600">
                {EF_DOMAIN_META[d].emoji} {EF_DOMAIN_META[d].title}
              </Text>
            </Box>
          ))}
        </HStack>
      </Card>

      {/* selección de banda de edad → variante de dificultad */}
      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="md" weight="bold" color="$textLight900" mb="$1">
          
          {t.executiveFunctions.edadTienePaciente}
        </Text>
        <Text size="2xs" color="$textLight500" mb="$3">
          
          {t.executiveFunctions.edadGraduaDificultadNTarjetas}
        </Text>
        <VStack space="sm">
          {EF_BANDS.map(b => {
            const on = band === b.band;
            return (
              <Pressable key={b.band} onPress={() => setBand(b.band)}>
                <HStack
                  alignItems="center"
                  space="md"
                  p="$3.5"
                  borderRadius={16}
                  borderWidth={2}
                  borderColor={on ? '$primary500' : '$borderLight200'}
                  bg={on ? '$primary0' : '$white'}>
                  <Center w={48} h={48} borderRadius={14} bg={on ? '$primary50' : '$backgroundLight50'}>
                    <Text style={atoms.fontSize26LineHeight34}>{b.emoji}</Text>
                  </Center>
                  <VStack style={atoms.flex1}>
                    <Text size="md" weight="bold" color="$textLight900">
                      {b.ages}
                    </Text>
                    <Text size="xs" color="$textLight500">
                      {b.label}
                    </Text>
                  </VStack>
                  <Box
                    w={22}
                    h={22}
                    borderRadius="$full"
                    borderWidth={2}
                    borderColor={on ? '$primary600' : '$borderLight300'}
                    alignItems="center"
                    justifyContent="center">
                    {on ? <Box w={11} h={11} borderRadius="$full" bg="$primary600" /> : null}
                  </Box>
                </HStack>
              </Pressable>
            );
          })}
        </VStack>
      </Card>

      <Card bgColor="$white" borderRadius={24} p="$5">
        <HStack alignItems="center" space="sm" mb="$1">
          <Icon as={Languages} size="sm" color="$primary500" />
          <Text size="sm" weight="bold" color="$textLight800" style={atoms.textTransformUppercaseLetterSpacing04}>
            
            {t.executiveFunctions.vozConsignas}
          </Text>
        </HStack>
        <Text size="xs" color="$textLight600" mb="$3">
          
          {t.executiveFunctions.vozDictaConsignaCadaMini}
        </Text>
        <HStack space="sm" flexWrap="wrap" style={atoms.rowGap8}>
          {EF_CONSIGNA_LANGS.map(l => {
            const on = sessionLanguage === l;
            return (
              <Pressable key={l} onPress={() => dispatch(setSessionLanguage(l))}>
                <Center
                  px="$3.5"
                  py="$2"
                  borderRadius="$full"
                  bg={on ? '$primary500' : '$white'}
                  borderWidth={1.5}
                  borderColor={on ? '$primary500' : '$borderLight200'}>
                  <Text size="2xs" weight="bold" color={on ? '$white' : '$textLight600'}>
                    {SESSION_LANG_LABEL[l] ?? l}
                  </Text>
                </Center>
              </Pressable>
            );
          })}
        </HStack>
        <Text size="2xs" color="$textLight400" mt="$3" style={atoms.lineHeight15}>
          
          {t.executiveFunctions.juegosSonMismosTodasLenguas}
        </Text>

        {/* El selector solo ofrece las lenguas en las que las consignas EXISTEN
            (`EF_CONSIGNA_LANGS`, derivado del banco). Si la sesión viene del hub
            en una lengua que este módulo no tiene, se dice aquí en vez de dictar
            castellano con acento de otra lengua, que es lo que hacía antes. */}
        {!EF_CONSIGNA_LANGS.includes(sessionLanguage as never) ? (
          <HStack space="xs" alignItems="flex-start" mt="$3" p="$2.5" borderRadius={12} bg="$warning50">
            <Text size="2xs" color="$warning800" style={atoms.flex1LineHeight15}>
              
              {t.executiveFunctions.sesionEsta} {SESSION_LANG_LABEL[sessionLanguage as SessionLang] ?? sessionLanguage}{t.executiveFunctions.peroMiniJuegosAunTienen}
            </Text>
          </HStack>
        ) : null}
      </Card>

      <Box bg="$warning50" borderRadius={12} p="$2.5">
        <Text size="2xs" color="$warning800" style={atoms.lineHeight15}>
          
          {t.executiveFunctions.cribadoOrientativoMedianteJuegoCortes}
        </Text>
      </Box>

      <Button action="primary" variant="solid" rounded="$full" onPress={startBattery}>
        <HStack space="sm" alignItems="center">
          <Icon as={Play} size="sm" color="$white" />
          <Text size="md" weight="bold" color="$white">
            
            {t.executiveFunctions.empezarJuegos}
          </Text>
        </HStack>
      </Button>
      {overall !== null ? (
        <Button action="secondary" variant="outline" rounded="$full" onPress={() => setPhase('results')}>
          <Text size="sm" weight="bold" color="$primary500">
            
            {t.executiveFunctions.verResultados}
          </Text>
        </Button>
      ) : null}
    </VStack>
  );

  /* --------------------------- fase: intro de juego ------------------------ */

  const renderIntro = () => (
    <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
      <HStack alignItems="center" space="sm">
        <Pressable onPress={exitBattery} hitSlop={10}>
          <Center w={38} h={38} borderRadius="$full" bg="$white" borderWidth={1} borderColor="$borderLight200">
            <Icon as={X} size="sm" color="$textLight500" />
          </Center>
        </Pressable>
        <HStack style={atoms.flex1} justifyContent="center" space="xs">
          {EF_DOMAIN_ORDER.map((d, i) => (
            <Text key={d} style={atoms.fontSize15LineHeight20}>
              {i < gameIndex ? '⭐' : i === gameIndex ? '🔵' : '⚪'}
            </Text>
          ))}
        </HStack>
        <Box w={38} />
      </HStack>

      <Card bgColor="$white" borderRadius={24} p="$6">
        <Center>
          <Text style={atoms.fontSize64LineHeight76}>{meta.emoji}</Text>
          <Text size="2xs" weight="bold" color="$textLight400" mt="$2" style={atoms.letterSpacing1}>
            
            {t.executiveFunctions.juego} {gameIndex + 1} DE {EF_DOMAIN_ORDER.length}
          </Text>
          <Text size="2xl" weight="bold" color="$textLight900" mt="$1">
            {meta.game}
          </Text>
          <Text size="md" color="$textLight700" mt="$3" style={atoms.textAlignCenterLineHeight22}>
            {meta.instruction}
          </Text>
          <Pressable onPress={() => speakConsigna(domain, sessionLanguage)}>
            <HStack space="xs" alignItems="center" bg="$primary50" borderRadius="$full" px="$4" py="$2" mt="$4">
              <Icon as={Volume2} size="sm" color="$primary600" />
              <Text size="sm" weight="bold" color="$primary600">
                
                {t.executiveFunctions.oirConsignaOtraVez}
              </Text>
            </HStack>
          </Pressable>
        </Center>
      </Card>

      <Button action="primary" variant="solid" rounded="$full" onPress={() => setPhase('play')}>
        <Text size="lg" weight="bold" color="$white">
          
          {t.executiveFunctions.jugar}
        </Text>
      </Button>
      <Text size="2xs" color="$textLight400" style={atoms.textAlignCenter}>
        
        {t.executiveFunctions.dominioEvaluado} {meta.title}
      </Text>
    </VStack>
  );

  /* ------------------------------ fase: play ------------------------------- */

  const renderPlay = () => (
    <VStack flex={1} px="$5" mt="$2" space="md" pb="$8">
      <HStack alignItems="center" space="sm">
        <Pressable onPress={exitBattery} hitSlop={10}>
          <Center w={38} h={38} borderRadius="$full" bg="$white" borderWidth={1} borderColor="$borderLight200">
            <Icon as={X} size="sm" color="$textLight500" />
          </Center>
        </Pressable>
        <HStack style={atoms.flex1} justifyContent="center" space="xs">
          {EF_DOMAIN_ORDER.map((d, i) => (
            <Text key={d} style={atoms.fontSize15LineHeight20}>
              {i < gameIndex ? '⭐' : i === gameIndex ? '🔵' : '⚪'}
            </Text>
          ))}
        </HStack>
        <Box w={38} />
      </HStack>

      <Card bgColor="$white" borderRadius={24} p="$4">
        {domain === 'attention' ? (
          <AttentionGame
            plan={plans.attention}
            onFinish={r => finishGame('attention', scoreAttention(r), r)}
          />
        ) : domain === 'inhibition' ? (
          <InhibitionGame
            plan={plans.inhibition}
            onFinish={r => finishGame('inhibition', scoreInhibition(r), r)}
          />
        ) : domain === 'flexibility' ? (
          <FlexibilityGame
            plan={plans.flexibility}
            lang={sessionLanguage}
            onFinish={r => finishGame('flexibility', scoreFlexibility(r), r)}
          />
        ) : domain === 'workingMemory' ? (
          <MemoryGame
            plan={plans.workingMemory}
            seed={seed}
            onFinish={r => finishGame('workingMemory', scoreMemory(r), r)}
          />
        ) : (
          <PlanningGame
            plan={plans.planning}
            onFinish={r => finishGame('planning', scorePlanning(r), r)}
          />
        )}
      </Card>
    </VStack>
  );

  /* ----------------------------- fase: results ----------------------------- */

  const renderResults = () => (
    <VStack flex={1} px="$6" mt="$2" space="md" pb="$10">
      <HStack alignItems="center" space="sm">
        <Pressable onPress={() => setPhase('setup')} hitSlop={10}>
          <Center w={38} h={38} borderRadius="$full" bg="$white" borderWidth={1} borderColor="$borderLight200">
            <Icon as={ChevronLeft} size="sm" color="$textLight500" />
          </Center>
        </Pressable>
        <VStack style={atoms.flex1}>
          <Text size="2xl" weight="bold" color="$textLight900">
            
            {t.executiveFunctions.perfilEjecutivo}
          </Text>
          <Text size="xs" color="$textLight500">
            {patientName ?? 'Funciones ejecutivas'}  {t.executiveFunctions.banda} {band}
          </Text>
        </VStack>
        {overall !== null ? (
          <Center bg="$white" borderRadius="$full" px="$3" py="$1.5" borderWidth={1} borderColor="$borderLight100">
            <Text size="sm" weight="bold" color={overall >= 80 ? '$success600' : overall >= 60 ? '$warning600' : '$error600'}>
              {overall}/100
            </Text>
          </Center>
        ) : null}
      </HStack>

      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" weight="bold" color="$textLight900" mb="$3">
          
          {t.executiveFunctions.puntuacionDominio0100Orientativa}
        </Text>
        <VStack space="md">
          {EF_DOMAIN_ORDER.map(d => {
            const s = scores[d];
            const m = EF_DOMAIN_META[d];
            const st = s === null ? null : efStatus(s);
            const barColor = st === 'ok' ? '#2A7948' : st === 'warn' ? '#FF7F00' : st === 'alt' ? '#DC2626' : '#D8CFC0';
            return (
              <VStack key={d}>
                <HStack justifyContent="space-between" alignItems="center" mb="$1">
                  <Text size="xs" weight="bold" color="$textLight800">
                    {m.emoji} {m.title}
                  </Text>
                  <Text size="xs" weight="bold" color={st === 'ok' ? '$success600' : st === 'warn' ? '$warning600' : st === 'alt' ? '$error600' : '$textLight400'}>
                    {s !== null ? `${s}/100` : t.executiveFunctions.jugado}
                  </Text>
                </HStack>
                <Box h={8} borderRadius="$full" bg="$backgroundLight100" style={atoms.overflowHidden}>
                  <Box style={{ height: '100%', width: `${s ?? 0}%`, backgroundColor: barColor, borderRadius: 999 }} />
                </Box>
              </VStack>
            );
          })}
        </VStack>
      </Card>

      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" weight="bold" color="$textLight700" mb="$2" style={atoms.letterSpacing03}>
          
          {t.executiveFunctions.interpretacionOrientativa}
        </Text>
        <Text size="sm" color="$textLight700" style={atoms.lineHeight21}>
          {interpretExecutiveFunctions(band, scores)}
        </Text>
      </Card>

      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" weight="bold" color="$textLight900" mb="$2">
          
          {t.executiveFunctions.repetir}
        </Text>
        <HStack space="sm" flexWrap="wrap" style={atoms.gap6}>
          <Button action="secondary" variant="outline" rounded="$full" onPress={startBattery}>
            <Text size="sm" weight="bold" color="$primary500">
              
              {t.executiveFunctions.repetirJuegos}
            </Text>
          </Button>
          <Button action="secondary" variant="outline" rounded="$full" onPress={restartAll}>
            <HStack space="xs" alignItems="center">
              <Icon as={RotateCcw} size="xs" color="$textLight500" />
              <Text size="sm" weight="bold" color="$textLight500">
                
                {t.executiveFunctions.cambiarEdad}
              </Text>
            </HStack>
          </Button>
        </HStack>
      </Card>

      <Card bgColor="$white" borderRadius={20} p="$4">
        <Text size="sm" weight="bold" color="$textLight700" mb="$2">{t.executiveFunctions.evaluadorResponsable}</Text>
        <HStack space="sm" mb="$3">
          <Input variant="outline" borderRadius={12} style={atoms.flex2}>
            <InputField placeholder={t.executiveFunctions.nombre} value={evaluatorName} onChangeText={setEvaluatorName} />
          </Input>
          <Input variant="outline" borderRadius={12} style={atoms.flex1}>
            <InputField placeholder={t.executiveFunctions.colegiado} value={evaluatorLicense} onChangeText={setEvaluatorLicense} />
          </Input>
        </HStack>
        <Input variant="outline" borderRadius={12} h={64} mb="$3">
          <InputField multiline placeholder={t.executiveFunctions.observacionesClinicas} value={notes} onChangeText={setNotes} style={atoms.textAlignVerticalTop} />
        </Input>
        <Button
          action="primary"
          variant="solid"
          rounded="$full"
          isDisabled={isSaving || !evaluatorName.trim() || !evaluatorLicense.trim() || overall === null}
          isLoading={isSaving}
          onPress={handleSave}>
          <HStack space="sm" alignItems="center">
            <Icon as={Save} size="sm" color="$white" />
            <Text size="sm" weight="bold" color="$white">{t.executiveFunctions.guardarExploracion}</Text>
          </HStack>
        </Button>
        <HStack space="xs" alignItems="center" justifyContent="center" mt="$2">
          <Icon as={Check} size="2xs" color="$textLight400" />
          <Text size="2xs" color="$textLight400" style={atoms.textAlignCenter}>
            
            {t.executiveFunctions.cribadoOrientativoJuegoSustituyeInstrumentos}
          </Text>
        </HStack>
      </Card>
    </VStack>
  );

  return (
    <Content
      padding={false}
      insetTop={false}
      radialBackgrounds={
        <>
          <RadialBackground topMultiplier={0.12} leftMultiplier={-0.2} widthMultiplier={2} heightMultiplier={2} center={(w, _h) => [w, w]} radiusMultiplier={1} />
          <RadialBackground topMultiplier={-0.95} leftMultiplier={-0.8} widthMultiplier={2} heightMultiplier={2} center={(w, _h) => [w, w]} radiusMultiplier={1} />
        </>
      }>
      <VStack flex={1}>
        <Header animationType="expand" />
        <ScrollView showsVerticalScrollIndicator={false}>
          {phase === 'setup'
            ? renderSetup()
            : phase === 'intro'
              ? renderIntro()
              : phase === 'play'
                ? renderPlay()
                : renderResults()}
        </ScrollView>
      </VStack>
    </Content>
  );
}
