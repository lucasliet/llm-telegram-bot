import OpenAi, { toFile } from 'openai';
import { addContentToChatHistory, getChatHistory, overwriteChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, convertGeminiHistoryToResponsesInput, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { MODELS_USING_RESPONSES_API, openAIModels } from '@/config/models.ts';
import * as path from '@std/path';
import ToolService from '@/service/ToolService.ts';
import { encodeBase64 } from 'base64';

import { ContextCompressorService } from '@/service/ContextCompressorService.ts';

// Agent Loop imports
import { AgentLoopConfig, AgentLoopExecutor, DEFAULT_AGENT_CONFIG } from './agent/index.ts';
import { ChatCompletionsStreamProcessor, ResponsesAPIStreamProcessor } from './stream/index.ts';

const { imageModel, gptModel, sttModel } = openAIModels;

export default class OpenAiService {
	protected openai: OpenAi;
	protected model: string;
	protected maxTokens: number;
	protected supportTools: boolean;
	protected agentConfig: AgentLoopConfig;

	public constructor(
		openai: OpenAi = new OpenAi(),
		model: string = gptModel,
		supportTools: boolean = true,
		maxTokens: number = 128000,
		agentConfig: Partial<AgentLoopConfig> = {},
	) {
		this.openai = openai;
		this.model = model;
		this.supportTools = supportTools;
		this.maxTokens = maxTokens;
		this.agentConfig = { ...DEFAULT_AGENT_CONFIG, ...agentConfig };
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
			stream: true,
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
		let geminiHistory = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;



		const { history, didCompress } = await ContextCompressorService.compressIfNeeded(
			geminiHistory,
			this.maxTokens,
			this.model,
			this.openai,
		);

		if (didCompress) {
			geminiHistory = history;
			await overwriteChatHistory(userKey, geminiHistory);
		}

		// Decide which API to use
		if (MODELS_USING_RESPONSES_API.includes(this.model)) {
			return this.generateTextWithResponses(userKey, quote, prompt);
		}

		const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
			{ role: 'system', content: getSystemPrompt('OpenAI', this.model, this.maxTokens) },
			...convertGeminiHistoryToGPT(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const reader = await this.executeAgentLoopForChatCompletions(messages, requestPrompt);

		const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);



		return { reader, onComplete, responseMap, isCompressed: didCompress };
	}

	/**
	 * Generates text using the OpenAI Responses API with streaming and tool support.
	 * @param userKey - Unique identifier for the user session.
	 * @param quote - Optional quoted text to include in the prompt.
	 * @param prompt - The user's input prompt.
	 * @returns A StreamReplyResponse containing the reader, completion callback, and response mapper.
	 */
	async generateTextWithResponses(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		let geminiHistory = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;



		const { history, didCompress } = await ContextCompressorService.compressIfNeeded(
			geminiHistory,
			this.maxTokens,
			this.model,
			this.openai,
		);

		if (didCompress) {
			geminiHistory = history;
			await overwriteChatHistory(userKey, geminiHistory);
		}

		const input: OpenAi.Responses.ResponseInputItem[] = [
			{
				role: 'system',
				content: getSystemPrompt('OpenAI', this.model, this.maxTokens),
			},
			...convertGeminiHistoryToResponsesInput(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const reader = await this.executeAgentLoopForResponsesAPI(input, requestPrompt);

		const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);



		return { reader, onComplete, responseMap: responsesResponseMap, isCompressed: didCompress };
	}

	/**
	 * Execute agent loop for Chat Completions API.
	 */
	private async executeAgentLoopForChatCompletions(
		messages: OpenAi.Chat.ChatCompletionMessageParam[],
		userQuery: string,
	): Promise<ReadableStreamDefaultReader<Uint8Array>> {
		const streamProcessor = new ChatCompletionsStreamProcessor();

		const generateFn = async (msgs: OpenAi.Chat.ChatCompletionMessageParam[]) => {
			const params: OpenAi.Chat.ChatCompletionCreateParamsStreaming = {
				model: this.model,
				messages: msgs,
				max_tokens: this.maxTokens,
				stream: true,
				reasoning_effort: 'low',
				...(this.supportTools ? { tools: ToolService.schemas, tool_choice: 'auto' as const } : {}),
			};
			const response = await this.openai.chat.completions.create(params);

			return response.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>;
		};

		const executor = new AgentLoopExecutor(
			streamProcessor,
			generateFn,
			this.openai,
			this.model,
			this.maxTokens,
			userQuery,
			this.agentConfig,
			true,
		);

		// First call
		const initialReader = await generateFn(messages);

		return executor.execute(initialReader, messages);
	}

	/**
	 * Execute agent loop for Responses API.
	 */
	private async executeAgentLoopForResponsesAPI(
		input: OpenAi.Responses.ResponseInputItem[],
		userQuery: string,
	): Promise<ReadableStreamDefaultReader<Uint8Array>> {
		const streamProcessor = new ResponsesAPIStreamProcessor();

		const tools: OpenAi.Responses.Tool[] | undefined = this.supportTools ? ToolService.responsesSchemas : undefined;

		const generateFn = async (inp: OpenAi.Responses.ResponseInputItem[]) => {
			const response = await this.openai.responses.create({
				model: this.model,
				input: inp,
				tools,
				max_output_tokens: this.maxTokens,
				stream: true,
			});

			return response.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>;
		};

		const executor = new AgentLoopExecutor(
			streamProcessor,
			generateFn,
			this.openai,
			this.model,
			this.maxTokens,
			userQuery,
			this.agentConfig,
			true,
		);

		// First call
		const initialReader = await generateFn(input);

		return executor.execute(initialReader, input);
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

/**
 * Maps the Chat Completions API streaming response body to extract generated text content.
 * @param responseBody - The raw JSON string from the streaming response.
 * @returns The extracted delta content text or empty string if parsing fails.
 */
export function responseMap(responseBody: string): string {
	try {
		return JSON.parse(responseBody).choices[0]?.delta?.content || '';
	} catch {
		return '';
	}
}

/**
 * Maps the Responses API streaming response body to extract generated text content.
 * @param responseBody - The raw JSON string from the Responses API stream.
 * @returns The extracted text content or empty string if not present.
 */
export function responsesResponseMap(responseBody: string): string {
	try {
		const parsed = JSON.parse(responseBody);
		if (parsed.type === 'response.output_text.delta') {
			return parsed.delta || '';
		}
		return '';
	} catch {
		return '';
	}
}

export function getImageBase64String(
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

			console.log(mimeType);

			return `data:${mimeType};base64,${base64String}`;
		} catch (e) {
			console.error(`Error processing image ${photoUrl}:`, e);
			return photoUrl;
		}
	});
	return Promise.all(promises);
}

/**
 * Execute tool calls from a stream and handle the follow-up response.
 * @param generateText - Function to generate text/stream from messages
 * @param initialReader - Reader for the initial stream
 * @param messages - Current conversation messages
 * @param generateTextArgs - Additional arguments for the generate function
 * @returns A readable stream reader containing the complete response
 */
export function executeToolCalls(
	generateText: (messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	...generateTextArgs: any[]
): ReadableStreamDefaultReader<Uint8Array> {
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
interface ToolCallFunction {
	name: string;
	arguments: string;
}

interface ToolCall {
	id: string;
	function: ToolCallFunction;
	type: string;
}

async function readInitialStreamAndExtract(
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<ToolCall[]> {
	const tool_calls: ToolCall[] = [];
	const decoder = new TextDecoder();
	while (true) {
		const { done, value } = await initialReader.read();
		if (done) break;
		controller.enqueue(value);
		try {
			const text = decoder.decode(value);
			const lines = text.split('\n');

			for (const line of lines) {
				const trimmed = line.trim();
				if (!trimmed) continue;

				try {
					const toolCalls = JSON.parse(trimmed)?.choices?.[0]?.delta?.tool_calls;
					for (const call of toolCalls || []) {
						const { index } = call;

						if (!tool_calls[index]) {
							tool_calls[index] = call as ToolCall;
						} else if (call.function?.arguments) {
							tool_calls[index].function.arguments += call.function.arguments;
						}
					}
				} catch (e) {
					// Skip partial or invalid JSON lines in the initial stream
					console.warn('Error parsing initial stream line:', e);
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
 * @param generateText Function to generate text from messages
 * @param messages Original conversation messages
 * @param tool_calls Array of detected tool calls containing function names and arguments
 * @param controller Controller to enqueue chunks in the output stream
 * @param generateTextArgs Additional arguments for the generate function
 */
async function handleFunctionCallFollowUp(
	generateText: (messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	tool_calls: ToolCall[],
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
			name: fnName,
			content: '',
			function_call: { name: fnName, arguments: tool_call.function.arguments },
		});
		messages.push({
			role: 'function',
			name: fnName,
			content: JSON.stringify(result),
		});
	}

	const followupReader = await generateText(messages, ...generateTextArgs);
	while (true) {
		const { done, value } = await followupReader.read();
		if (done) break;
		controller.enqueue(value);
	}
}
