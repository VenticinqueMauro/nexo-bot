import { Env } from './types';
import { getAllOrders } from './sheets/sales';
import { findClient } from './sheets/clients';
import { createWebhook } from './telegram/bot';

// Exportar Durable Objects
export { ConversationState } from './durable-objects/ConversationState';

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

      // Trigger manual de vencimientos (para testing)
      if (url.pathname === '/cron/check-debts') {
        const result = await checkExpiredDebts(env);
        return new Response(JSON.stringify(result), { status: 200 });
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
              checkDebts: '/cron/check-debts'
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

  /**
   * Handler para eventos programados (Cron Triggers)
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(checkExpiredDebts(env));
  },
};

async function checkExpiredDebts(env: Env) {
  try {
    const orders = await getAllOrders(env);
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // Filtrar deudas vencidas HOY o antes, que no estén pagadas
    const expiredOrders = orders.filter(o =>
      !o.pagado &&
      o.vencimiento &&
      o.vencimiento <= today
    );

    if (expiredOrders.length === 0) {
      return { status: 'no_expired_debts' };
    }

    // Agrupar por cliente para no mandar mil mensajes
    const debtsByClient: Record<string, typeof orders> = {};
    for (const order of expiredOrders) {
      if (!debtsByClient[order.clienteNombre]) {
        debtsByClient[order.clienteNombre] = [];
      }
      debtsByClient[order.clienteNombre].push(order);
    }

    let message = `⚠️ **REPORTE DE VENCIMIENTOS** ⚠️\n\nHoy ${today} se vencen las siguientes deudas:\n\n`;

    for (const [cliente, clientOrders] of Object.entries(debtsByClient)) {
      const total = clientOrders.reduce((sum, o) => sum + o.total, 0);
      message += `👤 **${cliente}**: $${total.toLocaleString('es-AR')}\n`;

      // Intentar obtener el teléfono para generar link
      // Esto es costoso en Sheet reads, pero es un cron job...
      try {
        const clientData = await findClient(env, cliente);
        if (clientData?.telefono) {
          const phone = clientData.telefono.replace(/[^0-9]/g, '');
          let finalPhone = phone;
          if (phone.length === 10) finalPhone = `549${phone}`;
          else if (phone.startsWith('15')) finalPhone = `549${phone.substring(2)}`;

          const waMsg = encodeURIComponent(`Hola ${cliente}, te recuerdo que hoy venció tu deuda de $${total}.`);
          const link = `https://wa.me/${finalPhone}?text=${waMsg}`;
          message += `[Reclamar por WhatsApp](${link})\n`;
        }
      } catch (e) {
        console.error(`Error buscando cliente ${cliente} para cron:`, e);
      }
      message += `\n`;
    }

    // Enviar a Telegram
    if (env.OWNER_TELEGRAM_ID) {
      await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.OWNER_TELEGRAM_ID,
          text: message,
          parse_mode: 'Markdown'
        }),
      });
    }

    return { status: 'sent', count: expiredOrders.length };

  } catch (error) {
    console.error('Error in scheduled job:', error);
    return { error: String(error) };
  }
}
