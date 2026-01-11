/**
 * Durable Object para almacenar el estado de conversación de forma persistente
 *
 * Cada usuario tiene su propia instancia del Durable Object
 * que persiste su historial de conversación y estado entre requests
 */

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface PendingPhoto {
  fileId: string;
  timestamp: number;
}

export interface ConversationStateData {
  userId: number;
  history: ConversationMessage[];
  pendingPhoto?: PendingPhoto;
  lastActivity: number;
}

export class ConversationState {
  private state: DurableObjectState;
  private data: ConversationStateData | null = null;

  // Límites de configuración
  private readonly MAX_HISTORY_LENGTH = 10;
  private readonly PHOTO_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos
  private readonly HISTORY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  /**
   * Inicializa el estado desde el almacenamiento persistente
   */
  private async ensureInitialized(): Promise<void> {
    if (this.data === null) {
      const stored = await this.state.storage.get<ConversationStateData>('conversation');

      if (stored) {
        this.data = stored;
        // Limpiar foto pendiente si expiró
        if (this.data.pendingPhoto) {
          const photoAge = Date.now() - this.data.pendingPhoto.timestamp;
          if (photoAge > this.PHOTO_TIMEOUT_MS) {
            this.data.pendingPhoto = undefined;
            await this.persist();
          }
        }
      } else {
        // Estado inicial
        this.data = {
          userId: 0, // Se seteará en la primera operación
          history: [],
          lastActivity: Date.now()
        };
      }
    }
  }

  /**
   * Persiste el estado actual al almacenamiento
   */
  private async persist(): Promise<void> {
    if (this.data) {
      this.data.lastActivity = Date.now();
      await this.state.storage.put('conversation', this.data);
    }
  }

  /**
   * Handler principal del Durable Object
   */
  async fetch(request: Request): Promise<Response> {
    await this.ensureInitialized();

    try {
      const url = new URL(request.url);
      const action = url.pathname.slice(1); // Remove leading '/'

      switch (action) {
        case 'get-history':
          return this.getHistory();

        case 'add-message':
          return this.addMessage(request);

        case 'clear-history':
          return this.clearHistory();

        case 'set-pending-photo':
          return this.setPendingPhoto(request);

        case 'get-pending-photo':
          return this.getPendingPhoto();

        case 'clear-pending-photo':
          return this.clearPendingPhoto();

        case 'get-full-state':
          return this.getFullState();

        default:
          return new Response('Not Found', { status: 404 });
      }
    } catch (error: any) {
      console.error('Error in ConversationState:', error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Obtiene el historial de conversación
   */
  private async getHistory(): Promise<Response> {
    await this.ensureInitialized();

    // Verificar si el historial expiró
    const inactivityTime = Date.now() - (this.data?.lastActivity || 0);
    if (inactivityTime > this.HISTORY_TIMEOUT_MS && this.data) {
      this.data.history = [];
      await this.persist();
    }

    return new Response(JSON.stringify({
      history: this.data?.history || []
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Agrega un mensaje al historial
   */
  private async addMessage(request: Request): Promise<Response> {
    await this.ensureInitialized();

    const body = await request.json() as {
      userId: number;
      role: 'user' | 'assistant' | 'system';
      content: string;
    };

    if (!this.data) {
      return new Response(JSON.stringify({ error: 'State not initialized' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Setear userId si es la primera vez
    if (this.data.userId === 0) {
      this.data.userId = body.userId;
    }

    // Agregar mensaje
    this.data.history.push({
      role: body.role,
      content: body.content,
      timestamp: Date.now()
    });

    // Limitar historial a MAX_HISTORY_LENGTH mensajes
    if (this.data.history.length > this.MAX_HISTORY_LENGTH) {
      this.data.history = this.data.history.slice(-this.MAX_HISTORY_LENGTH);
    }

    await this.persist();

    return new Response(JSON.stringify({
      success: true,
      historyLength: this.data.history.length
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Limpia el historial de conversación
   */
  private async clearHistory(): Promise<Response> {
    await this.ensureInitialized();

    if (this.data) {
      this.data.history = [];
      await this.persist();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Guarda una foto pendiente de asociación
   */
  private async setPendingPhoto(request: Request): Promise<Response> {
    await this.ensureInitialized();

    const body = await request.json() as {
      userId: number;
      fileId: string;
    };

    if (!this.data) {
      return new Response(JSON.stringify({ error: 'State not initialized' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Setear userId si es la primera vez
    if (this.data.userId === 0) {
      this.data.userId = body.userId;
    }

    this.data.pendingPhoto = {
      fileId: body.fileId,
      timestamp: Date.now()
    };

    await this.persist();

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Obtiene la foto pendiente (si existe y no expiró)
   */
  private async getPendingPhoto(): Promise<Response> {
    await this.ensureInitialized();

    if (!this.data?.pendingPhoto) {
      return new Response(JSON.stringify({ pendingPhoto: null }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar si expiró
    const photoAge = Date.now() - this.data.pendingPhoto.timestamp;
    if (photoAge > this.PHOTO_TIMEOUT_MS) {
      this.data.pendingPhoto = undefined;
      await this.persist();

      return new Response(JSON.stringify({ pendingPhoto: null }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      pendingPhoto: this.data.pendingPhoto.fileId
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Limpia la foto pendiente
   */
  private async clearPendingPhoto(): Promise<Response> {
    await this.ensureInitialized();

    if (this.data) {
      this.data.pendingPhoto = undefined;
      await this.persist();
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Obtiene el estado completo (para debugging)
   */
  private async getFullState(): Promise<Response> {
    await this.ensureInitialized();

    return new Response(JSON.stringify(this.data), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
