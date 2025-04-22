import OpenAi from 'npm:openai';
import OpenAiService from './OpenAIService.ts';
import { perplexityModels } from '../../config/models.ts';

const PERPLEXITY_API_KEY: string = Deno.env.get('PERPLEXITY_API_KEY') as string;
const { textModel, reasoningModel } = perplexityModels;

export default class PerplexityService extends OpenAiService {
  public constructor(command: '/perplexity' | '/perplexityreasoning') {
    super(
      new OpenAi({
        apiKey: PERPLEXITY_API_KEY,
        baseURL: 'https://api.perplexity.ai',
      }),
      command === '/perplexityreasoning' ? reasoningModel : textModel,
      1000,
    );
  }
}