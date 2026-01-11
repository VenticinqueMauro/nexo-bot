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
 * Maneja selección de estado de pago (Pagado / A Cuenta)
 */
async function handlePaymentStatus(
  ctx: Context,
  env: Env,
  status: string
) {
  const userId = ctx.from?.id;
  if (!userId) return;

  const isPaid = status === 'paid';
  const statusText = isPaid ? 'pagado' : 'a cuenta corriente';

  // Contestar el callback para quitar el "loading"
  await ctx.answerCallbackQuery(`✓ ${isPaid ? 'Pagado' : 'A cuenta'}`);

  // Editar el mensaje original
  await ctx.editMessageText(
    `Estado de pago: *${statusText}*`,
    { parse_mode: 'Markdown' }
  );

  // Continuar con el procesamiento del mensaje con el estado seleccionado
  const history = await getConversationHistory(env, userId);
  const messageWithStatus = `Estado de pago: ${statusText}`;

  const response = await processMessage(env, messageWithStatus, history);

  await addMessageToHistory(env, userId, 'user', messageWithStatus);
  await addMessageToHistory(env, userId, 'assistant', response);

  await ctx.reply(response);
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

  if (days === 'none') {
    await ctx.answerCallbackQuery('✓ Sin vencimiento');
    await ctx.editMessageText('Vencimiento: Sin fecha límite');
    return;
  }

  if (days === 'custom') {
    await ctx.answerCallbackQuery();
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

  // Continuar con el procesamiento
  const history = await getConversationHistory(env, userId);
  const messageWithDeadline = `Fecha de vencimiento: ${deadline}`;

  const response = await processMessage(env, messageWithDeadline, history);

  await addMessageToHistory(env, userId, 'user', messageWithDeadline);
  await addMessageToHistory(env, userId, 'assistant', response);

  await ctx.reply(response);
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

      await ctx.reply(response);

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

  await ctx.reply(response);
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
