import { Context } from 'grammy-context';
import { PhindService } from '@/service/PhindService.ts';

/**
 * Handles requests for Phind models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handlePhind(
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

	const phindService = new PhindService();

	const command = message!.split(':')[0].toLowerCase();

	const { reader, onComplete, responseMap } = await phindService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, ''),
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
