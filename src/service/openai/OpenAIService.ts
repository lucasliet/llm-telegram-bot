import OpenAi, { toFile } from 'npm:openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, convertGeminiHistoryToResponsesInput, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { openAIModels, MODELS_USING_RESPONSES_API } from '@/config/models.ts';
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

		if (MODELS_USING_RESPONSES_API.includes(model)) {
			return this.generateTextWithResponses(userKey, quote, prompt);
		}

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
		const geminiHistory = await getChatHistory(userKey);
		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const input: OpenAi.Responses.ResponseInputItem[] = [
			{
				role: 'system',
				content: getSystemPrompt('OpenAI', this.model, this.maxTokens),
			},
			...convertGeminiHistoryToResponsesInput(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const openai = this.openai;
		const model = this.model;
		const maxTokens = this.maxTokens;

		const tools: OpenAi.Responses.Tool[] | undefined = this.supportTools
			? ToolService.responsesSchemas
			: undefined;

		const initialResponse = await openai.responses.create({
			model,
			input,
			tools,
			max_output_tokens: maxTokens,
			stream: true,
		});

		const initialReader = initialResponse.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>;

		const reader = executeResponsesToolCalls(
			generateResponsesFollowup,
			initialReader,
			input,
			openai,
			model,
			maxTokens,
			tools,
		);

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

		return { reader, onComplete, responseMap: responsesResponseMap };
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
 * Maps the Responses API streaming response body to extract generated text content.
 * @param responseBody - The raw JSON string from the Responses API stream.
 * @returns The extracted text content or empty string if not present.
 */
export function responsesResponseMap(responseBody: string): string {
	const parsed = JSON.parse(responseBody);
	if (parsed.type === 'response.output_text.delta') {
		return parsed.delta || '';
	}
	return '';
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
					if (!tool_calls[index].function.arguments || JSON.parse(tool_calls[index].function.arguments)) {
						JSON.parse(call.function.arguments);
					}
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
	}).then((r) => r.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>);
}

/**
 * Creates a ReadableStream that handles the Responses API stream and processes tool calls.
 * @param generateText - Function to generate follow-up responses after tool execution.
 * @param initialReader - Reader for the initial Responses API stream.
 * @param input - Original conversation input items.
 * @param args - Additional arguments to pass to generateText.
 * @returns ReadableStream reader of Uint8Array containing all response chunks.
 */
export function executeResponsesToolCalls(
	generateText: (input: OpenAi.Responses.ResponseInputItem[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	input: OpenAi.Responses.ResponseInputItem[],
	...generateTextArgs: any[]
) {
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try {
				const functionCalls = await readResponsesStreamAndExtract(initialReader, controller);
				if (functionCalls.length > 0) {
					await handleResponsesFunctionCallFollowUp(generateText, input, functionCalls, controller, ...generateTextArgs);
				}
			} catch (e) {
				const errorMessage = `Eita, algo deu errado: ${e instanceof Error ? e.message : e}`;
				const responsesContent = JSON.stringify({
					type: 'response.output_text.delta',
					delta: errorMessage,
				});
				controller.enqueue(new TextEncoder().encode(responsesContent));
			} finally {
				controller.close();
			}
		},
	}).getReader();
}

interface ResponsesFunctionCall {
	call_id: string;
	name: string;
	arguments: string;
}

/**
 * Reads the Responses API stream and extracts function call information.
 * @param initialReader - Reader for the initial Responses API stream.
 * @param controller - Controller to enqueue chunks to the output stream.
 * @returns Promise resolving to an array of function calls.
 */
async function readResponsesStreamAndExtract(
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<ResponsesFunctionCall[]> {
	const functionCalls: ResponsesFunctionCall[] = [];
	const pendingCalls = new Map<number, ResponsesFunctionCall>();
	let buffer = '';

	while (true) {
		const { done, value } = await initialReader.read();
		if (done) break;
		controller.enqueue(value);

		buffer += new TextDecoder().decode(value, { stream: true });
		let newlineIndex;
		while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
			const line = buffer.slice(0, newlineIndex);
			buffer = buffer.slice(newlineIndex + 1);

			if (!line.trim()) continue;

			try {
				const event = JSON.parse(line);

				if (event.type === 'response.output_item.added' && event.item?.type === 'function_call') {
					pendingCalls.set(event.output_index, {
						call_id: event.item.call_id || '',
						name: event.item.name || '',
						arguments: '',
					});
				}

				if (event.type === 'response.function_call_arguments.delta') {
					const pending = pendingCalls.get(event.output_index);
					if (pending) {
						pending.arguments += event.delta || '';
					}
				}

				if (event.type === 'response.function_call_arguments.done') {
					const pending = pendingCalls.get(event.output_index);
					if (pending) {
						pending.arguments = event.arguments || pending.arguments;
						functionCalls.push(pending);
						pendingCalls.delete(event.output_index);
					}
				}
			} catch (e) {
				console.error('Error decoding Responses stream chunk:', e);
			}
		}
	}

	return functionCalls;
}

