import OpenAi from 'openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import ToolService from '@/service/ToolService.ts';
import { cloudflareModels } from '@/config/models.ts';
import { downloadTelegramFile } from './TelegramService.ts';
import { responseMap as openAiResponseMap } from '@/service/openai/OpenAIService.ts';
import { encodeBase64 } from 'base64';

const getCloudflareAccountId = () => Deno.env.get(
	'CLOUDFLARE_ACCOUNT_ID',
) as string;
const getCloudflareApiKey = () => Deno.env.get('CLOUDFLARE_API_KEY') as string;

const {
	imageModel,
	textModel,
	visionTextModel,
	sttModel,
} = cloudflareModels;

const CLOUDFLARE_MAX_TOKENS = 256000;

const REQUEST_OPTIONS = {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${getCloudflareApiKey()}`,
	},
};

/**
 * Service for interacting with Cloudflare AI API
 */
export default {
	/**
	 * Generate text from an image using the vision text model
	 * @param userKey - User identifier for chat history
	 * @param quote - Optional quote to include in context
	 * @param photoUrl - Promise resolving to the photo URL
	 * @param prompt - Text prompt to accompany the image
	 * @returns Generated text response
	 */
	async generateTextFromImage(
		userKey: string,
		quote: string = '',
		photoUrl: Promise<string>,
		prompt: string,
	): Promise<string> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const photoBinaryArray = await downloadTelegramFile(await photoUrl);

		const apiResponse = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/run/${visionTextModel}`,
			{
				...REQUEST_OPTIONS,
				body: JSON.stringify({
					prompt: requestPrompt,
					image: Array.from(photoBinaryArray),
					max_tokens: CLOUDFLARE_MAX_TOKENS,
				}),
			},
		);

		if (!apiResponse.ok) {
			const errorBody = await apiResponse.text().catch(() => '');
			throw new Error(`Failed to generate text: ${apiResponse.statusText} ${errorBody}`);
		}
		const { result: { description } } = await apiResponse.json();

		addContentToChatHistory(geminiHistory, requestPrompt, description, userKey);

		return description;
	},

	/**
	 * Generate text using a specified text model
	 * @param userKey - User identifier for chat history
	 * @param quote - Optional quote to include in context
	 * @param prompt - Text prompt
	 * @param model - Model to use (defaults to textModel)
	 * @returns Stream reply response with reader and completion handler
	 */
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
		model: string = textModel,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: getSystemPrompt(
					'Cloudflare',
					model,
					CLOUDFLARE_MAX_TOKENS,
				),
			},
			...geminiHistory,
			{ role: 'user', content: requestPrompt },
		];

		const initialResponse = await fetchChatCompletion(messages, model, false);
		const initialData = await initialResponse.json() as OpenAi.Chat.ChatCompletion;
		const choice = initialData.choices[0];

		if (choice?.message?.tool_calls?.length) {
			await executeToolsAndUpdateMessages(messages, choice.message.tool_calls);
		} else if (choice?.message?.content) {
			addContentToChatHistory(geminiHistory, requestPrompt, choice.message.content, userKey);
			return createStreamFromText(choice.message.content, geminiHistory, requestPrompt, userKey);
		}

		const followupResp = await fetchChatCompletion(messages, model, true);
		if (!followupResp.ok) {
			const errorBody = await followupResp.text().catch(() => '');
			throw new Error(`Failed to generate followup: ${followupResp.statusText} ${errorBody}`);
		}

		const reader = normalizeSseReader(followupResp.body!.getReader());
		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(geminiHistory, requestPrompt, completedAnswer, userKey);

		return { reader, onComplete, responseMap: openAiResponseMap };
	},

	/**
	 * Generate an image using Stable Diffusion
	 * @param prompt - Text prompt describing the desired image
	 * @returns Generated image as Uint8Array
	 */
	async generateImage(prompt: string): Promise<Uint8Array> {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/run/${imageModel}`,
			{
				...REQUEST_OPTIONS,
				body: `{"prompt": "${escapeMessageQuotes(prompt)}"}`,
			},
		);

		if (!response.ok) {
			console.error(
				`https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/run/${imageModel}`,
				{
					...REQUEST_OPTIONS,
					body: `{"prompt": "${escapeMessageQuotes(prompt)}"}`,
				},
				response.statusText,
			);
			throw new Error(`Failed to generate image: ${response.statusText}}`);
		}

		const { result: { image } } = await response.json();

		return Uint8Array.from(atob(image), (m) => m.codePointAt(0)!);
	},

	/**
	 * Transcribe audio to text
	 * @param audioFile - Promise resolving to audio file as Uint8Array
	 * @returns Transcribed text
	 */
	async transcribeAudio(audioFile: Promise<Uint8Array>): Promise<string> {
		const audioData = await audioFile;
		const base64Audio = encodeBase64(audioData);

		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/run/${sttModel}`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${getCloudflareApiKey()}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ audio: base64Audio }),
			},
		);

		if (!response.ok) {
			const errorText = await response.text();
			throw new Error(`Failed to transcribe audio: ${response.status} ${response.statusText} - ${errorText}`);
		}

		const { result: { text } } = await response.json();

		return text;
	},

	/**
	 * Converte arquivos para formato Markdown usando a API Cloudflare Workers AI
	 * @param fileContents - Array de Promise<Uint8Array> dos arquivos a serem convertidos
	 * @returns Texto em formato Markdown (conteúdo da propriedade data)
	 */
	async transcribeFile(
		fileDataList: { content: Promise<Uint8Array>; fileName: string }[],
	): Promise<string> {
		const formData = new FormData();

		for (const fileData of fileDataList) {
			try {
				const fileContent = new Uint8Array(await fileData.content);
				const file = new File([fileContent], fileData.fileName, {
					type: 'application/octet-stream',
				});
				formData.append('files', file);
			} catch (error) {
				console.error(`Erro ao processar arquivo: ${error instanceof Error ? error.message : error}`);
				throw new Error(`Falha ao processar arquivo: ${error instanceof Error ? error.message : error}`);
			}
		}

		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/tomarkdown`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${getCloudflareApiKey()}`,
				},
				body: formData,
			},
		);

		if (!response.ok) {
			throw new Error(`Falha ao converter para markdown: ${response.statusText}`);
		}

		const result = await response.json();
		return result.result.data;
	},
};

