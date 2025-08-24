import OpenAi, { toFile } from 'npm:openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { openAIModels } from '@/config/models.ts';
import * as path from 'jsr:@std/path';
import ToolService from '@/service/ToolService.ts';
import { encodeBase64 } from 'jsr:@std/encoding/base64';

const { imageModel, gptModel, sttModel } = openAIModels;

export default class OpenAiService {
	protected openai: OpenAi;
	protected model: string;
	protected maxTokens: number;
	protected supportTools: boolean;

	public constructor(
		openai: OpenAi = new OpenAi(),
		model: string = gptModel,
		supportTools: boolean = true,
		maxTokens: number = 8000,
	) {
		this.openai = openai;
		this.model = model;
		this.supportTools = supportTools;
		this.maxTokens = maxTokens;
	}

	async generateTextFromImage(
		userKey: string,
		quote: string = '',
		photosUrl: Promise<string>[],
		prompt: string,
		usePhotoBase64: boolean = false,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const urls = usePhotoBase64 ? await getImageBase64String(photosUrl) : await Promise.all(photosUrl);

		const completion = await this.openai.chat.completions.create({
			model: this.model,
			messages: [
				{
					role: 'system',
					content: getSystemPrompt(
						'OpenAI',
						this.model,
						this.maxTokens,
					),
				},
				...convertGeminiHistoryToGPT(geminiHistory),
				{
					role: 'user',
					content: [
						{ type: 'text', text: requestPrompt },
						...urls.map(
							(photoUrl) => ({
								type: 'image_url',
								image_url: { url: photoUrl },
							} as const),
						),
					],
				},
			],
			max_tokens: this.maxTokens,
			stream: true
		});

		const reader = completion.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>;

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				geminiHistory,
				quote,
				requestPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete, responseMap };
	}

	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;
		const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: getSystemPrompt('OpenAI', this.model, this.maxTokens) },
			...convertGeminiHistoryToGPT(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const openai = this.openai;
		const model = this.model;
		const maxTokens = this.maxTokens;

		const availableTools = this.supportTools
			? {
				tools: ToolService.schemas,
				tool_choice: 'auto',
			}
			: {};

		// @ts-ignore estou quebrando a tipagem acima para incluir condicionalmente
		const initialResponse = await openai.chat.completions.create({
			model,
			messages,
			...availableTools,
			max_tokens: maxTokens,
			stream: true,
			// parallel_tool_calls: true,
			reasoning_effort: 'high',
		});
		const initialReader = initialResponse.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>;

		const reader = executeToolCalls(
			generateFollowupResponse,
			initialReader,
			messages,
			openai,
			model,
			maxTokens,
		);

		const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

		return { reader, onComplete, responseMap };
	}

	async generateImage(
		userKey: string,
		prompt: string,
		style: 'vivid' | 'natural' = 'vivid',
	): Promise<string[]> {
		const response = await this.openai.images.generate({
			model: imageModel,
			prompt,
			quality: 'standard',
			size: '1024x1024',
			n: 1,
			response_format: 'url',
			user: userKey,
			style,
		});

		const imageUrls = response.data?.map((image: OpenAi.Images.Image) => image.url!);
		console.log('dall-e generated images: ', imageUrls);

		if (!imageUrls || imageUrls.length === 0) {
			throw new Error('No images generated.');
		}

		return imageUrls;
	}

	async transcribeAudio(
		audioFile: Promise<Uint8Array>,
		audioFileUrl: string,
	): Promise<string> {
		const response = await this.openai.audio.transcriptions.create({
			file: await toFile(audioFile, path.extname(audioFileUrl)),
			model: sttModel,
		});

		return response.text;
	}
}

export function responseMap(responseBody: string): string {
	return JSON.parse(responseBody).choices[0]?.delta?.content || '';
}

/**
 * Creates a ReadableStream that combines the initial stream and, if there are
 * function calls, processes their follow-up before closing.
 * @param openai Instance of the OpenAI client
 * @param initialReader Reader for the initial stream
 * @param messages Original conversation messages
 * @param model Name of the model for completions
 * @param maxTokens Token limit for the response
 * @returns ReadableStream of Uint8Array containing all chunks of the response
 */
export function executeToolCalls(
	generateText: (messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	...generateTextArgs: any[]
) {
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				const tool_calls = await readInitialStreamAndExtract(initialReader, controller);
				if (tool_calls.length > 0) {
					await handleFunctionCallFollowUp(generateText, messages, tool_calls, controller, ...generateTextArgs);
				}
			} catch (e) {
				const errorMessage = `Eita, algo deu errado: ${e instanceof Error ? e.message : e}`;
				const openAiContent = JSON.stringify({
					choices: [
						{
							delta: {
								content: errorMessage,
							},
						},
					],
				});
				controller.enqueue(new TextEncoder().encode(openAiContent));
			} finally {
				controller.close();
			}
		},
	}).getReader();
}

