import { Env } from '../types';

/**
 * Descarga un archivo de audio desde los servidores de Telegram
 */
async function downloadTelegramFile(fileId: string, token: string): Promise<ArrayBuffer> {
  // 1. Obtener la ruta del archivo
  const fileInfoResponse = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  );

  if (!fileInfoResponse.ok) {
    throw new Error('Error obteniendo información del archivo de Telegram');
  }

  const fileInfo: any = await fileInfoResponse.json();
  const filePath = fileInfo.result?.file_path;

  if (!filePath) {
    throw new Error('No se pudo obtener la ruta del archivo');
  }

  // 2. Descargar el archivo
  const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const fileResponse = await fetch(fileUrl);

  if (!fileResponse.ok) {
    throw new Error('Error descargando el archivo de audio');
  }

  return await fileResponse.arrayBuffer();
}

/**
 * Convierte ArrayBuffer a Base64
 * Workers AI Whisper requiere el audio como cadena Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Transcribe audio usando Whisper en Workers AI
 */
export async function transcribeAudio(
  env: Env,
  fileId: string
): Promise<string> {
  try {
    console.log(`🎤 Iniciando transcripción de audio: ${fileId}`);

    // 1. Descargar el archivo de audio desde Telegram
    const audioBuffer = await downloadTelegramFile(fileId, env.TELEGRAM_BOT_TOKEN);
    console.log(`✓ Audio descargado: ${audioBuffer.byteLength} bytes`);

    // 2. Convertir el audio a Base64 (requerido por Workers AI Whisper)
    const audioBase64 = arrayBufferToBase64(audioBuffer);
    console.log(`✓ Audio convertido a Base64: ${audioBase64.length} caracteres`);

    // 3. Llamar a Whisper en Workers AI
    // Usando whisper-large-v3-turbo para mejor velocidad y precisión
    // También soporta español y otros idiomas automáticamente
    const response: any = await env.AI.run(
      '@cf/openai/whisper-large-v3-turbo',
      {
        audio: audioBase64, // Base64 string como requiere Workers AI
      }
    );

    console.log('Whisper response:', JSON.stringify(response).substring(0, 200));

    // 4. Extraer el texto transcrito
    let transcription = '';

    // El formato de respuesta puede variar, intentar diferentes formatos
    if (typeof response === 'object' && response !== null) {
      // Formato 1: { text: "..." }
      if ('text' in response && typeof response.text === 'string') {
        transcription = response.text;
      }
      // Formato 2: { vtt: "WEBVTT\n..." } (formato de subtítulos)
      else if ('vtt' in response && typeof response.vtt === 'string') {
        // Extraer texto del formato VTT
        const vttText = response.vtt as string;
        const lines = vttText.split('\n').filter(line => {
          // Filtrar líneas que no sean headers, timestamps o vacías
          return line.trim() &&
                 !line.startsWith('WEBVTT') &&
                 !line.match(/^\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}$/);
        });
        transcription = lines.join(' ').trim();
      }
      // Formato 3: Array de words/segments
      else if ('words' in response && Array.isArray(response.words)) {
        transcription = response.words.map((w: any) => w.word || w.text || '').join(' ');
      }
    } else if (typeof response === 'string') {
      // Si la respuesta es directamente un string
      transcription = response;
    }

    if (!transcription || transcription.trim().length === 0) {
      console.error('No se pudo extraer transcripción de la respuesta:', response);
      throw new Error('No se pudo transcribir el audio. Respuesta vacía del modelo.');
    }

    console.log(`✅ Transcripción exitosa: "${transcription.substring(0, 50)}..."`);

    return transcription.trim();

  } catch (error: any) {
    console.error('Error transcribiendo audio:', error);
    console.error('Error stack:', error.stack);
    throw new Error(`Error en transcripción: ${error.message}`);
  }
}

/**
 * Genera audio desde texto usando Text-to-Speech (opcional)
 * Usa Deepgram Aura-2 que soporta español
 */
export async function textToSpeech(
  env: Env,
  text: string,
  language: 'en' | 'es' = 'es'
): Promise<ArrayBuffer> {
  try {
    console.log(`🔊 Generando audio: "${text.substring(0, 50)}..."`);

    // Usar el modelo apropiado según el idioma
    const modelId = language === 'es'
      ? '@cf/deepgram/aura-2-es'
      : '@cf/deepgram/aura-2-en';

    const response: any = await env.AI.run(modelId, {
      text: text,
      // Opciones adicionales si están disponibles
      // voice: 'default', // Puedes especificar diferentes voces si el modelo lo soporta
    });

    // La respuesta debería ser un ArrayBuffer con el audio
    if (response instanceof ArrayBuffer) {
      return response;
    } else if (response && typeof response === 'object' && 'audio' in response) {
      return response.audio as ArrayBuffer;
    } else {
      throw new Error('Formato de respuesta de TTS no esperado');
    }

  } catch (error: any) {
    console.error('Error generando audio:', error);
    throw new Error(`Error en TTS: ${error.message}`);
  }
}
