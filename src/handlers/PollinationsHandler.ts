import { Context } from 'grammy-context';
import PollinationsService from '@/service/PollinationsService.ts';

import { pollinationsModels } from '@/config/models.ts';

const modelMap = {
	'pollinations': pollinationsModels.openai,
	'pollinationsReasoning': pollinationsModels.reasoning,
	none: undefined,
};

/**
 * Handles requests for Pollinations models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handlePollinations(
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

	const command = message?.split(':')[0]?.toLowerCase() || 'none';
	const model = modelMap[command as keyof typeof modelMap];

	const { reader, onComplete, responseMap } = await PollinationsService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, ''),
		model,
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
