# Nexo Bot

## Bot de Telegram para gestión de distribuidora de bebidas

---

## 1. Visión General

### ¿Qué es Nexo Bot?

Un bot de Telegram que funciona como asistente personal para el dueño de una distribuidora de bebidas. El usuario habla o escribe en lenguaje natural, y el bot entiende, ejecuta y responde.

**Sin apps, sin paneles, sin complicaciones.** Todo desde Telegram.

### Filosofía

> "Hablale como a un empleado, él se encarga del resto."

El dueño dice "entraron 50 coca" y el bot actualiza el stock. Pregunta "¿quién me debe?" y el bot responde con la lista. Así de simple.

---

## 2. Stack Tecnológico

| Componente | Tecnología | Razón |
|------------|------------|-------|
| **Bot Framework** | grammY | Moderno, TypeScript nativo, bien documentado |
| **Runtime** | Cloudflare Workers | Serverless, económico, edge computing |
| **LLM** | Workers AI - `@cf/meta/llama-3.1-8b-instruct-fp8` | Optimizado para velocidad, 128K contexto, function calling |
| **Storage** | Google Sheets API | Rápido de implementar, visible para el dueño |
| **Lenguaje** | TypeScript | Type safety, mejor DX |

### ¿Por qué Llama 3.1 8B Fast?

