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
  updateProductPhoto,
} from '../sheets/stock';
import {
  findClient,
  addClient,
  getAllClients,
} from '../sheets/clients';
import {
  registerSale,
  getTodayOrders,
  getClientOrders,
  updateOrderDeadline,
  getSalesStats,
} from '../sheets/sales';
import { parseNaturalDate } from '../utils/dates';
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
import {
  formatMultipleProductsResponse,
  formatMultipleClientsResponse,
} from '../utils/selection-state';

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

  // Patrones que requieren product_create (PRIORIDAD: crear producto nuevo)
  // Detectar cuando se menciona precio (indica producto nuevo)
  if (/(\$|peso|precio).*\d+|(\d+).*(\$|peso|precio)/.test(msg) && /remera|jean|camisa|buzo|producto/.test(msg)) {
    return { requires: true, suggestedTool: 'product_create' };
  }

  // Detectar cuando dice explícitamente "nuevo" o "crear"
  if (/(cre[ao]|nuevo|agreg[aá]).*producto/.test(msg) || /producto.*(nuevo|cre[ao])/.test(msg)) {
    return { requires: true, suggestedTool: 'product_create' };
  }

  // Patrones que requieren stock_add (SOLO entrada de mercadería a productos existentes)
  if (/suma|entr[oóa]|lleg[oóa]|recibi/.test(msg) && /unidad|stock/.test(msg)) {
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

  // Patrones que requieren whatsapp_reminder
  if (/(mand|envi|record).*mensaje|(mand|envi|record)ale.*a.*(que|deuda|cobro)|l[ií]nk.*(wa|whatsapp)/.test(msg)) {
    return { requires: true, suggestedTool: 'whatsapp_reminder' };
  }

  // Patrones que requieren order_update_deadline
  if (/(venc|fech|plazo).*(deuda|pago)|(vence|caduca).*(el|en)/.test(msg)) {
    return { requires: true, suggestedTool: 'order_update_deadline' };
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
    /venta registrada/i,
    /pago registrado/i,
    /deuda actualizada/i,
    /stock actualizado/i,
    /producto creado/i,
  ];

  return patterns.some(p => p.test(response));
}

/**
 * Ejecuta una tool y retorna el resultado
 */
