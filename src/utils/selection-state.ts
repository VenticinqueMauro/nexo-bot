/**
 * Gestión de estado de selecciones pendientes
 * Cuando hay múltiples productos/clientes que coinciden, se guarda el estado
 * para que el usuario pueda seleccionar con botones
 */

import { Env } from '../types';
import { Product, Client } from '../types';

export interface PendingSelection {
  type: 'product' | 'client';
  action: string; // La acción original que se quería hacer
  options: Array<Product | Client>;
  originalMessage: string;
  args?: Record<string, any>; // Argumentos originales de la tool
  timestamp: number;
}

// Formato especial para que el handler detecte que debe mostrar botones
export function formatMultipleProductsResponse(
  products: Product[],
  action: string,
  originalArgs?: Record<string, any>
): string {
  // Formato especial que el handler de Telegram detectará
  return `[MULTIPLE_PRODUCTS]
${JSON.stringify({
  products: products.map(p => ({
    id: p.id,
    sku: p.sku,
    nombre: p.nombre,
    color: p.color,
    talle: p.talle,
    precio: p.precio,
    stock: p.stock
  })),
  action,
  args: originalArgs
})}
[/MULTIPLE_PRODUCTS]`;
}

export function formatMultipleClientsResponse(
  clients: Client[],
  action: string,
  originalArgs?: Record<string, any>
): string {
  return `[MULTIPLE_CLIENTS]
${JSON.stringify({
  clients: clients.map(c => ({
    id: c.id,
    nombre: c.nombre,
    telefono: c.telefono
  })),
  action,
  args: originalArgs
})}
[/MULTIPLE_CLIENTS]`;
}

/**
 * Detecta si una respuesta contiene múltiples opciones que requieren selección
 */
export function detectMultipleOptions(response: string): {
  hasMultiple: boolean;
  type?: 'product' | 'client';
  data?: any;
} {
  // Detectar múltiples productos
  const productMatch = response.match(/\[MULTIPLE_PRODUCTS\]([\s\S]*?)\[\/MULTIPLE_PRODUCTS\]/);
  if (productMatch) {
    try {
      const data = JSON.parse(productMatch[1].trim());
      return {
        hasMultiple: true,
        type: 'product',
        data
      };
    } catch (e) {
      console.error('Error parsing MULTIPLE_PRODUCTS:', e);
    }
  }

  // Detectar múltiples clientes
  const clientMatch = response.match(/\[MULTIPLE_CLIENTS\]([\s\S]*?)\[\/MULTIPLE_CLIENTS\]/);
  if (clientMatch) {
    try {
      const data = JSON.parse(clientMatch[1].trim());
      return {
        hasMultiple: true,
        type: 'client',
        data
      };
    } catch (e) {
      console.error('Error parsing MULTIPLE_CLIENTS:', e);
    }
  }

  return { hasMultiple: false };
}

/**
 * Formatea mensaje de texto para mostrar antes de los botones
 */
export function formatSelectionMessage(type: 'product' | 'client', count: number, action: string): string {
  if (type === 'product') {
    const actionText = getActionText(action);
    return `Encontré ${count} productos que coinciden. ${actionText}\n\n¿Cuál querés seleccionar?`;
  } else {
    const actionText = getActionText(action);
    return `Encontré ${count} clientes que coinciden. ${actionText}\n\n¿Cuál querés seleccionar?`;
  }
}

function getActionText(action: string): string {
  switch (action) {
    case 'stock_add':
      return 'Para agregar stock';
    case 'stock_check':
      return 'Para consultar';
    case 'sale_register':
      return 'Para registrar la venta';
    case 'product_update':
      return 'Para actualizar';
    case 'client_info':
      return 'Para ver información';
    case 'debt_check':
      return 'Para consultar deuda';
    default:
      return '';
  }
}

// Map temporal para guardar selecciones pendientes
// Idealmente esto debería estar en Durable Objects
const pendingSelections = new Map<number, PendingSelection>();

export function savePendingSelection(userId: number, selection: PendingSelection): void {
  pendingSelections.set(userId, selection);
}

export function getPendingSelection(userId: number): PendingSelection | undefined {
  return pendingSelections.get(userId);
}

export function clearPendingSelection(userId: number): void {
  pendingSelections.delete(userId);
}

/**
 * Mejora la búsqueda para ser más permisiva
 * Por ejemplo: "remera" debe encontrar "remera negra M", "remera roja L", etc.
 */
export function isPartialMatch(searchTerm: string, productName: string, category: string, color: string, talle: string): boolean {
  const search = searchTerm.toLowerCase().trim();
  const combined = `${productName} ${category} ${color} ${talle}`.toLowerCase();

  // Si el término de búsqueda está contenido en cualquier parte
  if (combined.includes(search)) {
    return true;
  }

  // Dividir en palabras y verificar si todas están presentes
  const searchWords = search.split(/\s+/).filter(w => w.length > 2);
  const allWordsPresent = searchWords.every(word => combined.includes(word));

  return allWordsPresent;
}
