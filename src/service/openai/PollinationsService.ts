import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

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
}
