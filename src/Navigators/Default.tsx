import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '@/Store';
import { RootStackParamList } from '@/Navigators/screenTypeNavigator';

import { BienvenidaScreen } from '@/Screens/Bienvenida';
import SeleccionProfesionalScreen from '@/Screens/SeleccionProfesional/SeleccionProfesionalScreen';
import PacientesScreen from '@/Screens/Pacientes/PacientesScreen';
import RegistroPacienteScreen from '@/Screens/RegistroPaciente/RegistroPacienteScreen';
import RegistroProfesionalScreen from '@/Screens/RegistroProfesional/RegistroProfesionalScreen';
import CreditosScreen from '@/Screens/Creditos/CreditosScreen';
import { PresentacionLuaScreen } from '@/Screens/PresentacionLua';
import { ConsentimientoScreen } from '@/Screens/Consentimiento';

import { ClinicalAssessmentScreen } from '@/Screens/ClinicalAssessment';
import { AutismScreeningScreen } from '@/Screens/AutismScreening';
import { RoomNoiseCheckScreen } from '@/Screens/RoomNoiseCheck';
import { AudiometryScreen } from '@/Screens/Audiometry';
import { AudiometryConditionedScreen } from '@/Screens/AudiometryConditioned';
import { VoiceAnalysisScreen } from '@/Screens/VoiceAnalysis';
import { ProsodyAnalysisScreen } from '@/Screens/ProsodyAnalysis';
import { DysphagiaTestScreen } from '@/Screens/DysphagiaTest';
import { SahsScreeningScreen } from '@/Screens/SahsScreening';
import { ArticulationTestScreen } from '@/Screens/Articulation';
import { VerbalAudiometryScreen } from '@/Screens/VerbalAudiometry';
import { ExecutiveFunctionsScreen } from '@/Screens/ExecutiveFunctions';
import { AshaScreeningScreen } from '@/Screens/AshaScreening';
import SeleccionEjerciciosScreen from '@/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen';
import ResultadosPreliminaresScreen from '@/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen';
import ResultadosFinalScreen from '@/Screens/ResultadosFinal/ResultadosFinalScreen';
import { HistorialPacienteScreen } from '@/Screens/HistorialPaciente';
import { DiagnosticoAudioScreen } from '@/Screens/DiagnosticoAudio';

/* -------------------------------------------------------------------------- */
/*  Navigator raíz — VIA+ (patrón "auth flow" de React Navigation).           */
/*                                                                            */
/*  UN SOLO navigator con grupos condicionales por `state.auth.isLogged`.     */
/*  IMPORTANTE: los nombres de ruta NO deben repetirse entre los dos grupos.  */
/*  La versión anterior montaba dos navigators alternativos (AccessStack /    */
/*  MainStack) que COMPARTÍAN las rutas `Creditos` y `RegistroProfesional`:   */
/*  al abrir sesión, React Navigation conservaba las rutas del historial      */
/*  cuyo nombre seguía existiendo y el usuario "volvía" a Créditos en vez de  */
/*  aterrizar en Pacientes. Con grupos condicionales y nombres únicos, al     */
/*  cambiar `isLogged` desaparecen todas las rutas del grupo saliente y el    */
/*  navigator se reinicia en la primera pantalla del grupo entrante           */
/*  (Pacientes al entrar, Bienvenida al cerrar sesión).                       */
/* -------------------------------------------------------------------------- */

const RootStack = createNativeStackNavigator<RootStackParamList>();

export default function DefaultNavigator() {
  const isLogged = useSelector((state: RootState) => state.auth.isLogged);

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      {!isLogged ? (
        // ------- flujo de acceso: bienvenida → créditos → perfil → alta -----
        <RootStack.Group>
          <RootStack.Screen name="Bienvenida" component={BienvenidaScreen} />
          <RootStack.Screen name="Creditos" component={CreditosScreen} />
          <RootStack.Screen name="PresentacionLua" component={PresentacionLuaScreen} />
          <RootStack.Screen name="SeleccionProfesional" component={SeleccionProfesionalScreen} />
          <RootStack.Screen name="RegistroProfesional" component={RegistroProfesionalScreen} />
        </RootStack.Group>
      ) : (
        // ------- sesión abierta: Pacientes es la ruta inicial ---------------
        <RootStack.Group>
          <RootStack.Screen name="Pacientes" component={PacientesScreen} />
          <RootStack.Screen name="RegistroPaciente" component={RegistroPacienteScreen} />
          {/* Consentimiento informado: bloqueante entre el registro y el CAP */}
          <RootStack.Screen name="Consentimiento" component={ConsentimientoScreen} />

          {/* Module routes (Contrato de Compilación §2) */}
          <RootStack.Screen name="ClinicalAssessment" component={ClinicalAssessmentScreen} />
          <RootStack.Screen name="Mchat" component={AutismScreeningScreen} />
          <RootStack.Screen name="RoomNoiseCheck" component={RoomNoiseCheckScreen} />
          <RootStack.Screen name="Audiometry" component={AudiometryScreen} />
          <RootStack.Screen name="AudiometryConditioned" component={AudiometryConditionedScreen} />
          <RootStack.Screen name="VoiceAnalysis" component={VoiceAnalysisScreen} />
          <RootStack.Screen name="ProsodyAnalysis" component={ProsodyAnalysisScreen} />
          <RootStack.Screen name="DysphagiaTest" component={DysphagiaTestScreen} />
          <RootStack.Screen name="SahsScreening" component={SahsScreeningScreen} />
          <RootStack.Screen name="Articulation" component={ArticulationTestScreen} />
          <RootStack.Screen name="VerbalAudiometry" component={VerbalAudiometryScreen} />
          <RootStack.Screen name="ExecutiveFunctions" component={ExecutiveFunctionsScreen} />
          <RootStack.Screen name="AshaScreening" component={AshaScreeningScreen} />

          {/* Hub y resultados */}
          <RootStack.Screen name="SeleccionEjercicios" component={SeleccionEjerciciosScreen} />
          <RootStack.Screen name="ResultadosPreliminares" component={ResultadosPreliminaresScreen} />
          <RootStack.Screen name="ResultadosFinal" component={ResultadosFinalScreen} />
          <RootStack.Screen name="HistorialPaciente" component={HistorialPacienteScreen} />

          {/* Diagnóstico del dispositivo (no clínico) */}
          <RootStack.Screen name="DiagnosticoAudio" component={DiagnosticoAudioScreen} />
        </RootStack.Group>
      )}
    </RootStack.Navigator>
  );
}
