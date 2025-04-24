import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { FileUtils } from '../../util/FileUtils.ts';
import OpenrouterService from '../../service/openai/OpenrouterService.ts';

/**
 * Handles requests for OpenRouter models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleOpenRouter(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const message = commandMessage || contextMessage;

	const openAIService = new OpenrouterService();

	if (photos && caption) {
		const photosUrl = FileUtils.getTelegramFilesUrl(ctx, photos);
		const { reader, onComplete, responseMap } = await openAIService
			.generateTextFromImage(
				userKey,
				quote,
				photosUrl,
				caption,
			);

		ctx.streamReply(reader, onComplete, responseMap);
		return;
	}

	const command = message!.split(':')[0].toLowerCase();

	const { reader, onComplete, responseMap } = await openAIService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, ''),
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
