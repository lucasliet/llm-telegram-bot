import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, replaceGeminiConfigFromTone, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { cloudflareModels } from '@/config/models.ts';
import { downloadTelegramFile } from './TelegramService.ts';

const CLOUDFLARE_ACCOUNT_ID: string = Deno.env.get(
	'CLOUDFLARE_ACCOUNT_ID',
) as string;
const CLOUDFLARE_API_KEY: string = Deno.env.get('CLOUDFLARE_API_KEY') as string;

const {
	imageModel,
	textModel,
	visionTextModel,
	sqlModel,
	codeModel,
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
			throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
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

		const apiResponse = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${model}`,
			{
				...REQUEST_OPTIONS,
				body: JSON.stringify({
					messages: [
						{
							role: 'system',
							content: replaceGeminiConfigFromTone(
								'Llama',
								textModel,
								CLOUDFLARE_MAX_TOKENS,
							),
						},
						...convertGeminiHistoryToGPT(geminiHistory),
						{ role: 'user', content: requestPrompt },
					],
					max_tokens: CLOUDFLARE_MAX_TOKENS,
					stream: true,
				}),
			},
		);

		if (!apiResponse.ok) {
			throw new Error(`Failed to generate text: ${apiResponse.statusText}`);
		}

		const reader = apiResponse.body!.getReader();

		const onComplete = (completedAnswer: string) =>
			addContentToChatHistory(
				geminiHistory,
				quote,
				requestPrompt,
				completedAnswer,
				userKey,
			);

		return { reader, onComplete, responseMap };
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
	 * Generate SQL code using a dedicated SQL model
	 * @param userKey - User identifier for chat history
	 * @param quote - Optional quote to include in context
	 * @param prompt - Text prompt describing the SQL query
	 * @returns Stream reply response with reader and completion handler
	 */
	async generateSQL(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		return await this.generateText(userKey, quote, prompt, sqlModel);
	},

	/**
	 * Generate code using a dedicated coding model
	 * @param userKey - User identifier for chat history
	 * @param quote - Optional quote to include in context
	 * @param prompt - Text prompt describing the code
	 * @returns Stream reply response with reader and completion handler
	 */
	async generateCode(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		return await this.generateText(userKey, quote, prompt, codeModel);
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
	if (responseBody.startsWith('data: ')) {
		try {
			return JSON.parse(responseBody.split('data: ')[1])?.response || '';
		} catch {
			return '';
		}
	}
	return '';
}
