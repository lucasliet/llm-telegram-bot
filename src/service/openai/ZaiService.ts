import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const ZHIPU_API_KEY: string = Deno.env.get('ZHIPU_API_KEY') as string;

export default class ZaiService extends OpenAiService {
	public constructor(model = 'glm-4.7-flash') {
		super(
			new OpenAi({
				apiKey: ZHIPU_API_KEY,
				baseURL: 'https://api.z.ai/api/coding/paas/v4',
			}),
			model,
		);
	}
}
