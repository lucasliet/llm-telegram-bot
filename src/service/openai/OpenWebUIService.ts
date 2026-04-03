import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const getOpenwebuiApiKey = () => Deno.env.get('OPENWEBUI_API_KEY') as string;

export default class OpenWebUIService extends OpenAiService {
	public constructor(model = 'grok-3-beta-search') {
		super(
			new OpenAi({
				apiKey: getOpenwebuiApiKey(),
				baseURL: 'http://gpt.lucasliet.com.br/api',
			}),
			model,
			true,
			1000,
		);
	}
}
