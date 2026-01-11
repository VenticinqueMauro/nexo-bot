import { Env, Product, StockMovement } from '../types';
import {
  getSheetValues,
  appendRow,
  updateRow,
  rowsToObjects,
  generateId,
  formatDateForSheet,
  fuzzyMatch,
  normalizeProductName,
  normalizePresentacion,
} from './client';
import {
  validateStockQuantity,
  validateProductPrice,
  formatValidationResult,
} from '../utils/validators';

interface ProductRow {
  ID: string;
  SKU: string;
  Nombre: string;
  Categoria: string;
  Color: string;
  Talle: string;
  Descripcion: string;
  Temporada: string;
  Proveedor: string;
  'Foto URL': string;
  Stock: string;
  'Stock Mínimo': string;
  Precio: string;
}

/**
 * Obtiene todos los productos del inventario
 */
export async function getAllProducts(env: Env): Promise<Product[]> {
  const rows = await getSheetValues(env, 'Productos');

  // Debug: Ver qué filas se obtienen
  console.log('=== DEBUG PRODUCTOS ===');
  console.log('Total filas:', rows.length);
  if (rows.length > 0) {
    console.log('Headers:', JSON.stringify(rows[0]));
  }
  if (rows.length > 1) {
    console.log('Primera fila de datos:', JSON.stringify(rows[1]));
  }

  const objects = rowsToObjects<ProductRow>(rows);
  console.log('Productos parseados:', objects.length);
  if (objects.length > 0) {
    console.log('Primer producto:', JSON.stringify(objects[0]));
  }

  return objects.map((row) => ({
    id: row.ID || '',
    sku: row.SKU || '',
    nombre: row.Nombre || '',
    categoria: row.Categoria || '',
    color: row.Color || '',
    talle: row.Talle || '',
    descripcion: row.Descripcion || '',
    temporada: row.Temporada || '',
    proveedor: row.Proveedor || '',
    fotoUrl: row['Foto URL'] || '',
    stock: parseInt(row.Stock || '0'),
    stockMinimo: parseInt(row['Stock Mínimo'] || '0'),
    precio: parseFloat(row.Precio || '0'),
  }));
}

/**
 * Busca productos por nombre (con fuzzy matching mejorado)
 * Busca en: nombre, categoría, y combinaciones con color/talle
 */
export async function findProducts(env: Env, searchTerm: string): Promise<Product[]> {
  const allProducts = await getAllProducts(env);
  const normalizedSearch = normalizeProductName(searchTerm);
  const searchLower = searchTerm.toLowerCase().trim();

  // Extraer posibles atributos del término de búsqueda
  const searchWords = searchLower.split(/\s+/);

  return allProducts.filter(p => {
    const nombreLower = p.nombre.toLowerCase();
    const categoriaLower = p.categoria.toLowerCase();
    const colorLower = p.color.toLowerCase();
    const talleLower = p.talle.toLowerCase();

    // Crear string combinado para búsqueda
    const combined = `${nombreLower} ${categoriaLower} ${colorLower} ${talleLower}`;

    // Coincidencia directa en nombre o categoría
    if (fuzzyMatch(normalizedSearch, p.nombre) || fuzzyMatch(searchTerm, p.nombre)) {
      return true;
    }

    // Coincidencia en categoría
    if (fuzzyMatch(searchTerm, p.categoria)) {
      return true;
    }

    // Verificar si todas las palabras de búsqueda están en el producto combinado
    // Esto permite buscar "remera negra" y encontrar producto con nombre="Remera", color="Negro"
    const allWordsMatch = searchWords.every(word => combined.includes(word));
    if (allWordsMatch && searchWords.length > 0) {
      return true;
    }

    return false;
  });
}

/**
 * Busca un producto específico por nombre, color y talle
 */
export async function findProduct(
  env: Env,
  nombre: string,
  color?: string,
  talle?: string
): Promise<Product | null> {
  const products = await findProducts(env, nombre);

  if (products.length === 0) {
    return null;
  }

  // Si hay color y talle, filtrar por ellos
  if (color && talle) {
    const match = products.find(p =>
      p.color.toLowerCase() === color.toLowerCase() &&
      p.talle.toLowerCase() === talle.toLowerCase()
    );
    return match || products[0];
  }

  // Si solo hay color, filtrar por color
  if (color) {
    const match = products.find(p => p.color.toLowerCase() === color.toLowerCase());
    return match || products[0];
  }

  // Si solo hay talle, filtrar por talle
  if (talle) {
    const match = products.find(p => p.talle.toLowerCase() === talle.toLowerCase());
    return match || products[0];
  }

  // Si solo hay un producto, devolverlo
  if (products.length === 1) {
    return products[0];
  }

  // Si hay varios, devolver el primero
  return products[0];
}

