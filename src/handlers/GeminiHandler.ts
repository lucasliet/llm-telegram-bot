import { Context } from 'grammy-context';
import GeminiService from '@/service/openai/GeminiService.ts';
import { FileUtils } from '@/util/FileUtils.ts';
import { geminiModels } from '@/config/models.ts';

const modelMap = {
	'geminiPro': geminiModels.geminiPro,
	'gemini': geminiModels.geminiFlash,
	none: undefined,
};

/**
 * Handles requests for Google Gemini models
 * @param ctx - Telegram context
 */
export async function handleGemini(ctx: Context, commandMessage?: string): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const message = commandMessage || contextMessage;

	const command = message?.split(':')[0]?.toLowerCase() || 'none';
	
	const model = modelMap[command as keyof typeof modelMap];

	const prompt = (message || caption)?.replace(`${command}:`, '')

	const geminiService = new GeminiService(model);

	if (photos && caption) {
		const photosUrl = FileUtils.getTelegramFilesUrl(ctx, photos);
		const { reader, onComplete, responseMap } = await geminiService.generateTextFromImage(userKey, quote, photosUrl, prompt!);
		return ctx.streamReply(reader, onComplete, responseMap);
	}

	const { reader, onComplete, responseMap } = await geminiService.generateText(userKey, quote, prompt!);
	return ctx.streamReply(reader, onComplete, responseMap);
}