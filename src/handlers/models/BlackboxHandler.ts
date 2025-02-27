import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import BlackboxaiService from '../../service/BlackboxaiService.ts';
import { blackboxModels } from '../../config/models.ts';

const { reasoningModel, geminiModel, mixtralModel, qwenModel, llamaModel } =
	blackboxModels;

/**
 * Handles requests for Blackbox AI models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handleBlackbox(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	if (photos && caption) {
		ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	const message = commandMessage || contextMessage;
	const blackBoxCommand = message!.split(':')[0].toLowerCase();

	type CommandHandlerKey =
		| 'v3'
		| 'blackbox'
		| 'r1'
		| 'gemini'
		| 'mixtral'
		| 'qwen'
		| 'llama'
		| 'image';

	const commandHandlers: Record<CommandHandlerKey, () => Promise<void>> = {
		'v3': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace(/^(blackbox|v3):/, ''),
			);

			ctx.streamReply(reader, onComplete);
		},
		'blackbox': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace(/^(blackbox|v3):/, ''),
			);

			ctx.streamReply(reader, onComplete);
		},
		'r1': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('r1:', ''),
				reasoningModel,
			);

			ctx.streamReply(reader, onComplete);
		},
		'gemini': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('gemini:', ''),
				geminiModel,
			);

			ctx.streamReply(reader, onComplete);
		},
		'mixtral': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('mixtral:', ''),
				mixtralModel,
			);

			ctx.streamReply(reader, onComplete);
		},
		'qwen': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('qwen:', ''),
				qwenModel,
			);

			ctx.streamReply(reader, onComplete);
		},
		'llama': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('llama:', ''),
				llamaModel,
			);

			ctx.streamReply(reader, onComplete);
		},
		'image': async () => {
			const imageUrl = await BlackboxaiService.generateImage(
				message!.replace('image:', ''),
			);
			ctx.replyWithPhoto(imageUrl, {
				reply_to_message_id: ctx.message?.message_id,
			});
		},
	};

	const handler = commandHandlers[blackBoxCommand as CommandHandlerKey];

	if (handler) {
		await handler();
	}
}