/**
 * Encuentra el índice de fila de un producto por ID
 */
async function findProductRowIndex(env: Env, productId: string): Promise<number> {
  const rows = await getSheetValues(env, 'Productos');
  const index = rows.findIndex((row, idx) => idx > 0 && row[0] === productId);
  return index + 1; // +1 porque las filas en Google Sheets empiezan en 1
}

/**
 * Actualiza el stock de un producto
 */
export async function updateProductStock(
  env: Env,
  productId: string,
  newStock: number
): Promise<void> {
  const rows = await getSheetValues(env, 'Productos');
  const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[0] === productId);

  if (rowIndex === -1) {
    throw new Error(`No se encontró el producto con ID ${productId}`);
  }

  const row = rows[rowIndex];
  row[10] = newStock.toString(); // Columna Stock

  await updateRow(env, 'Productos', rowIndex + 1, row);
}

/**
 * Registra un movimiento de stock (entrada o salida)
 */
export async function registerStockMovement(
  env: Env,
  movement: Omit<StockMovement, 'id' | 'fecha'>
): Promise<string> {
  const id = generateId('M');
  const fecha = formatDateForSheet();

  await appendRow(env, 'Movimientos Stock', [
    id,
    fecha,
    movement.productoId,
    movement.productoNombre,
    movement.tipo === 'entrada' ? `+${movement.cantidad}` : `-${movement.cantidad}`,
    movement.tipo,
    movement.referencia || '-',
    movement.notas || '-',
  ]);

  return id;
}

/**
 * Registra entrada de mercadería y actualiza stock
 */
export async function addStock(
  env: Env,
  nombre: string,
  cantidad: number | string,
  color?: string,
  talle?: string,
  notas?: string
): Promise<{ product: Product; newStock: number }> {
  const product = await findProduct(env, nombre, color, talle);

  if (!product) {
    throw new Error(`No se encontró el producto "${nombre}" ${color || ''} ${talle || ''}`);
  }

  // Asegurar que cantidad sea número (puede venir como string del AI)
  const cantidadNum = typeof cantidad === 'string' ? parseInt(cantidad, 10) : cantidad;

  // Validar cantidad
  const qtyValidation = validateStockQuantity(cantidadNum, 'add');
  if (!qtyValidation.valid) {
    throw new Error(`Cantidad inválida:\n${formatValidationResult(qtyValidation)}`);
  }

  // Log advertencias
  if (qtyValidation.warnings.length > 0) {
    console.warn('Advertencias de stock:', qtyValidation.warnings);
  }

  const newStock = product.stock + cantidadNum;

  // Actualizar stock
  await updateProductStock(env, product.id, newStock);

  // Registrar movimiento
  await registerStockMovement(env, {
    productoId: product.id,
    productoNombre: `${product.nombre} ${product.color} ${product.talle}`,
    cantidad: cantidadNum,
    tipo: 'entrada',
    notas: notas || 'Entrada manual',
  });

  return {
    product,
    newStock,
  };
}

/**
 * Reduce stock (por venta)
 */
export async function reduceStock(
  env: Env,
  productId: string,
  cantidad: number,
  referencia?: string
): Promise<void> {
  const allProducts = await getAllProducts(env);
  const product = allProducts.find(p => p.id === productId);

  if (!product) {
    throw new Error(`Producto no encontrado: ${productId}`);
  }

  const newStock = Math.max(0, product.stock - cantidad);

  // Actualizar stock
  await updateProductStock(env, product.id, newStock);

  // Registrar movimiento
  await registerStockMovement(env, {
    productoId: product.id,
    productoNombre: `${product.nombre} ${product.color} ${product.talle}`,
    cantidad,
    tipo: 'venta',
    referencia,
  });
}

/**
 * Obtiene productos con stock bajo
 */
export async function getLowStockProducts(env: Env): Promise<Product[]> {
  const allProducts = await getAllProducts(env);
  return allProducts.filter(p => p.stock <= p.stockMinimo);
}

