import {
  documentDirectory,
  EncodingType,
  getInfoAsync,
  makeDirectoryAsync,
  StorageAccessFramework,
  writeAsStringAsync,
} from 'expo-file-system/legacy';

/* -------------------------------------------------------------------------- */
/*  Dónde acaba el PDF del informe.                                            */
/*                                                                            */
/*  Hasta el 2/11/2026 «Exportar PDF» generaba el documento y la pantalla     */
/*  DESCARTABA los bytes: nadie podía abrirlo ni guardarlo, y el aviso decía  */
/*  «generado y archivado correctamente». Ahora:                              */
/*    1. Se escribe SIEMPRE una copia en el almacenamiento privado de la app  */
/*       (`<documents>/informes/`). Es el archivo local del informe firmado.  */
/*    2. Se ofrece guardar una copia fuera (Android: selector de carpetas del  */
/*       sistema, Storage Access Framework). El profesional elige dónde.      */
/*  Cada paso devuelve su resultado: la pantalla dice exactamente qué pasó.   */
/*                                                                            */
/*  `expo-file-system` es dependencia del propio `expo` (SDK 54): no añade    */
/*  código nativo nuevo al APK. Se usa la API `legacy` porque es la que trae  */
/*  `StorageAccessFramework`.                                                 */
/* -------------------------------------------------------------------------- */

export const REPORT_DIR_NAME = 'informes';

/** Nombre sin datos del paciente: id de evaluación y fecha. Zero-PHI en el nombre. */
export const reportFileName = (evaluationId: number, at: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `VIA-informe-${evaluationId}-${stamp}`;
};

export type SaveInAppResult = { ok: true; uri: string } | { ok: false; error: string };

/** Escribe el PDF en `<documents>/informes/<nombre>.pdf`. */
export async function saveReportInApp(base64: string, baseName: string): Promise<SaveInAppResult> {
  try {
    if (!documentDirectory) return { ok: false, error: 'documentDirectory no disponible' };
    const dir = `${documentDirectory}${REPORT_DIR_NAME}/`;
    const info = await getInfoAsync(dir);
    if (!info.exists) await makeDirectoryAsync(dir, { intermediates: true });
    const uri = `${dir}${baseName}.pdf`;
    await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
    return { ok: true, uri };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export type ExportCopyResult =
  | { status: 'saved'; uri: string }
  | { status: 'cancelled' }
  | { status: 'failed'; error: string };

/** Pide una carpeta al sistema y guarda allí una copia del PDF. */
export async function exportReportCopy(base64: string, baseName: string): Promise<ExportCopyResult> {
  try {
    const permission = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!permission.granted) return { status: 'cancelled' };
    const uri = await StorageAccessFramework.createFileAsync(
      permission.directoryUri,
      baseName,
      'application/pdf',
    );
    await writeAsStringAsync(uri, base64, { encoding: EncodingType.Base64 });
    return { status: 'saved', uri };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}