Según la [documentación oficial de Cloudflare](https://developers.cloudflare.com/workers-ai/models/@cf/meta/llama-3.1-8b-instruct-fp8/):

- **128,000 tokens de contexto** - Suficiente para conversaciones largas
- **Versión "fast"** - Optimizada para baja latencia
- **Soporta function calling** - Puede invocar tools estructurados
- **Multilingüe** - Entiende español perfectamente
- **Económico**: $0.045/M input tokens, $0.384/M output tokens

### Pricing de Workers AI

| Plan | Free Allocation | Precio |
|------|-----------------|--------|
| Workers Free | 10,000 Neurons/día | N/A |
| Workers Paid | 10,000 Neurons/día | $0.011/1,000 Neurons extra |

**Estimación para Nexo Bot:**
- ~50 interacciones/día
- ~500 tokens promedio por interacción
- **Costo estimado: $0 (dentro del free tier)** para uso normal

### Arquitectura Simple

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram   │────▶│ Cloudflare Worker│────▶│  Google Sheets  │
│   (User)    │◀────│  + Workers AI    │◀────│   (Storage)     │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

---

## 3. Funcionalidades MVP

### 3.1 Gestión de Stock

**Acciones:**
- Consultar stock de un producto
- Consultar stock general (resumen)
- Registrar entrada de mercadería
- Alertas de stock bajo (configurable)

**Ejemplos de interacción:**

```
Usuario: "¿Cuánta coca tengo?"
Bot: "Coca Cola 2.25L: 45 packs
      Coca Cola 1.5L: 23 packs
      Coca Cola 500ml: 120 unidades"

Usuario: "Entraron 50 packs de sprite 2.25"
Bot: "✓ Registrado. Stock de Sprite 2.25L actualizado: 78 packs"

Usuario: "¿Cómo estamos de stock?"
Bot: "📦 Resumen de stock:
      
      ⚠️ Stock bajo:
      - Fanta 2.25L: 8 packs (mínimo: 20)
      - Agua mineral 1.5L: 5 packs (mínimo: 15)
      
      ✓ Stock OK:
      - Coca 2.25L: 45 packs
      - Sprite 2.25L: 78 packs
      - Cerveza Quilmes: 30 packs
      ... (15 productos más)"
```

### 3.2 Gestión de Clientes

**Acciones:**
- Registrar cliente nuevo
- Buscar cliente
- Ver historial de compras de un cliente
- Ver info completa de cliente

**Ejemplos de interacción:**

```
Usuario: "Agregá un cliente nuevo, Kiosco López, teléfono 3815551234"
Bot: "✓ Cliente registrado: Kiosco López
      Tel: 3815551234
      ¿Querés agregar dirección o alguna nota?"

Usuario: "¿Qué onda con el kiosco de Juan?"
Bot: "🏪 Kiosco de Juan
      Tel: 3815559876
      Dirección: Av. Mate de Luna 1500
      
      Última compra: hace 5 días ($45.000)
      Promedio de compra: $38.000
      Comportamiento de pago: Excelente ✓
      Deuda actual: $0"

Usuario: "¿Qué me compró López la última vez?"
Bot: "📋 Última compra de Kiosco López (15/01):
      - 10 Coca 2.25L
      - 5 Sprite 2.25L
      - 5 Fanta 2.25L
      Total: $52.500"
```

### 3.3 Gestión de Deudas y Cobros

**Acciones:**
- Ver quién debe (lista general)
- Ver deuda de un cliente específico
- Registrar un pago
- Ver deudas vencidas

**Ejemplos de interacción:**

```
Usuario: "¿Quién me debe plata?"
Bot: "💰 Deudas pendientes: $185.000

      🔴 Vencidas:
      - Almacén Pérez: $65.000 (vencido hace 15 días)
      - Kiosco Don Mario: $40.000 (vencido hace 3 días)
      
      🟡 Por vencer:
      - Despensa María: $50.000 (vence mañana)
      
      🟢 Al día:
      - Kiosco López: $30.000 (vence en 5 días)"

Usuario: "Pérez me pagó 30 lucas"
Bot: "✓ Pago registrado: $30.000 de Almacén Pérez
      Deuda restante: $35.000"

Usuario: "¿Cuánto debe el kiosco de la esquina?"
Bot: "Kiosco La Esquina debe $25.000
      - $15.000 del pedido del 10/01 (vencido)
      - $10.000 del pedido del 18/01 (vence en 2 días)"
```

### 3.4 Registro de Ventas/Pedidos

**Acciones:**
- Registrar una venta/pedido
- Ver pedidos del día
- Ver historial de pedidos

**Ejemplos de interacción:**

```
Usuario: "Vendí a López: 10 coca, 5 sprite, todo 2.25"
Bot: "📝 Pedido registrado para Kiosco López:
      - 10 Coca 2.25L: $25.000
      - 5 Sprite 2.25L: $12.500
      Total: $37.500
      
      ¿Pagó o va a cuenta corriente?"

Usuario: "A cuenta"
Bot: "✓ Agregado a cuenta corriente de López.
      Deuda total de López: $37.500
      Stock actualizado."

Usuario: "¿Qué vendí hoy?"
Bot: "📊 Ventas de hoy (20/01):
      
      3 pedidos - Total: $127.500
      
      1. Kiosco López - $37.500 (cuenta corriente)
      2. Almacén Pérez - $45.000 (pagó efectivo)
      3. Despensa María - $45.000 (cuenta corriente)"
```

---

## 4. Estructura de Datos (Google Sheets)

### Hoja 1: Productos
| ID | Nombre | Presentación | Stock | Stock Mínimo | Precio |
|----|--------|--------------|-------|--------------|--------|
| P001 | Coca Cola | 2.25L | 45 | 20 | 2500 |
| P002 | Coca Cola | 1.5L | 23 | 15 | 2000 |
| P003 | Sprite | 2.25L | 78 | 20 | 2500 |

### Hoja 2: Clientes
| ID | Nombre | Teléfono | Dirección | Notas | Fecha Alta |
|----|--------|----------|-----------|-------|------------|
| C001 | Kiosco López | 3815551234 | Av. Mitre 450 | Paga siempre a tiempo | 2024-01-15 |
| C002 | Almacén Pérez | 3815555678 | San Martín 1200 | A veces se atrasa | 2024-01-10 |

### Hoja 3: Pedidos
| ID | Fecha | Cliente ID | Cliente Nombre | Items (JSON) | Total | Estado | Pagado |
|----|-------|------------|----------------|--------------|-------|--------|--------|
| V001 | 2025-01-20 | C001 | Kiosco López | [{"producto":"P001","cant":10},{"producto":"P003","cant":5}] | 37500 | entregado | no |

### Hoja 4: Pagos
| ID | Fecha | Cliente ID | Cliente Nombre | Monto | Método | Pedido ID | Notas |
|----|-------|------------|----------------|-------|--------|-----------|-------|
| PAY001 | 2025-01-20 | C002 | Almacén Pérez | 30000 | efectivo | V002 | Pago parcial |

### Hoja 5: Movimientos Stock
| ID | Fecha | Producto ID | Producto Nombre | Cantidad | Tipo | Referencia | Notas |
|----|-------|-------------|-----------------|----------|------|------------|-------|
| M001 | 2025-01-20 | P003 | Sprite 2.25L | +50 | entrada | - | Llegó pedido proveedor |
| M002 | 2025-01-20 | P001 | Coca 2.25L | -10 | venta | V001 | - |

### Hoja 6: Observaciones (Sistema de Aprendizaje)
| ID | Fecha | Tipo | Contexto | Acción Sugerida | Estado | Mensaje Usuario |
|----|-------|------|----------|-----------------|--------|-----------------|
| OBS001 | 2025-01-20 | termino_nuevo | Usuario dijo "las de siempre" | Crear alias para productos frecuentes | pendiente | "Entraron las de siempre" |
| OBS002 | 2025-01-20 | correccion | Usuario corrigió "López" → "Almacén López" | Agregar alias de cliente | implementada | "No, Almacén López" |

### Hoja 7: Preferencias (Sistema de Aprendizaje)
| ID | Tipo | Término Usuario | Mapeo | Frecuencia | Última Vez | Aprobado | Contexto Adicional |
|----|------|-----------------|-------|------------|------------|----------|-------------------|
| PREF001 | producto_alias | "las de siempre" | "remera,negro,XL" | 8 | 2025-01-20 | sí | Pedido frecuente |
| PREF002 | cliente_alias | "lópez" | "C001" | 15 | 2025-01-20 | sí | Cliente habitual |

---

## 5. Flujo del Bot

### 5.1 Arquitectura con Function Calling

Llama 3.1 soporta **function calling nativo**, lo que simplifica enormemente la arquitectura. En lugar de parsear manualmente la intención, le damos al modelo las "tools" disponibles y él decide cuál usar.

```
┌─────────────────────────────────────────────────────────────┐
│                   MENSAJE DE TELEGRAM                        │
│              (texto o transcripción de voz)                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│            WORKERS AI (Llama 3.1 8B Fast)                   │
│                                                              │
│  Input:                                                      │
│  - System prompt con contexto del negocio                   │
│  - Tools definidas (stock_check, sale_register, etc.)       │
│  - Mensaje del usuario                                       │
│                                                              │
│  Output:                                                     │
│  - tool_calls: [{name: "stock_check", arguments: {...}}]    │
│  - O respuesta directa si no necesita tool                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   EJECUTOR DE TOOLS                          │
│                                                              │
│  Si hay tool_calls:                                         │
│  1. Ejecutar la función correspondiente                     │
│  2. Leer/escribir en Google Sheets                          │
│  3. Retornar resultado al modelo                            │
│  4. El modelo genera respuesta final                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   RESPUESTA TELEGRAM                         │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Definición de Tools (Function Calling)

```typescript
const tools = [
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
      description: "Registrar entrada de mercadería al stock. Usar cuando el usuario dice que llegó/entró mercadería.",
      parameters: {
        type: "object",
        properties: {
          producto: {
            type: "string",
            description: "Nombre del producto"
          },
          cantidad: {
            type: "number",
            description: "Cantidad que entró"
          },
          presentacion: {
            type: "string",
            description: "Presentación del producto (ej: '2.25L', '1.5L', '500ml')"
          }
        },
        required: ["producto", "cantidad"]
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
            description: "Nombre o parte del nombre del cliente"
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
            description: "Nombre del cliente/negocio"
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
      description: "Registrar una venta/pedido",
      parameters: {
        type: "object",
        properties: {
          cliente: {
            type: "string",
            description: "Nombre del cliente"
          },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                producto: { type: "string" },
                cantidad: { type: "number" },
                presentacion: { type: "string" }
              }
            },
            description: "Lista de productos vendidos"
          },
          pagado: {
            type: "boolean",
            description: "Si pagó o va a cuenta corriente"
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
  }
];
```

### 5.3 System Prompt

```typescript
const systemPrompt = `Sos Nexo, el asistente de una distribuidora de bebidas en Argentina. 
Tu trabajo es ayudar al dueño a gestionar el stock, clientes, ventas y cobranzas.

REGLAS:
1. Hablás en español argentino, de forma directa y amigable
2. Usá las tools disponibles para ejecutar acciones
3. Si no estás seguro de algo, preguntá antes de actuar
4. Los montos son en pesos argentinos
5. Las cantidades de bebidas son en packs/cajones a menos que se indique otra cosa

PRODUCTOS COMUNES (para interpretar):
- "coca", "coca cola" → Coca Cola
- "sprite" → Sprite  
- "fanta" → Fanta
- "agua", "mineral" → Agua mineral
- "quilmes", "cerveza" → Cerveza Quilmes
- "seven", "7up" → 7UP

PRESENTACIONES:
- "2.25", "2 y cuarto", "grande" → 2.25L
- "1.5", "litro y medio" → 1.5L
- "500", "chica" → 500ml
- "lata" → Lata 354ml

Cuando registres una venta, siempre preguntá si pagó o va a cuenta corriente.
Cuando registres stock, confirmá la cantidad antes de guardar.`;
```

### 5.4 Ejemplo de Llamada a Workers AI

```typescript
// En el Worker
const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct-fp8", {
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Entraron 50 packs de coca 2.25" }
  ],
  tools: tools,
  max_tokens: 500
});

