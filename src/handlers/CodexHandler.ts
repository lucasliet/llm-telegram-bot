import { Context } from 'grammy-context';
import CodexService from '@/service/openai/responses/CodexService.ts';

/**
 * Handles requests for Codex models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command override
 */
export async function handleCodex(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

	const message = commandMessage || contextMessage;

	if (photos && caption) {
		await ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	const command = message?.split(':')[0]?.toLowerCase() || 'codex';

	const text = message!.replace(`${command}:`, '');

	const service = new CodexService();

	const { reader, onComplete, responseMap } = await service.generateText(
		userKey,
		quote,
		text,
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
