import { Context } from 'grammy';
import { Env } from '../types';
import { processMessage } from '../ai/agent';
import { getAllProducts, getLowStockProducts, searchProducts, updateProductPhoto } from '../sheets/stock';
import { getAllDebts } from '../sheets/payments';
import { getTodayOrders } from '../sheets/sales';
import { formatStockSummary, formatDebtList, formatDailySales, formatProductInfo } from '../utils/formatters';

// Almacenamiento temporal del historial de conversación
// En producción, esto debería estar en KV o Durable Objects
const conversationHistory = new Map<number, any[]>();

// Almacenamiento temporal para fotos pendientes de asociar
const pendingPhotos = new Map<number, string>();

/**
 * Handler para el comando /start
 */
export async function handleStart(ctx: Context) {
  const welcomeMessage = `
👋 ¡Hola! Soy Nexo, tu asistente para la tienda de ropa.

Podés hablarme en lenguaje natural o usar estos comandos:

👕 *Gestión de Stock:*
• "¿Cuántas remeras negras tengo?"
• "Entraron 20 remeras negras talle M"
• /stock - Ver resumen de stock

🏪 *Clientes:*
• "Agregá un cliente nuevo: María González, tel 3815551234"
• "¿Qué onda con Juan?"

💰 *Ventas y Cobros:*
• "Vendí a María: 2 remeras negras M y 1 jean azul 40"
• "Juan me pagó 30 lucas"
• /deudas - Ver quién debe
• /hoy - Resumen del día

📸 *Fotos de Productos:*
• Enviá una foto y te ayudo a asociarla a un producto

❓ /help - Ayuda completa
🚫 /cancelar - Cancelar acción pendiente

*¡Hablame como a un empleado, yo me encargo del resto!*
  `.trim();

  await ctx.reply(welcomeMessage, { parse_mode: 'Markdown' });
}

/**
 * Handler para el comando /help
 */
export async function handleHelp(ctx: Context) {
  const helpMessage = `
📚 *Guía de uso de Nexo*

*CONSULTAR STOCK:*
• "¿Cuántas remeras negras tengo?"
• "¿Cómo estamos de stock?"
• "¿Hay jeans azules talle 40?"
• /stock

*CREAR PRODUCTOS:*
• "Agregá producto: Remera negra M, $8000"
• "Nuevo producto: Jean azul 40, categoría Jean, $25000"

*REGISTRAR ENTRADA:*
• "Entraron 20 remeras negras talle M"
• "Llegaron 10 jeans azules talle 40"

*GESTIÓN DE CLIENTES:*
• "Agregá cliente: María González, tel 3815551234"
• "¿Qué onda con Juan?"

*REGISTRAR VENTAS:*
• "Vendí a María: 2 remeras negras M y 1 jean azul 40"
• "Anotar venta: Juan, 3 buzos grises L"

*COBROS Y DEUDAS:*
• "¿Quién me debe?"
• "¿Cuánto debe Juan?"
• "María me pagó 30 mil pesos"
• /deudas

*FOTOS DE PRODUCTOS:*
• Enviá una foto del producto
• El bot te preguntará a qué producto pertenece
• Se guardará automáticamente

*RESUMEN DEL DÍA:*
• "¿Qué vendí hoy?"
• /hoy

Recordá: podés hablarme naturalmente, yo entiendo 😉
  `.trim();

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

/**
 * Handler para el comando /stock
 */
export async function handleStock(ctx: Context, env: Env) {
  await ctx.reply('📦 Consultando stock...');

  const products = await getAllProducts(env);
  const summary = formatStockSummary(products);

  await ctx.reply(summary);
}

/**
 * Handler para el comando /deudas
 */
export async function handleDeudas(ctx: Context, env: Env) {
  await ctx.reply('💰 Consultando deudas...');

  const debts = await getAllDebts(env);
  const summary = formatDebtList(debts);

  await ctx.reply(summary);
}

/**
 * Handler para el comando /hoy
 */
export async function handleHoy(ctx: Context, env: Env) {
  await ctx.reply('📊 Generando resumen del día...');

  const orders = await getTodayOrders(env);
  const lowStock = await getLowStockProducts(env);

  let message = formatDailySales(orders);

  if (lowStock.length > 0) {
    message += '\n\n⚠️ *Alertas de stock bajo:*\n';
    lowStock.slice(0, 5).forEach(p => {
      message += `• ${p.nombre} ${p.color} ${p.talle} (${p.sku}): ${p.stock} (mínimo: ${p.stockMinimo})\n`;
    });
  }

  await ctx.reply(message, { parse_mode: 'Markdown' });
}

/**
 * Handler para el comando /cancelar
 */
export async function handleCancelar(ctx: Context) {
  const userId = ctx.from?.id;
  if (userId) {
    conversationHistory.delete(userId);
    pendingPhotos.delete(userId);
  }

  await ctx.reply('✓ Acción cancelada. Historial borrado.');
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

  // Verificar si el usuario está en el flujo de asociar foto
  const pendingPhotoFileId = pendingPhotos.get(userId);
  if (pendingPhotoFileId) {
    await ctx.replyWithChatAction('typing');

    // Buscar el producto mencionado
    const products = await searchProducts(env, message);

    if (products.length === 0) {
      await ctx.reply('No encontré ningún producto que coincida. ¿Podés ser más específico? Ejemplo: "Remera negra M" o "REM-NEG-M"');
      return;
    }

    if (products.length > 1) {
      await ctx.reply(`Encontré ${products.length} productos:\n\n${formatProductInfo(products)}\n\n¿Podés especificar cuál? Usa el SKU para mayor precisión.`);
      return;
    }

    // Asociar la foto al producto
    const product = products[0];
    await updateProductPhoto(env, product.id, pendingPhotoFileId);

    pendingPhotos.delete(userId);

    await ctx.reply(`✓ Foto asociada exitosamente a:\n${product.nombre} ${product.color} ${product.talle}\nSKU: ${product.sku}`);
    return;
  }

  // Mostrar indicador de "escribiendo..."
  await ctx.replyWithChatAction('typing');

  // Obtener historial de conversación
  const history = conversationHistory.get(userId) || [];

  // Procesar mensaje con AI
  const response = await processMessage(env, message, history);

  // Actualizar historial
  history.push(
    { role: 'user', content: message },
    { role: 'assistant', content: response }
  );

  // Limitar historial a últimos 10 mensajes
  if (history.length > 10) {
    history.splice(0, history.length - 10);
  }

  conversationHistory.set(userId, history);

  // Enviar respuesta
  await ctx.reply(response);
}

/**
 * Handler para mensajes de voz (transcripción)
 * TODO: Implementar transcripción con Whisper cuando esté disponible en Workers AI
 */
export async function handleVoice(ctx: Context, env: Env) {
  await ctx.reply(
    '🎤 Recibí tu mensaje de voz, pero la transcripción aún no está implementada.\n' +
    'Por ahora, escribime por favor.'
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

  // Guardar el file_id temporalmente
  pendingPhotos.set(userId, fileId);

  await ctx.reply(
    '📸 ¡Foto recibida!\n\n' +
    '¿A qué producto pertenece esta foto?\n\n' +
    'Podés decirme:\n' +
    '• El SKU (ej: REM-NEG-M)\n' +
    '• O describir el producto (ej: "Remera negra M")\n\n' +
    'Usa /cancelar si querés cancelar.'
  );
}