/**
 * Genera un SKU automático basado en categoria, color y talle
 */
export function generateSKU(categoria: string, color: string, talle: string): string {
  const catPrefix = categoria.substring(0, 3).toUpperCase();
  const colorPrefix = color.substring(0, 3).toUpperCase();
  const talleStr = talle.toUpperCase();

  return `${catPrefix}-${colorPrefix}-${talleStr}`;
}

/**
 * Busca un producto por nombre, categoria, color y talle (para detectar duplicados)
 */
export async function findExactProduct(
  env: Env,
  nombre: string,
  categoria: string,
  color: string,
  talle: string
): Promise<Product | null> {
  const allProducts = await getAllProducts(env);

  const match = allProducts.find(p =>
    p.nombre.toLowerCase() === nombre.toLowerCase() &&
    p.categoria.toLowerCase() === categoria.toLowerCase() &&
    p.color.toLowerCase() === color.toLowerCase() &&
    p.talle.toLowerCase() === talle.toLowerCase()
  );

  return match || null;
}

/**
 * Crea un nuevo producto en el inventario
 */
export async function createProduct(
  env: Env,
  nombre: string,
  categoria: string,
  color: string,
  talle: string,
  precio: number,
  descripcion?: string,
  temporada?: string,
  proveedor?: string,
  stockInicial: number = 0,
  stockMinimo: number = 5
): Promise<Product> {
  // Validar precio
  const priceValidation = validateProductPrice(precio);
  if (!priceValidation.valid) {
    throw new Error(`Precio inválido:\n${formatValidationResult(priceValidation)}`);
  }

  // Log advertencias de precio
  if (priceValidation.warnings.length > 0) {
    console.warn('Advertencias de precio:', priceValidation.warnings);
  }

  // Validar stock inicial
  const stockValidation = validateStockQuantity(stockInicial, 'add');
  if (!stockValidation.valid) {
    throw new Error(`Stock inicial inválido:\n${formatValidationResult(stockValidation)}`);
  }

  // Log advertencias de stock
  if (stockValidation.warnings.length > 0) {
    console.warn('Advertencias de stock inicial:', stockValidation.warnings);
  }

  // Verificar si ya existe un producto igual
  const existing = await findExactProduct(env, nombre, categoria, color, talle);
  if (existing) {
    throw new Error(`Ya existe un producto: ${existing.nombre} ${existing.color} ${existing.talle} (SKU: ${existing.sku})`);
  }

  // Generar ID y SKU
  const id = generateId('P');
  const sku = generateSKU(categoria, color, talle);

  // Crear fila
  const row = [
    id,
    sku,
    nombre,
    categoria,
    color,
    talle,
    descripcion || '',
    temporada || '',
    proveedor || '',
    '', // Foto URL vacío inicialmente
    stockInicial.toString(),
    stockMinimo.toString(),
    precio.toString(),
  ];

  await appendRow(env, 'Productos', row);

  return {
    id,
    sku,
    nombre,
    categoria,
    color,
    talle,
    descripcion,
    temporada,
    proveedor,
    fotoUrl: '',
    stock: stockInicial,
    stockMinimo,
    precio,
  };
}

/**
 * Actualiza la URL de foto de un producto
 */
export async function updateProductPhoto(
  env: Env,
  productId: string,
  photoUrl: string
): Promise<void> {
  const rows = await getSheetValues(env, 'Productos');
  const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[0] === productId);

  if (rowIndex === -1) {
    throw new Error(`No se encontró el producto con ID ${productId}`);
  }

  const row = rows[rowIndex];
  row[9] = photoUrl; // Columna "Foto URL" (índice 9)

  await updateRow(env, 'Productos', rowIndex + 1, row);
}

/**
 * Busca productos por SKU, nombre, color o talle
 */
export async function searchProducts(
  env: Env,
  searchTerm: string
): Promise<Product[]> {
  const allProducts = await getAllProducts(env);
  const search = searchTerm.toLowerCase();

  return allProducts.filter(p =>
    p.sku.toLowerCase().includes(search) ||
    p.nombre.toLowerCase().includes(search) ||
    p.color.toLowerCase().includes(search) ||
    p.talle.toLowerCase().includes(search) ||
    p.categoria.toLowerCase().includes(search)
  );
}
