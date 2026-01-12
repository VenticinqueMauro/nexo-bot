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
 * Calcula la distancia de Levenshtein entre dos strings (para errores de tipeo)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1,
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Normaliza palabras removiendo plurales y variaciones comunes
 */
function normalizarPalabra(palabra: string): string {
  palabra = palabra.toLowerCase().trim();

  // Remover plurales comunes en español
  if (palabra.endsWith('es') && palabra.length > 4) {
    return palabra.slice(0, -2);
  }
  if (palabra.endsWith('s') && palabra.length > 3) {
    return palabra.slice(0, -1);
  }

  return palabra;
}

/**
 * Busca coincidencias difusas de texto mejorado (para búsqueda de clientes/productos)
 */
export function fuzzyMatch(search: string, target: string): boolean {
  const searchLower = search.toLowerCase().trim();
  const targetLower = target.toLowerCase().trim();

  // 1. Coincidencia exacta (prioridad máxima)
  if (targetLower === searchLower) {
    return true;
  }

  // 2. Coincidencia de substring exacto
  if (targetLower.includes(searchLower)) {
    return true;
  }

  // 3. Normalizar y comparar (para plurales)
  const searchNorm = normalizarPalabra(searchLower);
  const targetNorm = normalizarPalabra(targetLower);

  if (targetNorm.includes(searchNorm) || searchNorm.includes(targetNorm)) {
    return true;
  }

  // 4. Coincidencia por palabras (todas las palabras deben estar)
  const searchWords = searchLower.split(/\s+/);
  if (searchWords.length > 1) {
    const allWordsMatch = searchWords.every(word => {
      const wordNorm = normalizarPalabra(word);
      return targetLower.includes(word) || targetLower.includes(wordNorm);
    });
    if (allWordsMatch) {
      return true;
    }
  }

  // 5. Levenshtein para errores de tipeo (solo para palabras individuales cortas)
  if (searchWords.length === 1 && searchLower.length >= 4) {
    const maxDistance = Math.floor(searchLower.length * 0.3); // 30% de error permitido
    const distance = levenshteinDistance(searchLower, targetLower);
    if (distance <= maxDistance) {
      return true;
    }
  }

  return false;
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
