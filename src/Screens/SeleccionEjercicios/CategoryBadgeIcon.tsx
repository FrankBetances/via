import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Rect, Text as SvgText } from 'react-native-svg';

export type CategoryType = 'all' | 'hearing' | 'voice' | 'neuro' | 'sleep' | 'dysphagia';

interface Props {
  category: CategoryType;
  size?: number;
  isActive?: boolean;
}

/** 1. TODAS (10): Cuadrícula 2x2 de 4 cuadrados redondeados (Grid icon) */
function AllBadge({ size, isActive }: { size: number; isActive: boolean }) {
  const c = isActive ? '#FF7F00' : '#475569';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke={c} strokeWidth="2" fill={isActive ? '#FFEDD5' : 'none'} />
      <Rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke={c} strokeWidth="2" fill={isActive ? '#FFEDD5' : 'none'} />
      <Rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke={c} strokeWidth="2" fill={isActive ? '#FFEDD5' : 'none'} />
      <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" stroke={c} strokeWidth="2" fill={isActive ? '#FFEDD5' : 'none'} />
    </Svg>
  );
}

/** 2. PRUEBAS AUDITIVAS (3): Oreja / Audición acústica */
function HearingBadge({ size, isActive }: { size: number; isActive: boolean }) {
  const c = isActive ? '#FF7F00' : '#0284C7';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 10 C6 5.5 9 3 13.5 3 C18 3 20 6.5 20 10.5 C20 14.5 17 17 14 18.5 C12 19.5 11 21 11 22 M14 10 C14 8 13 7 11.5 7 C10 7 9 8 9 9.5 C9 11.5 12 12.5 12 14.5"
        stroke={c}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Ondas sonoras exteriores */}
      <Path
        d="M17 6.5 C18.5 7.8 19.5 9.5 19.5 11.5"
        stroke={c}
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity={0.8}
      />
    </Svg>
  );
}

/** 3. VOZ (2): Micrófono con ondas */
function VoiceBadge({ size, isActive }: { size: number; isActive: boolean }) {
  const c = isActive ? '#FF7F00' : '#7C3AED';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" stroke={c} strokeWidth="2" fill={isActive ? '#FFEDD5' : 'none'} />
      <Path d="M5 10 C5 14 8 17 12 17 C16 17 19 14 19 10" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="17" x2="12" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <Line x1="8" y1="21" x2="16" y2="21" stroke={c} strokeWidth="2" strokeLinecap="round" />
      {/* Rayitas de vibración */}
      <Path d="M3 10 H1 M23 10 H21" stroke={c} strokeWidth="2" strokeLinecap="round" opacity={0.6} />
    </Svg>
  );
}

/** 4. NEURODESARROLLO (3): Cerebro con lóbulos / sinapsis */
function NeuroBadge({ size, isActive }: { size: number; isActive: boolean }) {
  const c = isActive ? '#FF7F00' : '#059669';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9.5 4 C7 4 5 6 5 8.5 C5 9.3 5.3 10 5.7 10.6 C4.7 11.4 4 12.6 4 14 C4 16 5.5 17.7 7.5 18 C7.7 19.1 8.5 20 9.5 20 C10.8 20 11.8 19 12 17.8 C12.2 19 13.2 20 14.5 20 C15.5 20 16.3 19.1 16.5 18 C18.5 17.7 20 16 20 14 C20 12.6 19.3 11.4 18.3 10.6 C18.7 10 19 9.3 19 8.5 C19 6 17 4 14.5 4 C13.5 4 12.6 4.4 12 5.1 C11.4 4.4 10.5 4 9.5 4 Z"
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={isActive ? '#FFEDD5' : 'none'}
      />
      <Path d="M12 5.5 V18 M8 10 H10 M14 10 H16 M7 14 H10 M14 14 H17" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

/** 5. SUEÑO (1): Luna creciente con 'zZ' */
function SleepBadge({ size, isActive }: { size: number; isActive: boolean }) {
  const c = isActive ? '#FF7F00' : '#4F46E5';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 4 C11 5 8 8.5 8 13 C8 17.5 11.5 21 16 21 C18 21 19.5 20.2 20.8 19 C14.5 19.5 10 14 11.5 8 C12.2 6.2 13.5 4.8 15 4 Z"
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill={isActive ? '#FFEDD5' : 'none'}
      />
      <SvgText x="15" y="9" fill={c} fontSize="7" fontWeight="bold">
        z
      </SvgText>
      <SvgText x="18" y="6" fill={c} fontSize="6" fontWeight="bold">
        Z
      </SvgText>
    </Svg>
  );
}

/** 6. DISFAGIA (1): Gota / Deglución y sensor SpO2 */
function DysphagiaBadge({ size, isActive }: { size: number; isActive: boolean }) {
  const c = isActive ? '#FF7F00' : '#DC2626';
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 C12 3 6 10.5 6 15 C6 18.3 8.7 21 12 21 C15.3 21 18 18.3 18 15 C18 10.5 12 3 12 3 Z"
        stroke={c}
        strokeWidth="1.8"
        fill={isActive ? '#FFEDD5' : 'none'}
      />
      <Path
        d="M8.5 15 H10.5 L11.5 12 L12.5 17 L13.5 13.5 L14.5 15 H15.5"
        stroke={c}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Line(props: any) {
  const { stroke, strokeWidth, strokeLinecap, x1, x2, y1, y2 } = props;
  return <Path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={strokeLinecap} />;
}

export default function CategoryBadgeIcon({ category, size = 20, isActive = false }: Props) {
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      {category === 'all' && <AllBadge size={size} isActive={isActive} />}
      {category === 'hearing' && <HearingBadge size={size} isActive={isActive} />}
      {category === 'voice' && <VoiceBadge size={size} isActive={isActive} />}
      {category === 'neuro' && <NeuroBadge size={size} isActive={isActive} />}
      {category === 'sleep' && <SleepBadge size={size} isActive={isActive} />}
      {category === 'dysphagia' && <DysphagiaBadge size={size} isActive={isActive} />}
    </View>
  );
}
