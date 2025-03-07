import { Context } from 'https://deno.land/x/grammy@v1.17.2/context.ts';
import BlackboxaiService from '../../service/BlackboxaiService.ts';
import { blackboxModels } from '../../config/models.ts';

const { reasoningModel, reasoningModelOffline, mixtralModel,
	 	qwenModel, llamaModel, claudeModel, deepseekv3,
		geminiModel, geminiProModel, o1Model, o3MiniModel } =
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
		| 'r1off'
		| 'r1'
		| 'mixtral'
		| 'qwen'
		| 'llama'
		| 'v3'
		| 'claude'
		| 'o1'
		| 'o3mini'
		| 'gemini'
		| 'geminiPro'
		| 'image';

	const commandHandlers: Record<CommandHandlerKey, () => Promise<void>> = {
		'r1': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('r1:', ''),
				reasoningModel,
			);

			ctx.streamReply(reader, onComplete);
		},
		'r1off': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('r1off:', ''),
				reasoningModelOffline,
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
		'v3': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('v3:', ''),
				deepseekv3,
			);

			ctx.streamReply(reader, onComplete);
		},
		'claude': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('claude:', ''),
				claudeModel,
			);

			ctx.streamReply(reader, onComplete);
		},
		'o1': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('o1:', ''),
				o1Model,
			);

			ctx.streamReply(reader, onComplete);
		},
		'o3mini': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('o3mini:', ''),
				o3MiniModel,
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
		'geminiPro': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('geminiPro:', ''),
				geminiProModel,
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
