import { Context } from 'grammy';
import ArtaService from '@/service/ArtaService.ts';

/**
 * Handles image generation requests for Arta
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleArta(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { contextMessage } = await ctx.extractContextKeys();
	const message = commandMessage || contextMessage;
	const prompt = message?.replace(/^artaImage:/i, '').trim();
	if (!prompt) return;

	ctx.chatAction = 'upload_photo';
	const imageUrl = await ArtaService.generateImage(prompt);
	await ctx.replyWithPhoto(imageUrl);
}
