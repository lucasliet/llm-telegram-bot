import { Content } from 'npm:@google/generative-ai';
import OpenAi from 'npm:openai';
import GeminiService from '../service/GeminiService.ts';
import { ExpirableContent } from '../repository/ChatRepository.ts';

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
 * Convert Gemini history format to OpenAI/GPT format
 *
 * @param history - History in Gemini format
 * @returns History in OpenAI format
 */
export function convertGeminiHistoryToGPT(
	history: ExpirableContent[],
): OpenAi.Chat.Completions.ChatCompletionMessageParam[] {
	return history.map((content) => {
		return {
			role: content.role === 'user' ? 'user' : 'assistant',
			content: content.parts.map((part) => part.text).join(' '),
		};
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
	// deno-lint-ignore no-unused-vars
	return history.map(({ createdAt, ...content }) => content);
}

/**
 * Replace configuration variables in a Gemini prompt template
 *
 * @param chatName - Name of the chat service
 * @param model - Model name
 * @param maxTokens - Maximum tokens for generation
 * @returns Modified prompt with updated values
 */
export function replaceGeminiConfigFromTone(
	chatName: string,
	model: string,
	maxTokens: number,
): string {
	const originalTone = GeminiService.tone(model);
	return originalTone
		.replace(/Gemini/gi, chatName)
		.replace(
			`${GeminiService.buildGenerationConfig().maxOutputTokens}`,
			`${maxTokens}`,
		);
}
