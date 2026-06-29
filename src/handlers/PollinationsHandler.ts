import { Context } from 'grammy';
import PollinationsService from '@/service/openai/PollinationsService.ts';
import { pollinationsModels } from '@/config/models.ts';

const modelMap = {
	'polli': pollinationsModels.default,
};

/**
 * Handles requests for Pollinations text models and image generation
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handlePollinations(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

	const message = commandMessage || contextMessage;
	const command = message?.split(':')[0]?.toLowerCase() || 'polli';
	const prompt = message!.replace(`${command}:`, '').trim();

	if (photos && caption) {
		ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	if (command === 'image') {
		ctx.chatAction = 'upload_photo';
		const imageUrl = new PollinationsService().generateImageUrl(prompt);
		await ctx.replyWithPhoto(imageUrl, { reply_to_message_id: ctx.message?.message_id });
		return;
	}

	const model = modelMap[command as keyof typeof modelMap] ?? pollinationsModels.default;
	const service = new PollinationsService(model);
	const response = await service.generateText(userKey, quote ?? '', prompt);
	ctx.streamReply(response);
}
