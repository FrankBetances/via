/* -------------------------------------------------------------------------- */
/*  Guardado del PDF. El mock reproduce el contrato de la API legacy de        */
/*  expo-file-system 19.0.24, leído en su fuente                               */
/*  (`android/.../legacy/FileSystemLegacyModule.kt` y `FileSystem.types.d.ts`):*/
/*  · requestDirectoryPermissionsAsync → `{ granted: false }` si se cancela,  */
/*    `{ granted: true, directoryUri }` si no; LANZA si ya hay una petición    */
/*    pendiente (FileSystemPendingPermissionsRequestException).               */
/*  · createFileAsync(dir, nombre SIN extensión, mime) → URI SAF del fichero. */
/* -------------------------------------------------------------------------- */

const mockWritten: { uri: string; contents: string; encoding: unknown }[] = [];
const mockDirs: string[] = [];
let mockPermission: { granted: boolean; directoryUri?: string } | Error = { granted: false };

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///data/user/0/via/files/',
  EncodingType: { UTF8: 'utf8', Base64: 'base64' },
  getInfoAsync: jest.fn(async (uri: string) => ({ exists: mockDirs.includes(uri), uri })),
  makeDirectoryAsync: jest.fn(async (uri: string) => {
    mockDirs.push(uri);
  }),
  writeAsStringAsync: jest.fn(async (uri: string, contents: string, options: { encoding: unknown }) => {
    mockWritten.push({ uri, contents, encoding: options.encoding });
  }),
  StorageAccessFramework: {
    requestDirectoryPermissionsAsync: jest.fn(async () => {
      if (mockPermission instanceof Error) throw mockPermission;
      return mockPermission;
    }),
    createFileAsync: jest.fn(async (dir: string, name: string, mime: string) => `${dir}/document/${name}.${mime === 'application/pdf' ? 'pdf' : 'bin'}`),
  },
}));

import { exportReportCopy, reportFileName, saveReportInApp } from '@/PDF/reportFile';

beforeEach(() => {
  mockWritten.length = 0;
  mockDirs.length = 0;
  mockPermission = { granted: false };
});

describe('reportFile', () => {
  it('el nombre no lleva datos del paciente', () => {
    const name = reportFileName(42, new Date(2026, 10, 2, 9, 5, 7));
    expect(name).toBe('VIA-informe-42-20261102-090507');
  });

  it('guarda siempre en <documents>/informes/ en base64', async () => {
    const result = await saveReportInApp('JVBERi0=', 'VIA-informe-1-x');
    expect(result).toEqual({ ok: true, uri: 'file:///data/user/0/via/files/informes/VIA-informe-1-x.pdf' });
    expect(mockDirs).toEqual(['file:///data/user/0/via/files/informes/']);
    expect(mockWritten[0]).toEqual({ uri: result.ok ? result.uri : '', contents: 'JVBERi0=', encoding: 'base64' });
  });

  it('cancelar el selector no es un error y no escribe nada fuera', async () => {
    expect(await exportReportCopy('JVBERi0=', 'n')).toEqual({ status: 'cancelled' });
    expect(mockWritten).toEqual([]);
  });

  it('con carpeta elegida escribe la copia allí', async () => {
    mockPermission = { granted: true, directoryUri: 'content://tree/Download' };
    const result = await exportReportCopy('JVBERi0=', 'VIA-informe-1-x');
    expect(result).toEqual({ status: 'saved', uri: 'content://tree/Download/document/VIA-informe-1-x.pdf' });
    expect(mockWritten[0].encoding).toBe('base64');
  });

  it('un fallo del sistema se devuelve con su motivo, no se traga', async () => {
    mockPermission = new Error('pending permissions request');
    expect(await exportReportCopy('JVBERi0=', 'n')).toEqual({ status: 'failed', error: 'pending permissions request' });
  });
});
