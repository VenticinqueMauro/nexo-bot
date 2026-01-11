import { Env } from '../types';
import { systemPrompt } from './prompts';
import { tools } from './tools';
import { buildDynamicPrompt, extractLearningContext } from './dynamic-prompt';
import {
  addObservation,
  addOrUpdatePreference,
  getLearningStats,
  analyzeMessageForLearning,
} from '../sheets/learning';
import {
  getAllProducts,
  findProducts,
  addStock,
  getLowStockProducts,
  createProduct,
  searchProducts,
} from '../sheets/stock';
import {
  findClient,
  addClient,
  getAllClients,
} from '../sheets/clients';
import {
  registerSale,
  getTodayOrders,
} from '../sheets/sales';
import {
  getAllDebts,
  getClientDebt,
  registerPayment,
  getClientDebtDetail,
} from '../sheets/payments';
import {
  formatStockSummary,
  formatProductInfo,
  formatClientInfo,
  formatDebtList,
  formatOrder,
  formatDailySales,
  formatPrice,
} from '../utils/formatters';

interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Ejecuta una tool y retorna el resultado
 */
async function executeTool(env: Env, toolName: string, args: any): Promise<string> {
  try {
    switch (toolName) {
      case 'stock_check': {
        if (args.producto) {
          // Consultar producto específico
          const products = await findProducts(env, args.producto);
          if (products.length === 0) {
            return `No se encontró ningún producto que coincida con "${args.producto}".`;
          }
          return formatProductInfo(products);
        } else {
          // Resumen de stock general
          const allProducts = await getAllProducts(env);
          return formatStockSummary(allProducts);
        }
      }

      case 'stock_add': {
        const result = await addStock(
          env,
          args.producto,
          args.cantidad,
          args.color,
          args.talle
        );
        return `✓ Registrado. Stock de ${result.product.nombre} ${result.product.color} ${result.product.talle} actualizado: ${result.newStock} (+${args.cantidad})`;
      }

      case 'client_list': {
        const allClients = await getAllClients(env);

        if (allClients.length === 0) {
          return 'No hay clientes registrados todavía.';
        }

        let message = `📋 Clientes registrados (${allClients.length}):\n\n`;
        allClients.forEach((client, index) => {
          message += `${index + 1}. ${client.nombre}`;
          if (client.telefono) {
            message += ` - Tel: ${client.telefono}`;
          }
          message += '\n';
        });

        return message.trim();
      }

      case 'client_search': {
        const client = await findClient(env, args.nombre);
        if (!client) {
          return `No se encontró ningún cliente que se llame "${args.nombre}".`;
        }

        // Obtener deuda y última orden
        const debt = await getClientDebt(env, client.id);
        // const lastOrder = await getLastClientOrder(env, client.id); // TODO

        return formatClientInfo(client, debt);
      }

      case 'client_add': {
        const client = await addClient(
          env,
          args.nombre,
          args.telefono || '',
          args.direccion
        );
        return `✓ Cliente registrado: ${client.nombre}\nTel: ${client.telefono}${args.direccion ? `\nDirección: ${args.direccion}` : ''}`;
      }

      case 'debt_list': {
        const debts = await getAllDebts(env);
        return formatDebtList(debts);
      }

      case 'debt_check': {
        const client = await findClient(env, args.cliente);
        if (!client) {
          return `No se encontró el cliente "${args.cliente}".`;
        }

        const debtDetail = await getClientDebtDetail(env, client.id);

        if (debtDetail.totalDebt === 0) {
          return `${client.nombre} no tiene deudas pendientes.`;
        }

        let message = `${client.nombre} debe ${formatPrice(debtDetail.totalDebt)}\n\n`;
        debtDetail.unpaidOrders.forEach(o => {
          const pending = o.monto - o.pagoParcial;
          message += `- ${formatPrice(pending)} del pedido del ${o.fecha}`;
          if (o.pagoParcial > 0) {
            message += ` (pagó ${formatPrice(o.pagoParcial)})`;
          }
          message += '\n';
        });

        return message;
      }

      case 'payment_register': {
        const payment = await registerPayment(
          env,
          args.cliente,
          args.monto,
          args.metodo || 'efectivo'
        );

        const remainingDebt = await getClientDebt(env, payment.clienteId);

        return `✓ Pago registrado: ${formatPrice(payment.monto)} de ${payment.clienteNombre}\nDeuda restante: ${formatPrice(remainingDebt)}`;
      }

      case 'sale_register': {
        // Nota: pagado debe ser especificado por el usuario
        if (args.pagado === undefined) {
          return 'NECESITA_CONFIRMACION: ¿El cliente pagó o va a cuenta corriente?';
        }

        const order = await registerSale(
          env,
          args.cliente,
          args.items,
          args.pagado
        );

        const allProducts = await getAllProducts(env);
        let message = formatOrder(order, allProducts);
        message += `\n\n✓ ${args.pagado ? 'Venta registrada (pagada)' : 'Agregado a cuenta corriente'}\nStock actualizado.`;

        return message;
      }

      case 'sales_today': {
        const orders = await getTodayOrders(env);
        return formatDailySales(orders);
      }

      case 'product_create': {
        const product = await createProduct(
          env,
          args.nombre,
          args.categoria,
          args.color,
          args.talle,
          args.precio,
          args.descripcion,
          args.temporada,
          args.proveedor,
          args.stockInicial || 0,
          args.stockMinimo || 5
        );

        return `✓ Producto creado exitosamente:
${product.nombre} ${product.color} ${product.talle}
SKU: ${product.sku}
Precio: ${formatPrice(product.precio)}
Stock inicial: ${product.stock}
${product.descripcion ? `Descripción: ${product.descripcion}\n` : ''}${product.temporada ? `Temporada: ${product.temporada}\n` : ''}${product.proveedor ? `Proveedor: ${product.proveedor}` : ''}`;
      }

      case 'product_search': {
        const results = await searchProducts(env, args.busqueda);
        if (results.length === 0) {
          return `No se encontraron productos que coincidan con "${args.busqueda}".`;
        }
        return formatProductInfo(results);
      }

      case 'learn_preference': {
        const preference = await addOrUpdatePreference(
          env,
          args.tipo,
          args.terminoUsuario,
          args.mapeo,
          true, // Auto-aprobar preferencias que el usuario enseña explícitamente
          args.contextoAdicional
        );

        return `✓ Aprendido! Ya sé que cuando decís "${preference.terminoUsuario}" te referís a: ${preference.mapeo}. Voy a recordarlo para la próxima.`;
      }

      case 'learning_stats': {
        const stats = await getLearningStats(env);

        let message = `🧠 Estadísticas de aprendizaje:\n\n`;
        message += `📊 Total de preferencias aprendidas: ${stats.totalPreferences}\n`;
        message += `📝 Observaciones totales: ${stats.totalObservations}\n`;
        message += `⏳ Observaciones pendientes: ${stats.pendingObservations}\n\n`;

        if (Object.keys(stats.preferencesByType).length > 0) {
          message += `Preferencias por tipo:\n`;
          Object.entries(stats.preferencesByType).forEach(([tipo, count]) => {
            const tipoNombre = tipo.replace('_', ' ');
            message += `  • ${tipoNombre}: ${count}\n`;
          });
        }

        return message;
      }

      default:
        return `Tool "${toolName}" no implementada.`;
    }
  } catch (error: any) {
    console.error(`Error ejecutando tool ${toolName}:`, error);
    return `❌ Error: ${error.message}`;
  }
}

