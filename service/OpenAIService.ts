import OpenAi, { toFile } from 'npm:openai';
import { getChatHistory, addContentToChatHistory } from '../repository/ChatRepository.ts';
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT, StreamReplyResponse } from '../util/ChatConfigUtil.ts';
import { perplexityModels, openAIModels } from '../config/models.ts';
import * as path from 'jsr:@std/path';

const PERPLEXITY_API_KEY: string = Deno.env.get('PERPLEXITY_API_KEY') as string;
const GITHUB_TOKEN: string = Deno.env.get('GITHUB_TOKEN') as string;

const { imageModel, gptModel, sttModel } = openAIModels;
const { textModel, reasoningModel } = perplexityModels;

export default class OpenAiService {
  private openai: OpenAi;
  private model: string;
  private maxTokens: number;  

  public constructor(command: '/openai' | '/perplexity' | '/perplexityreasoning' | '/github') {
    this.model = gptModel;
    this.openai = new OpenAi({ apiKey: PERPLEXITY_API_KEY, baseURL: 'https://api.perplexity.ai' });
    switch(command) {
      case '/openai':
        this.openai = new OpenAi();
        break;
      case '/perplexityreasoning':
        this.model = reasoningModel;
        break;
      case '/perplexity':
        this.model = textModel;
        break;
      case '/github':
        this.openai = new OpenAi({ apiKey: GITHUB_TOKEN , baseURL: 'https://models.inference.ai.azure.com' });
    }
    this.maxTokens = 1000;
  }

  async generateTextFromImage(userKey: string, quote: string = '', photosUrl: Promise<string>[], prompt: string): Promise<StreamReplyResponse>  {
    const geminiHistory = await getChatHistory(userKey);

    const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

    const urls = await Promise.all(photosUrl);

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: replaceGeminiConfigFromTone('OpenAI', this.model, this.maxTokens) },
        ...convertGeminiHistoryToGPT(geminiHistory),
        { role: 'user', content: [
          { type: 'text', text: requestPrompt },
          ...urls.map(photoUrl => ({ type: 'image_url', image_url: { url: photoUrl } } as const))
        ] }
      ],
      max_tokens: this.maxTokens,
      stream: true,
    });

    const reader = completion.toReadableStream().getReader();

    const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

    return { reader, onComplete, responseMap };
  }
  async generateText(userKey: string, quote: string = '', prompt: string): Promise<StreamReplyResponse> {
    const geminiHistory = await getChatHistory(userKey);

    const requestPrompt = quote ? `quote: "${quote}"\n\n${prompt}` : prompt;

    const completion = await this.openai.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: replaceGeminiConfigFromTone('OpenAI', this.model, this.maxTokens) },
        ...convertGeminiHistoryToGPT(geminiHistory),
        { role: 'user', content: `${requestPrompt}${this.openai.apiKey === PERPLEXITY_API_KEY ? ', indique suas fontes com seus links' : ''}` }
      ],
      max_tokens: this.maxTokens,
      stream: true,
    });

    const reader = completion.toReadableStream().getReader();

    const onComplete = (completedAnswer: string) => addContentToChatHistory(geminiHistory, quote, requestPrompt, completedAnswer, userKey);

    return { reader, onComplete, responseMap };
  }
  async generateImage(userKey: string, prompt: string, style: 'vivid' | 'natural' = 'vivid'): Promise<string[]> {
    const response = await this.openai.images.generate({
      model: imageModel,
      prompt,
      quality: 'standard',
      size: '1024x1024',
      n: 1,
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

function responseMap(responseBody: string): string {
  return JSON.parse(responseBody).choices[0]?.delta?.content || '';
}