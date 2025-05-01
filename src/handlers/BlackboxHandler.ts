import { Context } from 'grammy-context';
import BlackboxaiService from '@/service/BlackboxaiService.ts';
import { blackboxModels } from '@/config/models.ts';
import { textToSpeech } from '@/service/TelegramService.ts';

const {
	gptOnline,
	reasoningModelOnline,
	reasoningModel,
	mixtralModel,
	qwenModel,
	llamaModel,
	claudeModel,
	deepseekv3,
	geminiModel,
	geminiProModel,
	gptModel,
	o1Model,
	o3MiniModel,
	o3miniHigh,
	gpt45Preview,
	grok3Beta,
} = blackboxModels;

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
		| 'black'
		| 'gptonline'
		| 'r1online'
		| 'r1'
		| 'mixtral'
		| 'qwen'
		| 'llama'
		| 'v3'
		| 'claude'
		| 'o1'
		| 'o3mini'
		| 'o3high'
		| 'gpt45'
		| 'grok'
		| 'gemini'
		| 'geminipro'
		| 'image'
		| 'fala';

	const commandHandlers: Record<CommandHandlerKey, () => Promise<void>> = {
		'black': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('black:', ''),
				gptOnline,
			);

			ctx.streamReply(reader, onComplete);
		},
		'gptonline': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('gptonline:', ''),
				gptOnline,
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
		'r1online': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('r1online:', ''),
				reasoningModelOnline,
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
		'fala': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				'max_token limit this answer to 500 characters, it will be converted to limited voice message: ' +
					message!.replace('fala:', ''),
				gptModel,
			);

			const fullText = (await reader.text())
				.removeThinkingChatCompletion();

			if (onComplete) await onComplete(fullText);

			textToSpeech(ctx, fullText);
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
		'o3high': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('o3high:', ''),
				o3miniHigh,
			);

			ctx.streamReply(reader, onComplete);
		},
		'gpt45': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('gpt45:', ''),
				gpt45Preview,
			);
			ctx.streamReply(reader, onComplete);
		},
		'grok': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('grok:', ''),
				grok3Beta,
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
		'geminipro': async () => {
			const { reader, onComplete } = await BlackboxaiService.generateText(
				userKey,
				quote,
				message!.replace('geminipro:', ''),
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