// El modelo responde con:
// {
//   tool_calls: [{
//     name: "stock_add",
//     arguments: {
//       producto: "Coca Cola",
//       cantidad: 50,
//       presentacion: "2.25L"
//     }
//   }]
// }
```

### 5.5 Manejo de Confirmaciones

Para acciones que modifican datos, el bot pide confirmación:

```
Usuario: "Entraron 50 coca 2.25"
Bot: "Voy a registrar entrada de 50 packs de Coca Cola 2.25L. ¿Confirmo?"

Usuario: "Si" / "Dale" / "Ok" / "Confirmo"
Bot: "✓ Registrado. Stock de Coca 2.25L: 95 packs (+50)"
```

El bot mantiene el contexto de la última acción pendiente para confirmar.

---

## 6. Configuración

### wrangler.toml (Configuración de Cloudflare Workers)

```toml
name = "nexo-bot"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Binding para Workers AI (según documentación oficial)
[ai]
binding = "AI"

# Variables de entorno (secretos se agregan con wrangler secret put)
[vars]
OWNER_TELEGRAM_ID = "123456789"
GOOGLE_SHEETS_ID = "tu-sheet-id"
```

### Secretos (agregar con `wrangler secret put`)

```bash
# Token del bot de Telegram
wrangler secret put TELEGRAM_BOT_TOKEN