/**
 * Escapes double quotes in message text for JSON
 * @param message - Input message text
 * @returns Escaped message text
 */
function escapeMessageQuotes(message: string): string {
	return message.replace(/"/g, '\\"');
}

/**
 * Fetches a chat completion from the Cloudflare AI API.
 * @param messages - The conversation messages.
 * @param model - The model to use.
 * @param stream - Whether to stream the response.
 * @returns The fetch Response object.
 */
function fetchChatCompletion(
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	model: string,
	stream: boolean,
): Promise<Response> {
	return fetch(
		`https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/v1/chat/completions`,
		{
			...REQUEST_OPTIONS,
			body: JSON.stringify({
				model,
				messages,
				tools: ToolService.schemas,
				tool_choice: 'auto',
				stream,
				max_tokens: CLOUDFLARE_MAX_TOKENS,
				reasoning_effort: 'high',
			}),
		},
	);
}

/**
 * Executes tool calls and appends the results to the messages array.
 * Uses modern tool_calls/tool message format for Cloudflare compatibility.
 * @param messages - The conversation messages (mutated in place).
 * @param toolCalls - The tool calls from the model's response.
 */
async function executeToolsAndUpdateMessages(
	messages: OpenAi.Chat.ChatCompletionMessageParam[],
	toolCalls: OpenAi.Chat.Completions.ChatCompletionMessageToolCall[],
): Promise<void> {
	const encoder = new TextEncoder();

	for (const toolCall of toolCalls) {
		if (toolCall.type !== 'function') continue;
		const fnName = toolCall.function.name;
		let args = null;
		try {
			args = JSON.parse(toolCall.function.arguments);
		} catch {
			console.error('Error parsing function arguments:', toolCall);
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
			content: null,
			tool_calls: [toolCall],
		} as any);
		messages.push({
			role: 'tool',
			tool_call_id: toolCall.id,
			content: typeof result === 'string' ? result : JSON.stringify(result),
		} as any);
	}
}

/**
 * Creates a StreamReplyResponse from a static text string,
 * formatting it as an OpenAI streaming chunk for compatibility with streamReply.
 * @param text - The complete text response.
 * @param geminiHistory - The chat history for persistence.
 * @param requestPrompt - The original prompt.
 * @param userKey - The user identifier.
 * @returns A StreamReplyResponse that yields the text as a stream.
 */
function createStreamFromText(
	text: string,
	geminiHistory: OpenAi.Chat.ChatCompletionMessageParam[],
	requestPrompt: string,
	userKey: string,
): StreamReplyResponse {
	const encoder = new TextEncoder();
	const openAiChunk = JSON.stringify({
		choices: [{ delta: { content: text } }],
	});

	const reader = new ReadableStream<Uint8Array>({
		start(controller) {
			controller.enqueue(encoder.encode(`${openAiChunk}\n`));
			controller.close();
		},
	}).getReader();

	const onComplete = (completedAnswer: string) =>
		addContentToChatHistory(geminiHistory, requestPrompt, completedAnswer, userKey);

	return { reader, onComplete, responseMap: openAiResponseMap };
}

/**
 * Normalizes Cloudflare SSE chunks to newline-delimited JSON objects.
 * @param reader - Raw SSE stream reader
 * @returns Reader with one JSON object per chunk line
 */
function normalizeSseReader(
	reader: ReadableStreamDefaultReader<Uint8Array>,
): ReadableStreamDefaultReader<Uint8Array> {
	const decoder = new TextDecoder();
	const encoder = new TextEncoder();

	return new ReadableStream<Uint8Array>({
		async start(controller) {
			let buffer = '';
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });
					const lines = buffer.split('\n');
					buffer = lines.pop() ?? '';

					for (const line of lines) {
						const trimmed = line.trim();
						if (!trimmed) continue;

						if (trimmed.startsWith('data:')) {
							const payload = trimmed.slice(5).trim();
							if (!payload || payload === '[DONE]') continue;
							controller.enqueue(encoder.encode(`${payload}\n`));
							continue;
						}

						if (trimmed.startsWith('{')) {
							controller.enqueue(encoder.encode(`${trimmed}\n`));
						}
					}
				}

				const remaining = buffer.trim();
				if (remaining.startsWith('data:')) {
					const payload = remaining.slice(5).trim();
					if (payload && payload !== '[DONE]') {
						controller.enqueue(encoder.encode(`${payload}\n`));
					}
				} else if (remaining.startsWith('{')) {
					controller.enqueue(encoder.encode(`${remaining}\n`));
				}
			} catch (error) {
				controller.error(error);
			} finally {
				controller.close();
				reader.releaseLock();
			}
		},
	}).getReader();
}
