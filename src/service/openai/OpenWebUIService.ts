import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';

const OPENWEBUI_API_KEY: string = Deno.env.get('OPENWEBUI_API_KEY') as string;

export default class OpenWebUIService extends OpenAiService {
	public constructor(model = 'grok-3-beta-search') {
		super(
			new OpenAi({
				apiKey: OPENWEBUI_API_KEY,
				baseURL: 'http://gpt.lucasliet.com.br/api',
			}),
			model,
			true,
			1000,
		);
	}
}
