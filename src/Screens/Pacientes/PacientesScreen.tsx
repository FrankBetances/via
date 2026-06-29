import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/* STUB — la UI real (lista/búsqueda de pacientes según mockups) llega en una fase posterior. */
export default function PacientesScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Pacientes</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 20, color: '#2B2620' },
});
