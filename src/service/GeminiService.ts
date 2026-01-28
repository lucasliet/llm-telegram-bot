import { CoreMessage, streamText } from 'npm:ai';
import { createGoogleGenerativeAI, GoogleGenerativeAIProvider } from 'npm:@ai-sdk/google';

import { ExpirableContent, getChatHistory } from '@/repository/ChatRepository.ts';
import { addContentToChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import OpenAI from 'npm:openai';

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') as string;

/**
 * GeminiService - Provides text and image generation using Gemini models
 */
export default class GeminiService {
	private model: string;
	private googleAI: GoogleGenerativeAIProvider;

	/**
	 * Constructs a new GeminiService instance.
	 * @param model - The Gemini model name to be used.
	 */
	constructor(model: string) {
		this.model = model;
		this.googleAI = createGoogleGenerativeAI({
			apiKey: GEMINI_API_KEY,
		});
	}

	/**
	 * Handles the streaming of responses from the AI model and updates chat history.
	 * @private
	 * @param modelName - The specific model identifier (e.g., 'models/gemini-pro').
	 * @param messages - The array of messages to send to the model.
	 * @param geminiHistoryForUpdate - The chat history to be updated upon completion.
	 * @param originalQuote - The original quote included in the user's prompt.
	 * @param originalPrompt - The original text prompt from the user.
	 * @param userKey - The user's unique key for chat history management.
	 * @returns A promise that resolves to a StreamReplyResponse object.
	 */
	private _streamResponse(
		modelName: string,
		messages: CoreMessage[],
		geminiHistoryForUpdate: ExpirableContent[],
		originalQuote: string,
		originalPrompt: string,
		userKey: string,
	): Promise<StreamReplyResponse> {
		const { textStream } = streamText({
			model: this.googleAI(modelName),
			messages,
		});

		const textEncoder = new TextEncoder();
		const transformStream = new TransformStream<string, Uint8Array>({
			transform(chunk, controller) {
				controller.enqueue(textEncoder.encode(chunk));
			},
		});

		const transformedStream = textStream.pipeThrough(transformStream);
		const reader = transformedStream.getReader();

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				geminiHistoryForUpdate,
				originalQuote,
				originalPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete };
	}

	/**
	 * Maps OpenAI formatted chat history messages to CoreMessage format.
	 * @private
	 * @static
	 * @param openAiHistory - An array of chat messages in OpenAI.ChatCompletionMessageParam format.
	 * @returns An array of CoreMessage objects.
	 */
	private static _mapOpenAiHistoryToCoreMessages(
		openAiHistory: OpenAI.ChatCompletionMessageParam[],
	): CoreMessage[] {
		return openAiHistory.map((msg) => {
			const role: 'user' | 'assistant' = msg.role === 'assistant' ? 'assistant' : 'user';
			return {
				role,
				content: msg.content as string,
			};
		});
	}

	/**
	 * Generates a text-based response from the Gemini model.
	 * @param userKey - The user key for accessing and updating chat history.
	 * @param quote - An optional quote to prepend to the prompt.
	 * @param prompt - The main text prompt for the AI.
	 * @returns A promise that resolves to a StreamReplyResponse object,
	 *          containing the response stream and an onComplete callback.
	 */
	async generateText(userKey: string, quote: string = '', prompt: string): Promise<StreamReplyResponse> {
		const geminiHistory: ExpirableContent[] = await getChatHistory(this.model);
		const history: OpenAI.ChatCompletionMessageParam[] = convertGeminiHistoryToGPT(geminiHistory);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const systemMessageContent = getSystemPrompt('Gemini', this.model, 1000);
		const mappedHistory = GeminiService._mapOpenAiHistoryToCoreMessages(history);

		const finalMessagesForApi: CoreMessage[] = [
			{ role: 'system', content: systemMessageContent },
			...mappedHistory,
			{ role: 'user', content: requestPrompt },
		];

		return this._streamResponse(
			`models/${this.model}`,
			finalMessagesForApi,
			geminiHistory,
			quote,
			requestPrompt,
			userKey,
		);
	}

	/**
	 * Generates a text response from the Gemini model based on images and a text prompt.
	 * @param userKey - The user key for accessing and updating chat history.
	 * @param quote - An optional quote to prepend to the text prompt.
	 * @param photosUrl - An array of promises, each resolving to a URL of an image.
	 * @param prompt - The main text prompt accompanying the images.
	 * @returns A promise that resolves to a StreamReplyResponse object,
	 *          containing the response stream and an onComplete callback.
	 */
	async generateTextFromImage(
		userKey: string,
		quote: string = '',
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse> {
		const geminiHistory: ExpirableContent[] = await getChatHistory(this.model);
		const historyMessages: OpenAI.ChatCompletionMessageParam[] = convertGeminiHistoryToGPT(geminiHistory);

		const resolvedImageUrls = await Promise.all(photosUrl);
		const imageContentParts = await Promise.all(
			resolvedImageUrls.map((url) => {
				return { type: 'image' as const, image: url };
			}),
		);

		const textualPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;
		const userPromptContent: (
			| { type: 'text'; text: string }
			| { type: 'image'; image: string; mimeType?: string }
		)[] = [
			{ type: 'text', text: textualPrompt },
			...imageContentParts,
		];

		const systemMessageContent = getSystemPrompt('Gemini', this.model, 1000);
		const mappedHistory = GeminiService._mapOpenAiHistoryToCoreMessages(historyMessages);

		const messagesForApi: CoreMessage[] = [
			{
				role: 'system',
				content: systemMessageContent,
			},
			...mappedHistory,
			{ role: 'user', content: userPromptContent },
		];

		return this._streamResponse(
			`models/${this.model}`,
			messagesForApi,
			geminiHistory,
			quote,
			prompt,
			userKey,
		);
	}
}
