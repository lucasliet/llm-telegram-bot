import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';

const GITHUB_TOKEN: string = Deno.env.get('GITHUB_TOKEN') as string;

export default class GithubService extends OpenAiService {
  public constructor() {
    super(
      new OpenAi({
        apiKey: GITHUB_TOKEN,
        baseURL: 'https://models.inference.ai.azure.com',
      }),
    );
  }
}