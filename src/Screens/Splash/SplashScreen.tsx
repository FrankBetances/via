import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';

/* Splash mostrado mientras se inicializa el DataSource de TypeORM en App.tsx. */
export default function SplashScreen() {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#F0AE6C" />
      <Text style={styles.text}>VIA+</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F2EC', alignItems: 'center', justifyContent: 'center', gap: 16 },
  text: { fontSize: 18, color: '#2B2620', fontWeight: '600' },
});
