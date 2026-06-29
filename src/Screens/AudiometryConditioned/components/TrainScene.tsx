import React, { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutChangeEvent, View } from 'react-native';
import { Box, HStack, Text } from '@gluestack-ui/themed';

interface Props {
  /** Estaciones alcanzadas para el oído activo (0..4). */
  progress: number;
  stationLabels: string[]; // ['500','1k','2k','4k']
  doneFlags: boolean[]; // por estación
  chugging: boolean;
  celebrate: boolean;
}

const STATION_PCT = [0.16, 0.38, 0.6, 0.82];

/* --------------------------------- Rueda ---------------------------------- */

const Wheel = ({ size, spin }: { size: number; spin: Animated.AnimatedInterpolation<string> }) => (
  <Animated.View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: '#33414C',
      borderWidth: 2,
      borderColor: '#1F2A33',
      transform: [{ rotate: spin }],
      alignItems: 'center',
      justifyContent: 'center',
    }}>
    <View style={{ width: size * 0.5, height: 2, backgroundColor: '#8A9BA8', position: 'absolute' }} />
    <View style={{ width: 2, height: size * 0.5, backgroundColor: '#8A9BA8', position: 'absolute' }} />
  </Animated.View>
);

/* ------------------------------ Escena del tren --------------------------- */

