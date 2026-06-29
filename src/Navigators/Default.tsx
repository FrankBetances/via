import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useSelector } from 'react-redux';
import { RootState } from '@/Store';
import { RootStackParamList } from '@/Navigators/screenTypeNavigator';

import LoginScreen from '@/Screens/Login/LoginScreen';
import PacientesScreen from '@/Screens/Pacientes/PacientesScreen';
import RegistroPacienteScreen from '@/Screens/RegistroPaciente/RegistroPacienteScreen';
import RegistroProfesionalScreen from '@/Screens/RegistroProfesional/RegistroProfesionalScreen';
import CreditosScreen from '@/Screens/Creditos/CreditosScreen';

/* -------------------------------------------------------------------------- */
/*  Navigator raíz — VIA+.                                                  */
/*  Gate por `state.auth.isLogged`: si no hay sesión, solo se monta el stack  */
/*  de Login; si la hay, se monta el stack principal empezando en Pacientes.  */
/*  Las 9 pantallas de módulo se registran aquí en una fase posterior (ver    */
/*  Contrato de Compilación §6.4).                                           */
/* -------------------------------------------------------------------------- */

const RootStack = createNativeStackNavigator<RootStackParamList>();

function LoginStack() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Login" component={LoginScreen} />
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
      <RootStack.Screen name="RegistroProfesional" component={RegistroProfesionalScreen} />
      <RootStack.Screen name="Creditos" component={CreditosScreen} />

      {/* Module + new screen routes appended by later phases */}
    </RootStack.Navigator>
  );
}

export default function DefaultNavigator() {
  const isLogged = useSelector((state: RootState) => state.auth.isLogged);
  return isLogged ? <MainStack /> : <LoginStack />;
}
