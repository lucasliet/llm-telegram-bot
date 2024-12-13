import OpenAi, { toFile } from 'npm:openai';
import { getChatHistory, addChatToHistory } from '../repository/ChatRepository.ts';
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT } from '../util/ChatConfigUtil.ts';
import { perplexityModel, openAIModels } from '../config/models.ts';
import * as path from 'jsr:@std/path';

const PERPLEXITY_API_KEY: string = Deno.env.get('PERPLEXITY_API_KEY') as string;

const { imageModel, gptModel, sttModel } = openAIModels;

export default class OpenAiService {
  private openai: OpenAi;
  private model: string;
  private maxTokens: number;  

  public constructor(command: '/gpt' | '/perplexity') {
    this.openai = command === '/perplexity' 
      ? new OpenAi({ apiKey: PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai' })
      : new OpenAi();
    this.model = command === '/perplexity' ? perplexityModel : gptModel ;
    this.maxTokens = command === '/perplexity'? 140 : 1000;
  }

  async generateTextResponseFromImage(userKey: string, quote: string = '', photosUrl: Promise<string>[], prompt: string): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const requestPrompt = quote ? `"${quote}" ${prompt}`: prompt;

    const urls = await Promise.all(photosUrl);

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: replaceGeminiConfigFromTone('OpenAI', this.model, this.maxTokens) },
        ...convertGeminiHistoryToGPT(geminiHistory),
        { role: 'user', content: [
          { type: 'text', text: requestPrompt },
          ...urls.map(photoUrl => ({ type: 'image_url', image_url: { url: photoUrl } }))
        ] }
      ],
      max_tokens: this.maxTokens,
    });

    const responsePrompt =  completion.choices[0].message.content!;

    addChatToHistory(geminiHistory, quote, requestPrompt, responsePrompt, userKey);

    return responsePrompt;
  }
  async generateTextResponse(userKey: string, quote: string = '', prompt: string): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const requestPrompt = quote ? `"${quote}" ${prompt}`: prompt;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: replaceGeminiConfigFromTone('OpenAI', this.model, this.maxTokens) },
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

  async transcribeAudio(audioFile: Promise<Uint8Array>, audioFileUrl: string): Promise<string> {
    const response = await this.openai.audio.transcriptions.create({
      file: await toFile(audioFile, path.extname(audioFileUrl)),
      model: sttModel,
    });

    return response.text; 
  }
}
