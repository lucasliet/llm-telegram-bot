import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const getGroqApiKey = () => Deno.env.get('GROQ_API_KEY') as string;

export default class GroqService extends OpenAiService {
	public constructor(model: string, maxTokens: number = 131072) {
		super(
			new OpenAi({
				apiKey: getGroqApiKey(),
				baseURL: 'https://api.groq.com/openai/v1',
			}),
			model,
			true,
			maxTokens,
		);
	}
}
