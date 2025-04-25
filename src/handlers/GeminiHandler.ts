import { Context } from 'grammy-context';
import { PhotoSize } from 'grammy-types';
import { ApiKeyNotFoundError } from '@/error/ApiKeyNotFoundError.ts';
import GeminiService from '@/service/GeminiService.ts';
import { setUserGeminiApiKeysIfAbsent } from '@/repository/ChatRepository.ts';
import { FileUtils } from '@/util/FileUtils.ts';

/**
 * Handles requests for Google Gemini models
 * @param ctx - Telegram context
 */
export async function handleGemini(ctx: Context): Promise<void> {
	const { userKey, contextMessage: message, photos, caption, quote } = await ctx
		.extractContextKeys();

	if (await setUserGeminiApiKeysIfAbsent(userKey, message)) {
		ctx.reply('Chave API do Gemini salva com sucesso!', {
			reply_to_message_id: ctx.message?.message_id,
		});
		return;
	}

	try {
		const geminiService = await GeminiService.of(userKey);
		const outputMessage = await getGeminiOutput(
			geminiService,
			ctx,
			message,
			quote,
			photos,
			caption,
		);
		ctx.replyInChunks(outputMessage);
	} catch (err) {
		if (err instanceof ApiKeyNotFoundError) {
			ctx.reply(
				'Você precisa me enviar a chave API do Gemini para usar este bot, ex: `key:123456`, para conseguir a chave acesse https://aistudio.google.com/app/apikey?hl=pt-br',
				{ reply_to_message_id: ctx.message?.message_id },
			);
			return;
		}
		throw err;
	}
}

/**
 * Gets output from Gemini service based on input type
 * @param geminiService - The Gemini service instance
 * @param ctx - Telegram context
 * @param message - Text message
 * @param quote - Optional quoted message text
 * @param photos - Optional photos from the message
 * @param caption - Optional caption for photos
 * @returns Generated text response
 */
async function getGeminiOutput(
	geminiService: GeminiService,
	ctx: Context,
	message: string | undefined,
	quote: string | undefined,
	photos: PhotoSize[] | undefined,
	caption: string | undefined,
): Promise<string> {
	if (message) {
		return await geminiService.sendTextMessage(quote, message);
	} else if (photos && caption) {
		const photosUrl = FileUtils.getTelegramFilesUrl(ctx, photos);
		return await geminiService.sendPhotoMessage(quote, photosUrl, caption);
	} else {
		return 'Não entendi o que você quer, me envie uma mensagem de texto ou foto com legenda.';
	}
}
