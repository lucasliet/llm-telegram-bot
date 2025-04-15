import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import duckDuckGoService from '../../service/DuckDuckGoService.ts';

/**
 * Handles requests for OpenRouter models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleDuckDuckGo(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const message = commandMessage || contextMessage;

	if (photos && caption) {
		ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	const command = message!.split(':')[0].toLowerCase();

	const { reader, onComplete, responseMap } = await duckDuckGoService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, '')
	);

	ctx.streamReply(reader, onComplete, responseMap);
}