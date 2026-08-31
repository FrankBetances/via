import { StyleSheet } from 'react-native';

/* -------------------------------------------------------------------------- */
/*  Átomos de estilo — los retoques sueltos que antes iban EN LÍNEA.           */
/*                                                                            */
/*  `react-native/no-inline-styles` marcaba 577 objetos literales dentro de    */
/*  los `style={{…}}` de la app. Un objeto en línea se vuelve a crear en cada  */
/*  render, así que dos pantallas con el mismo `{ flex: 1 }` producían dos     */
/*  objetos nuevos por fotograma y ninguna comparación de props podía          */
/*  descartarlos. Aquí hay UNO por combinación, creado una sola vez.           */
/*                                                                            */
/*  El nombre se deriva de su contenido a propósito (`flex1`,                  */
/*  `marginTop2`, `colorFF7F00`): no describe INTENCIÓN, porque estos no la    */
/*  tienen —son ajustes puntuales sobre el componente de gluestack—, y así se  */
/*  encuentra el que ya existe en vez de añadir un duplicado. Un estilo con    */
/*  significado propio va al `StyleSheet` de su pantalla, no aquí.             */
/*                                                                            */
/*  GENERADO en su primera versión a partir de los avisos del linter; a        */
/*  partir de ahí se edita a mano como cualquier otro fichero.                 */
/* -------------------------------------------------------------------------- */

