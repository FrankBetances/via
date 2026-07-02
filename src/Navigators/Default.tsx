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

import { ClinicalAssessmentScreen } from '@/Screens/ClinicalAssessment';
import { AutismScreeningScreen } from '@/Screens/AutismScreening';
import { RoomNoiseCheckScreen } from '@/Screens/RoomNoiseCheck';
import { AudiometryScreen } from '@/Screens/Audiometry';
import { AudiometryConditionedScreen } from '@/Screens/AudiometryConditioned';
import { VoiceAnalysisScreen } from '@/Screens/VoiceAnalysis';
import { DysphagiaTestScreen } from '@/Screens/DysphagiaTest';
import { SahsScreeningScreen } from '@/Screens/SahsScreening';
import { ArticulationTestScreen } from '@/Screens/Articulation';
import SeleccionEjerciciosScreen from '@/Screens/SeleccionEjercicios/SeleccionEjerciciosScreen';
import ResultadosPreliminaresScreen from '@/Screens/ResultadosPreliminares/ResultadosPreliminaresScreen';
import ResultadosFinalScreen from '@/Screens/ResultadosFinal/ResultadosFinalScreen';

/* -------------------------------------------------------------------------- */
/*  Navigator raíz — VIA+.                                                  */
/*  Gate por `state.auth.isLogged`: sin sesión se monta el stack de acceso    */
/*  (Bienvenida -> selección de profesional -> alta de profesional); con      */
/*  sesión se monta el stack principal empezando en Pacientes. No hay login   */
/*  con usuario/contraseña: la "sesión" es elegir un perfil del dispositivo.  */
/*  Las 9 pantallas de módulo se registran aquí en una fase posterior (ver    */
/*  Contrato de Compilación §6.4).                                           */
/* -------------------------------------------------------------------------- */

const RootStack = createNativeStackNavigator<RootStackParamList>();

function AccessStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Bienvenida" component={BienvenidaScreen} />
      <RootStack.Screen name="SeleccionProfesional" component={SeleccionProfesionalScreen} />
      {/* Alcanzables antes de iniciar sesión: presentación del proyecto y alta
          de profesional de primera vez (ver Contrato de Compilación §6.4). */}
      <RootStack.Screen name="Creditos" component={CreditosScreen} />
      <RootStack.Screen name="RegistroProfesional" component={RegistroProfesionalScreen} />
    </RootStack.Navigator>
  );
}

function MainStack() {
  return (
    <RootStack.Navigator
      initialRouteName="Pacientes"
      screenOptions={{ headerShown: false }}
    >
      <RootStack.Screen name="Pacientes" component={PacientesScreen} />
      <RootStack.Screen name="RegistroPaciente" component={RegistroPacienteScreen} />
      {/* Reachable también dentro de la sesión: alta de un profesional adicional
          / gestión de perfil ("Registro de cuenta"), y créditos como "Acerca de". */}
      <RootStack.Screen name="RegistroProfesional" component={RegistroProfesionalScreen} />
      <RootStack.Screen name="Creditos" component={CreditosScreen} />

      {/* Module routes (Contrato de Compilación §2) */}
      <RootStack.Screen name="ClinicalAssessment" component={ClinicalAssessmentScreen} />
      <RootStack.Screen name="Mchat" component={AutismScreeningScreen} />
      <RootStack.Screen name="RoomNoiseCheck" component={RoomNoiseCheckScreen} />
      <RootStack.Screen name="Audiometry" component={AudiometryScreen} />
      <RootStack.Screen name="AudiometryConditioned" component={AudiometryConditionedScreen} />
      <RootStack.Screen name="VoiceAnalysis" component={VoiceAnalysisScreen} />
      <RootStack.Screen name="DysphagiaTest" component={DysphagiaTestScreen} />
      <RootStack.Screen name="SahsScreening" component={SahsScreeningScreen} />
      <RootStack.Screen name="Articulation" component={ArticulationTestScreen} />

      {/* New screen routes appended by later phases (mockup-based hub screens, etc.) */}
      <RootStack.Screen name="SeleccionEjercicios" component={SeleccionEjerciciosScreen} />
      <RootStack.Screen name="ResultadosPreliminares" component={ResultadosPreliminaresScreen} />
      <RootStack.Screen name="ResultadosFinal" component={ResultadosFinalScreen} />
    </RootStack.Navigator>
  );
}

export default function DefaultNavigator() {
  const isLogged = useSelector((state: RootState) => state.auth.isLogged);
  return isLogged ? <MainStack /> : <AccessStack />;
}
