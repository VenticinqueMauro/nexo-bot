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
 * Detecta si el mensaje del usuario requiere una acción de datos
 */
function requiresToolExecution(message: string): { requires: boolean; suggestedTool?: string } {
  const msg = message.toLowerCase();

  // PRIMERO: Patrones que requieren sale_register (ventas) - tiene prioridad sobre stock_add
  if (/vend[iíoó]|venta|compr[oó]|llev[oó]/.test(msg)) {
    return { requires: true, suggestedTool: 'sale_register' };
  }

  // Patrones que requieren stock_add (SOLO entrada de mercadería, NO ventas)
  if (/suma|agreg|entr[oóa]|lleg[oóa]|recibi/.test(msg) && /unidad|remera|jean|camisa|producto|stock/.test(msg)) {
    return { requires: true, suggestedTool: 'stock_add' };
  }

  // Patrones que requieren stock_check
  if (/cu[aá]nt|stock|hay|tengo|quedan/.test(msg) && /remera|jean|camisa|producto/.test(msg)) {
    return { requires: true, suggestedTool: 'stock_check' };
  }

  // Patrones que requieren payment_register
  if (/pag[oó]|me pag|cobr[eé]/.test(msg)) {
    return { requires: true, suggestedTool: 'payment_register' };
  }

  // Patrones que requieren client_add
  if (/agreg.*cliente|nuevo cliente|registr.*cliente/.test(msg)) {
    return { requires: true, suggestedTool: 'client_add' };
  }

  // Patrones que requieren product_create
  if (/cre[ao].*producto|nuevo producto|agreg.*producto/.test(msg)) {
    return { requires: true, suggestedTool: 'product_create' };
  }

  return { requires: false };
}

/**
 * Detecta si una respuesta es una "alucinación" que simula ejecutar una acción
 */
