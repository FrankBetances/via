/* -------------------------------------------------------------------------- */
/*  Presentación de Lúa · render, navegación y FALLO DE LOS ENLACES.            */
/*                                                                             */
/*  El tercer caso es el que justifica el fichero. `Linking.openURL` RECHAZA    */
/*  cuando no hay ninguna actividad que atienda el intent, y las imágenes de    */
/*  AVD del emulador —donde prueba Frank— no traen cliente de correo. Sin       */
/*  `catch`, el botón «Contactar» no hace nada y no dice nada: exactamente la   */
/*  regla 4. Aquí se comprueba que el rechazo se convierte en texto visible.    */
/*                                                                             */
/*  Los textos se leen del catálogo (`ES`), no a mano: así una pantalla que se  */
/*  saliera del catálogo rompe esta prueba en vez de pasarla con un literal.    */
/* -------------------------------------------------------------------------- */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ReactNative from 'react-native';
import { Linking } from 'react-native';

import PresentacionLuaScreen from '../PresentacionLuaScreen';
import { ES } from '@/I18n/strings.es';

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

const navMock = () =>
  ({ goBack: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn(() => true) }) as any;

const mount = (navigation: any) => {
  let tree: any;
  act(() => {
    tree = create(
      <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>
        <PresentacionLuaScreen navigation={navigation} route={{} as any} />
      </SafeAreaProvider>,
    );
  });
  return tree!;
};

describe('PresentacionLuaScreen', () => {
  it('se monta respetando el área segura y pinta el texto del catálogo', () => {
    const tree = mount(navMock());
    const json = JSON.stringify(tree.toJSON());

    [
      ES.luaIntro.navTitle,
      ES.luaIntro.emblemHeading,
      ES.luaIntro.cardTitle,
      ES.luaIntro.badgeZeroPhi,
      ES.luaIntro.empathyName,
      ES.luaIntro.bleName,
      ES.luaIntro.privacyName,
      ES.luaIntro.highlightTitle,
    ].forEach(texto => expect(json).toContain(texto));

    act(() => tree.unmount());
  });

  it('el botón inferior lleva a la selección de profesional', () => {
    const navigation = navMock();
    const tree = mount(navigation);

    const boton = tree.root.findByProps({ accessibilityLabel: ES.luaIntro.dockButton });
    act(() => boton.props.onPress());

    expect(navigation.navigate).toHaveBeenCalledWith('SeleccionProfesional');
    act(() => tree.unmount());
  });

  it('abre la web y el correo de contacto', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as any);
    const tree = mount(navMock());

    const web = tree.root.findByProps({ accessibilityLabel: ES.luaIntro.infoA11y });
    const correo = tree.root.findByProps({ accessibilityLabel: ES.luaIntro.contactA11y });

    await act(async () => {
      await web.props.onPress();
    });
    expect(openURL).toHaveBeenCalledWith('https://earlify.health');

    await act(async () => {
      await correo.props.onPress();
    });
    expect(openURL.mock.calls[1]![0]).toContain('mailto:contacto@earlify.health');

    // Nada que abrir bien deja aviso en pantalla.
    expect(JSON.stringify(tree.toJSON())).not.toContain(ES.luaIntro.emailFailed);

    openURL.mockRestore();
    act(() => tree.unmount());
  });

  it('REGLA 4: si no hay aplicación que abra el enlace, la pantalla lo DICE', async () => {
    // Es el rechazo real del emulador sin cliente de correo, no uno inventado:
    // `Linking.openURL` rechaza con el error del intent sin resolver.
    const openURL = jest
      .spyOn(Linking, 'openURL')
      .mockRejectedValue(new Error('No Activity found to handle Intent'));
    const tree = mount(navMock());

    const correo = tree.root.findByProps({ accessibilityLabel: ES.luaIntro.contactA11y });
    await act(async () => {
      await correo.props.onPress();
    });

    // El aviso nombra el fallo Y deja la dirección para poder seguir a mano.
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(ES.luaIntro.emailFailed);
    expect(json).toContain('contacto@earlify.health');

    // Y el de la web tiene su propio texto: dos vías, dos mensajes.
    const web = tree.root.findByProps({ accessibilityLabel: ES.luaIntro.infoA11y });
    await act(async () => {
      await web.props.onPress();
    });
    expect(JSON.stringify(tree.toJSON())).toContain(ES.luaIntro.webFailed);

    openURL.mockRestore();
    act(() => tree.unmount());
  });

  it('se adapta correctamente al viewport de un teléfono móvil estrecho (< 380)', () => {
    const spy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 360,
      height: 740,
      scale: 2,
      fontScale: 1,
    });
    const mobileMetrics = {
      frame: { x: 0, y: 0, width: 360, height: 740 },
      insets: { top: 38, left: 0, right: 0, bottom: 24 },
    };
    let tree: any;
    act(() => {
      tree = create(
        <SafeAreaProvider initialMetrics={mobileMetrics}>
          <PresentacionLuaScreen navigation={navMock()} route={{} as any} />
        </SafeAreaProvider>,
      );
    });
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(ES.luaIntro.navTitle);
    expect(json).toContain(ES.luaIntro.dockButton);
    expect(json).toContain(ES.luaIntro.emblemHeading);

    spy.mockRestore();
    act(() => tree.unmount());
  });

  it('se adapta correctamente al viewport apaisado de tableta (>= 850)', () => {
    const spy = jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 1024,
      height: 768,
      scale: 2,
      fontScale: 1,
    });
    const tree = mount(navMock());
    const json = JSON.stringify(tree.toJSON());
    expect(json).toContain(ES.luaIntro.navTitle);
    expect(json).toContain(ES.luaIntro.dockButton);
    expect(json).toContain(ES.luaIntro.emblemHeading);

    spy.mockRestore();
    act(() => tree.unmount());
  });
});
