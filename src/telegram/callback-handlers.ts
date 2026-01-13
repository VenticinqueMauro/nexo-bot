/**
 * Handlers para callback queries (botones inline)
 */

import { Context } from 'grammy';
import { processMessage } from '../ai/agent';
import { updateProductPhoto } from '../sheets/stock';
import { Env } from '../types';
import {
  addMessageToHistory,
  clearPendingPhoto,
  getConversationHistory,
  getPendingPhoto
} from '../utils/conversation-state';
import {
  getPendingSelection,
  clearPendingSelection,
} from '../utils/selection-state';
import { parseNaturalDate } from '../utils/dates';
import { deadlineQuickSelectKeyboard } from './inline-keyboards';

/**
 * Interfaz para estado pendiente de confirmación
 */
interface PendingAction {
  type: string;
  data: any;
  messageId?: number;
}

// Map temporal para acciones pendientes (idealmente debería estar en Durable Object)
const pendingActions = new Map<number, PendingAction>();

/**
 * Guarda una acción pendiente de confirmación
 */
export function savePendingAction(userId: number, action: PendingAction): void {
  pendingActions.set(userId, action);
}

/**
 * Obtiene y elimina una acción pendiente
 */
export function getPendingAction(userId: number): PendingAction | undefined {
  const action = pendingActions.get(userId);
  if (action) {
    pendingActions.delete(userId);
  }
  return action;
}

/**
 * Handler principal para callback queries
 */
export async function handleCallbackQuery(ctx: Context, env: Env) {
  const callbackData = ctx.callbackQuery?.data;
  const userId = ctx.from?.id;

  if (!callbackData || !userId) {
    await ctx.answerCallbackQuery('Error: datos inválidos');
    return;
  }

  // Parsear callback data (formato: "prefix:action" o "prefix:action:data")
  const parts = callbackData.split(':');
  const prefix = parts[0];
  const action = parts[1];
  const data = parts.slice(2).join(':');

  console.log(`Callback query: ${callbackData} from user ${userId}`);

  try {
    switch (prefix) {
      case 'payment_status':
        await handlePaymentStatus(ctx, env, action);
        break;

      case 'deadline':
        await handleDeadlineSelection(ctx, env, action, data);
        break;

      case 'select_product':
        await handleProductSelection(ctx, env, action);
        break;

      case 'select_client':
        await handleClientSelection(ctx, env, action);
        break;

      case 'confirm_sale':
        await handleSaleConfirmation(ctx, env, action);
        break;

      case 'confirm_stock':
        await handleStockConfirmation(ctx, env, action);
        break;

      case 'confirm_payment':
        await handlePaymentConfirmation(ctx, env, action);
        break;

      case 'noop':
        // No hacer nada (usado para botones informativos)
        await ctx.answerCallbackQuery();
        break;

      case 'back_to_menu':
        await handleBackToMenu(ctx);
        break;

      default:
        await ctx.answerCallbackQuery('Acción no reconocida');
        console.warn(`Callback query no manejado: ${callbackData}`);
    }
  } catch (error: any) {
    console.error('Error en handleCallbackQuery:', error);
    await ctx.answerCallbackQuery('❌ Error procesando acción');
    await ctx.reply(`❌ Error: ${error.message}`);
  }
}

/**
 * Maneja selección de estado de pago (Pagado / Pago Parcial / A Cuenta)
 */
async function handlePaymentStatus(
  ctx: Context,
  env: Env,
  status: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Recuperar la acción pendiente (el mensaje original del usuario)
  const pendingAction = getPendingAction(userId);

  if (!pendingAction || pendingAction.type !== 'payment_confirmation') {
    // Fallback: si no hay acción pendiente, usar método antiguo
    await ctx.reply('❌ No se encontró la venta pendiente. Por favor, intentá de nuevo.');
    return;
  }

  const originalMessage = pendingAction.data.originalMessage;

  if (status === 'paid') {
    // Pagado completo
    await ctx.answerCallbackQuery('✓ Pagado completo');
    await ctx.editMessageText('Estado de pago: *pagado completo*', { parse_mode: 'Markdown' });

    const history = await getConversationHistory(env, userId);
    const messageWithStatus = `${originalMessage}. IMPORTANTE: El cliente PAGÓ COMPLETO, usar pagado=true`;

    const response = await processMessage(env, messageWithStatus, history);

    await addMessageToHistory(env, userId, 'user', originalMessage);
    await addMessageToHistory(env, userId, 'assistant', response);

    await ctx.reply(response, { parse_mode: 'HTML' });
  } else if (status === 'partial') {
    // Pago parcial - preguntar cuánto pagó
    await ctx.answerCallbackQuery('✓ Pago parcial');
    await ctx.editMessageText('Estado de pago: *pago parcial*', { parse_mode: 'Markdown' });

    // Guardar estado para capturar el monto
    savePendingAction(userId, {
      type: 'partial_payment_amount',
      data: {
        originalMessage
      }
    });

    await ctx.reply('💵 ¿Cuánto pagó ahora? (escribí solo el monto)');
  } else {
    // Todo a cuenta corriente
    await ctx.answerCallbackQuery('✓ A cuenta');
    await ctx.editMessageText('Estado de pago: *todo a cuenta corriente*', { parse_mode: 'Markdown' });

    // Guardar el contexto para usarlo después
    savePendingAction(userId, {
      type: 'deadline_selection',
      data: {
        originalMessage,
        isPaid: false
      }
    });

    const keyboard = deadlineQuickSelectKeyboard();
    await ctx.reply('¿Cuándo vence esta deuda?', { reply_markup: keyboard });
  }
}

