import OpenAi from 'npm:openai';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import ResponsesToolAdapter from '@/utils/ResponsesToolAdapter.ts';
import ToolService from '@/service/ToolService.ts';
import { cloudflareModels } from '@/config/models.ts';
import { downloadTelegramFile } from './TelegramService.ts';
import ToolUsageAdapter from '../adapter/ToolUsageAdapter.ts';

const CLOUDFLARE_ACCOUNT_ID: string = Deno.env.get(
	'CLOUDFLARE_ACCOUNT_ID',
) as string;
const CLOUDFLARE_API_KEY: string = Deno.env.get('CLOUDFLARE_API_KEY') as string;

const {
	imageModel,
	textModel,
	visionTextModel,
	sttModel,
} = cloudflareModels;

const CLOUDFLARE_MAX_TOKENS = 4000;

const REQUEST_OPTIONS = {
	method: 'POST',
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
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
			`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${visionTextModel}`,
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

		addContentToChatHistory(
			geminiHistory,
			quote,
			requestPrompt,
			description,
			userKey,
		);

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
			...convertGeminiHistoryToGPT(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const tools = ResponsesToolAdapter.mapChatToolsToResponsesTools(ToolService.schemas);

		const apiResponse = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1/responses`,
			{
				...REQUEST_OPTIONS,
				body: JSON.stringify({
					model,
					tools,
					reasoning: { effort: 'high' },
					input: messages,
				}),
			},
		);

		if (!apiResponse.ok) {
			const errorBody = await apiResponse.text().catch(() => '');
			throw new Error(`Failed to generate text: ${apiResponse.statusText} ${errorBody}`);
		}

		const initialReader = apiResponse.body!.getReader();

		const reader = ToolUsageAdapter.processModelResponse(
			generateFollowup,
			initialReader,
			messages,
			responseMap,
			model
		);

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				geminiHistory,
				quote,
				requestPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete };
	},

	/**
	 * Generate an image using Stable Diffusion
	 * @param prompt - Text prompt describing the desired image
	 * @returns Generated image as Uint8Array
	 */
	async generateImage(prompt: string): Promise<Uint8Array> {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`,
			{
				...REQUEST_OPTIONS,
				body: `{"prompt": "${escapeMessageQuotes(prompt)}"}`,
			},
		);

		if (!response.ok) {
			console.error(
				`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${imageModel}`,
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
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${sttModel}`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
				},
				body: await audioFile,
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to transcribe text: ${response.statusText}`);
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
				const fileContent = await fileData.content;
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
			`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/tomarkdown`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${CLOUDFLARE_API_KEY}`,
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
 * Maps the response body from Cloudflare to text content
 * @param responseBody - Raw response body
 * @returns Extracted text content
 */
function responseMap(responseBody: string): string {
	type ResponseContent = { text?: string; type?: string;[key: string]: unknown };
	type OutputItem = { id?: string; type?: string; content?: ResponseContent[] };

	let output: OutputItem[] | undefined;
	try {
		output = JSON.parse(responseBody)?.output;

		const message = output
			?.filter((chat: OutputItem) => chat.type === 'message')
			.flatMap((chat: OutputItem) => chat.content ?? [])
			.map((c) => c.text ?? '')
			.filter(Boolean)
			.join('\n') ?? '';
		const reasoning = output
			?.filter((chat: OutputItem) => chat.type === 'reasoning')
			.flatMap((chat: OutputItem) => chat.content ?? [])
			.map((c) => c.text ?? '')
			.filter(Boolean)
			.join('\n') ?? '';

		if (reasoning) console.log('Reasoning: ', reasoning)

		return message || responseBody
	} catch {
		return '';
	}
}


/**
 * Generates a follow-up response from the Cloudflare AI API.
 * @param messages - The array of messages to send to the model.
 * @param model - The model to use for the follow-up response.
 * @returns A promise that resolves to a ReadableStreamDefaultReader for the follow-up response.
 */
async function generateFollowup(messages: any[], model: string): Promise<ReadableStreamDefaultReader<Uint8Array>> {
	const modifiedMessages = ToolUsageAdapter.modifyMessagesWithToolInfo(messages);
	const followResp = await fetch(
		`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/v1/responses`,
		{
			...REQUEST_OPTIONS,
			body: JSON.stringify({
				model,
				input: modifiedMessages,
			}),
		},
	);
	if (!followResp.ok) {
		const errorBody = await followResp.text().catch(() => '');
		throw new Error(`Failed to generate followup: ${followResp.statusText} ${errorBody}`);
	}
	const reader = followResp.body!.getReader();
	return ToolUsageAdapter.mapResponse(reader, true, responseMap);
}