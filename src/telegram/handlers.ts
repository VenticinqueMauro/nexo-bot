import { Context } from 'grammy';
import { Env } from '../types';
import { processMessage } from '../ai/agent';
import { getAllProducts, getLowStockProducts, searchProducts, updateProductPhoto } from '../sheets/stock';
import { getAllDebts } from '../sheets/payments';
import { getTodayOrders } from '../sheets/sales';
import { formatStockSummary, formatDebtList, formatDailySales, formatProductInfo } from '../utils/formatters';
import {
  getConversationHistory,
  addMessageToHistory,
  clearConversationHistory,
  getPendingPhoto,
  setPendingPhoto,
  clearPendingPhoto
} from '../utils/conversation-state';
import {
  detectMultipleOptions,
  formatSelectionMessage,
  savePendingSelection,
} from '../utils/selection-state';
import {
  productSelectionKeyboard,
  clientSelectionKeyboard,
  paymentStatusKeyboard,
  deadlineQuickSelectKeyboard,
} from './inline-keyboards';

/**
 * Handler para el comando /whoami - Muestra el ID del usuario
 */
export async function handleWhoami(ctx: Context) {
  const userId = ctx.from?.id;
  const username = ctx.from?.username || ctx.from?.first_name || 'Usuario';

  await ctx.reply(
    `👤 <b>Tu información de Telegram:</b>\n\n` +
    `• <b>ID de Usuario:</b> <code>${userId}</code>\n` +
    `• <b>Nombre:</b> ${username}\n\n` +
    `<i>Compartí este ID con el administrador para obtener acceso al bot.</i>`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Handler para el comando /start
 */
export async function handleStart(ctx: Context) {
  const welcomeMessage = `
👋 <b>¡Hola! Soy Nexo</b>

Tu asistente inteligente para la tienda de ropa.

<b>📦 Gestión de Stock:</b>
  • "¿Cuántas remeras negras tengo?"
  • "Entraron 20 remeras negras talle M"
  • /stock - Ver resumen de stock

<b>👥 Clientes:</b>
  • "Agregá cliente: María González, tel 3815551234"
  • "¿Qué onda con Juan?"

<b>💰 Ventas y Cobros:</b>
  • "Vendí a María: 2 remeras negras M"
  • "Juan me pagó 30 mil"
  • /deudas - Ver quién debe
  • /hoy - Resumen del día

<b>📸 Fotos de Productos:</b>
  • Enviá una foto para asociarla a un producto

━━━━━━━━━━━━━━━━
❓ /help - Ayuda completa
🚫 /cancelar - Cancelar acción

<i>¡Hablame como a un empleado, yo me encargo del resto!</i>
  `.trim();

  await ctx.reply(welcomeMessage, { parse_mode: 'HTML' });
}

/**
 * Handler para el comando /help
 */
export async function handleHelp(ctx: Context) {
  const helpMessage = `
📚 <b>Guía de uso de Nexo</b>

<b>📦 CONSULTAR STOCK:</b>
  • "¿Cuántas remeras negras tengo?"
  • "¿Cómo estamos de stock?"
  • "¿Hay jeans azules talle 40?"
  • /stock

<b>✨ CREAR PRODUCTOS:</b>
  • "Agregá producto: Remera negra M, $8000"
  • "Nuevo: Jean azul 40, categoría Jean, $25000"

<b>📥 REGISTRAR ENTRADA:</b>
  • "Entraron 20 remeras negras talle M"
  • "Llegaron 10 jeans azules 40"

<b>👥 GESTIÓN DE CLIENTES:</b>
  • "Agregá cliente: María González, tel 3815551234"
  • "¿Qué onda con Juan?"

<b>🛍 REGISTRAR VENTAS:</b>
  • "Vendí a María: 2 remeras negras M y 1 jean azul 40"
  • "Venta: Juan, 3 buzos grises L"

<b>💰 COBROS Y DEUDAS:</b>
  • "¿Quién me debe?"
  • "¿Cuánto debe Juan?"
  • "María me pagó 30 mil"
  • /deudas

<b>📸 FOTOS DE PRODUCTOS:</b>
  • Enviá una foto del producto
  • Te preguntaré a qué producto pertenece
  • Se guardará automáticamente

<b>📊 RESUMEN DEL DÍA:</b>
  • "¿Qué vendí hoy?"
  • /hoy

<i>Recordá: podés hablarme naturalmente, yo entiendo 😉</i>
  `.trim();

  await ctx.reply(helpMessage, { parse_mode: 'HTML' });
}

/**
 * Handler para el comando /stock
 */
export async function handleStock(ctx: Context, env: Env) {
  await ctx.reply('📦 <i>Consultando stock...</i>', { parse_mode: 'HTML' });

  const products = await getAllProducts(env);
  const summary = formatStockSummary(products);

  await ctx.reply(summary, { parse_mode: 'HTML' });
}

/**
 * Handler para el comando /deudas
 */
export async function handleDeudas(ctx: Context, env: Env) {
  await ctx.reply('💰 <i>Consultando deudas...</i>', { parse_mode: 'HTML' });

  const debts = await getAllDebts(env);
  const summary = formatDebtList(debts);

  await ctx.reply(summary, { parse_mode: 'HTML' });
}

/**
 * Handler para el comando /hoy
 */
export async function handleHoy(ctx: Context, env: Env) {
  await ctx.reply('📊 <i>Generando resumen del día...</i>', { parse_mode: 'HTML' });

  const orders = await getTodayOrders(env);
  const lowStock = await getLowStockProducts(env);

  let message = formatDailySales(orders);

  if (lowStock.length > 0) {
    message += '\n\n⚠️ <b>Alertas de stock bajo:</b>\n';
    lowStock.slice(0, 5).forEach(p => {
      message += `  • <b>${p.nombre}</b> ${p.color} ${p.talle} | <code>${p.sku}</code>\n`;
      message += `    Stock: <b>${p.stock}</b> (mín: ${p.stockMinimo})\n`;
    });
  }

  await ctx.reply(message, { parse_mode: 'HTML' });
}

/**
 * Handler para el comando /cancelar
 */
export async function handleCancelar(ctx: Context, env: Env) {
  const userId = ctx.from?.id;
  if (userId) {
    await clearConversationHistory(env, userId);
    await clearPendingPhoto(env, userId);
  }

  await ctx.reply(
    '✅ <b>Acción cancelada</b>\n\n' +
    '<i>Historial borrado. Podés empezar de nuevo.</i>',
    { parse_mode: 'HTML' }
  );
}

/**
 * Handler para mensajes de texto (lenguaje natural)
 */
export async function handleMessage(ctx: Context, env: Env) {
  const message = ctx.message?.text;
  const userId = ctx.from?.id;

  if (!message || !userId) {
    return;
  }

  try {
    // Verificar si el usuario está en el flujo de asociar foto
    const pendingPhotoFileId = await getPendingPhoto(env, userId);
    if (pendingPhotoFileId) {
      await ctx.replyWithChatAction('typing');

      // Buscar el producto mencionado
      const products = await searchProducts(env, message);

      if (products.length === 0) {
        await ctx.reply(
          '❌ <b>Producto no encontrado</b>\n\n' +
          '¿Podés ser más específico?\n\n' +
          '<i>Ejemplo: "Remera negra M" o el SKU "REM-NEG-M"</i>',
          { parse_mode: 'HTML' }
        );
        return;
      }

      if (products.length > 1) {
        await ctx.reply(
          `📦 <b>Encontré ${products.length} productos:</b>\n\n` +
          `${formatProductInfo(products)}\n\n` +
          `<i>¿Podés especificar cuál? Usa el SKU para mayor precisión.</i>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      // Asociar la foto al producto
      const product = products[0];
      await updateProductPhoto(env, product.id, pendingPhotoFileId);

      await clearPendingPhoto(env, userId);

      await ctx.reply(
        `✅ <b>Foto asociada exitosamente</b>\n\n` +
        `👕 <b>${product.nombre}</b> ${product.color} ${product.talle}\n` +
        `<code>${product.sku}</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Mostrar indicador de "escribiendo..."
    await ctx.replyWithChatAction('typing');

    // Obtener historial de conversación del Durable Object
    const history = await getConversationHistory(env, userId);

    // Procesar mensaje con AI
    const response = await processMessage(env, message, history);

    // Detectar si la respuesta contiene múltiples opciones
    const multipleOptions = detectMultipleOptions(response);

    if (multipleOptions.hasMultiple) {
      // Guardar en historial solo el mensaje original
      await addMessageToHistory(env, userId, 'user', message);

      if (multipleOptions.type === 'product') {
        const { products, action, args } = multipleOptions.data;

        // Guardar selección pendiente
        savePendingSelection(userId, {
          type: 'product',
          action,
          options: products,
          originalMessage: message,
          args,
          timestamp: Date.now()
        });

        // Mostrar mensaje con botones
        const selectionMessage = formatSelectionMessage('product', products.length, action);
        const keyboard = productSelectionKeyboard(products, 'select_product');

        await ctx.reply(selectionMessage, { reply_markup: keyboard });
      } else if (multipleOptions.type === 'client') {
        const { clients, action, args } = multipleOptions.data;

        // Guardar selección pendiente
        savePendingSelection(userId, {
          type: 'client',
          action,
          options: clients,
          originalMessage: message,
          args,
          timestamp: Date.now()
        });

        // Mostrar mensaje con botones
        const selectionMessage = formatSelectionMessage('client', clients.length, action);
        const keyboard = clientSelectionKeyboard(clients, 'select_client');

        await ctx.reply(selectionMessage, { reply_markup: keyboard });
      }
    } else if (response.includes('NECESITA_CONFIRMACION:')) {
      // Detectar tipo de confirmación
      if (response.includes('NECESITA_CONFIRMACION:PAGO')) {
        const keyboard = paymentStatusKeyboard();
        await ctx.reply('¿El cliente pagó o va a cuenta corriente?', { reply_markup: keyboard });
      } else {
        // Otros tipos de confirmación en el futuro
        await ctx.reply(response.replace(/NECESITA_CONFIRMACION:\w+\s*/g, ''), { parse_mode: 'HTML' });
      }
    } else if (response.includes('¿Cuándo vence esta deuda?')) {
      const keyboard = deadlineQuickSelectKeyboard();
      await ctx.reply(response, { reply_markup: keyboard });
    } else {
      // Respuesta normal, sin múltiples opciones
      await addMessageToHistory(env, userId, 'user', message);
      await addMessageToHistory(env, userId, 'assistant', response);
      await ctx.reply(response, { parse_mode: 'HTML' });
    }
  } catch (error: any) {
    console.error('Error en handleMessage:', error);
    console.error('Stack:', error.stack);
    console.error('Message:', message);

    // Informar al usuario del error
    await ctx.reply(
      '❌ <b>Error</b>\n\n' +
      'Ups, tuve un problema procesando tu mensaje.\n\n' +
      '<i>Intentá de nuevo o usá /cancelar para empezar de nuevo.</i>\n\n' +
      `<code>${error.message || 'Error desconocido'}</code>`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Handler para mensajes de voz (transcripción)
 * TODO: Implementar transcripción con Whisper cuando esté disponible en Workers AI
 */
export async function handleVoice(ctx: Context, env: Env) {
  await ctx.reply(
    '🎤 <b>Mensaje de voz recibido</b>\n\n' +
    '<i>La transcripción aún no está implementada.</i>\n' +
    'Por ahora, escribime por favor.',
    { parse_mode: 'HTML' }
  );
}

/**
 * Handler para fotos de productos
 */
export async function handlePhoto(ctx: Context, env: Env) {
  const userId = ctx.from?.id;
  if (!userId) {
    return;
  }

  // Obtener el file_id de la foto (la de mayor resolución)
  const photos = ctx.message?.photo;
  if (!photos || photos.length === 0) {
    return;
  }

  const photo = photos[photos.length - 1]; // Foto de mayor resolución
  const fileId = photo.file_id;

  // Guardar el file_id en Durable Object
  await setPendingPhoto(env, userId, fileId);

  const caption = ctx.message?.caption;

  if (caption) {
    // Si hay caption, procesarla directamente como un mensaje
    await ctx.replyWithChatAction('typing');

    // Inyectamos el ID de la foto en el mensaje para que el AI lo vea si decide usar una tool
    const messageWithPhoto = `${caption}\n\n[PHOTO_UPLOAD: ${fileId}]`;

    // Obtener historial de conversación del Durable Object
    const history = await getConversationHistory(env, userId);

    try {
      const response = await processMessage(env, messageWithPhoto, history);

      // Guardar mensajes en el historial
      await addMessageToHistory(env, userId, 'user', caption); // Guardamos el caption original
      await addMessageToHistory(env, userId, 'assistant', response);

      await ctx.reply(response);

      // Si el AI creó un producto (detectado por texto o algo), podríamos borrar la foto pendiente
      // Por ahora, la foto queda pendiente hasta que se asocie explícitamente
      return;

    } catch (error: any) {
      console.error('Error procesando foto con caption:', error);
      await ctx.reply('❌ Tuve un problema procesando la foto. ¿Podés intentar de nuevo?');
      return;
    }
  }

  // Si no hay caption, flujo normal (preguntar)
  await ctx.reply(
    '📸 <b>¡Foto recibida!</b>\n\n' +
    '¿A qué producto pertenece esta foto?\n\n' +
    'Podés decirme:\n' +
    '  • El SKU (ej: <code>REM-NEG-M</code>)\n' +
    '  • O describir el producto (ej: "Remera negra M")\n\n' +
    '<i>Usa /cancelar si querés cancelar.</i>',
    { parse_mode: 'HTML' }
  );
}
