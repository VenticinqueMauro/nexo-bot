import { Env, Client } from '../types';
import {
  getSheetValues,
  appendRow,
  updateRow,
  rowsToObjects,
  generateId,
  formatDateForSheet,
  fuzzyMatch,
} from './client';

// Caché simple en memoria
let clientsCache: { data: Client[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 1000; // 30 segundos

interface ClientRow {
  ID: string;
  Nombre: string;
  'Teléfono': string;
  'Dirección': string;
  Notas: string;
  'Fecha Alta': string;
}

/**
 * Invalida el caché de clientes
 */
export function invalidateClientsCache(): void {
  clientsCache = null;
}

/**
 * Obtiene todos los clientes (con caché)
 */
export async function getAllClients(env: Env, useCache: boolean = true): Promise<Client[]> {
  // Verificar caché
  if (useCache && clientsCache && (Date.now() - clientsCache.timestamp < CACHE_TTL)) {
    console.log('📦 Usando caché de clientes');
    return clientsCache.data;
  }

  console.log('🔄 Cargando clientes desde Google Sheets');
  const rows = await getSheetValues(env, 'Clientes');
  const objects = rowsToObjects<ClientRow>(rows);

  const clients = objects.map((row) => ({
    id: row.ID || '',
    nombre: row.Nombre || '',
    telefono: row['Teléfono'] || '',
    direccion: row['Dirección'] || '',
    notas: row.Notas || '',
    fechaAlta: row['Fecha Alta'] || '',
  }));

  // Actualizar caché
  if (useCache) {
    clientsCache = {
      data: clients,
      timestamp: Date.now()
    };
  }

  return clients;
}

/**
 * Busca clientes por nombre (con fuzzy matching)
 */
export async function findClients(env: Env, searchTerm: string): Promise<Client[]> {
  const allClients = await getAllClients(env);

  return allClients.filter(c =>
    fuzzyMatch(searchTerm, c.nombre)
  );
}

/**
 * Busca un cliente específico por nombre
 */
export async function findClient(env: Env, nombre: string): Promise<Client | null> {
  const clients = await findClients(env, nombre);

  if (clients.length === 0) {
    return null;
  }

  // Si hay varios, devolver el de coincidencia más exacta
  const exactMatch = clients.find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
  return exactMatch || clients[0];
}

/**
 * Obtiene un cliente por ID
 */
export async function getClientById(env: Env, clientId: string): Promise<Client | null> {
  const allClients = await getAllClients(env);
  return allClients.find(c => c.id === clientId) || null;
}

/**
 * Registra un nuevo cliente
 */
export async function addClient(
  env: Env,
  nombre: string,
  telefono: string,
  direccion?: string,
  notas?: string
): Promise<Client> {
  // Verificar si el cliente ya existe
  const existing = await findClient(env, nombre);
  if (existing) {
    throw new Error(`Ya existe un cliente con el nombre "${nombre}"`);
  }

  const id = generateId('C');
  const fechaAlta = formatDateForSheet();

  await appendRow(env, 'Clientes', [
    id,
    nombre,
    telefono,
    direccion || '',
    notas || '',
    fechaAlta,
  ]);

  // Invalidar caché
  invalidateClientsCache();

  return {
    id,
    nombre,
    telefono,
    direccion,
    notas,
    fechaAlta,
  };
}

/**
 * Actualiza la información de un cliente
 */
export async function updateClient(
  env: Env,
  clientId: string,
  updates: Partial<Omit<Client, 'id' | 'fechaAlta'>>
): Promise<void> {
  const rows = await getSheetValues(env, 'Clientes');
  const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[0] === clientId);

  if (rowIndex === -1) {
    throw new Error(`No se encontró el cliente con ID ${clientId}`);
  }

  const row = rows[rowIndex];

  if (updates.nombre) row[1] = updates.nombre;
  if (updates.telefono) row[2] = updates.telefono;
  if (updates.direccion !== undefined) row[3] = updates.direccion;
  if (updates.notas !== undefined) row[4] = updates.notas;

  await updateRow(env, 'Clientes', rowIndex + 1, row);
}
