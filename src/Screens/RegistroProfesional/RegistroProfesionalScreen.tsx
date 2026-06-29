import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/* STUB — formulario real de alta de profesional (RBAC por rol) llega en una fase posterior. */
export default function RegistroProfesionalScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Registro de Profesional</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 20, color: '#2B2620' },
});