# Credenciales de Google Sheets
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
wrangler secret put GOOGLE_PRIVATE_KEY
```

### Tipos de TypeScript para el Worker

```typescript
export interface Env {
  // Workers AI binding
  AI: Ai;
  
  // Variables de entorno
  TELEGRAM_BOT_TOKEN: string;
  OWNER_TELEGRAM_ID: string;
  GOOGLE_SHEETS_ID: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL: string;
  GOOGLE_PRIVATE_KEY: string;
}
```

---

## 7. Estructura del Proyecto

```
nexo-bot/
├── src/
│   ├── index.ts              # Entry point del Worker
│   ├── telegram/
│   │   ├── bot.ts            # Setup de grammY
│   │   ├── handlers.ts       # Handlers de mensajes
│   │   └── middleware.ts     # Auth, logging, etc.
│   ├── ai/
│   │   ├── agent.ts          # Lógica del agente con tools
│   │   ├── tools.ts          # Definición de tools
│   │   └── prompts.ts        # System prompts
│   ├── sheets/
│   │   ├── client.ts         # Cliente de Google Sheets
│   │   ├── stock.ts          # Operaciones de stock
│   │   ├── clients.ts        # Operaciones de clientes
│   │   ├── sales.ts          # Operaciones de ventas
│   │   └── payments.ts       # Operaciones de pagos
│   ├── types/
│   │   └── index.ts          # Tipos compartidos
│   └── utils/
│       └── formatters.ts     # Formateo de respuestas
├── wrangler.toml             # Config de Cloudflare Workers
├── package.json
├── tsconfig.json
└── README.md
```

---

## 8. Comandos Explícitos

Además del lenguaje natural, el bot responde a comandos:

| Comando | Descripción |
|---------|-------------|
| `/start` | Mensaje de bienvenida |
| `/help` | Lista de cosas que puede hacer |
| `/stock` | Resumen rápido de stock |
| `/deudas` | Lista de deudores |
| `/hoy` | Resumen del día (ventas, cobros) |
| `/cancelar` | Cancela la acción pendiente |

---

## 9. Manejo de Errores

### Mensaje no entendido
```
Bot: "No entendí bien. ¿Querés:
      • Consultar stock de algo
      • Cargar una venta
      • Ver quién te debe
      • Registrar un pago
      
      O decime con otras palabras qué necesitás."
```

### Error de conexión a Sheets
```
Bot: "Hubo un problema accediendo a los datos. 
      Intentá de nuevo en unos segundos. 
      Si sigue fallando, avisame."
```

### Cliente/Producto no encontrado
```
Bot: "No encontré ningún cliente que se llame 'Kiosco Ramírez'. 
      ¿Quisiste decir:
      • Kiosco Rodríguez
      • Kiosco Ramón
      
      O es un cliente nuevo?"