/**
 * Handles function call follow-up for the Responses API by executing tools and generating continuation.
 * @param generateText - Function to generate follow-up responses.
 * @param input - Original conversation input items.
 * @param functionCalls - Array of function calls to execute.
 * @param controller - Controller to enqueue chunks to the output stream.
 * @param args - Additional arguments to pass to generateText.
 */
async function handleResponsesFunctionCallFollowUp(
	generateText: (input: OpenAi.Responses.ResponseInputItem[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
	input: OpenAi.Responses.ResponseInputItem[],
	functionCalls: ResponsesFunctionCall[],
	controller: ReadableStreamDefaultController<Uint8Array>,
	...generateTextArgs: any[]
) {
	for (const call of functionCalls) {
		const fnName = call.name;
		let args = null;
		try {
			args = JSON.parse(call.arguments);
		} catch {
			console.error('Error parsing function arguments:', call);
			continue;
		}

		const fn = ToolService.tools.get(fnName)?.fn;
		if (!fn) {
			console.error(`Function ${fnName} not found.`);
			continue;
		}

		const result = await fn(args);

		input.push({
			role: 'assistant',
			content: [], // Function calls are not content in the traditional sense for the input array in this context, but we need to represent the turn
			// However, for Responses API input, we typically append the output.
			// Re-reading docs: "Submit function call results back to the model... input messages including function_call_output entries"
			// The model expects to see the conversation history.
			// Let's stick to the structure that includes the call and the result.
			// But wait, the previous code was manually constructing 'function_call' item.
			// OpenAI docs say:
			// input_list.append({ "type": "function_call", ... }) NO, it says response.output items are added.
			// And then user adds "function_call_output".
			// Since we don't have the full original item object easily available without reconstructing it or saving it from the stream loop,
			// reconstructing it as we did is the best approach given the current structure, but we must ensure it matches the expected type.
		} as unknown as OpenAi.Responses.ResponseInputItem);


		// Actually, looking at the "Submit Results Back to Model" logic:
		// You append the function_call item (which we received) and then the function_call_output.
		// The previous code was pushing a custom object. Let's make it strictly typed if possible or at least structurally correct.

		// We will push the function call as an assistant message or specific item type if the API supports it.
		// The `ResponseInputItem` type in the SDK might have `type: 'function_call'`.
		// Let's trust the previous structure was intentioned but verify against standard.
		// Standard allows `type: 'function_call'`.

		input.push({
			type: 'function_call',
			call_id: call.call_id,
			name: fnName,
			arguments: call.arguments,
		} as OpenAi.Responses.ResponseInputItem);

		input.push({

			type: 'function_call_output',
			call_id: call.call_id,
			output: JSON.stringify(result),
		} as OpenAi.Responses.ResponseInputItem);
	}

	const followupReader = await generateText(input, ...generateTextArgs);
	while (true) {
		const { done, value } = await followupReader.read();
		if (done) break;
		controller.enqueue(value);
	}
}

function generateResponsesFollowup(
	input: OpenAi.Responses.ResponseInputItem[],
	openai: OpenAi,
	model: string,
	maxTokens: number,
	tools?: OpenAi.Responses.Tool[],
): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	return openai.responses.create({
		model,
		input,
		tools,
		max_output_tokens: maxTokens,
		stream: true,
	}).then((r) => r.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>);
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

			console.log(mimeType);

			return `data:${mimeType};base64,${base64String}`;
		} catch (e) {
			console.error(`Error processing image ${photoUrl}:`, e);
			return photoUrl;
		}
	});
	return Promise.all(promises);
}