export const atoms = StyleSheet.create({
  alignItemsCenterMarginBottom2: {
    alignItems: 'center',
    marginBottom: 2,
  },
  alignSelfCenterMarginLeft4: {
    alignSelf: 'center',
    marginLeft: 4,
  },
  backgroundColor10B981: {
    backgroundColor: '#10B981',
  },
  backgroundColorCCFBF1: {
    backgroundColor: '#CCFBF1',
  },
  backgroundColorD1FAE5: {
    backgroundColor: '#D1FAE5',
  },
  backgroundColorE0F2FE: {
    backgroundColor: '#E0F2FE',
  },
  backgroundColorEF4444: {
    backgroundColor: '#EF4444',
  },
  backgroundColorF59E0B: {
    backgroundColor: '#F59E0B',
  },
  backgroundColorF6F3EE: {
    backgroundColor: '#F6F3EE',
  },
  backgroundColorFEE2E2: {
    backgroundColor: '#FEE2E2',
  },
  backgroundColorFEF3C7: {
    backgroundColor: '#FEF3C7',
  },
  borderColorDC2626: {
    borderColor: '#DC2626',
  },
  borderStyleDashed: {
    borderStyle: 'dashed',
  },
  color0066B3: {
    color: '#0066B3',
  },
  color0066B3FontWeightBold: {
    color: '#0066B3',
    fontWeight: 'bold',
  },
  color065F46: {
    color: '#065F46',
  },
  color0D9488FontSize11: {
    color: '#0D9488',
    fontSize: 11,
  },
  color0D9488FontWeightBoldFontSize13: {
    color: '#0D9488',
    fontWeight: 'bold',
    fontSize: 13,
  },
  color0EA5E9: {
    color: '#0EA5E9',
  },
  color0F172AFontWeight800: {
    color: '#0F172A',
    fontWeight: '800',
  },
  color1E293BFontSize14: {
    color: '#1E293B',
    fontSize: 14,
  },
  color1E8049: {
    color: '#1E8049',
  },
  color2563EBFontWeightBoldFontSize13: {
    color: '#2563EB',
    fontWeight: 'bold',
    fontSize: 13,
  },
  color2B2620: {
    color: '#2B2620',
  },
  color2B2620LetterSpacingNeg05: {
    color: '#2B2620',
    letterSpacing: -0.5,
  },
  color475569FontSize11: {
    color: '#475569',
    fontSize: 11,
  },
  color475569FontSize14: {
    color: '#475569',
    fontSize: 14,
  },
  color475569FontWeight500: {
    color: '#475569',
    fontWeight: '500',
  },
  color64748BTextDecorationLineUnderline: {
    color: '#64748B',
    textDecorationLine: 'underline',
  },
  color92400E: {
    color: '#92400E',
  },
  color94A3B8: {
    color: '#94A3B8',
  },
  color991B1B: {
    color: '#991B1B',
  },
  colorA855F7: {
    color: '#A855F7',
  },
  colorA89F93: {
    color: '#A89F93',
  },
  colorDC2626: {
    color: '#DC2626',
  },
  colorE63535: {
    color: '#E63535',
  },
  colorFF7F00: {
    color: '#FF7F00',
  },
  colorFFFFFFFontSize14: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  flex1: {
    flex: 1,
  },
  flex1ColorB91C1CLineHeight15: {
    flex: 1,
    color: '#B91C1C',
    lineHeight: 15,
  },
  flex1Height1: {
    flex: 1,
    height: 1,
  },
  flex1JustifyContentCenter: {
    flex: 1,
    justifyContent: 'center',
  },
  flex1LineHeight15: {
    flex: 1,
    lineHeight: 15,
  },
  flex1LineHeight16: {
    flex: 1,
    lineHeight: 16,
  },
  flex1LineHeight17: {
    flex: 1,
    lineHeight: 17,
  },
  flex1LineHeight18: {
    flex: 1,
    lineHeight: 18,
  },
  flex1MarginLeft14: {
    flex: 1,
    marginLeft: 14,
  },
  flex1MarginRight10: {
    flex: 1,
    marginRight: 10,
  },
  flex1TextAlignCenter: {
    flex: 1,
    textAlign: 'center',
  },
  flex1TextAlignRight: {
    flex: 1,
    textAlign: 'right',
  },
  flex2: {
    flex: 2,
  },
  flexGrow1FlexBasis18Pct: {
    flexGrow: 1,
    flexBasis: '18%',
  },
  flexGrow1PaddingHorizontal24PaddingTop8: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  fontSize11LineHeight15: {
    fontSize: 11,
    lineHeight: 15,
  },
  fontSize15LineHeight19LetterSpacingNeg02: {
    fontSize: 15,
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  fontSize15LineHeight20: {
    fontSize: 15,
    lineHeight: 20,
  },
  fontSize24: {
    fontSize: 24,
  },
  fontSize26LineHeight34: {
    fontSize: 26,
    lineHeight: 34,
  },
  fontSize32: {
    fontSize: 32,
  },
  fontSize56LineHeight66: {
    fontSize: 56,
    lineHeight: 66,
  },
  fontSize64LineHeight76: {
    fontSize: 64,
    lineHeight: 76,
  },
  fontSize72LineHeight84: {
    fontSize: 72,
    lineHeight: 84,
  },
  fontStyleItalicTextAlignCenter: {
    fontStyle: 'italic',
    textAlign: 'center',
  },
  fontWeight700Color5B554C: {
    fontWeight: '700',
    color: '#5B554C',
  },
  gap10: {
    gap: 10,
  },
  gap12MaxWidth340: {
    gap: 12,
    maxWidth: 340,
  },
  gap12MaxWidth360: {
    gap: 12,
    maxWidth: 360,
  },
  gap6: {
    gap: 6,
  },
  height10: {
    height: 10,
  },
  height180: {
    height: 180,
  },
  height56Gap4: {
    height: 56,
    gap: 4,
  },
  letterSpacing03: {
    letterSpacing: 0.3,
  },
  letterSpacing04: {
    letterSpacing: 0.4,
  },
  letterSpacing04TextAlignCenter: {
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  letterSpacing04TextTransformUppercase: {
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  letterSpacing05: {
    letterSpacing: 0.5,
  },
  letterSpacing1: {
    letterSpacing: 1,
  },
  lineHeight14: {
    lineHeight: 14,
  },
  lineHeight15: {
    lineHeight: 15,
  },
  lineHeight16: {
    lineHeight: 16,
  },
  lineHeight17: {
    lineHeight: 17,
  },
  lineHeight17Opacity095: {
    lineHeight: 17,
    opacity: 0.95,
  },
  lineHeight18: {
    lineHeight: 18,
  },
  lineHeight20: {
    lineHeight: 20,
  },
  lineHeight21: {
    lineHeight: 21,
  },
  lineHeight22: {
    lineHeight: 22,
  },
  lineHeight30: {
    lineHeight: 30,
  },
  marginBottom12: {
    marginBottom: 12,
  },
  marginBottom16: {
    marginBottom: 16,
  },
  marginBottom3: {
    marginBottom: 3,
  },
  marginHorizontal8: {
    marginHorizontal: 8,
  },
  marginLeft8: {
    marginLeft: 8,
  },
  marginRight3: {
    marginRight: 3,
  },
  marginTop1: {
    marginTop: 1,
  },
  marginTop10: {
    marginTop: 10,
  },
  marginTop14: {
    marginTop: 14,
  },
  marginTop16: {
    marginTop: 16,
  },
  marginTop2: {
    marginTop: 2,
  },
  marginTop3: {
    marginTop: 3,
  },
  marginTop8: {
    marginTop: 8,
  },
  maxWidth420Width100Pct: {
    maxWidth: 420,
    width: '100%',
  },
  minHeight64: {
    minHeight: 64,
  },
  opacity08: {
    opacity: 0.8,
  },
  opacity09: {
    opacity: 0.9,
  },
  opacity095LineHeight18: {
    opacity: 0.95,
    lineHeight: 18,
  },
  overflowHidden: {
    overflow: 'hidden',
  },
  paddingBottom40: {
    paddingBottom: 40,
  },
  positionRelative: {
    position: 'relative',
  },
  rowGap10: {
    rowGap: 10,
  },
  rowGap6: {
    rowGap: 6,
  },
  rowGap8: {
    rowGap: 8,
  },
  textAlignCenter: {
    textAlign: 'center',
  },
  textAlignCenterLineHeight15: {
    textAlign: 'center',
    lineHeight: 15,
  },
  textAlignCenterLineHeight16: {
    textAlign: 'center',
    lineHeight: 16,
  },
  textAlignCenterLineHeight22: {
    textAlign: 'center',
    lineHeight: 22,
  },
  textAlignVerticalTop: {
    textAlignVertical: 'top',
  },
  textTransformUppercase: {
    textTransform: 'uppercase',
  },
  textTransformUppercaseLetterSpacing03: {
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  textTransformUppercaseLetterSpacing04: {
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  textTransformUppercaseLetterSpacing05: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textTransformUppercaseOpacity08: {
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  top8Right8: {
    top: 8,
    right: 8,
  },
  topNeg8RightNeg8: {
    top: -8,
    right: -8,
  },
  width100Pct: {
    width: '100%',
  },
  width120: {
    width: 120,
  },
  width31PctMarginBottom12: {
    width: '31%',
    marginBottom: 12,
  },
  width42Pct: {
    width: '42%',
  },
  width50: {
    width: 50,
  },
  width90: {
    width: 90,
  },
  width90Color0066B3: {
    width: 90,
    color: '#0066B3',
  },
});
