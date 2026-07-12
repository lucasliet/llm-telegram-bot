import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

/**
 * Service for ScreenPipe free OpenAI-compatible endpoint.
 * The ScreenPipe API does not require an API key for free tier usage.
 */
export default class ScreenPipeService extends OpenAiService {
	public constructor(model: string = 'auto', supportTools = false) {
		super(
			new OpenAi({
				apiKey: '',
				baseURL: 'https://api.screenpipe.com/v1',
			}),
			model,
			supportTools,
		);
	}
}
