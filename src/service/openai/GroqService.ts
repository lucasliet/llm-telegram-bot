import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const GROQ_API_KEY: string = Deno.env.get('GROQ_API_KEY') as string;

export default class GroqService extends OpenAiService {
	public constructor(model: string, maxTokens: number = 131072) {
		super(
			new OpenAi({
				apiKey: GROQ_API_KEY,
				baseURL: 'https://api.groq.com/openai/v1',
			}),
			model,
			true,
			maxTokens,
		);
	}
}
