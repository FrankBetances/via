/**
 * Mock de assets de audio para Jest: el preset de react-native solo
 * transforma imágenes/vídeo (bmp|gif|jpg|jpeg|mp4|png|psd|svg|webp); los
 * require() de .m4a del registro de la audiometría verbal se resuelven aquí
 * a un id de asset ficticio, igual que hace assetFileTransformer con las
 * imágenes.
 */
module.exports = 1;
