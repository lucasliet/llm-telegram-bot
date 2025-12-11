import { Context } from 'grammy-context';
import VertexAiService from '@/service/openai/VertexAiService.ts';
import { FileUtils } from '@/util/FileUtils.ts';
import { geminiModels } from '@/config/models.ts';

const modelMap = {
  'geminiPro': geminiModels.geminiPro,
  'gemini': geminiModels.geminiFlash,
  none: undefined,
};

/**
 * Handles requests for Vertex AI models
 * @param ctx - Telegram context
 */
export async function handleVertex(ctx: Context, commandMessage?: string): Promise<void> {
  const { userKey, contextMessage, photos, caption, quote } = await ctx
    .extractContextKeys();

  const message = commandMessage || contextMessage;

  const command = message?.split(':')[0]?.toLowerCase() || 'none';

  const model = modelMap[command as keyof typeof modelMap];

  const prompt = (message || caption)?.replace(`${command}:`, '');

  const vertexService = new VertexAiService(model);

  if (photos && caption) {
    const photosUrl = FileUtils.getTelegramFilesUrl(ctx, photos);
    const { reader, onComplete, responseMap } = await vertexService.generateTextFromImage(userKey, quote, photosUrl, prompt!);
    return ctx.streamReply(reader, onComplete, responseMap);
  }

  const { reader, onComplete, responseMap } = await vertexService.generateText(userKey, quote, prompt!);
  return ctx.streamReply(reader, onComplete, responseMap);
}
