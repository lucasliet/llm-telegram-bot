import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';
import { openRouterModels } from '@/config/models.ts';

const getOpenrouterApiKey = () => Deno.env.get('OPENROUTER_API_KEY') as string;

export default class OpenrouterService extends OpenAiService {
	public constructor(model: keyof typeof openRouterModels = 'llamaModel', supportTools = false) {
		super(
			new OpenAi({
				apiKey: getOpenrouterApiKey(),
				baseURL: 'https://openrouter.ai/api/v1',
			}),
			openRouterModels[model],
			supportTools,
		);
	}
}
