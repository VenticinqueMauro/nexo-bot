/**
 * Utilidades para parsear input de usuario
 */

/**
 * Parsea múltiples talles de un string
 * Ejemplos:
 * - "6, 8, 10" → ["6", "8", "10"]
 * - "S, M y L" → ["S", "M", "L"]
 * - "38-40-42" → ["38", "40", "42"]
 * - "M" → ["M"]
 */
export function parseMultipleSizes(input: string): string[] {
  if (!input || input.trim() === '') {
    return [];
  }

  // Limpiar el string
  let cleaned = input.trim();

  // Reemplazar separadores comunes por comas
  cleaned = cleaned.replace(/\s+y\s+/gi, ','); // "S y M" → "S,M"
  cleaned = cleaned.replace(/\s*-\s*/g, ','); // "38-40" → "38,40"
  cleaned = cleaned.replace(/\s*;\s*/g, ','); // "S;M" → "S,M"
  cleaned = cleaned.replace(/\s+/g, ','); // "S M L" → "S,M,L"

  // Split por comas y limpiar cada elemento
  const sizes = cleaned
    .split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Remover duplicados
  return [...new Set(sizes)];
}

/**
 * Detecta si un string contiene múltiples talles
 */
export function hasMultipleSizes(input: string): boolean {
  const sizes = parseMultipleSizes(input);
  return sizes.length > 1;
}

/**
 * Distribuye una cantidad total entre varios items
 * @param total Cantidad total a distribuir
 * @param count Número de items
 * @returns Array con cantidades distribuidas
 *
 * Ejemplos:
 * - distributeQuantity(3, 3) → [1, 1, 1]
 * - distributeQuantity(5, 3) → [2, 2, 1]
 * - distributeQuantity(10, 3) → [4, 3, 3]
 */
export function distributeQuantity(total: number, count: number): number[] {
  if (count <= 0) return [];
  if (total <= 0) return Array(count).fill(0);

  const base = Math.floor(total / count);
  const remainder = total % count;

  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    result.push(base + (i < remainder ? 1 : 0));
  }

  return result;
}
