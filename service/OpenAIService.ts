import OpenAi from 'npm:openai';
import { getChatHistory } from '../repository/ChatRepository.ts';
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT } from '../util/ChatConfigUtil.ts';

const gptModel = 'gpt-4o-mini';
const perplexityModel = 'llama-3.1-sonar-small-128k-online';
const imageModel = 'dall-e-2';
const gptMaxTokens = 1000;

const PERPLEXITY_API_KEY: string = Deno.env.get('PERPLEXITY_API_KEY') as string;

export default class OpenAiService {
  private openai: OpenAi;
  private textModel: string;

  public constructor(command: '/gpt' | '/perplexity') {
    this.openai = command === '/perplexity' 
      ? new OpenAi({ apiKey: PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai' })
      : new OpenAi();
    this.textModel = command === '/perplexity' ? perplexityModel : gptModel ;
  }


  async generateTextResponse(userKey: string, quote: string = '', prompt: string): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const completion = await this.openai.chat.completions.create({
      model: this.textModel,
      messages: [
        { role: 'system', content: replaceGeminiConfigFromTone('OpenAI', this.textModel, gptMaxTokens) },
        ...convertGeminiHistoryToGPT(geminiHistory),
        { role: 'user', content: `"${quote}" ${prompt}` }
      ],
      max_tokens: gptMaxTokens,
    });

    return completion.choices[0].message.content!;
  }
  async generateImageResponse(userKey: string, prompt: string, style: 'vivid' | 'natural' = 'vivid'): Promise<string[]> {
    const response = await this.openai.images.generate({
      model: imageModel,
      prompt,
      quality: 'standard',
      size: '512x512',
      n: 3,
      response_format: 'url',
      user: userKey, 
      style
    })

    const imageUrls = response.data.map((image: OpenAi.Images.Image) => image.url!);
    console.log('dall-e generated images: ', imageUrls);

    return imageUrls;
  }
}
