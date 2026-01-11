# Nexo Bot 🤖

Bot de Telegram para gestión de tienda de ropa con IA.

## Stack Tecnológico

- **Bot Framework:** grammY
- **Runtime:** Cloudflare Workers
- **LLM:** Workers AI (Llama 3.1 8B Instruct Fast)
- **Storage:** Google Sheets API
- **Lenguaje:** TypeScript

## Pre-requisitos

Antes de comenzar, necesitás:

### 1. Cuenta de Cloudflare Workers

- Crear cuenta en [Cloudflare Dashboard](https://dash.cloudflare.com/sign-up)
- Habilitar Workers AI en el dashboard

### 2. Bot de Telegram

```bash
# Hablar con @BotFather en Telegram
/newbot
# Seguir las instrucciones y guardar el token
```

### 3. Google Sheets

1. Crear un nuevo Google Sheet
2. Crear estas 5 hojas con los siguientes encabezados:

**Hoja "Productos":**
```
ID | SKU | Nombre | Categoria | Color | Talle | Descripcion | Temporada | Proveedor | Foto URL | Stock | Stock Mínimo | Precio
```

Notas sobre los campos:
- **SKU**: Código único del producto (opcional, útil para búsquedas rápidas)
- **Categoria**: Tipo de prenda (Remera, Jean, Camisa, Buzo, Campera, Short, Vestido)
- **Temporada**: Verano, Invierno, o "Todo el año" (opcional)
- **Proveedor**: Nombre del proveedor (opcional)
- **Foto URL**: URL de la imagen del producto (opcional)

**Hoja "Clientes":**
```
ID | Nombre | Teléfono | Dirección | Notas | Fecha Alta
```

**Hoja "Pedidos":**
```
ID | Fecha | Cliente ID | Cliente Nombre | Items (JSON) | Total | Estado | Pagado
```

**Hoja "Pagos":**
```
ID | Fecha | Cliente ID | Cliente Nombre | Monto | Método | Pedido ID | Notas
```

**Hoja "Movimientos Stock":**
```
ID | Fecha | Producto ID | Producto Nombre | Cantidad | Tipo | Referencia | Notas
```

3. Crear Service Account en [Google Cloud Console](https://console.cloud.google.com/):
   - Ir a "IAM & Admin" > "Service Accounts"
   - Crear nueva Service Account
   - Crear clave JSON
   - Copiar el email y la private key

4. Compartir el Google Sheet con el email del Service Account (con permisos de editor)

## Instalación

### 1. Clonar e instalar dependencias

```bash
cd nexo-bot
npm install
```

### 2. Configurar variables de entorno

Editar `wrangler.toml`:

```toml
[vars]
OWNER_TELEGRAM_ID = "TU_TELEGRAM_USER_ID"  # Tu ID de usuario de Telegram
GOOGLE_SHEETS_ID = "TU_GOOGLE_SHEET_ID"    # ID del Google Sheet (está en la URL)
```

Para obtener tu Telegram User ID, podés usar [@userinfobot](https://t.me/userinfobot).

### 3. Configurar secretos

```bash
# Token del bot de Telegram
wrangler secret put TELEGRAM_BOT_TOKEN
# Pegar el token cuando lo pida

# Email del Service Account de Google
wrangler secret put GOOGLE_SERVICE_ACCOUNT_EMAIL
# Pegar el email

# Private key del Service Account
wrangler secret put GOOGLE_PRIVATE_KEY
# Pegar la private key completa (con los \n)
```

## Desarrollo Local

```bash
npm run dev
```

Esto inicia el Worker en modo desarrollo. Conecta a Workers AI en la nube pero corre localmente.

## Deploy

### 1. Deploy del Worker

```bash
npm run deploy
```

### 2. Configurar webhook de Telegram

Después del deploy, visitá:

```
https://nexo-bot.TU_USUARIO.workers.dev/setup-webhook
```

Deberías ver:

```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### 3. Probar el bot

Abrí Telegram y hablá con tu bot. Probá:

```
/start
```

## Uso

### Comandos disponibles

- `/start` - Mensaje de bienvenida
- `/help` - Guía de uso
- `/stock` - Ver resumen de stock
- `/deudas` - Lista de deudores
- `/hoy` - Resumen del día
- `/cancelar` - Cancelar acción pendiente

### Ejemplos de lenguaje natural

**Stock:**
```
¿Cuántas remeras negras tengo?
Entraron 20 remeras negras talle M
¿Cómo estamos de stock?
```

**Clientes:**
```
Agregá un cliente: María González, tel 3815551234
¿Qué onda con María?
```

**Ventas:**
```
Vendí a María: 2 remeras negras M y 1 jean azul 40
¿Qué vendí hoy?
```

**Cobros:**
```
¿Quién me debe?
Juan me pagó 30 mil pesos
¿Cuánto debe Juan?
```

## Estructura del Proyecto

```
nexo-bot/
├── src/
│   ├── types/
│   │   └── index.ts          # Tipos compartidos
│   ├── utils/
│   │   └── formatters.ts     # Formateadores de respuestas
│   ├── ai/
│   │   ├── prompts.ts        # System prompts
│   │   ├── tools.ts          # Definición de tools
│   │   └── agent.ts          # Lógica del agente con AI
│   ├── sheets/
│   │   ├── client.ts         # Cliente de Google Sheets
│   │   ├── stock.ts          # Operaciones de stock
│   │   ├── clients.ts        # Operaciones de clientes
│   │   ├── sales.ts          # Operaciones de ventas
│   │   └── payments.ts       # Operaciones de pagos
│   ├── telegram/
│   │   ├── middleware.ts     # Middleware (auth, logging)
│   │   ├── handlers.ts       # Handlers de mensajes
│   │   └── bot.ts            # Setup de grammY
│   └── index.ts              # Entry point del Worker
├── wrangler.toml             # Config de Cloudflare Workers
├── package.json
├── tsconfig.json
└── README.md
```

## Debugging

### Ver logs en tiempo real

```bash
npm run tail
```

### Health check

```
https://nexo-bot.TU_USUARIO.workers.dev/health
```

### Ver info del Worker

```
https://nexo-bot.TU_USUARIO.workers.dev/
```

## Costos Estimados

### Workers AI (Free Tier)

- 10,000 Neurons/día gratis
- Para ~50 interacciones/día: **$0/mes** ✨

### Cloudflare Workers

- 100,000 requests/día gratis
- Para uso normal: **$0/mes** ✨

### Google Sheets API

- Gratis para uso personal

**Total: $0/mes** 🎉

## Troubleshooting

### Error: "No se pudo conectar a Google Sheets"

- Verificá que el Service Account tenga acceso al Sheet
- Verificá que la GOOGLE_PRIVATE_KEY esté correctamente configurada (con los `\n`)

### El bot no responde

- Verificá que el webhook esté configurado: visitá `/setup-webhook`
- Verificá los logs con `npm run tail`
- Verificá que tu OWNER_TELEGRAM_ID sea correcto

### Error: "Usuario no autorizado"

- Verificá que el OWNER_TELEGRAM_ID en `wrangler.toml` sea tu ID real de Telegram
- Usá [@userinfobot](https://t.me/userinfobot) para obtener tu ID

## Roadmap

- [ ] Transcripción de mensajes de voz con Whisper
- [ ] Reportes automáticos (diarios/semanales)
- [ ] Notificaciones de stock bajo
- [ ] Recordatorios de cobros
- [ ] Estadísticas avanzadas
- [ ] Backup automático de datos

## Licencia

MIT

---

**Desarrollado con ❤️ usando Cloudflare Workers AI**
