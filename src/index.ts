import { Env } from './types';
import { createWebhook } from './telegram/bot';

/**
 * Entry point del Cloudflare Worker
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response('OK', { status: 200 });
      }

      // Endpoint para configurar el webhook de Telegram
      if (url.pathname === '/setup-webhook') {
        const webhookUrl = `${url.origin}/webhook`;
        const telegramApiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;

        const response = await fetch(telegramApiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query'],
          }),
        });

        const result = await response.json();

        return new Response(JSON.stringify(result, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Webhook endpoint para recibir actualizaciones de Telegram
      if (url.pathname === '/webhook' && request.method === 'POST') {
        const webhookHandler = createWebhook(env);
        return await webhookHandler(request);
      }

      // Info endpoint
      if (url.pathname === '/') {
        return new Response(
          JSON.stringify({
            name: 'Nexo Bot',
            version: '1.0.0',
            status: 'running',
            endpoints: {
              webhook: '/webhook',
              setup: '/setup-webhook',
              health: '/health',
            },
          }, null, 2),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      return new Response('Not Found', { status: 404 });
    } catch (error: any) {
      console.error('Error en el Worker:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  },
};
