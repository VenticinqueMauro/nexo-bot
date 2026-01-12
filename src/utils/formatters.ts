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
 * Formatea un resumen de stock con HTML
 */
export function formatStockSummary(products: Product[]): string {
  const lowStock = products.filter(p => p.stock <= p.stockMinimo);
  const okStock = products.filter(p => p.stock > p.stockMinimo);

  let message = '📦 <b>Resumen de Stock</b>\n\n';

  if (lowStock.length > 0) {
    message += '⚠️ <b>Stock Bajo:</b>\n';
    lowStock.forEach(p => {
      message += `  • <b>${p.nombre}</b> ${p.color} ${p.talle}\n`;
      message += `    <code>${p.sku}</code> | Stock: <b>${p.stock}</b> (mín: ${p.stockMinimo})\n`;
    });
    message += '\n';
  }

  if (okStock.length > 0) {
    message += '✅ <b>Stock OK:</b>\n';
    okStock.slice(0, 10).forEach(p => {
      message += `  • <b>${p.nombre}</b> ${p.color} ${p.talle} | <code>${p.sku}</code>\n`;
      message += `    Stock: <b>${p.stock}</b>\n`;
    });
    if (okStock.length > 10) {
      message += `\n<i>...y ${okStock.length - 10} productos más</i>\n`;
    }
  }

  if (products.length === 0) {
    message += '<i>No hay productos registrados todavía.</i>';
  }

  return message;
}

/**
 * Formatea información de un producto con HTML
 */
export function formatProductInfo(products: Product[]): string {
  if (products.length === 0) {
    return '❌ <i>No se encontraron productos.</i>';
  }

  let message = products.length > 1 ? `📦 <b>${products.length} productos encontrados:</b>\n\n` : '';

  products.forEach((p, index) => {
    if (products.length > 1) message += `<b>${index + 1}.</b> `;

    message += `👕 <b>${p.nombre}</b> ${p.color} ${p.talle}\n`;
    message += `   <code>${p.sku}</code>\n`;
    message += `   💰 Precio: <b>${formatPrice(p.precio)}</b>\n`;
    message += `   📦 Stock: <b>${p.stock}</b> unidades`;

    if (p.stock <= p.stockMinimo) {
      message += ` ⚠️ <i>(bajo)</i>`;
    }

    message += '\n';

    if (p.descripcion) {
      message += `   📝 ${p.descripcion}\n`;
    }

    if (p.temporada) {
      message += `   🌡 ${p.temporada}\n`;
    }

    message += '\n';
  });

  return message.trim();
}

/**
 * Formatea información de un cliente con HTML
 */
export function formatClientInfo(client: Client, debt?: number, lastOrder?: Order): string {
  let message = `👤 <b>${client.nombre}</b>\n`;
  message += `📞 ${client.telefono}\n`;

  if (client.direccion) {
    message += `📍 ${client.direccion}\n`;
  }

  message += '\n';

  if (lastOrder) {
    const daysAgo = Math.floor((Date.now() - new Date(lastOrder.fecha).getTime()) / (1000 * 60 * 60 * 24));
    const daysText = daysAgo === 0 ? 'hoy' : daysAgo === 1 ? 'ayer' : `hace ${daysAgo} días`;
    message += `🛍 <b>Última compra:</b> ${daysText} (${formatPrice(lastOrder.total)})\n`;
  }

  if (debt !== undefined) {
    if (debt > 0) {
      message += `💰 <b>Deuda actual:</b> <b>${formatPrice(debt)}</b> ⚠️\n`;
    } else {
      message += `✅ <b>Sin deudas</b>\n`;
    }
  }

  if (client.notas) {
    message += `\n📝 <i>${client.notas}</i>`;
  }

  return message;
}

/**
 * Formatea lista de deudas con HTML
 */
