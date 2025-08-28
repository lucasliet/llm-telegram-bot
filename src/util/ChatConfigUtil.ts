import { Content } from 'npm:@google/generative-ai';
import OpenAi from 'npm:openai';
import { ExpirableContent } from '@/repository/ChatRepository.ts';

/**
 * Interface for StreamReplyResponse
 */
export interface StreamReplyResponse {
	/** Reader for the streaming response */
	reader: ReadableStreamDefaultReader<Uint8Array>;

	/** Callback function to execute when the response is complete */
	onComplete: (completedAnswer: string) => Promise<void>;

	/** Optional function to map response body to a different format */
	responseMap?: (responseBody: string) => string;
}

/**
 * Message format for Responses API
 */
export type ResponsesMessage = {
  type: 'message';
  role: 'user' | 'assistant';
  content: Array<{ type: 'input_text' | 'output_text' | 'text'; text: string }>;
};

/**
 * Convert Gemini history format to OpenAI/GPT format
 *
 * @param history - History in Gemini format
 * @returns History in OpenAI format
 */
export function convertGeminiHistoryToGPT(
    history: ExpirableContent[],
): OpenAi.ChatCompletionMessageParam[] {
    return history.map((content) => {
        return {
            role: content.role === 'user' ? 'user' : 'assistant',
            content: content.parts.map((part) => part.text).join(' '),
        };
    });
}

/**
 * Convert Gemini history to Responses API message format
 * @param history - History in Gemini format
 * @returns History in Responses API message format
 */
export function convertGeminiHistoryToResponses(
  history: ExpirableContent[],
): ResponsesMessage[] {
  return history.map((content) => {
    const role = content.role === 'user' ? 'user' : 'assistant';
    const text = content.parts.map((p) => p.text).join(' ');
    const type = role === 'user' ? 'input_text' : 'output_text';
    return { type: 'message', role, content: [{ type, text }] };
  });
}

/**
 * Convert GPT messages to Responses API message format
 * @param messages - GPT messages
 * @returns Responses API messages
 */
export function convertGPTToResponses(
  messages: OpenAi.Chat.ChatCompletionMessageParam[],
): ResponsesMessage[] {
  return messages
    .map((m) => {
      const role = m.role === 'user' ? 'user' : 'assistant';
      const text = typeof m.content === 'string'
        ? m.content
        : Array.isArray(m.content)
          ? m.content.map((c) => (c as any).text || '').join('')
          : '';
      const type = role === 'user' ? 'input_text' : 'output_text';
      return { type: 'message', role, content: [{ type, text }] } as ResponsesMessage;
    });
}

/**
 * Remove expiration-related properties from history objects
 *
 * @param history - History with expiration information
 * @returns History without expiration information
 */
export function removeExpirationFromHistory(
    history: ExpirableContent[],
): Content[] {
    return history.map(({ createdAt: _, ...content }) => content);
}

/**
 * Replace configuration variables in a Gemini prompt template
 *
 * @param chatName - Name of the chat service
 * @param model - Model name
 * @param maxTokens - Maximum tokens for generation
 * @returns Modified prompt with updated values
 */
export function getSystemPrompt(
    chatName: string,
    model: string,
    maxTokens: number,
): string {
    return systemPrompt(chatName, model, maxTokens);
}

/**
 * Builds an assistant message for Responses API
 * @param text - Assistant text content
 * @returns Responses API assistant message
 */
export function buildAssistantMessage(text: string): ResponsesMessage {
  return { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] };
}

const systemPrompt = (chatName: string, model: string, maxTokens: number) =>
    `
        Você é ${chatName}, um modelo de linguagem de IA muito prestativo. Está usando o modelo ${model} 
        e está hospedado em um bot do cliente de mensagens Telegram.
        Então tentará manter suas respostas curtas e diretas para obter melhores resultados 
        com o máximo de ${maxTokens} tokens de saída,
        Pode usar à vontade as estilizações de texto e emojis para tornar a conversa mais agradável e natural.

        Deve sempre respeitar a linguagem de marcação Markdown, evitando abrir marcações sem fecha-las.

        Caso tenha buscado informações atualizadas na internet, indique suas fontes de informação.
    `;
