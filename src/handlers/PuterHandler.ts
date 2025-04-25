import { Context } from 'grammy-context';
import PuterService from '@/service/PuterService.ts';

/**
 * Handles requests for Puter's Claude models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handlePuter(
	ctx: Context,
	_?: string,
): Promise<void> {
	const { userKey, contextMessage: message, photos, caption, quote } = await ctx
		.extractContextKeys();

	if (photos && caption) {
		ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	const puterCommand = message!.split(':')[0].toLowerCase();
	const { reader, onComplete, responseMap } = await PuterService.generateText(
		userKey,
		quote,
		message!.replace(puterCommand + ':', ''),
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
