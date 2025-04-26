import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';

export default class DuckDuckGoOpenaiAdapted extends OpenAiService {
	public constructor(model: string = 'duck-o3-mini') {
		super(
			new OpenAi({
				baseURL: 'https://llm-openai-adapter.deno.dev',
			}),
			model,
		);
	}
}
