import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { InputMediaBuilder } from 'https://deno.land/x/grammy@v1.17.2/mod.ts';
import OpenAiService from '../../service/openai/OpenAIService.ts';
import { FileUtils } from '../../util/FileUtils.ts';
import GithubService from '../../service/openai/GithubService.ts';

/**
 * Handles requests for OpenAI models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleOpenAI(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();
	const openAIService = new OpenAiService();

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

	const message = commandMessage || contextMessage;
	const command = message!.split(':')[0].toLowerCase();

	if (command === 'gpt') {
		const { reader, onComplete, responseMap } = await new GithubService().generateText(
			userKey,
			quote,
			message!.replace('gpt:', ''),
		);

		ctx.streamReply(reader, onComplete, responseMap);
	} else if (command === 'gptimage') {
		const output = await openAIService.generateImage(
			userKey,
			message!.replace('gptImage:', ''),
		);
		const mediaUrls = output.map((imageUrl) => InputMediaBuilder.photo(imageUrl));
		ctx.replyWithMediaGroup(mediaUrls, {
			reply_to_message_id: ctx.message?.message_id,
		});
	}
}
