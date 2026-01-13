import { Bot, webhookCallback } from 'grammy';
import { Env } from '../types';
import {
  authMiddleware,
  loggingMiddleware,
  rateLimitMiddleware,
  errorHandler,
} from './middleware';
import {
  handleStart,
  handleHelp,
  handleStock,
  handleDeudas,
  handleHoy,
  handleCancelar,
  handleMessage,
  handleVoice,
  handlePhoto,
  handleContact,
  handleWhoami,
} from './handlers';
import { handleCallbackQuery } from './callback-handlers';

/**
 * Crea y configura el bot de Telegram
 */
export function createBot(env: Env): Bot {
  const bot = new Bot(env.TELEGRAM_BOT_TOKEN);

  // Aplicar middleware
  bot.use(errorHandler());
  bot.use(loggingMiddleware());
  bot.use(authMiddleware(env));
  bot.use(rateLimitMiddleware());

  // Comandos
  bot.command('start', handleStart);
  bot.command('help', handleHelp);
  bot.command('whoami', handleWhoami);
  bot.command('stock', (ctx) => handleStock(ctx, env));
  bot.command('deudas', (ctx) => handleDeudas(ctx, env));
  bot.command('hoy', (ctx) => handleHoy(ctx, env));
  bot.command('cancelar', (ctx) => handleCancelar(ctx, env));

  // Callback queries (respuestas de botones inline)
  bot.on('callback_query:data', (ctx) => handleCallbackQuery(ctx, env));

  // Mensajes de voz
  bot.on('message:voice', (ctx) => handleVoice(ctx, env));

  // Fotos de productos
  bot.on('message:photo', (ctx) => handlePhoto(ctx, env));

  // Contactos (registro rápido de clientes)
  bot.on('message:contact', (ctx) => handleContact(ctx, env));

  // Mensajes de texto (lenguaje natural)
  bot.on('message:text', (ctx) => handleMessage(ctx, env));

  return bot;
}

/**
 * Crea el webhook handler para Cloudflare Workers
 */
export function createWebhook(env: Env) {
  const bot = createBot(env);
  return webhookCallback(bot, 'cloudflare-mod');
}
