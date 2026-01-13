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
 * Detecta si el mensaje del usuario requiere una acción de datos (simplificado para 70B)
 */
function requiresToolExecution(message: string): { requires: boolean; suggestedTool?: string } {
  const msg = message.toLowerCase();

  // Patrones básicos para detectar acciones críticas
  if (/vend[iíoó]|venta/.test(msg)) {
    return { requires: true, suggestedTool: 'sale_register' };
  }

  if (/(\$|peso|precio).*\d+/.test(msg) && /producto|remera|jean|camisa/.test(msg)) {
    return { requires: true, suggestedTool: 'product_create' };
  }

  if (/entr[oóa]|lleg[oóa]/.test(msg) && /\d+/.test(msg)) {
    return { requires: true, suggestedTool: 'stock_add' };
  }

  if (/cu[aá]nt|stock|hay|tengo/.test(msg)) {
    return { requires: true, suggestedTool: 'stock_check' };
  }

  if (/pag[oó]|me pag/.test(msg)) {
    return { requires: true, suggestedTool: 'payment_register' };
  }

  return { requires: false };
}

/**
 * Detecta si una respuesta es una "alucinación" (versión simplificada)
 */
function isHallucinatedResponse(response: string): boolean {
  // Solo detectamos casos muy obvios con el 70B
  const patterns = [
    /venta registrada.*exitosamente/i,
    /producto creado.*exitosamente/i,
    /stock actualizado.*\d+ unidades/i,
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
          return `✅ <b>Stock actualizado</b>\n\n` +
                 `📦 <b>${result.product.nombre}</b> ${result.product.color} ${result.product.talle}\n` +
                 `<code>${result.product.sku}</code>\n\n` +
                 `Stock nuevo: <b>${result.newStock}</b> unidades (+${args.cantidad})`;
        } catch (error: any) {
          // Si el error es que no se encontró el producto, sugerir crearlo
          if (error.message && error.message.includes('No se encontró el producto')) {
            return `❌ <b>Producto no encontrado</b>\n\n` +
                   `${error.message}\n\n` +
                   `💡 <b>Sugerencia:</b> <i>Parece que este producto no existe todavía.</i>\n\n` +
                   `Para crearlo, necesito:\n` +
                   `• <b>Nombre:</b> ${args.producto}\n` +
                   `• <b>Categoría:</b> Remera / Jean / Camisa / Buzo / etc.\n` +
                   `• <b>Color:</b> ${args.color || '(especificar)'}\n` +
                   `• <b>Talle:</b> ${args.talle || '(especificar)'}\n` +
                   `• <b>Precio:</b> (especificar)\n\n` +
                   `Decime: "Crealo como [Categoría] a $[Precio]"`;
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
        return `✅ <b>Cliente registrado</b>\n\n` +
               `👤 <b>${client.nombre}</b>\n` +
               `📞 ${client.telefono}` +
               (args.direccion ? `\n📍 ${args.direccion}` : '');
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

        return `✅ <b>Pago registrado</b>\n\n` +
               `👤 <b>${payment.clienteNombre}</b>\n` +
               `💵 Monto: <b>${formatPrice(payment.monto)}</b>\n` +
               `💳 Método: ${args.metodo || 'efectivo'}\n\n` +
               (remainingDebt > 0
                 ? `⚠️ Deuda restante: <b>${formatPrice(remainingDebt)}</b>`
                 : `✅ <b>Saldó toda la deuda</b> 🎉`);
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

        // Detectar pago parcial en el mensaje del usuario
        let montoParcial: number | undefined = undefined;
        if (userMessage) {
          const parcialMatch = userMessage.match(/pagó\s+PARCIAL\s+([\d,.]+)\s+pesos/i);
          if (parcialMatch) {
            const montoStr = parcialMatch[1].replace(/[.,]/g, '');
            montoParcial = parseFloat(montoStr);
            console.log(`💵 Pago parcial detectado: ${montoParcial}`);
          }
        }

        // Parsear pagado a boolean con validación estricta
        let pagado = args.pagado;

        // Si hay pago parcial, forzar pagado=false (porque queda deuda)
        if (montoParcial && montoParcial > 0) {
          pagado = false;
          console.log('ℹ️ Pago parcial detectado - estableciendo pagado=false');
        } else {
          // VALIDACIÓN ESTRICTA: Solo aceptar valores muy explícitos
          if (typeof pagado === 'string') {
            const pagadoLower = pagado.toLowerCase().trim();

            // Casos PAGADO (explícitos)
            if (['true', 'si', 'sí', 'yes', 'pagado', 'pago'].includes(pagadoLower)) {
              pagado = true;
            }
            // Casos NO PAGADO (explícitos)
            else if (['false', 'no', 'cuenta corriente', 'fiado', 'debe'].includes(pagadoLower)) {
              pagado = false;
            }
            // Cualquier otro string → forzar pregunta
            else {
              console.log(`⚠️ Valor ambiguo de 'pagado': "${pagado}" - forzando confirmación`);
              pagado = undefined;
            }
          }
          // Si viene como número diferente de 0 o 1, forzar pregunta
          else if (typeof pagado === 'number' && pagado !== 0 && pagado !== 1) {
            console.log(`⚠️ Valor numérico inválido de 'pagado': ${pagado} - forzando confirmación`);
            pagado = undefined;
          }

          // Si es undefined, null, o el modelo no lo incluyó → PREGUNTAR
          if (pagado === undefined || pagado === null) {
            console.log('ℹ️ Estado de pago no especificado - preguntando al usuario');
            return 'NECESITA_CONFIRMACION:PAGO';
          }

          // Convertir a boolean limpio (solo si llegamos aquí con un valor válido)
          pagado = Boolean(pagado);
        }

        // Parsear fecha de vencimiento si viene
        let vencimiento: string | undefined = undefined;
        let explicitNoDeadline = false;

        if (args.vencimiento) {
          const vLower = args.vencimiento.toLowerCase();
          if (vLower.includes('sin') || vLower.includes('no') || vLower.includes('none')) {
            explicitNoDeadline = true;
          } else {
            const parsed = parseNaturalDate(args.vencimiento);
            if (parsed) {
              vencimiento = parsed;
            }
          }
        }

        // Si es a cuenta corriente y NO tiene vencimiento establecido (y no se especificó explicitamente que no tenga),
        // PREGUNTAR para dar opción de botones rápidos
        if (pagado === false && !vencimiento && !explicitNoDeadline && !montoParcial) {
          return '¿Cuándo vence esta deuda?';
        }

        const order = await registerSale(
          env,
          args.cliente,
          items,
          pagado,
          vencimiento,
          montoParcial
        );

        const allProducts = await getAllProducts(env);
        let message = formatOrder(order, allProducts);

        if (pagado) {
          message += `\n\n✅ <b>Venta registrada y PAGADA</b>\n`;
          message += `💰 Total: <b>${formatPrice(order.total)}</b>\n`;
          message += `📦 <i>Stock actualizado</i>`;
        } else if (montoParcial && montoParcial > 0) {
          // Pago parcial
          const deudaRestante = order.total - montoParcial;
          message += `\n\n💵 <b>Venta con PAGO PARCIAL</b>\n`;
          message += `💰 Total: <b>${formatPrice(order.total)}</b>\n`;
          message += `✅ Pagó ahora: <b>${formatPrice(montoParcial)}</b>\n`;
          message += `🟡 Queda a deber: <b>${formatPrice(deudaRestante)}</b>\n`;

          if (vencimiento) {
            message += `📅 Vence el: <b>${vencimiento}</b>\n`;
          }

          message += `📦 <i>Stock actualizado</i>`;
        } else {
          // Todo a cuenta
          message += `\n\n🟡 <b>Venta en CUENTA CORRIENTE</b>\n`;
          message += `💰 Deuda: <b>${formatPrice(order.total)}</b>\n`;

          if (vencimiento) {
            message += `📅 Vence el: <b>${vencimiento}</b>\n`;
          } else {
            message += `\n⚠️ <i>¿Cuándo vence esta deuda?</i>\n`;
            message += `<i>(Respondé "en 7 días", "el 20", etc)</i>\n`;
          }

          message += `📦 <i>Stock actualizado</i>`;
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

        return `✅ <b>Vencimiento agendado</b>\n\n` +
               `👤 <b>${client.nombre}</b>\n` +
               `💰 Deuda: <b>${formatPrice(lastUnpaid.total)}</b>\n` +
               `📅 Vence el: <b>${deadline}</b>`;
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
        const { parseMultipleSizes, hasMultipleSizes, distributeQuantity } = await import('../utils/parsers');

        // Detectar si hay múltiples talles
        const multipleSizes = hasMultipleSizes(args.talle || '');

        if (multipleSizes) {
          // CASO: Múltiples talles → Crear un producto por cada talle
          const sizes = parseMultipleSizes(args.talle);
          const stockInicial = args.stockInicial || 0;

          console.log(`📦 Detectados ${sizes.length} talles: ${sizes.join(', ')}`);
          console.log(`📊 Distribuyendo stock total (${stockInicial}) entre ${sizes.length} productos`);

          // Distribuir stock entre los talles
          const stockDistribution = distributeQuantity(stockInicial, sizes.length);

          const createdProducts = [];

          for (let i = 0; i < sizes.length; i++) {
            const size = sizes[i];
            const stockForSize = stockDistribution[i];

            console.log(`  → Creando producto talle ${size} con stock ${stockForSize}`);

            const product = await createProduct(
              env,
              args.nombre,
              args.categoria,
              args.color || '',
              size, // Talle individual
              args.precio,
              args.descripcion,
              args.temporada,
              args.proveedor,
              stockForSize,
              args.stockMinimo || 5
            );

            // Si viene fotoId, asociar la foto a todos los productos
            if (args.fotoId) {
              try {
                await updateProductPhoto(env, product.id, args.fotoId);
              } catch (e: any) {
                console.error(`Error asociando foto al producto talle ${size}:`, e);
              }
            }

            createdProducts.push(product);
          }

          // Construir mensaje de respuesta para múltiples productos
          let message = `✅ <b>Creados ${createdProducts.length} productos</b>\n\n`;
          message += `👕 <b>${args.nombre}</b> ${args.color || ''}\n`;
          message += `💰 Precio: <b>${formatPrice(args.precio)}</b> c/u\n\n`;

          createdProducts.forEach(p => {
            message += `• Talle <b>${p.talle}</b> - Stock: <b>${p.stock}</b> - <code>${p.sku}</code>\n`;
          });

          if (args.fotoId) {
            message += `\n📸 <i>Foto asociada a todos los productos</i>`;
          }

          return message;

        } else {
          // CASO: Talle único o sin talle → Crear un solo producto
          const product = await createProduct(
            env,
            args.nombre,
            args.categoria,
            args.color || '',
            args.talle || '',
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

          return `✅ <b>Producto creado exitosamente</b>\n\n` +
                 `👕 <b>${product.nombre}</b> ${product.color} ${product.talle}\n` +
                 `<code>${product.sku}</code>\n\n` +
                 `💰 Precio: <b>${formatPrice(product.precio)}</b>\n` +
                 `📦 Stock inicial: <b>${product.stock}</b> unidades\n` +
                 (product.descripcion ? `📝 ${product.descripcion}\n` : '') +
                 (product.temporada ? `🌡 ${product.temporada}\n` : '') +
                 (product.proveedor ? `🏭 Proveedor: ${product.proveedor}\n` : '') +
                 (args.fotoId ? `📸 <i>Foto asociada</i>` : '');
        }
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

        return `🧠 <b>¡Aprendido!</b>\n\n` +
               `Ya sé que cuando decís "<i>${preference.terminoUsuario}</i>" te referís a: <b>${preference.mapeo}</b>.\n\n` +
               `Lo voy a recordar para la próxima 😉`;
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

    // Llamar a Workers AI con timeout de 12 segundos (70B necesita más tiempo)
    let response: any = await withTimeout(
      env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
        messages,
        tools,
        max_tokens: 300, // Aumentado porque 70B da mejores respuestas
      }),
      12000,
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

      // Si necesita confirmación, retornar directamente el marcador
      // para que handlers.ts lo detecte y muestre los botones correspondientes
      if (toolResult.startsWith('NECESITA_CONFIRMACION:')) {
        return toolResult; // NO limpiar aquí, dejar que handlers.ts lo procese
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
            env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', {
              messages: retryMessages,
              tools,
              max_tokens: 300,
            }),
            12000,
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