async function executeTool(env: Env, toolName: string, args: any, userMessage?: string): Promise<string> {
  try {
    switch (toolName) {
      case 'stock_check': {
        if (args.producto) {
          // Consultar producto específico
          const products = await findProducts(env, args.producto);
          if (products.length === 0) {
            return `No se encontró ningún producto que coincida con "${args.producto}".`;
          }

          // Si hay múltiples coincidencias y el término es genérico, mostrar opciones
          if (products.length > 1 && args.producto.split(' ').length <= 2) {
            return formatMultipleProductsResponse(products, 'stock_check', args);
          }

          return formatProductInfo(products);
        } else {
          // Resumen de stock general
          const allProducts = await getAllProducts(env);
          return formatStockSummary(allProducts);
        }
      }

      case 'stock_add': {
        try {
          const result = await addStock(
            env,
            args.producto,
            args.cantidad,
            args.color,
            args.talle
          );
          return `✓ Registrado. Stock de ${result.product.nombre} ${result.product.color} ${result.product.talle} actualizado: ${result.newStock} (+${args.cantidad})`;
        } catch (error: any) {
          // Si el error es que no se encontró el producto, sugerir crearlo
          if (error.message && error.message.includes('No se encontró el producto')) {
            return `❌ ${error.message}\n\n💡 **Sugerencia:** Parece que este producto no existe todavía. ¿Querés que lo cree primero?\n\nPara crear el producto, necesito:\n- Nombre: ${args.producto}\n- Categoría: (¿Es una Remera, Jean, Camisa, Buzo, etc.?)\n- Color: ${args.color || '(especificar)'}\n- Talle: ${args.talle || '(especificar)'}\n- Precio: (especificar)\n\nDecime "Sí, crealo con categoría X y precio $Y" o dame los datos completos.`;
          }
          throw error;
        }
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
        // SIEMPRE PREGUNTAR si el usuario no especificó que PAGÓ
        // Solo proceder automáticamente si pagado === true o "true" o "si"
        let pagado = args.pagado;

        // 1. Normalizar string a boolean si viene como texto
        if (typeof pagado === 'string') {
          const pagadoLower = pagado.toLowerCase();
          // Casos positivos
          if (['true', 'si', 'sí', 'pago', 'pagó', 'efectivo', 'tarjeta', 'transferencia'].some(s => pagadoLower.includes(s))) {
            pagado = true;
          }
          // Casos negativos explícitos
          else if (['false', 'no', 'cuenta corriente', 'cc', 'ctacte', 'debe', 'fiado'].some(s => pagadoLower.includes(s))) {
            pagado = false;
          } else {
            // Si trae texto raro, dejarlo undefined para que pregunte
            pagado = undefined;
          }
        }

        console.log('[DEBUG] Payment Check:', {
          original: args.pagado,
          parsed: pagado,
          userMessage,
          isBoolean: typeof pagado === 'boolean'
        });

        // 2. Validación Anti-Alucinación (User Message Check)
        if (userMessage && typeof pagado === 'boolean') {
          const userMsgLower = userMessage.toLowerCase();
          const explicitCC = ['cuenta corriente', 'cc', 'ctacte', 'c.c.', 'fiado', 'debe', 'no pago', 'sin pagar', 'a cuenta'].some(term => userMsgLower.includes(term));
          const explicitPaid = ['pago', 'pagó', 'pagada', 'pagado', 'efectivo', 'tarjeta', 'transferencia', 'mp', 'mercado pago', 'alias', 'cvu'].some(term => userMsgLower.includes(term));

          console.log('[DEBUG] Keywords:', { explicitCC, explicitPaid, msg: userMsgLower });

          if (pagado === false && !explicitCC) {
            console.log('Force confirmation: Model predicted pagado=false but user did not be explicit.');
            pagado = undefined;
          }

          if (pagado === true && !explicitPaid) {
            console.log('Force confirmation: Model predicted pagado=true but user did not be explicit.');
            pagado = undefined;
          }
        }

        // 3. Si sigue indefinido, solicitar confirmación al usuario
        if (pagado === undefined || pagado === null) {
          return 'NECESITA_CONFIRMACION:PAGO';
        }

        // Parsear fecha de vencimiento si viene
        let vencimiento: string | undefined = undefined;
        if (args.vencimiento) {
          const parsed = parseNaturalDate(args.vencimiento);
          if (parsed) {
            vencimiento = parsed;
          }
        }

        const order = await registerSale(
          env,
          args.cliente,
          items,
          pagado,
          vencimiento
        );

        const allProducts = await getAllProducts(env);
        let message = formatOrder(order, allProducts);

        if (pagado) {
          message += `\n\n✓ Venta registrada y PAGADA ($${order.total.toLocaleString('es-AR')})\nStock actualizado.`;
        } else {
          message += `\n\n✓ Venta registrada en CUENTA CORRIENTE\nDeuda: $${order.total.toLocaleString('es-AR')}`;

          if (vencimiento) {
            message += `\n📅 Vence el: ${vencimiento}`;
          } else {
            message += `\n\n⚠️ ¿Cuándo vence esta deuda? (Respondé "en 7 días", "el 20", etc)`;
          }

          message += `\nStock actualizado.`;
        }

        return message;
      }

      case 'order_update_deadline': {
        const client = await findClient(env, args.cliente);
        if (!client) {
          return `No se encontró el cliente "${args.cliente}".`;
        }

        // Buscar última deuda sin fecha de vencimiento o la más reciente
        const orders = await getClientOrders(env, client.id);
        // Filtrar impagas
        const unpaidOrders = orders.filter(o => !o.pagado);

        if (unpaidOrders.length === 0) {
          return `${client.nombre} no tiene deudas pendientes para asignar vencimiento.`;
        }

        // Tomar la última
        const lastUnpaid = unpaidOrders[unpaidOrders.length - 1];

        // Parsear fecha
        const deadline = parseNaturalDate(args.vencimiento);
        if (!deadline) {
          return `No pude entender la fecha "${args.vencimiento}". Probá con "en 7 días" o "20/05".`;
        }

        await updateOrderDeadline(env, lastUnpaid.id, deadline);

        return `✅ Agendado. La deuda de ${client.nombre} ($${lastUnpaid.total}) del ${lastUnpaid.fecha} vence el **${deadline}**.`;
      }

      case 'sales_stats': {
        let desde = args.desde;
        let hasta = args.hasta;
        const now = new Date();
        const timezoneOffset = -3; // Argentina UTC-3
        // Ajustar fecha actual a zona horaria local aprox
        now.setHours(now.getHours() + timezoneOffset);

        const todayStr = now.toISOString().split('T')[0];

        if (!desde && !hasta && args.periodo) {
          switch (args.periodo) {
            case 'hoy':
              desde = todayStr;
              break;
            case 'ayer': {
              const yesterday = new Date(now);
              yesterday.setDate(yesterday.getDate() - 1);
              desde = yesterday.toISOString().split('T')[0];
              hasta = yesterday.toISOString().split('T')[0];
              break;
            }
            case 'semana_actual': {
              const day = now.getDay(); // 0 (Domingo) - 6 (Sábado)
              const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Ajustar al Lunes
              const monday = new Date(now);
              monday.setDate(diff);
              desde = monday.toISOString().split('T')[0];
              break;
            }
            case 'mes_actual': {
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              desde = startOfMonth.toISOString().split('T')[0];
              break;
            }
            case 'mes_anterior': {
              const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
              const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
              desde = startOfPrevMonth.toISOString().split('T')[0];
              hasta = endOfPrevMonth.toISOString().split('T')[0];
              break;
            }
            case 'anio_actual': {
              const startOfYear = new Date(now.getFullYear(), 0, 1);
              desde = startOfYear.toISOString().split('T')[0];
              break;
            }
            case 'historico':
            default:
              // Sin fechas, trae todo
              break;
          }
        }

        const stats = await getSalesStats(env, desde, hasta);

        let msg = `📊 **Estadísticas de Ventas**\n`;
        if (args.periodo && args.periodo !== 'historico') {
          msg += `Período: ${args.periodo.replace('_', ' ')}\n`;
        }
        if (desde) msg += `Desde: ${desde}\n`;
        if (hasta) msg += `Hasta: ${hasta}\n`;

        msg += `\n🛒 Cantidad de ventas: ${stats.totalVentas}`;
        msg += `\n💰 Total facturado: $${stats.totalMonto.toLocaleString('es-AR')}`;
        msg += `\n📈 Promedio por venta: $${stats.promedioPorVenta.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

        return msg;
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

        // Si viene fotoId, asociar la foto
        if (args.fotoId) {
          try {
            await updateProductPhoto(env, product.id, args.fotoId);
          } catch (e: any) {
            console.error('Error asociando foto al crear producto:', e);
            // No fallamos la operación completa, solo logueamos
          }
        }

        return `✓ Producto creado exitosamente:
${product.nombre} ${product.color} ${product.talle}
SKU: ${product.sku}
Precio: ${formatPrice(product.precio)}
Stock inicial: ${product.stock}
${product.descripcion ? `Descripción: ${product.descripcion}\n` : ''}${product.temporada ? `Temporada: ${product.temporada}\n` : ''}${product.proveedor ? `Proveedor: ${product.proveedor}` : ''}${args.fotoId ? '\n📸 Foto asociada.' : ''}`;
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

      case 'whatsapp_reminder': {
        const client = await findClient(env, args.cliente);
        if (!client) {
          return `No se encontró el cliente "${args.cliente}".`;
        }

        if (!client.telefono) {
          return `El cliente ${client.nombre} no tiene teléfono registrado. Agregalo primero.`;
        }

        // Limpiar teléfono (dejar solo números)
        const phone = client.telefono.replace(/[^0-9]/g, '');

        // Si no tiene código de país (ej: empieza con 11 o 15), asumir Argentina (549)
        let finalPhone = phone;
        if (phone.length === 10) { // Ej: 11 1234 5678
          finalPhone = `549${phone}`;
        } else if (phone.startsWith('15')) { // Ej: 15 1234 5678
          finalPhone = `549${phone.substring(2)}`;
        }

        // Obtener detalles de deuda para armar el mensaje
        const orders = await getClientOrders(env, client.id);
        const unpaidOrders = orders.filter(o => !o.pagado);
        const allProducts = await getAllProducts(env);

        let finalMessage = args.mensaje || '';

        // Si hay deuda y el mensaje parece ser un recordatorio (o si el usuario pide detalles)
        if (unpaidOrders.length > 0) {
          const intro = `Hola ${client.nombre}! 👋 Quería recordarte que tenés un saldo pendiente:`;

          const details = unpaidOrders.map(order => {
            const itemsStr = order.items.map(item => {
              const product = allProducts.find(p => p.id === item.producto);
              // Normalizar nombre para que sea amigable
              const prodName = product ? `${product.nombre} ${product.color} ${product.talle}` : 'Producto';
              return `${item.cantidad} ${prodName}`;
            }).join(', ');

            return `🗓 ${order.fecha}: ${itemsStr} -> $${order.total.toLocaleString('es-AR')}`;
          }).join('\n');

          const totalDeuda = unpaidOrders.reduce((sum, o) => sum + o.total, 0);

          // Si el usuario ya puso un mensaje específico, lo usamos como cabecera o nota
          // Si el mensaje es muy genérico ("recordale la deuda"), usamos nuestro formato completo
          const userMsgLower = (args.mensaje || '').toLowerCase();
          if (!args.mensaje || userMsgLower.includes('deuda') || userMsgLower.includes('vence') || userMsgLower.includes('recorda')) {
            finalMessage = `${intro}\n\n${details}\n\nTotal: $${totalDeuda.toLocaleString('es-AR')}\n\nCualquier duda avisame! Gracias 🙌`;

            // Si el usuario agregó una nota específica (ej: "que se vence mañana"), la agregamos al final
            if (args.mensaje && !userMsgLower.includes('recorda')) {
              finalMessage += `\n(${args.mensaje})`;
            }
          }
        }

        const encodedMessage = encodeURIComponent(finalMessage);
        const link = `https://wa.me/${finalPhone}?text=${encodedMessage}`;

        return `📱 Link generado para ${client.nombre}:\n\n[Enviar mensaje por WhatsApp](${link})\n\nMensaje generado:\n${finalMessage}`;
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

    // Calcular fecha actual para contexto
    const now = new Date();
    // Ajuste simple UTC-3
    now.setHours(now.getHours() - 3);
    const todayStr = now.toISOString().split('T')[0];

    // Construir mensajes para el modelo
    const messages: Message[] = [
      { role: 'system', content: `${systemPrompt}\n\nHOY ES: ${todayStr}.` }, // Inyectar fecha actual
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
              const toolResult = await executeTool(env, toolCallData.name, toolCallData.parameters, userMessage);

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
      const toolResult = await executeTool(env, toolName, toolArgs, userMessage);

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
            const toolResult = await executeTool(env, toolCall.name, toolCall.arguments, userMessage);
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
