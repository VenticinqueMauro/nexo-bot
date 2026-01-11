import { Context, NextFunction } from 'grammy';
import { Env } from '../types';

/**
 * Middleware para verificar que solo usuarios autorizados pueden usar el bot
 * Soporta múltiples IDs separados por comas en OWNER_TELEGRAM_ID
 */
export function authMiddleware(env: Env) {
  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id.toString();

    // Soportar múltiples IDs separados por comas
    const authorizedIds = env.OWNER_TELEGRAM_ID.split(',').map(id => id.trim());

    if (!authorizedIds.includes(userId || '')) {
      console.log(`Usuario no autorizado intentó usar el bot: ${userId}`);
      await ctx.reply('❌ No estás autorizado para usar este bot.\n\nSi necesitás acceso, contactá al administrador.');
      return;
    }

    await next();
  };
}

/**
 * Middleware para logging de mensajes
 */
export function loggingMiddleware() {
  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    const username = ctx.from?.username || ctx.from?.first_name || 'Unknown';
    const messageText = ctx.message?.text || ctx.message?.caption || '[No text]';

    console.log(`[${new Date().toISOString()}] User ${userId} (${username}): ${messageText}`);

    await next();
  };
}

/**
 * Middleware para rate limiting básico
 */
export function rateLimitMiddleware() {
  const userRequests = new Map<number, number[]>();
  const MAX_REQUESTS_PER_MINUTE = 30;

  return async (ctx: Context, next: NextFunction) => {
    const userId = ctx.from?.id;
    if (!userId) {
      await next();
      return;
    }

    const now = Date.now();
    const userHistory = userRequests.get(userId) || [];

    // Filtrar requests del último minuto
    const recentRequests = userHistory.filter(timestamp => now - timestamp < 60000);

    if (recentRequests.length >= MAX_REQUESTS_PER_MINUTE) {
      await ctx.reply('⏸️ Estás enviando mensajes muy rápido. Esperá un momento.');
      return;
    }

    recentRequests.push(now);
    userRequests.set(userId, recentRequests);

    await next();
  };
}

/**
 * Middleware para manejo de errores
 */
export function errorHandler() {
  return async (ctx: Context, next: NextFunction) => {
    try {
      await next();
    } catch (error: any) {
      console.error('Error en el bot:', error);

      const errorMessage = error.message || 'Error desconocido';

      // Mensajes de error user-friendly
      if (errorMessage.includes('Sheet') || errorMessage.includes('Sheets')) {
        await ctx.reply(
          '❌ Hubo un problema accediendo a los datos.\n' +
          'Intentá de nuevo en unos segundos.\n' +
          'Si sigue fallando, revisá la configuración de Google Sheets.'
        );
      } else if (errorMessage.includes('not found') || errorMessage.includes('No se encontró')) {
        await ctx.reply(`❌ ${errorMessage}`);
      } else {
        await ctx.reply(
          '❌ Ocurrió un error procesando tu solicitud.\n' +
          `Error: ${errorMessage}`
        );
      }
    }
  };
}