```

---

## 10. Seguridad

1. **Verificación de usuario**: Solo responde al `OWNER_TELEGRAM_ID`
2. **Rate limiting**: Máximo 30 mensajes por minuto
3. **Validación de datos**: Sanitizar inputs antes de escribir en Sheets
4. **Logs**: Registrar todas las acciones para auditoría

---

## 11. Plan de Desarrollo

### Fase 0: Setup Inicial (1 día)

**Pre-requisitos:**
- [ ] Crear cuenta en Cloudflare (gratis)
- [ ] Habilitar Workers AI en el dashboard
- [ ] Crear bot de Telegram con @BotFather (guardar token)
- [ ] Crear Google Sheet con la estructura de datos
- [ ] Crear Service Account en Google Cloud Console
- [ ] Compartir el Sheet con el Service Account

**Setup del proyecto:**
```bash
# Crear proyecto con C3 (create-cloudflare)
npm create cloudflare@latest nexo-bot

# Opciones:
# - Hello World example
# - Worker only  
# - TypeScript
# - Yes (git)
# - No (deploy después)

cd nexo-bot

# Instalar dependencias
npm install grammy google-spreadsheet

# Configurar wrangler.toml (agregar [ai] binding)
# Agregar secretos
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL  
wrangler secret put GOOGLE_PRIVATE_KEY
```

### Fase 1: Bot Básico + Stock (2-3 días)

- [ ] Setup grammY con webhook para Cloudflare Workers
- [ ] Middleware de autenticación (solo OWNER_TELEGRAM_ID)
- [ ] Integración básica con Workers AI
- [ ] Conexión con Google Sheets
- [ ] Tool: `stock_check` (consultar stock)
- [ ] Tool: `stock_add` (registrar entrada)
- [ ] Comando `/start` y `/help`

**Test:** "¿Cuánta coca tengo?" / "Entraron 50 sprite"

### Fase 2: Clientes y Ventas (2-3 días)

- [ ] Tool: `client_search` (buscar cliente)
- [ ] Tool: `client_add` (registrar cliente)
- [ ] Tool: `sale_register` (registrar venta)
- [ ] Tool: `sales_today` (ventas del día)
- [ ] Actualización automática de stock al vender
- [ ] Manejo de "cuenta corriente"

**Test:** "Vendí a López 10 coca y 5 sprite" / "¿Qué onda con el kiosco de Juan?"

### Fase 3: Deudas y Cobros (2 días)

- [ ] Tool: `debt_list` (lista de deudores)
- [ ] Tool: `debt_check` (deuda de un cliente)
- [ ] Tool: `payment_register` (registrar pago)
- [ ] Cálculo de deudas vencidas

**Test:** "¿Quién me debe?" / "López me pagó 50 lucas"

### Fase 4: Pulido y Testing (2-3 días)

- [ ] Mejorar system prompt según casos reales
- [ ] Agregar confirmaciones para acciones destructivas
- [ ] Manejo de errores robusto
- [ ] Testing con el cliente real
- [ ] Ajustes de UX según feedback

**Total estimado: 9-12 días**

---

## 12. Comandos de Desarrollo

```bash
# Desarrollo local (conecta a Workers AI en la nube)
npm run dev
# o
wrangler dev

# Deploy a producción
npm run deploy
# o
wrangler deploy

# Ver logs en tiempo real
wrangler tail

# Agregar/actualizar secretos
wrangler secret put NOMBRE_DEL_SECRETO