export function formatDebtList(debts: { client: Client; amount: number; dueDate?: string }[]): string {
  if (debts.length === 0) {
    return '✅ <b>No hay deudas pendientes</b> 🎉';
  }

  const total = debts.reduce((sum, d) => sum + d.amount, 0);
  let message = `💰 <b>Deudas Pendientes</b>\n`;
  message += `<b>Total:</b> ${formatPrice(total)}\n\n`;

  const now = new Date();
  const overdue = debts.filter(d => d.dueDate && new Date(d.dueDate) < now);
  const upcoming = debts.filter(d => d.dueDate && new Date(d.dueDate) >= now);
  const noDate = debts.filter(d => !d.dueDate);

  if (overdue.length > 0) {
    message += '🔴 <b>Vencidas:</b>\n';
    overdue.forEach(d => {
      const daysOverdue = Math.floor((now.getTime() - new Date(d.dueDate!).getTime()) / (1000 * 60 * 60 * 24));
      message += `  • <b>${d.client.nombre}:</b> ${formatPrice(d.amount)}\n`;
      message += `    <i>Vencido hace ${daysOverdue} día${daysOverdue !== 1 ? 's' : ''}</i>\n`;
    });
    message += '\n';
  }

  if (upcoming.length > 0) {
    message += '🟡 <b>Por Vencer:</b>\n';
    upcoming.forEach(d => {
      const daysUntilDue = Math.floor((new Date(d.dueDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const dueText = daysUntilDue === 0 ? '⚠️ <b>vence hoy</b>' :
                       daysUntilDue === 1 ? 'vence mañana' :
                       `vence en ${daysUntilDue} días`;
      message += `  • <b>${d.client.nombre}:</b> ${formatPrice(d.amount)}\n`;
      message += `    <i>${dueText}</i>\n`;
    });
    message += '\n';
  }

  if (noDate.length > 0) {
    message += '🟢 <b>Sin Fecha:</b>\n';
    noDate.forEach(d => {
      message += `  • <b>${d.client.nombre}:</b> ${formatPrice(d.amount)}\n`;
    });
  }

  return message;
}

/**
 * Formatea un resumen de pedido con HTML
 */
export function formatOrder(order: Order, products: Product[]): string {
  let message = `🛍 <b>Pedido para ${order.clienteNombre}</b>\n\n`;

  order.items.forEach((item, index) => {
    const product = products.find(p => p.id === item.producto || p.nombre.toLowerCase().includes(item.producto.toLowerCase()));
    const price = product ? product.precio * item.cantidad : 0;
    const productName = product ? product.nombre : item.producto;

    message += `<b>${index + 1}.</b> ${item.cantidad}x <b>${productName}</b> ${item.color || ''} ${item.talle || ''}\n`;
    message += `   ${formatPrice(price)}\n`;
  });

  message += `\n━━━━━━━━━━━━━━━━\n`;
  message += `💰 <b>Total: ${formatPrice(order.total)}</b>`;

  return message;
}

/**
 * Formatea ventas del día con HTML
 */
export function formatDailySales(orders: Order[]): string {
  if (orders.length === 0) {
    return '📊 <b>Ventas de Hoy</b>\n\n<i>No hay ventas registradas todavía.</i>';
  }

  const total = orders.reduce((sum, o) => sum + o.total, 0);
  const totalPagado = orders.filter(o => o.pagado).reduce((sum, o) => sum + o.total, 0);
  const totalCC = orders.filter(o => !o.pagado).reduce((sum, o) => sum + o.total, 0);
  const today = new Date().toLocaleDateString('es-AR');

  let message = `📊 <b>Ventas del ${today}</b>\n\n`;
  message += `<b>${orders.length} pedido${orders.length !== 1 ? 's' : ''}</b>\n`;
  message += `💰 <b>Total:</b> ${formatPrice(total)}\n`;
  message += `✅ Pagado: ${formatPrice(totalPagado)}\n`;
  message += `🟡 Cta. Cte.: ${formatPrice(totalCC)}\n\n`;
  message += `━━━━━━━━━━━━━━━━\n\n`;

  orders.forEach((o, i) => {
    const status = o.pagado ? '✅ <i>pagado</i>' : '🟡 <i>cta. cte.</i>';
    message += `<b>${i + 1}.</b> ${o.clienteNombre}\n`;
    message += `   ${formatPrice(o.total)} ${status}\n`;
  });

  return message;
}
