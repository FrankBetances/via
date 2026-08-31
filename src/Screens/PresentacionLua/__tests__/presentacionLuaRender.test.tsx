import React from 'react';
import { act, create } from 'react-test-renderer';
import PresentacionLuaScreen from '../PresentacionLuaScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Linking } from 'react-native';

jest.mock('@/Components/Common', () => ({
  Header: () => null,
  Text: ({ children, style }: any) => <span style={style}>{children}</span>,
}));

jest.mock('@/Components/Common/ViaIcon', () => 'ViaIcon');
jest.mock('@/Components/Mascot/LuaPixel', () => ({
  CatPixel: () => 'CatPixel',
}));

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 24, left: 0, right: 0, bottom: 16 },
};

describe('PresentacionLuaScreen', () => {
  it('renders correctly and respects Safe Area', () => {
    let tree: any;
    const navMock = { goBack: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) } as any;

    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <PresentacionLuaScreen navigation={navMock} route={{} as any} />
        </SafeAreaProvider>,
      );
    });

    const json = JSON.stringify(tree.toJSON());

    // Verificamos textos clave
    expect(json).toContain('Lúa · Mascota y Periférico');
    expect(json).toContain('ACOMPAÑANTE PEDIÁTRICO');
    expect(json).toContain('DISPOSITIVO FÍSICO OPCIONAL');
    expect(json).toContain('Zero-PHI');
    expect(json).toContain('Empatía y Calma Clínica');

    act(() => {
      tree.unmount();
    });
  });

  it('navigates forward to SeleccionProfesional', () => {
    const navMock = { goBack: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) } as any;
    let tree: any;

    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <PresentacionLuaScreen navigation={navMock} route={{} as any} />
        </SafeAreaProvider>,
      );
    });

    // Encontrar el botón de Continuar y simular onPress
    const button = tree.root.findByProps({ accessibilityLabel: 'Comenzar Selección Profesional' });
    act(() => {
      button.props.onPress();
    });

    expect(navMock.navigate).toHaveBeenCalledWith('SeleccionProfesional');

    act(() => {
      tree.unmount();
    });
  });

  it('opens Web and Email links for contact', async () => {
    const navMock = { goBack: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) } as any;
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    let tree: any;

    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
          <PresentacionLuaScreen navigation={navMock} route={{} as any} />
        </SafeAreaProvider>,
      );
    });

    // Botón de la web
    const webButton = tree.root.findByProps({ accessibilityLabel: 'Botón Más Información' });
    
    // Botón de email
    const emailButton = tree.root.findByProps({ accessibilityLabel: 'Botón Contactar' });

    expect(webButton).toBeDefined();
    expect(emailButton).toBeDefined();

    await act(async () => {
      webButton.props.onPress();
    });
    expect(openURLSpy).toHaveBeenCalledWith('https://earlify.health');

    await act(async () => {
      emailButton.props.onPress();
    });
    expect(openURLSpy).toHaveBeenCalledWith('mailto:contacto@earlify.health?subject=Solicitud de Mascota Lúa');

    openURLSpy.mockRestore();

    act(() => {
      tree.unmount();
    });
  });
});
