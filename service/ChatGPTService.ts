import OpenAi from 'npm:openai';
import { getChatHistory } from '../repository/ChatRepository.ts';
import { replaceGeminiConfigFromTone, convertGeminiHistoryToGPT } from '../util/ChatConfigUtil.ts';

const gptModel = 'gpt-4o-mini';
const imageModel = 'dall-e-2';
const gptMaxTokens = 1000;
const openai = new OpenAi();

export default {
  async generateTextResponse(userKey: string, quote: string = '', prompt: string, model: string = gptModel): Promise<string> {
    const geminiHistory = await getChatHistory(userKey);

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: replaceGeminiConfigFromTone('chatGPT', model, gptMaxTokens) },
        ...convertGeminiHistoryToGPT(geminiHistory),
        { role: 'user', content: `"${quote}" ${prompt}` }
      ],
      max_tokens: gptMaxTokens,
    });

    return completion.choices[0].message.content!;
  },
  async generateImageResponse(userKey: string, prompt: string, style: "vivid" | "natural" = 'vivid'): Promise<string[]> {
    const response = await openai.images.generate({
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