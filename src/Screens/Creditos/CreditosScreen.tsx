import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/* STUB — pantalla de créditos real (acorde a mockups) llega en una fase posterior. */
export default function CreditosScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Créditos</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 20, color: '#2B2620' },
});
