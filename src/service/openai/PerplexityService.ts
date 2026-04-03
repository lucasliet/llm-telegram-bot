import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';
import { perplexityModels } from '@/config/models.ts';

const getPerplexityApiKey = () => Deno.env.get('PERPLEXITY_API_KEY') as string;
const { textModel, reasoningModel } = perplexityModels;

export default class PerplexityService extends OpenAiService {
	public constructor(command: '/perplexity' | '/perplexityreasoning') {
		super(
			new OpenAi({
				apiKey: getPerplexityApiKey(),
				baseURL: 'https://api.perplexity.ai',
			}),
			command === '/perplexityreasoning' ? reasoningModel : textModel,
			false,
			1000,
		);
	}
}