/**
 * Maneja selección de plazo de vencimiento
 */
async function handleDeadlineSelection(
  ctx: Context,
  env: Env,
  days: string,
  customDate?: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Recuperar el contexto guardado (mensaje original + estado de pago)
  const pendingAction = getPendingAction(userId);

  if (days === 'none') {
    await ctx.answerCallbackQuery('✓ Sin vencimiento');
    await ctx.editMessageText('Vencimiento: Sin fecha límite');

    // Si hay contexto guardado, procesar la venta sin vencimiento
    if (pendingAction && (pendingAction.type === 'deadline_selection' || pendingAction.type === 'partial_payment_deadline')) {
      const { originalMessage } = pendingAction.data;
      const history = await getConversationHistory(env, userId);

      let messageWithStatus: string;
      if (pendingAction.type === 'partial_payment_deadline') {
        const { montoParcial } = pendingAction.data;
        messageWithStatus = `${originalMessage}. IMPORTANTE: El cliente pagó PARCIAL ${montoParcial} pesos, el resto a cuenta sin vencimiento específico.`;
      } else {
        messageWithStatus = `${originalMessage}. IMPORTANTE: El cliente NO PAGÓ (pagado=false), sin vencimiento específico.`;
      }

      const response = await processMessage(env, messageWithStatus, history);

      await addMessageToHistory(env, userId, 'user', originalMessage);
      await addMessageToHistory(env, userId, 'assistant', response);

      await ctx.reply(response, { parse_mode: 'HTML' });
    }
    return;
  }

  if (days === 'custom') {
    await ctx.answerCallbackQuery();

    // Guardar el estado para cuando el usuario escriba la fecha personalizada
    if (pendingAction && (pendingAction.type === 'deadline_selection' || pendingAction.type === 'partial_payment_deadline')) {
      savePendingAction(userId, {
        type: pendingAction.type === 'partial_payment_deadline' ? 'custom_partial_deadline_input' : 'custom_deadline_input',
        data: pendingAction.data
      });
    }

    await ctx.reply('Indicame la fecha de vencimiento (ej: "en 10 días", "el 25", "DD/MM/YYYY")');
    return;
  }

  const daysNum = parseInt(days, 10);
  const deadline = parseNaturalDate(`en ${daysNum} días`);

  await ctx.answerCallbackQuery(`✓ Vence en ${daysNum} días`);
  await ctx.editMessageText(
    `Vencimiento: ${daysNum} días (${deadline})`,
    { parse_mode: 'Markdown' }
  );

  // Si hay contexto guardado, procesar la venta completa con todos los datos
  if (pendingAction) {
    const { originalMessage } = pendingAction.data;
    const history = await getConversationHistory(env, userId);

    let messageWithFullContext: string;

    if (pendingAction.type === 'partial_payment_deadline') {
      // Pago parcial
      const { montoParcial } = pendingAction.data;
      messageWithFullContext = `${originalMessage}. IMPORTANTE: El cliente pagó PARCIAL ${montoParcial} pesos, el resto vence: ${deadline}`;
    } else if (pendingAction.type === 'deadline_selection') {
      // Todo a cuenta
      messageWithFullContext = `${originalMessage}. IMPORTANTE: El cliente NO PAGÓ (pagado=false), vencimiento: ${deadline}`;
    } else {
      // Flujo antiguo (por compatibilidad)
      messageWithFullContext = `Fecha de vencimiento: ${deadline}`;
    }

    const response = await processMessage(env, messageWithFullContext, history);

    await addMessageToHistory(env, userId, 'user', originalMessage || messageWithFullContext);
    await addMessageToHistory(env, userId, 'assistant', response);

    await ctx.reply(response, { parse_mode: 'HTML' });
  }
}


/**
 * Maneja selección de producto
 */
