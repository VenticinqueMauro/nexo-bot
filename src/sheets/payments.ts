import { Env, Payment, Client } from '../types';
import {
  getSheetValues,
  appendRow,
  rowsToObjects,
  generateId,
  formatDateForSheet,
} from './client';
import { findClient, getAllClients } from './clients';
import { getClientOrders } from './sales';
import {
  validatePayment,
  validateMoneyAmount,
  formatValidationResult,
} from '../utils/validators';

interface PaymentRow {
  ID: string;
  Fecha: string;
  'Cliente ID': string;
  'Cliente Nombre': string;
  Monto: string;
  'Método': string;
  'Pedido ID': string;
  Notas: string;
}

/**
 * Obtiene todos los pagos
 */
export async function getAllPayments(env: Env): Promise<Payment[]> {
  const rows = await getSheetValues(env, 'Pagos');
  const objects = rowsToObjects<PaymentRow>(rows);

  return objects.map((row) => ({
    id: row.ID || '',
    fecha: row.Fecha || '',
    clienteId: row['Cliente ID'] || '',
    clienteNombre: row['Cliente Nombre'] || '',
    monto: parseFloat(row.Monto || '0'),
    metodo: row['Método'] || 'efectivo',
    pedidoId: row['Pedido ID'] && row['Pedido ID'] !== '-' ? row['Pedido ID'] : undefined,
    notas: row.Notas && row.Notas !== '-' ? row.Notas : undefined,
  }));
}

/**
 * Obtiene pagos de un cliente específico
 */
export async function getClientPayments(env: Env, clienteId: string): Promise<Payment[]> {
  const allPayments = await getAllPayments(env);
  return allPayments.filter(p => p.clienteId === clienteId);
}

/**
 * Calcula la deuda de un cliente
 */
export async function getClientDebt(env: Env, clienteId: string): Promise<number> {
  const orders = await getClientOrders(env, clienteId);
  const payments = await getClientPayments(env, clienteId);

  // Total de ventas no pagadas
  const totalOrders = orders
    .filter(o => !o.pagado)
    .reduce((sum, o) => sum + o.total, 0);

  // Total de pagos
  const totalPayments = payments.reduce((sum, p) => sum + p.monto, 0);

  return Math.max(0, totalOrders - totalPayments);
}

/**
 * Obtiene todos los clientes con deuda
 */
export async function getAllDebts(env: Env): Promise<Array<{
  client: Client;
  amount: number;
  dueDate?: string;
}>> {
  const clients = await getAllClients(env);
  const debts: Array<{ client: Client; amount: number; dueDate?: string }> = [];

  for (const client of clients) {
    const debt = await getClientDebt(env, client.id);
    if (debt > 0) {
      // TODO: Calcular fecha de vencimiento basada en política de crédito
      debts.push({
        client,
        amount: debt,
      });
    }
  }

  return debts;
}

/**
 * Registra un pago de un cliente
 */
export async function registerPayment(
  env: Env,
  clienteNombre: string,
  monto: number,
  metodo: string = 'efectivo',
  pedidoId?: string,
  notas?: string
): Promise<Payment> {
  // Buscar cliente
  const client = await findClient(env, clienteNombre);
  if (!client) {
    throw new Error(`No se encontró el cliente "${clienteNombre}"`);
  }

  // Validar monto básico
  const amountValidation = validateMoneyAmount(monto, 'payment');
  if (!amountValidation.valid) {
    throw new Error(`Monto de pago inválido:\n${formatValidationResult(amountValidation)}`);
  }

  // Obtener deuda actual
  const currentDebt = await getClientDebt(env, client.id);

  // Validar pago contra deuda
  const paymentValidation = validatePayment(monto, currentDebt);

  if (!paymentValidation.valid) {
    throw new Error(`Validación de pago falló:\n${formatValidationResult(paymentValidation)}`);
  }

  // Log advertencias (ej: pago mayor a deuda)
  if (paymentValidation.warnings.length > 0) {
    console.warn('Advertencias de pago:', paymentValidation.warnings);
    // Se podría retornar estas advertencias al usuario para confirmación
  }

  const id = generateId('PAY');
  const fecha = formatDateForSheet();

  await appendRow(env, 'Pagos', [
    id,
    fecha,
    client.id,
    client.nombre,
    monto.toString(),
    metodo,
    pedidoId || '-',
    notas || '-',
  ]);

  return {
    id,
    fecha,
    clienteId: client.id,
    clienteNombre: client.nombre,
    monto,
    metodo,
    pedidoId,
    notas,
  };
}

/**
 * Obtiene deuda detallada de un cliente con breakdown por pedido
 */
export async function getClientDebtDetail(env: Env, clienteId: string): Promise<{
  totalDebt: number;
  unpaidOrders: Array<{ orderId: string; fecha: string; monto: number; pagoParcial: number }>;
}> {
  const orders = await getClientOrders(env, clienteId);
  const payments = await getClientPayments(env, clienteId);

  const unpaidOrders = orders
    .filter(o => !o.pagado)
    .map(o => {
      // Buscar pagos parciales para este pedido
      const pagoParcial = payments
        .filter(p => p.pedidoId === o.id)
        .reduce((sum, p) => sum + p.monto, 0);

      return {
        orderId: o.id,
        fecha: o.fecha,
        monto: o.total,
        pagoParcial,
      };
    });

  const totalDebt = unpaidOrders.reduce((sum, o) => sum + o.monto - o.pagoParcial, 0);

  return {
    totalDebt,
    unpaidOrders,
  };
}
