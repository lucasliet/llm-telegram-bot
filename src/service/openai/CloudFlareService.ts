import OpenAi from 'openai';
import OpenAiService from '@/service/openai/OpenAIService.ts';
import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { cloudflareModels } from '@/config/models.ts';
import { downloadTelegramFile } from '../TelegramService.ts';
import { encodeBase64 } from 'base64';

const getCloudflareAccountId = () => Deno.env.get('CLOUDFLARE_ACCOUNT_ID') as string;
const getCloudflareApiKey = () => Deno.env.get('CLOUDFLARE_API_KEY') as string;

const { imageModel, visionTextModel, sttModel } = cloudflareModels;

const CLOUDFLARE_MAX_TOKENS = 256000;

const REQUEST_OPTIONS = {
	method: 'POST' as const,
	headers: {
		'Content-Type': 'application/json',
		'Authorization': `Bearer ${getCloudflareApiKey()}`,
	},
};

class CloudFlareService extends OpenAiService {
	constructor(
		model: string = cloudflareModels.textModel,
		maxTokens: number = CLOUDFLARE_MAX_TOKENS,
	) {
		super(
			new OpenAi({
				apiKey: getCloudflareApiKey(),
				baseURL: `https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/v1`,
			}),
			model,
			true,
			maxTokens,
		);
	}

	/**
	 * Generate text from an image using the Cloudflare-native vision endpoint.
	 * Named differently from OpenAiService.generateTextFromImage because the parameter
	 * and return types differ (single photo + string vs multiple photos + StreamReplyResponse).
	 * @param userKey - User identifier for chat history
	 * @param quote - Optional quote to include in context
	 * @param photoUrl - Promise resolving to the photo URL
	 * @param prompt - Text prompt to accompany the image
	 * @returns Generated text response
	 */
	async generateVisionText(
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
	}

	/**
	 * Generate an image using Cloudflare-native /ai/run/ endpoint.
	 * Named differently from OpenAiService.generateImage because the return type differs (Uint8Array vs string[]).
	 * @param prompt - Text prompt describing the desired image
	 * @returns Generated image as Uint8Array
	 */
	async generateImageBinary(prompt: string): Promise<Uint8Array> {
		const response = await fetch(
			`https://api.cloudflare.com/client/v4/accounts/${getCloudflareAccountId()}/ai/run/${imageModel}`,
			{
				...REQUEST_OPTIONS,
				body: JSON.stringify({ prompt }),
			},
		);

		if (!response.ok) {
			throw new Error(`Failed to generate image: ${response.statusText}}`);
		}

		const { result: { image } } = await response.json();

		return Uint8Array.from(atob(image), (m) => m.codePointAt(0)!);
	}

	/**
	 * Transcribe audio to text using Cloudflare-native /ai/run/ endpoint.
	 * @param audioFile - Promise resolving to audio file as Uint8Array
	 * @param _audioFileUrl - Unused, matches parent signature for compatibility
	 * @returns Transcribed text
	 */
	override async transcribeAudio(
		audioFile: Promise<Uint8Array>,
		_audioFileUrl?: string,
	): Promise<string> {
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
	}

	/**
	 * Convert files to Markdown format using Cloudflare /ai/tomarkdown endpoint.
	 * @param fileDataList - Array of file data with content and fileName
	 * @returns Markdown text
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
	}
}

export default CloudFlareService;