async function handleProductSelection(
  ctx: Context,
  env: Env,
  productId: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (productId === 'cancel') {
    await ctx.answerCallbackQuery('❌ Cancelado');
    await ctx.editMessageText('Operación cancelada');
    clearPendingSelection(userId);
    return;
  }

  // Obtener selección pendiente
  const pendingSelection = getPendingSelection(userId);

  if (pendingSelection && pendingSelection.type === 'product') {
    const products = pendingSelection.options as any[];
    const selectedProduct = products.find((p: any) => p.id === productId);

    if (selectedProduct) {
      await ctx.answerCallbackQuery(`✓ ${selectedProduct.nombre}`);
      await ctx.editMessageText(
        `✓ Seleccionado: ${selectedProduct.nombre} ${selectedProduct.color} ${selectedProduct.talle} (${selectedProduct.sku})`
      );

      // Continuar con la acción original usando el producto seleccionado
      const history = await getConversationHistory(env, userId);

      // Construir mensaje contextual basado en la acción
      let contextMessage = '';
      switch (pendingSelection.action) {
        case 'stock_check':
          contextMessage = `Ver stock de ${selectedProduct.nombre} ${selectedProduct.color} ${selectedProduct.talle}`;
          break;
        case 'stock_add':
          contextMessage = `Agregar stock a ${selectedProduct.nombre} ${selectedProduct.color} ${selectedProduct.talle}`;
          break;
        case 'sale_register':
          contextMessage = `Vender ${selectedProduct.nombre} ${selectedProduct.color} ${selectedProduct.talle}`;
          break;
        default:
          contextMessage = `Operación con ${selectedProduct.nombre} ${selectedProduct.color} ${selectedProduct.talle}`;
      }

      const response = await processMessage(env, contextMessage, history);

      await addMessageToHistory(env, userId, 'user', contextMessage);
      await addMessageToHistory(env, userId, 'assistant', response);

      await ctx.reply(response, { parse_mode: 'HTML' });

      // Limpiar selección pendiente
      clearPendingSelection(userId);
    }
  } else {
    // Verificar si hay foto pendiente para asociar (flujo antiguo)
    const pendingPhotoFileId = await getPendingPhoto(env, userId);

    if (pendingPhotoFileId) {
      await updateProductPhoto(env, productId, pendingPhotoFileId);
      await clearPendingPhoto(env, userId);

      await ctx.answerCallbackQuery('✓ Foto asociada');
      await ctx.editMessageText('✓ Foto asociada exitosamente al producto');
    } else {
      await ctx.answerCallbackQuery('✓ Producto seleccionado');
    }
  }
}

/**
 * Maneja selección de cliente
 */
async function handleClientSelection(
  ctx: Context,
  env: Env,
  clientId: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (clientId === 'cancel') {
    await ctx.answerCallbackQuery('❌ Cancelado');
    await ctx.editMessageText('Operación cancelada');
    return;
  }

  await ctx.answerCallbackQuery('✓ Cliente seleccionado');

  // Continuar con el procesamiento usando el ID del cliente
  const history = await getConversationHistory(env, userId);
  const message = `Cliente seleccionado: ${clientId}`;

  const response = await processMessage(env, message, history);

  await addMessageToHistory(env, userId, 'user', message);
  await addMessageToHistory(env, userId, 'assistant', response);

  await ctx.reply(response, { parse_mode: 'HTML' });
}

/**
 * Maneja confirmación de venta
 */
async function handleSaleConfirmation(
  ctx: Context,
  env: Env,
  action: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (action === 'cancel') {
    await ctx.answerCallbackQuery('❌ Venta cancelada');
    await ctx.editMessageText('Venta cancelada');
    return;
  }

  if (action === 'confirm') {
    await ctx.answerCallbackQuery('✓ Venta confirmada');
    await ctx.editMessageText('✓ Venta registrada');

    // Procesar la venta guardada
    // TODO: Implementar guardado de venta pendiente
  }
}

/**
 * Maneja confirmación de stock
 */
async function handleStockConfirmation(
  ctx: Context,
  env: Env,
  action: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (action === 'cancel') {
    await ctx.answerCallbackQuery('❌ Cancelado');
    await ctx.editMessageText('Entrada de stock cancelada');
    return;
  }

  if (action === 'confirm') {
    await ctx.answerCallbackQuery('✓ Stock actualizado');
    await ctx.editMessageText('✓ Stock registrado');

    // Procesar el stock guardado
    // TODO: Implementar guardado de stock pendiente
  }
}

/**
 * Maneja confirmación de pago
 */
async function handlePaymentConfirmation(
  ctx: Context,
  env: Env,
  action: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  if (action === 'cancel') {
    await ctx.answerCallbackQuery('❌ Pago cancelado');
    await ctx.editMessageText('Pago cancelado');
    return;
  }

  if (action === 'confirm') {
    await ctx.answerCallbackQuery('✓ Pago registrado');
    await ctx.editMessageText('✓ Pago confirmado');

    // Procesar el pago guardado
    // TODO: Implementar guardado de pago pendiente
  }
}

/**
 * Volver al menú principal
 */
async function handleBackToMenu(ctx: Context) {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    '🏠 Menú Principal\n\n' +
    'Podés usar estos comandos:\n' +
    '/stock - Ver resumen de stock\n' +
    '/deudas - Lista de deudores\n' +
    '/hoy - Resumen del día\n' +
    '/help - Ayuda completa'
  );
}
