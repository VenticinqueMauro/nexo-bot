/**
 * Funciones auxiliares para interactuar con el Durable Object ConversationState
 */

import { Env } from '../types';

/**
 * Obtiene la instancia del Durable Object para un usuario
 */
function getConversationStateStub(env: Env, userId: number): DurableObjectStub {
  // Usar el userId como identificador único
  const id = env.CONVERSATION_STATE.idFromName(userId.toString());
  return env.CONVERSATION_STATE.get(id);
}

/**
 * Obtiene el historial de conversación de un usuario
 */
export async function getConversationHistory(
  env: Env,
  userId: number
): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
  try {
    const stub = getConversationStateStub(env, userId);
    const response = await stub.fetch('http://do/get-history');

    if (!response.ok) {
      console.error('Error getting history:', await response.text());
      return [];
    }

    const data = await response.json() as { history: Array<{ role: 'user' | 'assistant' | 'system'; content: string; timestamp: number }> };

    // Convertir a formato esperado (sin timestamp)
    return data.history.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  } catch (error) {
    console.error('Error in getConversationHistory:', error);
    return [];
  }
}

/**
 * Agrega un mensaje al historial de conversación
 */
export async function addMessageToHistory(
  env: Env,
  userId: number,
  role: 'user' | 'assistant' | 'system',
  content: string
): Promise<boolean> {
  try {
    const stub = getConversationStateStub(env, userId);
    const response = await stub.fetch('http://do/add-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role, content })
    });

    if (!response.ok) {
      console.error('Error adding message:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in addMessageToHistory:', error);
    return false;
  }
}

/**
 * Limpia el historial de conversación de un usuario
 */
export async function clearConversationHistory(
  env: Env,
  userId: number
): Promise<boolean> {
  try {
    const stub = getConversationStateStub(env, userId);
    const response = await stub.fetch('http://do/clear-history');

    if (!response.ok) {
      console.error('Error clearing history:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in clearConversationHistory:', error);
    return false;
  }
}

/**
 * Guarda una foto pendiente de asociación
 */
export async function setPendingPhoto(
  env: Env,
  userId: number,
  fileId: string
): Promise<boolean> {
  try {
    const stub = getConversationStateStub(env, userId);
    const response = await stub.fetch('http://do/set-pending-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, fileId })
    });

    if (!response.ok) {
      console.error('Error setting pending photo:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in setPendingPhoto:', error);
    return false;
  }
}

/**
 * Obtiene la foto pendiente de asociación (si existe)
 */
export async function getPendingPhoto(
  env: Env,
  userId: number
): Promise<string | null> {
  try {
    const stub = getConversationStateStub(env, userId);
    const response = await stub.fetch('http://do/get-pending-photo');

    if (!response.ok) {
      console.error('Error getting pending photo:', await response.text());
      return null;
    }

    const data = await response.json() as { pendingPhoto: string | null };
    return data.pendingPhoto;
  } catch (error) {
    console.error('Error in getPendingPhoto:', error);
    return null;
  }
}

/**
 * Limpia la foto pendiente de asociación
 */
export async function clearPendingPhoto(
  env: Env,
  userId: number
): Promise<boolean> {
  try {
    const stub = getConversationStateStub(env, userId);
    const response = await stub.fetch('http://do/clear-pending-photo');

    if (!response.ok) {
      console.error('Error clearing pending photo:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error in clearPendingPhoto:', error);
    return false;
  }
}

/**
 * Obtiene el estado completo de la conversación (para debugging)
 */
export async function getFullConversationState(
  env: Env,
  userId: number
): Promise<any> {
  try {
    const stub = getConversationStateStub(env, userId);
    const response = await stub.fetch('http://do/get-full-state');

    if (!response.ok) {
      console.error('Error getting full state:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error in getFullConversationState:', error);
    return null;
  }
}
