// Tipos del Worker
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

// Tipos de Google Sheets
export interface Product {
  id: string;
  sku?: string;
  nombre: string;
  categoria: string;
  color: string;
  talle: string;
  descripcion?: string;
  temporada?: string;
  proveedor?: string;
  fotoUrl?: string;
  stock: number;
  stockMinimo: number;
  precio: number;
}

export interface Client {
  id: string;
  nombre: string;
  telefono: string;
  direccion?: string;
  notas?: string;
  fechaAlta: string;
}

export interface OrderItem {
  producto: string;
  cantidad: number;
  color?: string;
  talle?: string;
}

export interface Order {
  id: string;
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  items: OrderItem[];
  total: number;
  estado: string;
  pagado: boolean;
}

export interface Payment {
  id: string;
  fecha: string;
  clienteId: string;
  clienteNombre: string;
  monto: number;
  metodo: string;
  pedidoId?: string;
  notas?: string;
}

export interface StockMovement {
  id: string;
  fecha: string;
  productoId: string;
  productoNombre: string;
  cantidad: number;
  tipo: 'entrada' | 'venta';
  referencia?: string;
  notas?: string;
}

// Tipos de AI
export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
}

export interface ConversationContext {
  pendingAction?: {
    type: string;
    data: any;
  };
  lastMessages: AIMessage[];
}
