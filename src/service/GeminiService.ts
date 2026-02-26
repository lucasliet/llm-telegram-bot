import { CoreMessage, streamText } from 'ai';
import { createGoogleGenerativeAI, GoogleGenerativeAIProvider } from '@ai-sdk/google';

import OpenAI from 'openai';
import { getChatHistory, addContentToChatHistory } from '@/repository/ChatRepository.ts';
import { getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';

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
	 * @param historyForUpdate - The GPT-format chat history to be updated upon completion.
	 * @param originalPrompt - The original text prompt from the user.
	 * @param userKey - The user's unique key for chat history management.
	 * @returns A StreamReplyResponse object.
	 */
	private _streamResponse(
		modelName: string,
		messages: CoreMessage[],
		historyForUpdate: OpenAI.ChatCompletionMessageParam[],
		originalPrompt: string,
		userKey: string,
	): StreamReplyResponse {
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
			addContentToChatHistory(historyForUpdate, originalPrompt, completedAnswer, userKey);

		return { reader, onComplete };
	}

	/**
	 * Maps OpenAI formatted chat history messages to CoreMessage format.
	 * @private
	 * @static
	 * @param history - An array of chat messages in OpenAI.ChatCompletionMessageParam format.
	 * @returns An array of CoreMessage objects.
	 */
	private static _toCoreMessages(history: OpenAI.ChatCompletionMessageParam[]): CoreMessage[] {
		return history.map((msg) => ({
			role: msg.role === 'assistant' ? 'assistant' : 'user',
			content: msg.content as string,
		}));
	}

	/**
	 * Generates a text-based response from the Gemini model.
	 * @param userKey - The user key for accessing and updating chat history.
	 * @param quote - An optional quote to prepend to the prompt.
	 * @param prompt - The main text prompt for the AI.
	 * @returns A promise that resolves to a StreamReplyResponse object.
	 */
	async generateText(userKey: string, quote: string = '', prompt: string): Promise<StreamReplyResponse> {
		const history = await getChatHistory(this.model);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const messages: CoreMessage[] = [
			{ role: 'system', content: getSystemPrompt('Gemini', this.model, 1000) },
			...GeminiService._toCoreMessages(history),
			{ role: 'user', content: requestPrompt },
		];

		return this._streamResponse(`models/${this.model}`, messages, history, requestPrompt, userKey);
	}

	/**
	 * Generates a text response from the Gemini model based on images and a text prompt.
	 * @param userKey - The user key for accessing and updating chat history.
	 * @param quote - An optional quote to prepend to the text prompt.
	 * @param photosUrl - An array of promises, each resolving to a URL of an image.
	 * @param prompt - The main text prompt accompanying the images.
	 * @returns A promise that resolves to a StreamReplyResponse object.
	 */
	async generateTextFromImage(
		userKey: string,
		quote: string = '',
		photosUrl: Promise<string>[],
		prompt: string,
	): Promise<StreamReplyResponse> {
		const history = await getChatHistory(this.model);
		const textualPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const resolvedImageUrls = await Promise.all(photosUrl);
		const imageContentParts = resolvedImageUrls.map((url) => ({ type: 'image' as const, image: url }));

		const userPromptContent: (
			| { type: 'text'; text: string }
			| { type: 'image'; image: string; mimeType?: string }
		)[] = [{ type: 'text', text: textualPrompt }, ...imageContentParts];

		const messages: CoreMessage[] = [
			{ role: 'system', content: getSystemPrompt('Gemini', this.model, 1000) },
			...GeminiService._toCoreMessages(history),
			{ role: 'user', content: userPromptContent },
		];

		return this._streamResponse(`models/${this.model}`, messages, history, textualPrompt, userKey);
	}
}
