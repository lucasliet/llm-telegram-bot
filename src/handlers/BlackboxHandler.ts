import { Context } from 'grammy-context';
import BlackboxaiService from '@/service/BlackboxaiService.ts';
import { blackboxModels } from '@/config/models.ts';
import { textToSpeech } from '@/service/TelegramService.ts';
import ToolService from '../service/ToolService.ts';

const modelMap = {
	'black': blackboxModels.gptOnline,
	'gptonline': blackboxModels.gptOnline,
	'r1online': blackboxModels.reasoningModelOnline,
	'r1': blackboxModels.reasoningModel,
	'mixtral': blackboxModels.mixtralModel,
	'qwen': blackboxModels.qwenModel,
	'llama': blackboxModels.llamaModel,
	'claude': blackboxModels.claudeModel,
	'v3': blackboxModels.deepseekv3,
	'gemini': blackboxModels.geminiModel,
	'geminipro': blackboxModels.geminiProModel,
	'gpt': blackboxModels.gptModel,
	'o1': blackboxModels.o1Model,
	'o3mini': blackboxModels.o3MiniModel,
	'o3high': blackboxModels.o3miniHigh,
	'gpt45': blackboxModels.gpt45Preview,
	'grok': blackboxModels.grok3Beta,
};

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
	if (!message) {
		console.error('Error: Message is null or undefined in handleBlackbox');
		ctx.reply('Sorry, I could not process your request.');
		return;
	}

	const command = message.split(':')[0].toLowerCase();
	const prompt = message!.replace(`${command}:`, '');

	if (command === 'image') {
		const imageUrl = await BlackboxaiService.generateImage(prompt);
		ctx.replyWithPhoto(imageUrl, {
			reply_to_message_id: ctx.message?.message_id,
		});
		return;
	}

	if (command === 'fala') {
		const { reader, onComplete } = await BlackboxaiService.generateText(
			userKey,
			quote,
			'max_token limit this answer to 500 characters, it will be converted to limited voice message: ' +
			prompt,
			blackboxModels.gptModel,
		);

		const fullText = (await reader.text()).removeThinkingChatCompletion();
		if (onComplete) await onComplete(fullText);
		textToSpeech(ctx, fullText);
		return;
	}

	const model = modelMap[command as keyof typeof modelMap] || blackboxModels.gptOnline;

	const { reader, onComplete } = await BlackboxaiService.generateText(
		userKey,
		quote,
		prompt,
		model,
		ToolService.schemas,
	);
	ctx.streamReply(reader, onComplete);
}