/**
 * Reads the initial stream from the OpenAI response, enqueues chunks in the controller,
 * and extracts the name of the called function and its arguments.
 * @param initialReader Reader for the initial stream of Uint8Array
 * @param controller Controller to enqueue chunks in the output stream
 * @returns Promise that resolves with an array of tool calls containing the function name and arguments
 */
async function readInitialStreamAndExtract(
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<OpenAi.Chat.Completions.ChatCompletionMessageToolCall[]> {
	const tool_calls: OpenAi.Chat.Completions.ChatCompletionMessageToolCall[] = [];
	while (true) {
		const { done, value } = await initialReader.read();
		if (done) break;
		controller.enqueue(value);
		try {
			const text = new TextDecoder().decode(value);
			const toolCalls = JSON.parse(text)?.choices?.[0]?.delta?.tool_calls;
			for (const call of toolCalls || []) {
				const index = call?.index || 0;

				if (!tool_calls[index]) {
					tool_calls[index] = call;
				}

				try {
					if (!tool_calls[index].function.arguments || JSON.parse(tool_calls[index].function.arguments))
						JSON.parse(call.function.arguments);
					tool_calls[index].function.arguments = call.function.arguments;
				} catch {
					tool_calls[index].function.arguments += call.function.arguments;
				}
			}
			continue;
		} catch (e) {
			console.error('Error decoding initial chunk:', e);
			throw e;
		}
	}
	return tool_calls;
}

/**
 * Processes the follow-up of the detected function call, executes the function via ToolService,
 * and enqueues the result in the output stream.
 * @param openai Instance of the OpenAI client
 * @param messages Original conversation messages
 * @param model Name of the model to be used for the follow-up response
 * @param maxTokens Token limit for the response
 * @param tool_calls Array of detected tool calls containing function names and arguments
 * @param controller Controller to enqueue chunks in the output stream
 */
async function handleFunctionCallFollowUp(
	generateText: (messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	tool_calls: OpenAi.Chat.Completions.ChatCompletionMessageToolCall[],
	controller: ReadableStreamDefaultController<Uint8Array>,
	...generateTextArgs: any[]
) {
	for (const tool_call of tool_calls) {
		const fnName = tool_call.function.name;
		let args = null;
		try {
			args = JSON.parse(tool_call.function.arguments);
		} catch {
			console.error('Error parsing function arguments:', tool_call);
			continue;
		}

		const fn = ToolService.tools.get(fnName)?.fn;
		if (!fn) {
			console.error(`Function ${fnName} not found.`);
			continue;
		}
		const result = await fn(args);
		messages.push({
			role: 'assistant',
			content: '',
			tool_calls: [
				{
					id: tool_call.id ?? null,
					function: {
						name: fnName,
						arguments: tool_call.function.arguments,
					},
				},
			],
		} as unknown as OpenAi.Chat.ChatCompletionMessageParam);
		messages.push({
			tool_call_id: tool_call.id ?? null,
			role: 'tool',
			type: 'function_tool_output',
			name: fnName,
			content: JSON.stringify(result),
		} as unknown as OpenAi.Chat.ChatCompletionMessageParam);
	}

	const followupReader = await generateText(messages, ...generateTextArgs);
	while (true) {
		const { done, value } = await followupReader.read();
		if (done) break;
		controller.enqueue(value);
	}
}

function generateFollowupResponse(
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	openai: OpenAi,
	model: string,
	maxTokens: number,
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	return openai.chat.completions.create({
		model: model === 'o3-mini' || model === 'o4-mini' ? 'gpt-5-mini' : model,
		messages,
		stream: true,
		max_tokens: maxTokens,
	}).then(r => r.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>);
}

function getImageBase64String(
	photoUrls: Promise<string>[],
): Promise<string[]> {
	const promises = photoUrls.map(async (photoUrl) => {
		try {
			const response = await fetch(await photoUrl);
			if (!response.ok) {
				console.warn(
					`Failed to fetch image ${photoUrl}: ${response.statusText}`,
				);
				return photoUrl;
			}
			const arrayBuffer = await response.arrayBuffer();
			const base64String = encodeBase64(arrayBuffer);

			const extension = path.extname(await photoUrl).toLowerCase();
			const ext = extension.slice(1).toLowerCase();
			const mimeType = ext && ext !== 'jpg' ? `image/${ext}` : 'image/jpeg';

			console.log(mimeType)

			return `data:${mimeType};base64,${base64String}`;
		} catch (e) {
			console.error(`Error processing image ${photoUrl}:`, e);
			return photoUrl;
		}
	});
	return Promise.all(promises);
}