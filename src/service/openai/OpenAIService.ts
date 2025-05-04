import OpenAi, { toFile } from 'npm:openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, replaceGeminiConfigFromTone, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { openAIModels } from '@/config/models.ts';
import * as path from 'jsr:@std/path';
import ToolService from '@/service/ToolService.ts';

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
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const urls = await Promise.all(photosUrl);

		const completion = await this.openai.chat.completions.create({
			model: this.model,
			messages: [
				{
					role: 'system',
					content: replaceGeminiConfigFromTone(
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
			{ role: 'system', content: replaceGeminiConfigFromTone('OpenAI', this.model, this.maxTokens) },
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
			parallel_tool_calls: true,
			reasoning_effort: 'high',
		});
		const initialReader = initialResponse.toReadableStream().getReader() as ReadableStreamDefaultReader<Uint8Array>;

		const combinedStream = extractToolCalls(
			openai,
			initialReader,
			messages,
			model,
			maxTokens,
		);

		const reader = combinedStream.getReader();
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

		const imageUrls = response.data.map((image: OpenAi.Images.Image) => image.url!);
		console.log('dall-e generated images: ', imageUrls);

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

function responseMap(responseBody: string): string {
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
function extractToolCalls(
	openai: OpenAi,
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	model: string,
	maxTokens: number,
) {
	return new ReadableStream<Uint8Array>({
		async start(controller) {
			try{
				const tool_calls = await readInitialStreamAndExtract(initialReader, controller);
				if (tool_calls.length > 0) {
					await handleFunctionCallFollowUp(openai, messages, model, maxTokens, tool_calls, controller);
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
	});
}

/**
 * Reads the initial stream from the OpenAI response, enqueues chunks in the controller,
 * and extracts the name of the called function and its arguments.
 * @param initialReader Reader for the initial stream of Uint8Array
 * @param controller Controller to enqueue chunks in the output stream
 * @returns Promise that resolves with an array of tool calls containing the function name and arguments
 */
function readInitialStreamAndExtract(
	initialReader: ReadableStreamDefaultReader<Uint8Array>,
	controller: ReadableStreamDefaultController<Uint8Array>,
): Promise<OpenAi.Chat.Completions.ChatCompletionMessageToolCall[]> {
	return (async () => {
		const tool_calls: OpenAi.Chat.Completions.ChatCompletionMessageToolCall[] = [];
		while (true) {
			const { done, value } = await initialReader.read();
			if (done) break;
			controller.enqueue(value);
			try {
				const text = new TextDecoder().decode(value);
				const toolCalls = JSON.parse(text)?.choices?.[0]?.delta?.tool_calls;
				for (const call of toolCalls || []) {
					const { index } = call;

					if (!tool_calls[index]) {
						tool_calls[index] = call;
					}

					try {
						if(!tool_calls[index].function.arguments || JSON.parse(tool_calls[index].function.arguments)) 
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
	})();
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
	openai: OpenAi,
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	model: string,
	maxTokens: number,
	tool_calls: OpenAi.Chat.Completions.ChatCompletionMessageToolCall[],
	controller: ReadableStreamDefaultController<Uint8Array>,
) {
	for (const tool_call of tool_calls) {
		const fnName = tool_call.function.name;
		let args = null;
		try {
			args = JSON.parse(tool_call.function.arguments);
		} catch (e) {
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

	const followupResponse = await openai.chat.completions.create({
		model: model === 'o3-mini' || model === 'o4-mini' ? 'gpt-4o' : model,
		messages,
		stream: true,
		max_tokens: maxTokens,
	});

	const followReader = followupResponse.toReadableStream().getReader();
	while (true) {
		const { done, value } = await followReader.read();
		if (done) break;
		controller.enqueue(value);
	}
}
