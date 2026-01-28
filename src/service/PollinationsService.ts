import { addContentToChatHistory, getChatHistory } from '@/repository/ChatRepository.ts';
import { convertGeminiHistoryToGPT, getSystemPrompt, StreamReplyResponse } from '@/util/ChatConfigUtil.ts';
import { OpenAI } from 'npm:openai';
import { pollinationsModels } from '@/config/models.ts';

const { openai } = pollinationsModels;

/**
 * Service for interacting with Pollinations AI models
 */
export default class PollinationsService {
	private readonly headers = {
		'Content-Type': 'application/json',
	};

	private readonly maxTokens = 8000;

	private readonly model: string;

	/**
	 * Creates an instance of PollinationsService.
	 * @param model - The model to use for generation
	 */
	constructor(model: string = openai) {
		this.model = model;
	}

	/**
	 * Generates text using the Pollinations AI model.
	 * @param userKey - Unique key for the user
	 * @param quote - Optional quote to include in the prompt
	 * @param prompt - The user prompt
	 * @returns A promise that resolves to a StreamReplyResponse
	 */
	async generateText(
		userKey: string,
		quote: string = '',
		prompt: string,
	): Promise<StreamReplyResponse> {
		const geminiHistory = await getChatHistory(userKey);

		const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

		const messages: OpenAI.ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: getSystemPrompt('Pollinations', this.model, this.maxTokens),
			},
			...convertGeminiHistoryToGPT(geminiHistory),
			{ role: 'user', content: requestPrompt },
		];

		const apiResponse = await this.fetchResponse(messages);

		if (!apiResponse.ok) {
			const errorBody = await apiResponse.text().catch(() => '');
			throw new Error(`Failed to generate text: ${apiResponse.statusText} ${errorBody}`);
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
	}

	/**
	 * Generates an image URL using the Pollinations AI model.
	 * @param prompt - The image description prompt
	 * @returns A promise that resolves to the image URL
	 */
	generateImage(prompt: string): string {
		const encodedPrompt = encodeURIComponent(prompt);
		const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=720&height=1280&seed=${Math.floor(Math.random() * 1000000)}
&enhance=true&nologo=true&model=flux`;

		return url;
	}

	/**
	 * Fetches response from the Pollinations API.
	 * @param messages - Messages to send to the API
	 * @returns The API response
	 */
	private fetchResponse(messages: OpenAI.ChatCompletionMessageParam[]) {
		return fetch('https://text.pollinations.ai/openai', {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify({
				messages,
				model: this.model,
				stream: true,
			}),
		});
	}
}

/**
 * Maps the raw response body from Pollinations to a string content.
 * @param responseBody - The raw response string
 * @returns The extracted content
 */
function responseMap(responseBody: string): string {
	const lines = responseBody.split('\n');
	let result = '';

	for (const line of lines) {
		if (line.startsWith('data: ')) {
			try {
				const content = JSON.parse(line.substring(6)).choices[0].delta.content;
				if (content) {
					result += content;
				}
			} catch {
				continue;
			}
		}
	}

	return result;
}
