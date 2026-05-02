import * as XLSX from 'xlsx';
import { Client } from '../routing/RouteEngine';

export const REQUIRED_COLS = [
  'CLIENTE',
  'RAZON SOCIAL',
  'NOMBRE CLIENTE',
  'ZONA',
  'DESCRIPCION',
  'LATITUDE',
  'LONGITUDE',
];

export interface ExcelParseResult {
  clients: Client[];
  zones: Record<string, Client[]>;
  filename: string;
}

export async function parseClientsExcel(file: File): Promise<ExcelParseResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const rawData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as any[];
        
        if (!rawData.length) {
          throw new Error('El archivo está vacío.');
        }

        // Normalize headers
        const normalizedData = rawData.map((row) => {
          const newRow: any = {};
          Object.keys(row).forEach((key) => {
            newRow[key.trim().toUpperCase().replace(/_/g, ' ')] = row[key];
          });
          return newRow;
        });

        const headers = Object.keys(normalizedData[0]);
        const missing = REQUIRED_COLS.filter((col) => !headers.includes(col));

        if (missing.length) {
          throw new Error(`Faltan columnas requeridas: ${missing.join(', ')}`);
        }

        const clients: Client[] = normalizedData
          .filter((r) => r['LATITUDE'] !== '' && r['LONGITUDE'] !== '')
          .map((r) => ({
            CLIENTE: String(r['CLIENTE'] || ''),
            RAZON_SOCIAL: String(r['RAZON SOCIAL'] || ''),
            NOMBRE_CLIENTE: String(r['NOMBRE CLIENTE'] || ''),
            ZONA: String(r['ZONA'] || 'SIN ZONA').trim(),
            DESCRIPCION: String(r['DESCRIPCION'] || ''),
            lat: parseFloat(r['LATITUDE']),
            lng: parseFloat(r['LONGITUDE']),
          }))
          .filter((c) => !isNaN(c.lat) && !isNaN(c.lng));

        if (!clients.length) {
          throw new Error('No se encontraron clientes con coordenadas válidas.');
        }

        const zones: Record<string, Client[]> = {};
        clients.forEach((c) => {
          if (!zones[c.ZONA]) {
            zones[c.ZONA] = [];
          }
          zones[c.ZONA].push(c);
        });

        resolve({ clients, zones, filename: file.name });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
}

export function downloadTemplate() {
  const wb = XLSX.utils.book_new();
  const wsData = [REQUIRED_COLS];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla Base');
  XLSX.writeFile(wb, 'rutaspro_planilla_base.xlsx');
}
