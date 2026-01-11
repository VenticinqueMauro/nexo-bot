/**
 * Teclados inline (botones) para confirmaciones y selecciones rápidas
 */

import { InlineKeyboard } from 'grammy';

/**
 * Botones de confirmación genérica (Sí / No)
 */
export function confirmationKeyboard(callbackPrefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Sí', `${callbackPrefix}:yes`)
    .text('❌ No', `${callbackPrefix}:no`);
}

/**
 * Botones para estado de pago (Pagado / A Cuenta)
 */
export function paymentStatusKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 Pagado', 'payment_status:paid')
    .text('📋 A Cuenta', 'payment_status:credit');
}

/**
 * Botones para cancelar una operación
 */
export function cancelKeyboard(callbackPrefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('↩️ Cancelar', `${callbackPrefix}:cancel`);
}

/**
 * Botones de confirmación con opción de cancelar
 */
export function confirmWithCancelKeyboard(callbackPrefix: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ Confirmar', `${callbackPrefix}:confirm`)
    .text('❌ Cancelar', `${callbackPrefix}:cancel`);
}

/**
 * Botones para selección de producto (cuando hay múltiples coincidencias)
 */
export function productSelectionKeyboard(
  products: Array<{ id: string; sku: string; nombre: string; color: string; talle: string }>,
  callbackPrefix: string = 'select_product'
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  products.slice(0, 5).forEach((product, index) => {
    const label = `${index + 1}. ${product.nombre} ${product.color} ${product.talle} (${product.sku})`;
    keyboard.text(label, `${callbackPrefix}:${product.id}`).row();
  });

  keyboard.text('❌ Cancelar', `${callbackPrefix}:cancel`);

  return keyboard;
}

/**
 * Botones para seleccionar cliente (cuando hay múltiples coincidencias)
 */
export function clientSelectionKeyboard(
  clients: Array<{ id: string; nombre: string; telefono?: string }>,
  callbackPrefix: string = 'select_client'
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  clients.slice(0, 5).forEach((client, index) => {
    const label = `${index + 1}. ${client.nombre}${client.telefono ? ` (${client.telefono})` : ''}`;
    keyboard.text(label, `${callbackPrefix}:${client.id}`).row();
  });

  keyboard.text('❌ Cancelar', `${callbackPrefix}:cancel`);

  return keyboard;
}

/**
 * Botones de opciones múltiples (hasta 6 opciones)
 */
export function multipleChoiceKeyboard(
  options: Array<{ label: string; callback: string }>,
  callbackPrefix: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  options.forEach((option, index) => {
    keyboard.text(option.label, `${callbackPrefix}:${option.callback}`);

    // Dos botones por fila
    if ((index + 1) % 2 === 0 || index === options.length - 1) {
      keyboard.row();
    }
  });

  return keyboard;
}

/**
 * Botones de navegación (página anterior/siguiente)
 */
export function paginationKeyboard(
  currentPage: number,
  totalPages: number,
  callbackPrefix: string
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  if (currentPage > 0) {
    keyboard.text('⬅️ Anterior', `${callbackPrefix}:prev:${currentPage - 1}`);
  }

  keyboard.text(`${currentPage + 1}/${totalPages}`, 'noop');

  if (currentPage < totalPages - 1) {
    keyboard.text('➡️ Siguiente', `${callbackPrefix}:next:${currentPage + 1}`);
  }

  return keyboard;
}

/**
 * Botón para volver al menú principal
 */
export function backToMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🏠 Volver al menú', 'back_to_menu');
}

/**
 * Botones para plazos de vencimiento rápidos
 */
export function deadlineQuickSelectKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('📅 En 7 días', 'deadline:7')
    .text('📅 En 15 días', 'deadline:15')
    .row()
    .text('📅 En 30 días', 'deadline:30')
    .text('📅 En 60 días', 'deadline:60')
    .row()
    .text('✏️ Fecha personalizada', 'deadline:custom')
    .text('❌ Sin vencimiento', 'deadline:none');
}
