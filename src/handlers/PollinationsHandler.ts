import { Context } from 'grammy';
import PollinationsService from '@/service/PollinationsService.ts';
import { pollinationsModels } from '@/config/models.ts';

const modelMap = {
	'polli': pollinationsModels.openai,
};

/**
 * Handles requests for Pollinations models (text and image generation)
 */
export async function handlePollinations(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx.extractContextKeys();

	const message = commandMessage || contextMessage;

	if (photos && caption) {
		ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	const command = message?.split(':')[0]?.toLowerCase() || 'none';
	const prompt = message!.replace(`${command}:`, '');

	const model = modelMap[command as keyof typeof modelMap];
	const service = new PollinationsService(model);

	if (command === 'polliimage') {
		ctx.chatAction = 'upload_photo';
		const imageUrl = await service.generateImage(prompt);
		await ctx.replyWithPhoto(imageUrl);
		return;
	}

	const { reader, onComplete, responseMap } = await service.generateText(
		userKey,
		quote ?? '',
		prompt,
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
