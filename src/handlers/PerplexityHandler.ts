import { Context } from 'grammy-context';
import PerplexityService from '@/service/openai/PerplexityService.ts';

/**
 * Handles requests for Perplexity models
 * @param ctx - Telegram context
 * @param commandMessage - Optional command message override
 */
export async function handlePerplexity(
	ctx: Context,
	commandMessage?: string,
): Promise<void> {
	const { userKey, contextMessage, photos, caption, quote } = await ctx
		.extractContextKeys();

	const message = commandMessage || contextMessage;

	if (photos && caption) {
		ctx.replyWithVisionNotSupportedByModel();
		return;
	}

	const command = message!.split(':')[0]
		.replace(/^search$/si, 'perplexity')
		.replace(/^reasonSearch$/si, 'perplexityReasoning')
		.toLowerCase();

	const model = `/${command}` as '/perplexity' | '/perplexityreasoning';

	const openAIService = new PerplexityService(model);

	const { reader, onComplete, responseMap } = await openAIService.generateText(
		userKey,
		quote,
		message!.replace(`${command}:`, ''),
	);

	ctx.streamReply(reader, onComplete, responseMap);
}
