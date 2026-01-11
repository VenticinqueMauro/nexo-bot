import { Env } from '../types';
import { getAccessToken } from './auth';

let cachedToken: { token: string; expires: number } | null = null;

/**
 * Obtiene un access token (con cache)
 */
async function getToken(env: Env): Promise<string> {
  const now = Date.now();

  if (cachedToken && cachedToken.expires > now) {
    return cachedToken.token;
  }

  const token = await getAccessToken(env);
  cachedToken = {
    token,
    expires: now + 3500 * 1000, // 58 minutos
  };

  return token;
}

/**
 * Realiza una petición a la API de Google Sheets
 */
async function sheetsRequest(
  env: Env,
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  const token = await getToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SHEETS_ID}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Sheets API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Obtiene valores de una hoja
 */
export async function getSheetValues(
  env: Env,
  sheetName: string
): Promise<any[][]> {
  const data = await sheetsRequest(env, `/values/${encodeURIComponent(sheetName)}`);
  return data.values || [];
}

/**
 * Agrega una fila a una hoja
 */
export async function appendRow(
  env: Env,
  sheetName: string,
  values: any[]
): Promise<void> {
  await sheetsRequest(
    env,
    `/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({
        values: [values],
      }),
    }
  );
}

/**
 * Actualiza una fila específica
 */
export async function updateRow(
  env: Env,
  sheetName: string,
  rowIndex: number,
  values: any[]
): Promise<void> {
  const range = `${sheetName}!A${rowIndex}:Z${rowIndex}`;
  await sheetsRequest(env, `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [values],
    }),
  });
}

/**
 * Convierte valores de hoja a array de objetos
 * Detecta automáticamente la fila de headers (primera fila con datos)
 */
export function rowsToObjects<T>(rows: any[][]): T[] {
  if (rows.length === 0) return [];

  // Encontrar la primera fila con datos (los headers)
  let headerRowIndex = 0;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i] && rows[i].length > 0 && rows[i].some(cell => cell && cell.toString().trim() !== '')) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = rows[headerRowIndex];
  const dataRows = rows.slice(headerRowIndex + 1);

  console.log('Headers encontrados en fila:', headerRowIndex, headers);

  return dataRows.map((row) => {
    const obj: any = {};
    headers.forEach((header, index) => {
      if (header) { // Solo agregar si el header existe
        obj[header] = row[index] || '';
      }
    });
    return obj as T;
  });
}

/**
 * Genera un ID único para nuevas entradas
 */
export function generateId(prefix: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 7);
  return `${prefix}${timestamp}${random}`.toUpperCase();
}

/**
 * Formatea una fecha para Google Sheets (YYYY-MM-DD)
 */
export function formatDateForSheet(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

/**
 * Busca coincidencias difusas de texto (para búsqueda de clientes/productos)
 */
export function fuzzyMatch(search: string, target: string): boolean {
  const searchLower = search.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();

  // Coincidencia exacta
  if (targetLower.includes(searchLower)) {
    return true;
  }

  // Coincidencia por palabras
  const searchWords = searchLower.split(/\s+/);
  return searchWords.every(word => targetLower.includes(word));
}

/**
 * Normaliza nombres de productos para búsqueda
 */
export function normalizeProductName(name: string): string {
  const normalized = name.toLowerCase().trim();

  // Mapeo de nombres comunes
  const aliases: Record<string, string> = {
    'coca': 'coca cola',
    'sprite': 'sprite',
    'fanta': 'fanta',
    'agua': 'agua mineral',
    'mineral': 'agua mineral',
    'quilmes': 'cerveza quilmes',
    'cerveza': 'cerveza quilmes',
    'seven': '7up',
    '7up': '7up',
  };

  for (const [alias, canonical] of Object.entries(aliases)) {
    if (normalized.includes(alias)) {
      return canonical;
    }
  }

  return normalized;
}

/**
 * Normaliza presentaciones de productos
 */
export function normalizePresentacion(presentacion?: string): string {
  if (!presentacion) return '';

  const normalized = presentacion.toLowerCase().trim();

  // Mapeo de presentaciones
  const aliases: Record<string, string> = {
    '2.25': '2.25L',
    '2 y cuarto': '2.25L',
    'grande': '2.25L',
    '1.5': '1.5L',
    'litro y medio': '1.5L',
    '500': '500ml',
    'chica': '500ml',
    'lata': 'Lata 354ml',
  };

  for (const [alias, canonical] of Object.entries(aliases)) {
    if (normalized.includes(alias)) {
      return canonical;
    }
  }

  return presentacion;
}