/**
 * Procesa un mensaje del usuario con Workers AI
 */
export async function processMessage(
  env: Env,
  userMessage: string,
  conversationHistory: Message[] = []
): Promise<string> {
  try {
    // Construir prompt dinámico con preferencias aprendidas
    const dynamicSystemPrompt = await buildDynamicPrompt(env);

    // Construir mensajes para el modelo
    const messages: Message[] = [
      { role: 'system', content: dynamicSystemPrompt },
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    // Llamar a Workers AI
    let response: any = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
      messages,
      tools,
      max_tokens: 500,
    });

    // Si el modelo quiere usar una tool
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      const toolName = toolCall.name;
      const toolArgs = toolCall.arguments;

      console.log(`Ejecutando tool: ${toolName}`, toolArgs);

      // Ejecutar la tool
      const toolResult = await executeTool(env, toolName, toolArgs);

      // Si necesita confirmación, retornar directamente
      if (toolResult.startsWith('NECESITA_CONFIRMACION:')) {
        return toolResult.replace('NECESITA_CONFIRMACION: ', '');
      }

      // Detectar situaciones de aprendizaje automáticamente
      const learningAnalysis = analyzeMessageForLearning(
        userMessage,
        toolName,
        toolResult
      );

      if (learningAnalysis.shouldLearn && learningAnalysis.type && learningAnalysis.suggestion) {
        // Registrar observación automáticamente
        const context = extractLearningContext(userMessage, toolName, toolArgs, toolResult);
        await addObservation(
          env,
          learningAnalysis.type,
          context,
          learningAnalysis.suggestion,
          userMessage
        ).catch(err => console.error('Error guardando observación:', err));
        // No interrumpir el flujo, solo registrar silenciosamente
      }

      // Agregar el resultado de la tool al historial y pedir respuesta final
      messages.push({
        role: 'assistant',
        content: response.content || '',
        tool_calls: response.tool_calls,
      });

      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolName,
        content: toolResult,
      });

      // Llamar al modelo nuevamente para que genere la respuesta final
      const finalResponse: any = await env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        messages,
        max_tokens: 300,
      });

      return finalResponse.response || finalResponse.content || toolResult;
    }

    // Si no hay tool calls, devolver la respuesta directa
    return response.response || response.content || 'No entendí. ¿Podés repetir?';
  } catch (error: any) {
    console.error('Error en processMessage:', error);
    return '❌ Hubo un problema procesando tu mensaje. Intentá de nuevo.';
  }
}
