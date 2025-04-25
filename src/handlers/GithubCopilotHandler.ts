import { Context } from 'grammy-context';
import { FileUtils } from '@/util/FileUtils.ts';
import GithubCopilotService from '@/service/openai/GithubCopilotService.ts';

/**
 * Handles requests for OpenRouter models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleGithubCopilot(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const message = commandMessage || contextMessage;

	const command = message?.split(':')[0]?.toLowerCase();

	const model = command === 'gpt' ? 'gpt-4.1' : 'o4-mini';

	const openAIService = new GithubCopilotService(model);

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

	const { reader, onComplete, responseMap } = await openAIService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, ''),
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
