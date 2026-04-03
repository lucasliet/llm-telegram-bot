import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const getGithubToken = () => Deno.env.get('GITHUB_TOKEN') as string;

export default class GithubService extends OpenAiService {
	public constructor() {
		super(
			new OpenAi({
				apiKey: getGithubToken(),
				baseURL: 'https://models.inference.ai.azure.com',
			}),
		);
	}
}
