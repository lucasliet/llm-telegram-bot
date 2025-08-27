import { Context } from 'grammy-context';
import isouService from '@/service/IsouService.ts';

/**
 * Handles requests for Isou models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleIsou(
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

	const { reader, onComplete, responseMap } = await isouService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, ''),
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