function isHallucinatedResponse(response: string): boolean {
  const patterns = [
    /sumando stock/i,
    /vendiendo producto/i,
    /registrando venta/i,
    /agregando.*unidad/i,
    /stock actualizado.*\d+.*unidad/i,
    /voy a (agregar|sumar|registrar|vender)/i,
    /\*\*sumando/i,
    /\*\*vendiendo/i,
    /\*\*registrando/i,
  ];

  return patterns.some(p => p.test(response));
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
        // Parsear items si viene como string JSON (el AI a veces lo envía así)
        let items = args.items;
        if (typeof items === 'string') {
          try {
            items = JSON.parse(items);
          } catch (e) {
            return '❌ Error: No pude interpretar los productos. Intentá de nuevo con formato: "vendí X [producto] a [cliente]"';
          }
        }

        // Parsear pagado a boolean
        // IMPORTANTE: Si el AI envía False por defecto sin que el usuario lo especifique,
        // debemos preguntar. Solo aceptamos true/si como confirmación de pago.
        let pagado = args.pagado;
        if (pagado === undefined || pagado === null) {
          return '¿El cliente pagó o va a cuenta corriente? Respondé "pagó" o "cuenta corriente".';
        }

        if (typeof pagado === 'string') {
          const pagadoLower = pagado.toLowerCase();
          if (pagadoLower === 'false' || pagadoLower === 'no') {
            pagado = false;
          } else if (pagadoLower === 'true' || pagadoLower === 'si' || pagadoLower === 'sí') {
            pagado = true;
          } else {
            return '¿El cliente pagó o va a cuenta corriente? Respondé "pagó" o "cuenta corriente".';
          }
        }

        const order = await registerSale(
          env,
          args.cliente,
          items,
          pagado
        );

        const allProducts = await getAllProducts(env);
        let message = formatOrder(order, allProducts);

        if (pagado) {
          message += `\n\n✓ Venta registrada y PAGADA ($${order.total.toLocaleString('es-AR')})\nStock actualizado.`;
        } else {
          message += `\n\n✓ Venta registrada en CUENTA CORRIENTE\nDeuda: $${order.total.toLocaleString('es-AR')}\nStock actualizado.`;
        }

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
 * Ejecuta una promesa con timeout
 */
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorMessage: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs)
    )
  ]);
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
    // OPTIMIZACIÓN: Usar prompt estático para evitar latencia de Sheets
    // TODO: Cachear preferencias aprendidas en KV para mejor performance
    // const dynamicSystemPrompt = await buildDynamicPrompt(env);

    // Construir mensajes para el modelo
    const messages: Message[] = [
      { role: 'system', content: systemPrompt }, // Usando prompt estático
      ...conversationHistory,
      { role: 'user', content: userMessage },
    ];

    // Llamar a Workers AI con timeout de 8 segundos
    let response: any = await withTimeout(
      env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
        messages,
        tools,
        max_tokens: 200, // Reducido para respuestas más rápidas
      }),
      8000,
      'AI request timeout - el modelo tardó demasiado en responder'
    );

    console.log('=== AI RESPONSE ===');
    console.log('Has tool_calls:', !!response.tool_calls);
    console.log('Response text:', (response.response || response.content || '').substring(0, 200));
    console.log('Full response:', JSON.stringify(response).substring(0, 500));

    // Verificar si la respuesta contiene un JSON de tool call como texto
    // (a veces el modelo lo devuelve como texto en lugar de tool_calls estructurado)
    if (response.response || response.content) {
      const textResponse = response.response || response.content || '';

      // Intentar detectar si es un JSON de tool call
      if (textResponse.includes('"name"') && textResponse.includes('"parameters"')) {
        try {
          // Buscar el JSON completo (puede tener objetos anidados)
          const startIdx = textResponse.indexOf('{');
          if (startIdx !== -1) {
            // Encontrar el cierre del JSON balanceando llaves
            let depth = 0;
            let endIdx = startIdx;
            for (let i = startIdx; i < textResponse.length; i++) {
              if (textResponse[i] === '{') depth++;
              if (textResponse[i] === '}') depth--;
              if (depth === 0) {
                endIdx = i + 1;
                break;
              }
            }

            const jsonStr = textResponse.substring(startIdx, endIdx);
            const toolCallData = JSON.parse(jsonStr);

            if (toolCallData.name && toolCallData.parameters) {
              console.log('Detected tool call in text response:', toolCallData);

              // Ejecutar la tool manualmente
              const toolResult = await executeTool(env, toolCallData.name, toolCallData.parameters);

              // Retornar el resultado directamente (ya formateado)
              return toolResult;
            }
          }
        } catch (e) {
          console.error('Error parsing tool call from text:', e);
        }
      }
    }

    // Si el modelo quiere usar una tool (formato estructurado)
    if (response.tool_calls && response.tool_calls.length > 0) {
      const toolCall = response.tool_calls[0];
      const toolName = toolCall.name;
      const toolArgs = toolCall.arguments;

      console.log(`Ejecutando tool: ${toolName}`, toolArgs);

      // Ejecutar la tool
      const toolResult = await executeTool(env, toolName, toolArgs);

      console.log('Tool result:', toolResult.substring(0, 200));

      // Si necesita confirmación, retornar directamente
      if (toolResult.startsWith('NECESITA_CONFIRMACION:')) {
        return toolResult.replace('NECESITA_CONFIRMACION: ', '');
      }

      // CAMBIO CRÍTICO: Devolver directamente el resultado de la tool
      // sin re-procesarlo por el AI para evitar alucinaciones
      return toolResult;
    }

    // Si no hay tool calls, verificar si debería haber habido una
    const textResponse = response.response || response.content || '';
    const actionCheck = requiresToolExecution(userMessage);

    // Si el mensaje requería una tool pero el modelo no la usó
    if (actionCheck.requires) {
      console.log('⚠️ ADVERTENCIA: El mensaje requería tool pero no se ejecutó ninguna');
      console.log('Mensaje usuario:', userMessage);
      console.log('Tool sugerida:', actionCheck.suggestedTool);
      console.log('Respuesta del modelo:', textResponse.substring(0, 100));

      // Detectar si es una respuesta "alucinada"
      if (isHallucinatedResponse(textResponse)) {
        console.log('🚨 DETECTADA RESPUESTA ALUCINADA - Reintentando con prompt directo');

        // Reintentar con un prompt más directo
        const retryMessages: Message[] = [
          { role: 'system', content: systemPrompt },
          ...conversationHistory,
          { role: 'user', content: `IMPORTANTE: Usá la tool ${actionCheck.suggestedTool} para: ${userMessage}. NO respondas con texto, EJECUTÁ la tool.` },
        ];

        try {
          const retryResponse: any = await withTimeout(
            env.AI.run('@cf/meta/llama-3.1-8b-instruct-fp8', {
              messages: retryMessages,
              tools,
              max_tokens: 200,
            }),
            8000,
            'AI retry timeout'
          );

          console.log('Retry response:', JSON.stringify(retryResponse).substring(0, 300));

          if (retryResponse.tool_calls && retryResponse.tool_calls.length > 0) {
            const toolCall = retryResponse.tool_calls[0];
            console.log(`✓ Retry exitoso - ejecutando tool: ${toolCall.name}`);
            const toolResult = await executeTool(env, toolCall.name, toolCall.arguments);
            return toolResult;
          }
        } catch (retryError) {
          console.error('Error en retry:', retryError);
        }

        // Si el retry también falla, devolver mensaje de error claro
        return '❌ No pude ejecutar la acción. Por favor, intentá de nuevo siendo más específico (ej: "suma 10 remeras negras M")';
      }
    }

    return textResponse || 'No entendí. ¿Podés repetir?';
  } catch (error: any) {
    console.error('Error en processMessage:', error);
    return '❌ Hubo un problema procesando tu mensaje. Intentá de nuevo.';
  }
}