# Probar Workers AI en el playground
# https://playground.ai.cloudflare.com/?model=@cf/meta/llama-3.1-8b-instruct-fp8
```

---

## 13. Recursos Útiles

- [Workers AI Docs](https://developers.cloudflare.com/workers-ai/)
- [Llama 3.1 8B Fast Model](https://developers.cloudflare.com/workers-ai/models/@cf/meta/llama-3.1-8b-instruct-fp8/)
- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [grammY Docs](https://grammy.dev/)
- [grammY + Cloudflare Workers](https://grammy.dev/hosting/cloudflare-workers)
- [Google Sheets API](https://developers.google.com/sheets/api)

---

## 14. Sistema de Aprendizaje Adaptativo 🧠

### ¿Qué es?

El bot puede **aprender automáticamente** de las interacciones con el usuario y adaptarse a su lenguaje, términos personalizados y patrones de uso.

**Filosofía:** "La herramienta se adapta al usuario, no el usuario a la herramienta."

### Características Principales

#### 1. Detección Automática
El bot detecta silenciosamente:
- Términos no reconocidos que se usan repetidamente
- Correcciones del usuario ("no, me refería a...")
- Múltiples intentos para lograr algo (indicador de confusión)
- Patrones de uso frecuentes
- Errores en tools o búsquedas fallidas

#### 2. Aprendizaje Manual
El usuario puede enseñar directamente:
```
Usuario: "Recordá que 'las de siempre' son remeras negras XL"
Bot: ✓ Aprendido! Ya sé que cuando decís "las de siempre" te referís a: remeras negras XL
```

#### 3. Prompt Dinámico
El system prompt se construye dinámicamente inyectando preferencias aprendidas:
```
System Prompt Base
+
Preferencias Aprendidas (de Google Sheets)
=
Prompt Personalizado para este Usuario
```

### Tipos de Preferencias

1. **producto_alias**: Términos personalizados para productos
   - "las básicas" → Remera blanca M
   - "las de siempre" → Conjunto específico

2. **cliente_alias**: Formas informales de referirse a clientes
   - "el kiosco de juan" → Cliente específico
   - "el de la esquina" → Cliente conocido

3. **abreviacion**: Shortcuts personalizados
   - "rne" → Remera negra XL
   - "jnm" → Jean negro M

4. **patron_venta**: Ventas recurrentes
   - "lo de siempre para López" → Pedido habitual

5. **contexto**: Información específica del negocio
   - "temporada alta" → Definición personal
   - "zona norte" → Áreas de entrega

### Nuevas Tools

```typescript
{
  name: "learn_preference",
  description: "Aprender una nueva preferencia del usuario",
  parameters: {
    tipo: "producto_alias | cliente_alias | abreviacion | patron_venta | contexto",
    terminoUsuario: "string",
    mapeo: "string",
    contextoAdicional: "string (opcional)"
  }
}

{
  name: "learning_stats",
  description: "Ver estadísticas del sistema de aprendizaje"
}
```

### Flujo de Aprendizaje

```
1. Usuario envía mensaje
   ↓
2. Sistema carga preferencias aprobadas de Google Sheets
   ↓
3. Construye prompt dinámico con preferencias
   ↓
4. LLM procesa con contexto personalizado
   ↓
5. Ejecuta tool correspondiente
   ↓
6. Detecta automáticamente situaciones de aprendizaje
   ↓
7. Guarda observaciones en Google Sheets (silencioso)
   ↓
8. Responde al usuario
```

### Ejemplo de Uso

```
[Primera interacción]
Usuario: "Entraron las de siempre"
Bot: "¿A qué productos te referís?"
Usuario: "Las remeras negras XL, las que siempre pido"
Bot: [Detecta patrón, guarda observación]

[Segunda interacción]
Usuario: "Entraron las de siempre"
Bot: "¿Querés que recuerde que 'las de siempre' son remeras negras XL?"
Usuario: "Sí"
Bot: ✓ Listo! [Guarda preferencia aprobada]

[Tercera interacción en adelante]
Usuario: "Entraron las de siempre"
Bot: [Prompt dinámico ya incluye esta preferencia]
Bot: "Perfecto, registrando 50 remeras negras XL. ¿Cuántas entraron?"
```

### Implementación

**Archivos nuevos:**
- `src/sheets/learning.ts` - Funciones para Observaciones y Preferencias
- `src/ai/dynamic-prompt.ts` - Construcción de prompt adaptativo

**Archivos modificados:**
- `src/ai/agent.ts` - Integración del sistema de aprendizaje
- `src/ai/tools.ts` - Nuevas tools de aprendizaje

**Documentación completa:** Ver `LEARNING_SYSTEM.md`

---

## 15. Próximos Pasos Inmediatos

1. **Vos:**
   - Crear cuenta en Cloudflare → https://dash.cloudflare.com/sign-up
   - Crear bot en Telegram con @BotFather
   - Crear el Google Sheet con las 7 hojas (incluir Observaciones y Preferencias)

2. **Yo:**
   - Te preparo el boilerplate inicial del proyecto
   - Configuración de wrangler.toml
   - Setup básico de grammY + Workers AI

---

*Documento de especificaciones Nexo Bot v1.2*
*Stack: Cloudflare Workers + grammY + Google Sheets + Llama 3.1 8B Fast*
*Última actualización: Enero 2025*
*Nuevo: Sistema de Aprendizaje Adaptativo*
