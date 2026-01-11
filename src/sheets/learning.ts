import { Env } from '../types';
import { getSheetValues, appendRow } from './client';

/**
 * Tipos de observaciones que el bot puede detectar
 */
export type ObservationType =
  | 'termino_nuevo'           // Usuario usa un término no reconocido
  | 'multiple_intento'        // Múltiples intentos para lograr algo
  | 'correccion'              // Usuario corrige al bot
  | 'patron_frecuente'        // Patrón de uso repetido
  | 'error_tool'              // Tool falló o dio error
  | 'ambiguedad';             // Situación ambigua que necesita clarificación

export type ObservationStatus = 'pendiente' | 'revisada' | 'implementada' | 'descartada';

export interface Observation {
  id: string;
  fecha: string;
  tipo: ObservationType;
  contexto: string;
  accionSugerida: string;
  estado: ObservationStatus;
  mensajeUsuario?: string;
}

export type PreferenceType =
  | 'producto_alias'     // Alias personalizado para productos
  | 'cliente_alias'      // Alias personalizado para clientes
  | 'abreviacion'        // Abreviaciones personalizadas
  | 'patron_venta'       // Patrón de venta recurrente
  | 'contexto';          // Contexto específico del negocio

export interface UserPreference {
  id: string;
  tipo: PreferenceType;
  terminoUsuario: string;
  mapeo: string;
  frecuencia: number;
  ultimaVez: string;
  aprobado: boolean;
  contextoAdicional?: string;
}

/**
 * Registra una nueva observación en Google Sheets
 */
export async function addObservation(
  env: Env,
  tipo: ObservationType,
  contexto: string,
  accionSugerida: string,
  mensajeUsuario?: string
): Promise<Observation> {
  const fecha = new Date().toISOString().split('T')[0];
  const id = `OBS${Date.now().toString().slice(-6)}`;

  await appendRow(env, 'Observaciones', [
    id,
    fecha,
    tipo,
    contexto,
    accionSugerida,
    'pendiente',
    mensajeUsuario || '',
  ]);

  return {
    id,
    fecha,
    tipo,
    contexto,
    accionSugerida,
    estado: 'pendiente',
    mensajeUsuario,
  };
}

/**
 * Obtiene todas las observaciones pendientes
 */
export async function getPendingObservations(env: Env): Promise<Observation[]> {
  const rows = await getSheetValues(env, 'Observaciones');

  return rows
    .filter(row => row[5] === 'pendiente') // Estado = pendiente
    .map(row => ({
      id: row[0],
      fecha: row[1],
      tipo: row[2] as ObservationType,
      contexto: row[3],
      accionSugerida: row[4],
      estado: row[5] as ObservationStatus,
      mensajeUsuario: row[6],
    }));
}

/**
 * Registra o actualiza una preferencia del usuario
 */
export async function addOrUpdatePreference(
  env: Env,
  tipo: PreferenceType,
  terminoUsuario: string,
  mapeo: string,
  aprobado: boolean = false,
  contextoAdicional?: string
): Promise<UserPreference> {
  const rows = await getSheetValues(env, 'Preferencias');

  // Buscar si ya existe esta preferencia
  const existingIndex = rows.findIndex(
    row => row[1] === tipo && row[2].toLowerCase() === terminoUsuario.toLowerCase()
  );

  const fecha = new Date().toISOString().split('T')[0];

  if (existingIndex !== -1) {
    // Actualizar preferencia existente (incrementar frecuencia)
    const currentFreq = parseInt(rows[existingIndex][4]) || 1;
    // TODO: Implementar actualización de fila en Google Sheets
    // Por ahora solo agregamos una nueva
  }

  // Crear nueva preferencia
  const id = `PREF${Date.now().toString().slice(-6)}`;
  await appendRow(env, 'Preferencias', [
    id,
    tipo,
    terminoUsuario,
    mapeo,
    '1', // frecuencia inicial
    fecha,
    aprobado ? 'sí' : 'no',
    contextoAdicional || '',
  ]);

  return {
    id,
    tipo,
    terminoUsuario,
    mapeo,
    frecuencia: 1,
    ultimaVez: fecha,
    aprobado,
    contextoAdicional,
  };
}

/**
 * Obtiene todas las preferencias aprobadas del usuario
 */
export async function getApprovedPreferences(env: Env): Promise<UserPreference[]> {
  const rows = await getSheetValues(env, 'Preferencias');

  return rows
    .filter(row => row[6] === 'sí') // Aprobado = sí
    .map(row => ({
      id: row[0],
      tipo: row[1] as PreferenceType,
      terminoUsuario: row[2],
      mapeo: row[3],
      frecuencia: parseInt(row[4]) || 1,
      ultimaVez: row[5],
      aprobado: true,
      contextoAdicional: row[7],
    }));
}

/**
 * Busca una preferencia específica por término del usuario
 */
export async function findPreference(
  env: Env,
  terminoUsuario: string
): Promise<UserPreference | null> {
  const preferences = await getApprovedPreferences(env);

  const found = preferences.find(
    p => p.terminoUsuario.toLowerCase() === terminoUsuario.toLowerCase()
  );

  return found || null;
}

/**
 * Obtiene estadísticas de aprendizaje
 */
export async function getLearningStats(env: Env): Promise<{
  totalObservations: number;
  pendingObservations: number;
  totalPreferences: number;
  preferencesByType: Record<string, number>;
}> {
  const obsRows = await getSheetValues(env, 'Observaciones');
  const prefRows = await getSheetValues(env, 'Preferencias');

  const preferencesByType: Record<string, number> = {};
  prefRows
    .filter(row => row[6] === 'sí')
    .forEach(row => {
      const tipo = row[1];
      preferencesByType[tipo] = (preferencesByType[tipo] || 0) + 1;
    });

  return {
    totalObservations: obsRows.length,
    pendingObservations: obsRows.filter(row => row[5] === 'pendiente').length,
    totalPreferences: prefRows.filter(row => row[6] === 'sí').length,
    preferencesByType,
  };
}

/**
 * Analiza un mensaje del usuario para detectar patrones aprendibles
 */
export function analyzeMessageForLearning(
  userMessage: string,
  toolName?: string,
  toolResult?: string,
  previousAttempts?: number
): {
  shouldLearn: boolean;
  type?: ObservationType;
  suggestion?: string;
} {
  // Detectar múltiples intentos
  if (previousAttempts && previousAttempts > 2) {
    return {
      shouldLearn: true,
      type: 'multiple_intento',
      suggestion: `Usuario intentó ${previousAttempts} veces la misma acción. Posible confusión o falta de claridad.`,
    };
  }

  // Detectar correcciones
  const correctionWords = ['no,', 'no ', 'quise decir', 'me refería', 'en realidad', 'mejor dicho'];
  if (correctionWords.some(word => userMessage.toLowerCase().includes(word))) {
    return {
      shouldLearn: true,
      type: 'correccion',
      suggestion: 'Usuario corrigió la interpretación. Considerar agregar esta variante como preferencia.',
    };
  }

  // Detectar error en tool
  if (toolResult && (toolResult.includes('❌') || toolResult.includes('no se encontró'))) {
    return {
      shouldLearn: true,
      type: 'termino_nuevo',
      suggestion: `Término "${userMessage}" no reconocido. Preguntar si es un alias personalizado.`,
    };
  }

  return { shouldLearn: false };
}
