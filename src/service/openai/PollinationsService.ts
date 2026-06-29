import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const IMAGE_MODEL = 'sana';

export default class PollinationsService extends OpenAiService {
	public constructor(model = 'openai') {
		super(
			new OpenAi({
				apiKey: 'anonymous',
				baseURL: 'https://text.pollinations.ai/openai',
			}),
			model,
			true,
			8000,
		);
	}

	/**
	 * Generates an image URL using the Pollinations image endpoint.
	 * @param prompt - Text prompt describing the desired image
	 * @returns Public URL that renders the generated image
	 */
	public generateImageUrl(prompt: string): string {
		const encodedPrompt = encodeURIComponent(prompt);
		const seed = Math.floor(Math.random() * 1_000_000);
		return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=720&height=1280&seed=${seed}&enhance=true&nologo=true&model=${IMAGE_MODEL}`;
	}
}
