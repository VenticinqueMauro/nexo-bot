import { Product, Client, Order, Payment } from '../types';

/**
 * Formatea un número como precio en pesos argentinos
 */
export function formatPrice(amount: number): string {
  return `$${amount.toLocaleString('es-AR')}`;
}

/**
 * Formatea una fecha en formato argentino
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

/**
 * Formatea un resumen de stock
 */
export function formatStockSummary(products: Product[]): string {
  const lowStock = products.filter(p => p.stock <= p.stockMinimo);
  const okStock = products.filter(p => p.stock > p.stockMinimo);

  let message = '📦 Resumen de stock:\n\n';

  if (lowStock.length > 0) {
    message += '⚠️ Stock bajo:\n';
    lowStock.forEach(p => {
      message += `- ${p.nombre} ${p.color} ${p.talle} (${p.sku}): ${p.stock} (mínimo: ${p.stockMinimo})\n`;
    });
    message += '\n';
  }

  if (okStock.length > 0) {
    message += '✓ Stock OK:\n';
    okStock.slice(0, 10).forEach(p => {
      message += `- ${p.nombre} ${p.color} ${p.talle} (${p.sku}): ${p.stock}\n`;
    });
    if (okStock.length > 10) {
      message += `... (${okStock.length - 10} productos más)\n`;
    }
  }

  return message;
}

/**
 * Formatea información de un producto
 */
export function formatProductInfo(products: Product[]): string {
  if (products.length === 0) {
    return 'No se encontraron productos.';
  }

  let message = '';
  products.forEach(p => {
    message += `${p.nombre} ${p.color} ${p.talle}\n`;
    message += `SKU: ${p.sku}\n`;
    message += `Stock: ${p.stock} unidades\n`;
    message += `Precio: ${formatPrice(p.precio)}\n`;
    if (p.descripcion) {
      message += `Descripción: ${p.descripcion}\n`;
    }
    message += '\n';
  });

  return message.trim();
}

/**
 * Formatea información de un cliente
 */
export function formatClientInfo(client: Client, debt?: number, lastOrder?: Order): string {
  let message = `🏪 ${client.nombre}\n`;
  message += `Tel: ${client.telefono}\n`;

  if (client.direccion) {
    message += `Dirección: ${client.direccion}\n`;
  }

  message += '\n';

  if (lastOrder) {
    const daysAgo = Math.floor((Date.now() - new Date(lastOrder.fecha).getTime()) / (1000 * 60 * 60 * 24));
    message += `Última compra: hace ${daysAgo} días (${formatPrice(lastOrder.total)})\n`;
  }

  if (debt !== undefined) {
    message += `Deuda actual: ${formatPrice(debt)}\n`;
  }

  if (client.notas) {
    message += `\nNotas: ${client.notas}`;
  }

  return message;
}

/**
 * Formatea lista de deudas
 */
export function formatDebtList(debts: { client: Client; amount: number; dueDate?: string }[]): string {
  if (debts.length === 0) {
    return '✓ No hay deudas pendientes';
  }

  const total = debts.reduce((sum, d) => sum + d.amount, 0);
  let message = `💰 Deudas pendientes: ${formatPrice(total)}\n\n`;

  const now = new Date();
  const overdue = debts.filter(d => d.dueDate && new Date(d.dueDate) < now);
  const upcoming = debts.filter(d => d.dueDate && new Date(d.dueDate) >= now);
  const noDate = debts.filter(d => !d.dueDate);

  if (overdue.length > 0) {
    message += '🔴 Vencidas:\n';
    overdue.forEach(d => {
      const daysOverdue = Math.floor((now.getTime() - new Date(d.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
      message += `- ${d.client.nombre}: ${formatPrice(d.amount)} (vencido hace ${daysOverdue} días)\n`;
    });
    message += '\n';
  }

  if (upcoming.length > 0) {
    message += '🟡 Por vencer:\n';
    upcoming.forEach(d => {
      const daysUntilDue = Math.floor((new Date(d.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const dueText = daysUntilDue === 0 ? 'vence hoy' : daysUntilDue === 1 ? 'vence mañana' : `vence en ${daysUntilDue} días`;
      message += `- ${d.client.nombre}: ${formatPrice(d.amount)} (${dueText})\n`;
    });
    message += '\n';
  }

  if (noDate.length > 0) {
    message += '🟢 Al día:\n';
    noDate.forEach(d => {
      message += `- ${d.client.nombre}: ${formatPrice(d.amount)}\n`;
    });
  }

  return message;
}

/**
 * Formatea un resumen de pedido
 */
export function formatOrder(order: Order, products: Product[]): string {
  let message = `📝 Pedido para ${order.clienteNombre}:\n\n`;

  order.items.forEach(item => {
    const product = products.find(p => p.id === item.producto || p.nombre.toLowerCase().includes(item.producto.toLowerCase()));
    const price = product ? product.precio * item.cantidad : 0;
    message += `- ${item.cantidad} ${item.producto} ${item.color || ''} ${item.talle || ''}: ${formatPrice(price)}\n`;
  });

  message += `\nTotal: ${formatPrice(order.total)}`;

  return message;
}

/**
 * Formatea ventas del día
 */
export function formatDailySales(orders: Order[]): string {
  if (orders.length === 0) {
    return 'No hay ventas registradas hoy.';
  }

  const total = orders.reduce((sum, o) => sum + o.total, 0);
  const today = new Date().toLocaleDateString('es-AR');

  let message = `📊 Ventas de hoy (${today}):\n\n`;
  message += `${orders.length} pedidos - Total: ${formatPrice(total)}\n\n`;

  orders.forEach((o, i) => {
    const status = o.pagado ? 'pagó efectivo' : 'cuenta corriente';
    message += `${i + 1}. ${o.clienteNombre} - ${formatPrice(o.total)} (${status})\n`;
  });

  return message;
}
