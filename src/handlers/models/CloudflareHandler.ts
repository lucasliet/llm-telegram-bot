import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import { InputFile } from 'https://deno.land/x/grammy@v1.17.2/types.deno.ts';
import CloudFlareService from '../../service/CloudFlareService.ts';
import { FileUtils } from '../../util/FileUtils.ts';

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

	if (photos && caption) {
		const photoUrl = FileUtils.getTelegramFilesUrl(ctx, photos)[0];
		const output = await CloudFlareService.generateTextFromImage(
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

	if (cloudflareCommand === 'llama') {
		const { reader, onComplete, responseMap } = await CloudFlareService
			.generateText(
				userKey,
				quote,
				message!.replace('llama:', ''),
			);

		ctx.streamReply(reader, onComplete, responseMap);
	} else if (cloudflareCommand === 'sql') {
		const { reader, onComplete, responseMap } = await CloudFlareService
			.generateSQL(
				userKey,
				quote,
				message!.replace('sql:', ''),
			);

		ctx.streamReply(reader, onComplete, responseMap);
	} else if (cloudflareCommand === 'code') {
		const { reader, onComplete, responseMap } = await CloudFlareService
			.generateCode(
				userKey,
				quote,
				message!.replace('code:', ''),
			);

		ctx.streamReply(reader, onComplete, responseMap);
	} else if (cloudflareCommand === 'cloudflareimage' || cloudflareCommand === 'image') {
		ctx.replyWithPhoto(
			new InputFile(
				await CloudFlareService.generateImage(message!),
				'image/png',
			),
			{ reply_to_message_id: ctx.message?.message_id },
		);
	}
}
