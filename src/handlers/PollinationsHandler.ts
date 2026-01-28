import { Context } from 'grammy-context';
import PollinationsService from '@/service/PollinationsService.ts';
import { pollinationsModels } from '@/config/models.ts';

const modelMap = {
	'polli': pollinationsModels.openai,
	'pollireasoning': pollinationsModels.reasoning,
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

	if (command === 'polliimage') {
		const imageUrl = await PollinationsService.generateImage(prompt);
		await ctx.replyWithPhoto(imageUrl);
		return;
	}

	const model = modelMap[command as keyof typeof modelMap];

	const { reader, onComplete, responseMap } = await PollinationsService.generateText(
		userKey,
		quote ?? '',
		prompt,
		model,
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
