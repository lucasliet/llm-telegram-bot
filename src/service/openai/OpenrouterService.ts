import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const getOpenrouterApiKey = () => Deno.env.get('OPENROUTER_API_KEY') as string;

export default class OpenrouterService extends OpenAiService {
	public constructor(model: string = 'openrouter/free', supportTools = false) {
		super(
			new OpenAi({
				apiKey: getOpenrouterApiKey(),
				baseURL: 'https://openrouter.ai/api/v1',
			}),
			model,
			supportTools,
		);
	}
}
