import { Context } from 'grammy-context';
import OpenWebUIService from '@/service/openai/OpenWebUIService.ts';

import { openWebUiModels } from '@/config/models.ts';
import { FileUtils } from '../util/FileUtils.ts';

const modelMap = {
	'pgrok': openWebUiModels.grok,
	'pgpt': openWebUiModels.gpt45,
	none: undefined,
};

/**
 * Handles requests for OpenWebUI models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleOpenWebUI(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const message = commandMessage || contextMessage;

	const command = message!.split(':')[0].toLowerCase() || 'none';

	const model = modelMap[command as keyof typeof modelMap];

	const openAIService = new OpenWebUIService(model);

	if (photos && caption) {
		ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	const { reader, onComplete, responseMap } = await openAIService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, ''),
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
