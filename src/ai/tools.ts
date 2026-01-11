/**
 * Definición de tools para Workers AI (Llama 3.1 function calling)
 */
export const tools = [
  {
    type: "function",
    function: {
      name: "stock_check",
      description: "Consultar el stock actual de uno o varios productos. Usar cuando el usuario pregunta cuánto hay de algo.",
      parameters: {
        type: "object",
        properties: {
          producto: {
            type: "string",
            description: "Nombre del producto a consultar (ej: 'coca', 'sprite', 'fanta'). Dejar vacío para ver todo el stock."
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "stock_add",
      description: "SOLO para entrada de mercadería nueva al inventario. Usar cuando la mercadería LLEGA/ENTRA al negocio (proveedor, reposición). SUMA unidades al stock. NO usar para ventas - para ventas usar sale_register.",
      parameters: {
        type: "object",
        properties: {
          producto: {
            type: "string",
            description: "Nombre del producto tal cual lo dijo el usuario. NO inventar SKUs. Ej: 'remera', 'jean', 'camisa'"
          },
          cantidad: {
            type: "number",
            description: "Cantidad que entró (en unidades)"
          },
          color: {
            type: "string",
            description: "Color del producto (ej: 'negro', 'blanco', 'azul')"
          },
          talle: {
            type: "string",
            description: "Talle del producto (ej: 'S', 'M', 'L', 'XL')"
          }
        },
        required: ["producto", "cantidad"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "client_list",
      description: "Listar todos los clientes registrados",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "client_search",
      description: "Buscar información de un cliente por nombre",
      parameters: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
            description: "Nombre del cliente tal cual lo dijo el usuario."
          }
        },
        required: ["nombre"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "client_add",
      description: "Registrar un cliente nuevo",
      parameters: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
            description: "Nombre del cliente/negocio tal cual lo dijo el usuario."
          },
          telefono: {
            type: "string",
            description: "Teléfono de contacto"
          },
          direccion: {
            type: "string",
            description: "Dirección del cliente"
          }
        },
        required: ["nombre"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "debt_list",
      description: "Ver lista de clientes que deben plata",
      parameters: {
        type: "object",
        properties: {
          solo_vencidas: {
            type: "boolean",
            description: "Si es true, solo muestra deudas vencidas"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "debt_check",
      description: "Ver deuda de un cliente específico",
      parameters: {
        type: "object",
        properties: {
          cliente: {
            type: "string",
            description: "Nombre del cliente"
          }
        },
        required: ["cliente"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "payment_register",
      description: "Registrar un pago de un cliente",
      parameters: {
        type: "object",
        properties: {
          cliente: {
            type: "string",
            description: "Nombre del cliente que pagó"
          },
          monto: {
            type: "number",
            description: "Monto que pagó"
          },
          metodo: {
            type: "string",
            description: "Método de pago (efectivo, transferencia, etc.)"
          }
        },
        required: ["cliente", "monto"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sale_register",
      description: "Registrar una VENTA. Usar cuando el usuario dice 'vendí', 'compró', 'llevó'. RESTA unidades del stock, registra la venta en Pedidos. MUY IMPORTANTE: El parámetro 'pagado' solo debe ser true si el usuario dice explícitamente que 'pagó', 'pago en efectivo', 'pago con tarjeta'. Si NO lo dice, NO incluyas el parámetro pagado para que el sistema pregunte.",
      parameters: {
        type: "object",
        properties: {
          cliente: {
            type: "string",
            description: "Nombre del cliente tal cual lo dijo el usuario. NO normalizar ni cambiar mayúsculas/minúsculas."
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                producto: {
                  type: "string",
                  description: "Nombre del producto tal cual lo dijo el usuario. NO inventar SKUs ni IDs. Ej: 'remera', 'corpiño', 'jean'."
                },
                cantidad: { type: "number" },
                color: { type: "string" },
                talle: { type: "string" }
              }
            },
            description: "Lista de productos vendidos (con color y talle si aplica)"
          },
          pagado: {
            type: "boolean",
            description: "SOLO incluir si el usuario lo dijo explícitamente. true='pagó', 'efectivo', 'tarjeta'. NO incluir si no lo dijo."
          }
        },
        required: ["cliente", "items"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sales_today",
      description: "Ver las ventas del día",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "product_create",
      description: "Crear un nuevo producto en el inventario. El SKU se genera automáticamente.",
      parameters: {
        type: "object",
        properties: {
          nombre: {
            type: "string",
            description: "Nombre del producto (ej: 'Remera', 'Jean', 'Camisa')"
          },
          categoria: {
            type: "string",
            description: "Categoría (ej: 'Remera', 'Jean', 'Camisa', 'Buzo', 'Campera')"
          },
          color: {
            type: "string",
            description: "Color del producto (ej: 'Negro', 'Blanco', 'Azul')"
          },
          talle: {
            type: "string",
            description: "Talle (ej: 'S', 'M', 'L', 'XL', '38', '40')"
          },
          precio: {
            type: "number",
            description: "Precio de venta"
          },
          descripcion: {
            type: "string",
            description: "Descripción opcional del producto"
          },
          temporada: {
            type: "string",
            description: "Temporada (opcional): 'Verano', 'Invierno', 'Todo el año'"
          },
          proveedor: {
            type: "string",
            description: "Nombre del proveedor (opcional)"
          },
          stockInicial: {
            type: "number",
            description: "Stock inicial (default: 0)"
          },
          stockMinimo: {
            type: "number",
            description: "Stock mínimo para alerta (default: 5)"
          }
        },
        required: ["nombre", "categoria", "color", "talle", "precio"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "product_search",
      description: "Buscar productos por SKU, nombre, color, talle o categoría",
      parameters: {
        type: "object",
        properties: {
          busqueda: {
            type: "string",
            description: "Término de búsqueda (SKU, nombre, color, talle, categoría)"
          }
        },
        required: ["busqueda"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "learn_preference",
      description: "Aprender una nueva preferencia o alias personalizado del usuario. Usar cuando el usuario te enseña un término nuevo, alias o patrón específico.",
      parameters: {
        type: "object",
        properties: {
          tipo: {
            type: "string",
            description: "Tipo de preferencia: 'producto_alias', 'cliente_alias', 'abreviacion', 'patron_venta', 'contexto'",
            enum: ["producto_alias", "cliente_alias", "abreviacion", "patron_venta", "contexto"]
          },
          terminoUsuario: {
            type: "string",
            description: "El término o frase que usa el usuario"
          },
          mapeo: {
            type: "string",
            description: "A qué se mapea ese término (el significado real)"
          },
          contextoAdicional: {
            type: "string",
            description: "Información adicional o contexto sobre esta preferencia"
          }
        },
        required: ["tipo", "terminoUsuario", "mapeo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "learning_stats",
      description: "Ver estadísticas del sistema de aprendizaje: cuántas preferencias aprendidas, observaciones pendientes, etc.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "whatsapp_reminder",
      description: "Generar un link de WhatsApp para enviar un mensaje a un cliente. Usar cuando el usuario pida 'mandar mensaje', 'recordar deuda', 'avisar a cliente'.",
      parameters: {
        type: "object",
        properties: {
          cliente: {
            type: "string",
            description: "Nombre del cliente tal cual lo dijo el usuario."
          },
          mensaje: {
            type: "string",
            description: "El contenido del mensaje a enviar. Si es un recordatorio de deuda, incluir detalles (monto, fecha, etc)."
          }
        },
        required: ["cliente", "mensaje"]
      }
    }
  }
];
