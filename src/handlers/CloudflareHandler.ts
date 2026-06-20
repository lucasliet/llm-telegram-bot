import { Context } from 'grammy';
import { InputFile } from 'grammy-types';
import CloudFlareService from '@/service/openai/CloudFlareService.ts';
import { FileUtils } from '@/util/FileUtils.ts';

/**
 * Handles requests for Cloudflare models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleCloudflare(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const service = new CloudFlareService();

	if (photos && caption) {
		const photoUrl = FileUtils.getTelegramFilesUrl(ctx, photos)[0];
		const output = await service.generateVisionText(
			userKey,
			quote,
			photoUrl,
			caption,
		);
		ctx.replyInChunks(output);
		return;
	}

	const message = commandMessage || contextMessage;
	const cloudflareCommand = message!.split(':')[0].toLowerCase();

	if (cloudflareCommand === 'kimi') {
		const prompt = message!.replace(/^kimi:\s*/i, '');
		const response = await service.generateText(
			userKey,
			quote,
			prompt,
		);

		ctx.streamReply(response);
		return;
	}

	if (cloudflareCommand === 'cloudflareimage' || cloudflareCommand === 'image') {
		ctx.chatAction = 'upload_photo';
		ctx.replyWithPhoto(
			new InputFile(
				await service.generateImageBinary(message!),
				'image/png',
			),
			{ reply_to_message_id: ctx.message?.message_id },
		);
	}
}
