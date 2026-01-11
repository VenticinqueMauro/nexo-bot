import { Env, Order, OrderItem } from '../types';
import {
  getSheetValues,
  appendRow,
  updateRow,
  rowsToObjects,
  generateId,
  formatDateForSheet,
} from './client';
import { findProduct, reduceStock } from './stock';
import { findClient } from './clients';

interface OrderRow {
  ID: string;
  Fecha: string;
  'Cliente ID': string;
  'Cliente Nombre': string;
  'Items (JSON)': string;
  Total: string;
  Estado: string;
  Pagado: string;
}

/**
 * Obtiene todos los pedidos
 */
export async function getAllOrders(env: Env): Promise<Order[]> {
  const rows = await getSheetValues(env, 'Pedidos');
  const objects = rowsToObjects<OrderRow>(rows);

  return objects.map((row) => ({
    id: row.ID || '',
    fecha: row.Fecha || '',
    clienteId: row['Cliente ID'] || '',
    clienteNombre: row['Cliente Nombre'] || '',
    items: JSON.parse(row['Items (JSON)'] || '[]'),
    total: parseFloat(row.Total || '0'),
    estado: row.Estado || 'entregado',
    pagado: row.Pagado?.toLowerCase() === 'si',
  }));
}

/**
 * Obtiene pedidos de un cliente específico
 */
export async function getClientOrders(env: Env, clienteId: string): Promise<Order[]> {
  const allOrders = await getAllOrders(env);
  return allOrders.filter(o => o.clienteId === clienteId);
}

/**
 * Obtiene pedidos del día actual
 */
export async function getTodayOrders(env: Env): Promise<Order[]> {
  const allOrders = await getAllOrders(env);
  const today = formatDateForSheet();
  return allOrders.filter(o => o.fecha === today);
}

/**
 * Registra una nueva venta/pedido
 */
export async function registerSale(
  env: Env,
  clienteNombre: string,
  items: OrderItem[],
  pagado: boolean = false
): Promise<Order> {
  // Buscar o validar cliente
  const client = await findClient(env, clienteNombre);
  if (!client) {
    throw new Error(`No se encontró el cliente "${clienteNombre}". Registralo primero.`);
  }

  // Procesar items y calcular total
  let total = 0;
  const processedItems: OrderItem[] = [];

  for (const item of items) {
    const product = await findProduct(env, item.producto, item.presentacion);

    if (!product) {
      throw new Error(`No se encontró el producto "${item.producto}" ${item.presentacion || ''}`);
    }

    // Verificar stock disponible
    if (product.stock < item.cantidad) {
      throw new Error(
        `Stock insuficiente de ${product.nombre} ${product.presentacion}. ` +
        `Disponible: ${product.stock}, solicitado: ${item.cantidad}`
      );
    }

    const itemTotal = product.precio * item.cantidad;
    total += itemTotal;

    processedItems.push({
      producto: product.id,
      cantidad: item.cantidad,
      presentacion: product.presentacion,
    });

    // Reducir stock
    await reduceStock(env, product.id, item.cantidad);
  }

  // Crear pedido
  const id = generateId('V');
  const fecha = formatDateForSheet();

  await appendRow(env, 'Pedidos', [
    id,
    fecha,
    client.id,
    client.nombre,
    JSON.stringify(processedItems),
    total.toString(),
    'entregado',
    pagado ? 'si' : 'no',
  ]);

  return {
    id,
    fecha,
    clienteId: client.id,
    clienteNombre: client.nombre,
    items: processedItems,
    total,
    estado: 'entregado',
    pagado,
  };
}

/**
 * Actualiza el estado de pago de un pedido
 */
export async function updateOrderPaymentStatus(
  env: Env,
  orderId: string,
  pagado: boolean
): Promise<void> {
  const rows = await getSheetValues(env, 'Pedidos');
  const rowIndex = rows.findIndex((row, idx) => idx > 0 && row[0] === orderId);

  if (rowIndex === -1) {
    throw new Error(`No se encontró el pedido con ID ${orderId}`);
  }

  const row = rows[rowIndex];
  row[7] = pagado ? 'si' : 'no'; // Columna Pagado

  await updateRow(env, 'Pedidos', rowIndex + 1, row);
}

/**
 * Calcula estadísticas de ventas
 */
export async function getSalesStats(env: Env, startDate?: string, endDate?: string): Promise<{
  totalVentas: number;
  totalMonto: number;
  promedioPorVenta: number;
}> {
  let orders = await getAllOrders(env);

  // Filtrar por fechas si se especifican
  if (startDate) {
    orders = orders.filter(o => o.fecha >= startDate);
  }
  if (endDate) {
    orders = orders.filter(o => o.fecha <= endDate);
  }

  const totalVentas = orders.length;
  const totalMonto = orders.reduce((sum, o) => sum + o.total, 0);
  const promedioPorVenta = totalVentas > 0 ? totalMonto / totalVentas : 0;

  return {
    totalVentas,
    totalMonto,
    promedioPorVenta,
  };
}
