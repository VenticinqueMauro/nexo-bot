import { Env } from '../types';
import { systemPrompt } from './prompts';
import { getApprovedPreferences, UserPreference } from '../sheets/learning';

/**
 * Construye el system prompt dinámico con preferencias aprendidas
 */
export async function buildDynamicPrompt(env: Env): Promise<string> {
  try {
    const preferences = await getApprovedPreferences(env);

    if (preferences.length === 0) {
      return systemPrompt;
    }

    // Agrupar preferencias por tipo
    const productoAliases = preferences.filter(p => p.tipo === 'producto_alias');
    const clienteAliases = preferences.filter(p => p.tipo === 'cliente_alias');
    const abreviaciones = preferences.filter(p => p.tipo === 'abreviacion');
    const patronesVenta = preferences.filter(p => p.tipo === 'patron_venta');
    const contextos = preferences.filter(p => p.tipo === 'contexto');

    let dynamicSection = '\n\n🧠 PREFERENCIAS APRENDIDAS (adaptado a este usuario):\n';

    if (productoAliases.length > 0) {
      dynamicSection += '\nPRODUCTOS PERSONALIZADOS:\n';
      productoAliases.forEach(p => {
        dynamicSection += `- "${p.terminoUsuario}" → ${p.mapeo}`;
        if (p.contextoAdicional) {
          dynamicSection += ` (${p.contextoAdicional})`;
        }
        dynamicSection += '\n';
      });
    }

    if (clienteAliases.length > 0) {
      dynamicSection += '\nCLIENTES PERSONALIZADOS:\n';
      clienteAliases.forEach(p => {
        dynamicSection += `- "${p.terminoUsuario}" → ${p.mapeo}\n`;
      });
    }

    if (abreviaciones.length > 0) {
      dynamicSection += '\nABREVIACIONES DEL USUARIO:\n';
      abreviaciones.forEach(p => {
        dynamicSection += `- "${p.terminoUsuario}" significa: ${p.mapeo}\n`;
      });
    }

    if (patronesVenta.length > 0) {
      dynamicSection += '\nPATRONES DE VENTA FRECUENTES:\n';
      patronesVenta.forEach(p => {
        dynamicSection += `- "${p.terminoUsuario}": ${p.mapeo}\n`;
      });
    }

    if (contextos.length > 0) {
      dynamicSection += '\nCONTEXTO ESPECÍFICO DEL NEGOCIO:\n';
      contextos.forEach(p => {
        dynamicSection += `- ${p.terminoUsuario}: ${p.mapeo}\n`;
      });
    }

    dynamicSection += '\nIMPORTANTE: Estas preferencias tienen PRIORIDAD sobre las reglas generales. Cuando el usuario use estos términos, SIEMPRE aplicá el mapeo aprendido.\n';

    return systemPrompt + dynamicSection;
  } catch (error) {
    console.error('Error construyendo prompt dinámico:', error);
    // Si hay error, usar el prompt estático
    return systemPrompt;
  }
}

/**
 * Genera sugerencias de aprendizaje basadas en el contexto
 */
export function generateLearningSuggestion(
  userMessage: string,
  matchedPreferences: UserPreference[]
): string | null {
  // Si hay preferencias que coinciden parcialmente, sugerir usarlas
  const partialMatches = matchedPreferences.filter(p =>
    userMessage.toLowerCase().includes(p.terminoUsuario.toLowerCase().split(' ')[0])
  );

  if (partialMatches.length > 0) {
    return `💡 Sugerencia: ¿Te referís a "${partialMatches[0].terminoUsuario}"?`;
  }

  return null;
}

/**
 * Extrae contexto útil del mensaje para futuro aprendizaje
 */
export function extractLearningContext(
  userMessage: string,
  toolName?: string,
  toolArgs?: any,
  toolResult?: string
): string {
  const context = {
    mensaje: userMessage,
    tool: toolName,
    args: toolArgs,
    resultado: toolResult?.substring(0, 100), // Primeros 100 chars
    timestamp: new Date().toISOString(),
  };

  return JSON.stringify(context);
}