export default function TrainScene({ progress, stationLabels, doneFlags, chugging, celebrate }: Props) {
  const width = useRef(0);
  const trainX = useRef(new Animated.Value(0)).current;
  const wheel = useRef(new Animated.Value(0)).current;

  const targetIdx = Math.min(3, progress);

  const moveTo = (w: number) => {
    Animated.timing(trainX, {
      toValue: 6 + targetIdx * 22 > 0 ? (0.06 + targetIdx * 0.22) * w : 0,
      duration: 1500,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const onLayout = (e: LayoutChangeEvent) => {
    width.current = e.nativeEvent.layout.width;
    moveTo(width.current);
  };

  useEffect(() => {
    if (width.current) moveTo(width.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIdx]);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (chugging) {
      wheel.setValue(0);
      loop = Animated.loop(
        Animated.timing(wheel, { toValue: 1, duration: 600, easing: Easing.linear, useNativeDriver: true }),
      );
      loop.start();
    }
    return () => loop?.stop();
  }, [chugging, wheel]);

  const spin = wheel.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Box h={210} borderRadius={18} borderWidth={1.5} borderColor="#DCE7F0" style={{ overflow: 'hidden' }} onLayout={onLayout}>
      {/* cielo + suelo */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '53%', backgroundColor: '#CDE6FB' }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '47%', backgroundColor: '#DBF0DD' }} />
      {/* sol + nubes */}
      <View style={{ position: 'absolute', top: 14, right: 24, width: 34, height: 34, borderRadius: 17, backgroundColor: '#FFD86B' }} />
      <View style={{ position: 'absolute', top: 22, left: '16%', width: 54, height: 18, borderRadius: 12, backgroundColor: '#fff', opacity: 0.85 }} />
      <View style={{ position: 'absolute', top: 36, left: '50%', width: 46, height: 15, borderRadius: 10, backgroundColor: '#fff', opacity: 0.7 }} />
      {/* colinas */}
      <View style={{ position: 'absolute', bottom: '44%', left: -30, width: 220, height: 120, borderRadius: 110, backgroundColor: '#CDEBC8', opacity: 0.8 }} />
      <View style={{ position: 'absolute', bottom: '44%', right: -40, width: 260, height: 140, borderRadius: 130, backgroundColor: '#C2E6BE', opacity: 0.7 }} />

      {/* estaciones */}
      {STATION_PCT.map((pct, i) => (
        <View key={i} style={{ position: 'absolute', bottom: 36, left: `${pct * 100}%`, alignItems: 'center', marginLeft: -16, zIndex: 2 }}>
          {/* bandera */}
          <View style={{ flexDirection: 'row', marginBottom: -1 }}>
            <View style={{ width: 2, height: 14, backgroundColor: '#9C6B3F' }} />
            <View style={{ width: 9, height: 7, backgroundColor: doneFlags[i] ? '#34A853' : '#C0392B' }} />
          </View>
          {/* edificio */}
          <View style={{ width: 30, height: 24, borderRadius: 5, backgroundColor: doneFlags[i] ? '#9BD7AE' : '#E9DFCB', borderWidth: 2, borderColor: '#B98A5E' }}>
            <View style={{ position: 'absolute', top: -9, left: -3, right: -3, height: 9, backgroundColor: '#9C6B3F', borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
          </View>
          <Box bg="rgba(255,255,255,0.85)" px="$1.5" borderRadius={4} mt="$1">
            <Text fontSize={8} fontWeight="$bold" color="#3A352F">{stationLabels[i]}</Text>
          </Box>
        </View>
      ))}

      {/* vía */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 30, height: 6, backgroundColor: '#8A9BA8' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 24, height: 6, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 }}>
        {Array.from({ length: 16 }).map((_, i) => (
          <View key={i} style={{ width: 5, height: 6, backgroundColor: '#7A4F2B' }} />
        ))}
      </View>

      {/* TREN */}
      <Animated.View style={{ position: 'absolute', bottom: 30, left: 0, zIndex: 5, transform: [{ translateX: trainX }] }}>
        <HStack alignItems="flex-end">
          {/* coche de pasajeros */}
          <View style={{ marginRight: 3 }}>
            <View style={{ position: 'absolute', left: -2, right: -2, top: -5, height: 6, borderRadius: 4, backgroundColor: '#1F6B58' }} />
            <HStack
              style={{ width: 78, height: 38, borderRadius: 7, backgroundColor: '#2E8B74', borderWidth: 2, borderColor: '#1F6B58', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 }}
              space="xs">
              {['🐰', '🐻', '🦊'].map((p, i) => (
                <Box key={i} style={{ width: 14, height: 16, borderRadius: 3, backgroundColor: '#BFE9FF', borderWidth: 1, borderColor: '#1F6B58', alignItems: 'center', justifyContent: 'center' }}>
                  <Text fontSize={9}>{p}</Text>
                </Box>
              ))}
            </HStack>
            <HStack style={{ width: 60, justifyContent: 'space-around', alignSelf: 'center', marginTop: 3 }}>
              <Wheel size={16} spin={spin} />
              <Wheel size={16} spin={spin} />
            </HStack>
          </View>

          <View style={{ width: 7, height: 4, backgroundColor: '#33414C', marginBottom: 14 }} />

          {/* locomotora */}
          <View style={{ position: 'relative' }}>
            {/* caldera */}
            <View style={{ position: 'absolute', bottom: 14, left: 30, width: 64, height: 30, borderTopLeftRadius: 6, borderBottomLeftRadius: 6, borderTopRightRadius: 14, borderBottomRightRadius: 14, backgroundColor: '#34495A', borderWidth: 2, borderColor: '#1F2A33' }} />
            {/* chimenea */}
            <View style={{ position: 'absolute', bottom: 42, left: 34, width: 13, height: 16, borderRadius: 3, backgroundColor: '#33414C', borderWidth: 2, borderColor: '#1F2A33' }} />
            {/* domo */}
            <View style={{ position: 'absolute', bottom: 42, left: 56, width: 12, height: 9, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#C0392B', borderWidth: 2, borderColor: '#8E2A20' }} />
            {/* faro */}
            <View style={{ position: 'absolute', bottom: 20, left: 90, width: 8, height: 10, borderRadius: 3, backgroundColor: '#FFD24A', borderWidth: 1.5, borderColor: '#1F2A33' }} />
            {/* cabina */}
            <View style={{ width: 34, height: 48, borderTopLeftRadius: 7, borderTopRightRadius: 7, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: '#C0392B', borderWidth: 2, borderColor: '#8E2A20', zIndex: 2 }}>
              <View style={{ width: 18, height: 16, borderRadius: 4, backgroundColor: '#BFE9FF', borderWidth: 1.5, borderColor: '#8E2A20', alignSelf: 'center', marginTop: 7 }} />
            </View>
            {/* ruedas */}
            <HStack style={{ width: 96, alignItems: 'flex-end', marginTop: 3, paddingLeft: 30 }} space="xs">
              <Wheel size={22} spin={spin} />
              <Wheel size={22} spin={spin} />
              <View style={{ marginBottom: 3 }}>
                <Wheel size={15} spin={spin} />
              </View>
            </HStack>
          </View>
        </HStack>
      </Animated.View>

      {/* confeti */}
      {celebrate ? (
        <HStack style={{ position: 'absolute', top: 10, left: 0, right: 0, justifyContent: 'center' }} space="md">
          <Text fontSize={18}>🎉</Text>
          <Text fontSize={15}>🎫</Text>
          <Text fontSize={17}>✨</Text>
          <Text fontSize={15}>🎊</Text>
        </HStack>
      ) : null}
    </Box>
  );
}
