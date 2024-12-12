import OpenAi from 'npm:openai';
import { getChatHistory, addChatToHistory } from '../repository/ChatRepository.ts';
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT } from '../util/ChatConfigUtil.ts';
import { perplexityModel, openAIModels } from '../config/models.ts';

const PERPLEXITY_API_KEY: string = Deno.env.get('PERPLEXITY_API_KEY') as string;

const { imageModel, gptModel } = openAIModels;

export default class OpenAiService {
  private openai: OpenAi;
  private textModel: string;
  private maxTokens: number;

  public constructor(command: '/gpt' | '/perplexity') {
    this.openai = command === '/perplexity' 
      ? new OpenAi({ apiKey: PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai' })
      : new OpenAi();
    this.textModel = command === '/perplexity' ? perplexityModel : gptModel ;
    this.maxTokens = command === '/perplexity'? 140 : 1000;
  }


  async generateTextResponse(userKey: string, quote: string = '', prompt: string): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const requestPrompt = quote ? `"${quote}" ${prompt}`: prompt;

    const completion = await this.openai.chat.completions.create({
      model: this.textModel,
      messages: [
        { role: 'system', content: replaceGeminiConfigFromTone('OpenAI', this.textModel, this.maxTokens) },
        ...convertGeminiHistoryToGPT(geminiHistory),
        { role: 'user', content: requestPrompt }
      ],
      max_tokens: this.maxTokens,
    });

    const responsePrompt =  completion.choices[0].message.content!;

    addChatToHistory(geminiHistory, quote, requestPrompt, responsePrompt, userKey);

    return responsePrompt;
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
