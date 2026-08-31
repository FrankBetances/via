import React, { useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Center, HStack, Icon, VStack } from '@gluestack-ui/themed';
import { Eraser, PenLine } from 'lucide-react-native';

import Text from './Text';

import { useT } from '@/I18n';
import { atoms } from '@/Theme/styleAtoms';
/* -------------------------------------------------------------------------- */
/*  SignaturePad — pad de firma manuscrita (SVG + PanResponder).               */
/*                                                                            */
/*  Extraído de ConsentimientoScreen para reutilizarlo en cualquier prueba    */
/*  que requiera dejar constancia firmada (p. ej. el cierre manual del        */
/*  análisis acústico de voz). El trazo se acumula como lista de paths SVG    */
/*  («M… L…»); para persistirlo se suele guardar `paths.join(' ')`.           */
/*                                                                            */
/*  `setScrollEnabled` permite congelar el ScrollView contenedor mientras se  */
/*  firma (si no, el gesto desplaza la pantalla en lugar de trazar).           */
/* -------------------------------------------------------------------------- */

export interface SignaturePadProps {
  paths: string[];
  onAddPath: (path: string) => void;
  onClear: () => void;
  setScrollEnabled: (enabled: boolean) => void;
  /** Texto guía cuando el pad está vacío. */
  placeholder?: string;
}

const styles = StyleSheet.create({
  canvas: {
    height: 150,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#E5DED2',
    backgroundColor: '#FDFCFA',
    overflow: 'hidden',
  },
});

export default function SignaturePad({
  paths,
  onAddPath,
  onClear,
  setScrollEnabled,
  placeholder,
}: SignaturePadProps) {
  const t = useT();
  const [livePath, setLivePath] = useState('');
  const currentPath = useRef('');

  // Callbacks vivos para el PanResponder (se crea una sola vez).
  const addPathRef = useRef(onAddPath);
  addPathRef.current = onAddPath;
  const setScrollRef = useRef(setScrollEnabled);
  setScrollRef.current = setScrollEnabled;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        setScrollRef.current(false);
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setLivePath(currentPath.current);
      },
      onPanResponderMove: e => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setLivePath(currentPath.current);
      },
      onPanResponderRelease: () => {
        setScrollRef.current(true);
        if (currentPath.current.includes('L')) addPathRef.current(currentPath.current);
        currentPath.current = '';
        setLivePath('');
      },
      onPanResponderTerminate: () => {
        setScrollRef.current(true);
        currentPath.current = '';
        setLivePath('');
      },
    }),
  ).current;

  const hasInk = paths.length > 0 || !!livePath;

  return (
    <VStack>
      <View
        {...responder.panHandlers}
        style={styles.canvas}>
        {/* pointerEvents none: el View contenedor es el objetivo táctil y las
            coordenadas locationX/Y quedan siempre referidas a él. */}
        <Svg width="100%" height="100%" pointerEvents="none">
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#3A3630" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {livePath ? (
            <Path d={livePath} stroke="#3A3630" strokeWidth={2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
        {!hasInk ? (
          <Center style={StyleSheet.absoluteFill} pointerEvents="none">
            <Icon as={PenLine} size="md" color="$textLight300" />
            <Text size="2xs" color="$textLight400" mt="$1">
              {placeholder ?? t.components.firmeAqui}
            </Text>
          </Center>
        ) : null}
      </View>
      <HStack justifyContent="flex-end" mt="$2">
        <Pressable onPress={onClear} disabled={!paths.length} hitSlop={8}>
          <HStack space="xs" alignItems="center" style={paths.length ? atoms.opacity1 : atoms.opacity04}>
            <Icon as={Eraser} size="xs" color="$textLight500" />
            <Text size="xs" weight="bold" color="$textLight500">
              
              {t.components.borrarFirma}
            </Text>
          </HStack>
        </Pressable>
      </HStack>
    </VStack>
  );
}
