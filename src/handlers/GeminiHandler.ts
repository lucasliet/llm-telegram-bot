import { Context } from 'grammy-context';
import GeminiService from '@/service/openai/GeminiService.ts';
import { FileUtils } from '@/util/FileUtils.ts';
import { geminiModel } from '@/config/models.ts';

/**
 * Handles requests for Google Gemini models
 * @param ctx - Telegram context
 */
export async function handleGemini(ctx: Context, commandMessage?: string): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const message = commandMessage || contextMessage;

	const command = message?.split(':')[0]?.toLowerCase() || 'none';

	const prompt = (message || caption)?.replace(`${command}:`, '')

	const geminiService = new GeminiService(geminiModel);

	if (photos && caption) {
		const photosUrl = FileUtils.getTelegramFilesUrl(ctx, photos);
		const { reader, onComplete, responseMap } = await geminiService.generateTextFromImage(userKey, quote, photosUrl, prompt!);
		return ctx.streamReply(reader, onComplete, responseMap);
	}

	const { reader, onComplete, responseMap } = await geminiService.generateText(userKey, quote, prompt!);
	return ctx.streamReply(reader, onComplete, responseMap);
}