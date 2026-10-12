import process from 'node:process';
import OpenAi from 'openai';
import OpenAiService from './OpenAIService.ts';

const getGithubToken = () => process.env.GITHUB_TOKEN as string;

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
