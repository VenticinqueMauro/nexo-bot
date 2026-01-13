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

// Caché simple en memoria (se resetea con cada deploy)
let productsCache: { data: Product[]; timestamp: number } | null = null;
const CACHE_TTL = 30 * 1000; // 30 segundos

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
 * Invalida el caché de productos (llamar después de modificaciones)
 */
export function invalidateProductsCache(): void {
  productsCache = null;
}

/**
 * Obtiene todos los productos del inventario (con caché)
 */
export async function getAllProducts(env: Env, useCache: boolean = true): Promise<Product[]> {
  // Verificar caché
  if (useCache && productsCache && (Date.now() - productsCache.timestamp < CACHE_TTL)) {
    console.log('📦 Usando caché de productos');
    return productsCache.data;
  }

  console.log('🔄 Cargando productos desde Google Sheets');
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

  const products = objects.map((row) => ({
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

  // Actualizar caché
  if (useCache) {
    productsCache = {
      data: products,
      timestamp: Date.now()
    };
  }

  return products;
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

  // Detectar colores comunes en la búsqueda
  const coloresComunes = ['negro', 'negra', 'blanco', 'blanca', 'azul', 'rojo', 'roja', 'verde', 'gris', 'rosa', 'amarillo', 'amarilla', 'celeste', 'naranja'];
  const colorEnBusqueda = searchWords.find(w => coloresComunes.includes(w));

  // Detectar talles en la búsqueda (incluyendo talles infantiles)
  const tallesComunes = ['xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl',
                         '0', '2', '4', '6', '8', '10', '12', '14', '16', '18', // Talles infantiles
                         '36', '38', '40', '42', '44', '46', '48', '50']; // Talles adultos
  const talleEnBusqueda = searchWords.find(w => tallesComunes.includes(w));

  // Filtrar productos
  const results = allProducts.filter(p => {
    const nombreLower = p.nombre.toLowerCase();
    const categoriaLower = p.categoria.toLowerCase();
    const colorLower = p.color.toLowerCase();
    const talleLower = p.talle.toLowerCase();

    // Crear string combinado para búsqueda
    const combined = `${nombreLower} ${categoriaLower} ${colorLower} ${talleLower}`;

    // FILTRO 1: Si especificó color, debe coincidir
    if (colorEnBusqueda) {
      const colorMatch = fuzzyMatch(colorEnBusqueda, colorLower);
      if (!colorMatch) return false; // Descartamos si el color no coincide
    }

    // FILTRO 2: Si especificó talle, debe coincidir
    if (talleEnBusqueda) {
      if (!talleLower.includes(talleEnBusqueda)) return false;
    }

    // FILTRO 3: Buscar el nombre/categoría del producto
    // Si la búsqueda tiene una sola palabra (sin color/talle)
    if (searchWords.length === 1) {
      if (fuzzyMatch(normalizedSearch, p.nombre) || fuzzyMatch(searchTerm, p.nombre)) {
        return true;
      }
      if (fuzzyMatch(searchTerm, p.categoria)) {
        return true;
      }
    }

    // FILTRO 4: Para búsquedas compuestas (ej: "remera negra" o "camisa de mujer")
    // Verificar que todas las palabras clave estén en el producto
    const palabrasSinColorTalle = searchWords.filter(w =>
      !coloresComunes.includes(w) && !tallesComunes.includes(w) && w.length > 2 // Ignorar palabras muy cortas como "de", "el", "la"
    );

    if (palabrasSinColorTalle.length > 0) {
      const allWordsMatch = palabrasSinColorTalle.every(word => {
        // Skip prepositions and articles
        if (['de', 'del', 'la', 'el', 'los', 'las', 'un', 'una'].includes(word)) {
          return true;
        }

        // Normalizar palabra para plurales
        const singular = word.endsWith('s') && word.length > 3 ? word.slice(0, -1) : word;
        const plural = word + 's';

        // Buscar la palabra, su singular o plural
        return combined.includes(word) || combined.includes(singular) || combined.includes(plural);
      });

      if (!allWordsMatch) return false;
    }

    return true;
  });

  // ORDENAR resultados: coincidencias exactas primero
  return results.sort((a, b) => {
    const aExactName = a.nombre.toLowerCase() === normalizedSearch;
    const bExactName = b.nombre.toLowerCase() === normalizedSearch;

    if (aExactName && !bExactName) return -1;
    if (!aExactName && bExactName) return 1;

    // Si ambos tienen el color buscado, priorizar
    if (colorEnBusqueda) {
      const aHasColor = a.color.toLowerCase().includes(colorEnBusqueda);
      const bHasColor = b.color.toLowerCase().includes(colorEnBusqueda);
      if (aHasColor && !bHasColor) return -1;
      if (!aHasColor && bHasColor) return 1;
    }

    return 0;
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
  // Primero intentar con el término de búsqueda que incluye potencialmente el talle
  let products = await findProducts(env, nombre);

  if (products.length === 0) {
    return null;
  }

  // Si hay color y talle especificados, filtrar con prioridad
  if (color && talle) {
    const talleLower = talle.toLowerCase();
    const colorLower = color.toLowerCase();

    // Buscar coincidencia exacta de color y talle
    const exactMatch = products.find(p =>
      p.color.toLowerCase() === colorLower &&
      p.talle.toLowerCase() === talleLower
    );
    if (exactMatch) return exactMatch;

    // Buscar coincidencia fuzzy de color y talle
    const fuzzyMatch = products.find(p =>
      p.color.toLowerCase().includes(colorLower) &&
      p.talle.toLowerCase() === talleLower
    );
    if (fuzzyMatch) return fuzzyMatch;

    // Si no hay match, devolver el primero
    return products[0];
  }

  // Si solo hay color, filtrar por color
  if (color) {
    const colorLower = color.toLowerCase();
    const match = products.find(p =>
      p.color.toLowerCase() === colorLower ||
      p.color.toLowerCase().includes(colorLower)
    );
    return match || products[0];
  }

  // Si solo hay talle, filtrar por talle (MEJORADO)
  if (talle) {
    const talleLower = talle.toLowerCase();

    // Buscar coincidencia exacta
    const exactMatch = products.find(p => p.talle.toLowerCase() === talleLower);
    if (exactMatch) return exactMatch;

    // Buscar si el producto contiene el talle (para casos como "S, M, L")
    const partialMatch = products.find(p => p.talle.toLowerCase().includes(talleLower));
    if (partialMatch) return partialMatch;

    // Si no hay match, devolver el primero
    return products[0];
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

  // Invalidar caché
  invalidateProductsCache();

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

  // Invalidar caché
  invalidateProductsCache();
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
  const allProducts = await getAllProducts(env);
  const existing = allProducts.find(p =>
    p.nombre.toLowerCase() === nombre.toLowerCase() &&
    p.categoria.toLowerCase() === categoria.toLowerCase() &&
    p.color.toLowerCase() === color.toLowerCase() &&
    p.talle.toLowerCase() === talle.toLowerCase()
  );

  if (existing) {
    throw new Error(`Ya existe un producto: ${existing.nombre} ${existing.color} ${existing.talle} (SKU: ${existing.sku})`);
  }

  // Generar ID y SKU
  const id = generateId('P');
  let sku = generateSKU(categoria, color, talle);

  // Asegurar unicidad del SKU
  // Si falta SKU, le agregamos sufijo numérico o parte del ID
  const skuExists = allProducts.some(p => p.sku === sku);
  if (skuExists) {
    // Intentar agregar sufijo -2, -3, etc si es común, pero mejor usar ID corto para garantizar unicidad
    // O simplemente usar los últimos 4 del ID
    sku = `${sku}-${id.substring(id.length - 4)}`;
  }

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

  // Invalidar caché
  invalidateProductsCache();

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
