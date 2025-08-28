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
 * Maps an array of OpenAI ChatCompletionTool objects to an array of OpenAI.Responses.Tool objects.
 * This function is used to adapt tool schemas for the Responses API.
 * @param tools - An optional array of OpenAI ChatCompletionTool objects.
 * @returns An array of OpenAI.Responses.Tool objects.
 */
export function mapChatToolsToResponsesTools(
	tools?: OpenAi.Chat.Completions.ChatCompletionTool[],
): OpenAi.Responses.Tool[] {
	if (!tools || tools.length === 0) {
		return [];
	}

	return tools.map((t): OpenAi.Responses.Tool => {
		if (t.type === 'function' && t.function) {
			const params = t.function.parameters || {};
			const props = params.properties || {};
			const required = Object.keys(props);
			return {
				type: 'function',
				name: t.function.name,
				description: t.function.description ?? '',
				parameters: {
					type: 'object',
					additionalProperties: false,
					...params,
					properties: props,
					required,
				},
				strict: (t as any).strict ?? true,
			} as OpenAi.Responses.Tool;
		}
		throw new Error('Unsupported tool type');
	});
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

const systemPrompt = (chatName: string, model: string, maxTokens: number) => `
        Você é ${chatName}, um modelo de linguagem de IA muito prestativo. Está usando o modelo ${model} 
        e está hospedado em um bot do cliente de mensagens Telegram.
        Então tentará manter suas respostas curtas e diretas para obter melhores resultados 
        com o máximo de ${maxTokens} tokens de saída,
        Pode usar à vontade as estilizações de texto e emojis para tornar a conversa mais agradável e natural.

        Deve sempre respeitar a linguagem de marcação Markdown, evitando abrir marcações sem fecha-las.

        Caso tenha buscado informações atualizadas na internet, indique suas fontes de informação.
    `;
