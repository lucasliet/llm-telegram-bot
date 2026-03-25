import { Context } from 'grammy';
import { ContextCompressorService } from '@/service/ContextCompressorService.ts';
import { getChatHistory, getCurrentModel, overwriteChatHistory } from '@/repository/ChatRepository.ts';
import { getServiceForCommand } from '@/util/ServiceFactory.ts';
import '@/prototype/ContextExtensionPrototype.ts';

export async function handleCompress(ctx: Context): Promise<void> {
	const userId = ctx.from?.id;
	if (!userId) {
		await ctx.reply('Não foi possível identificar o usuário.');
		return;
	}

	const userKey = `user:${userId}`;

	const typingId = ctx.startTypingIndicator();

	try {
		const currentModel = await getCurrentModel(userKey);
		const history = await getChatHistory(userKey);

		if (history.length === 0) {
			clearInterval(typingId);
			await ctx.reply('Não há histórico para comprimir. Comece uma conversa primeiro.');
			return;
		}

		const { service } = getServiceForCommand(currentModel);

		const result = await ContextCompressorService.compressHistoryForce(history, service, userKey);

		await overwriteChatHistory(userKey, result.history);

		clearInterval(typingId);

		const reduction = result.tokensBefore - result.tokensAfter;
		const reductionPercent = ((reduction / result.tokensBefore) * 100).toFixed(1);

		const sizeMessage = reduction >= 0
			? `📉 **Redução:** ${reduction.toLocaleString()} tokens (${reductionPercent}%)`
			: `📈 **Aumento:** ${Math.abs(reduction).toLocaleString()} tokens (${Math.abs(Number(reductionPercent))}%)`;

		await ctx.reply(
			`✅ Histórico comprimido com sucesso!\n\n` +
			`📊 **Antes:** ${result.tokensBefore.toLocaleString()} tokens\n` +
			`📊 **Depois:** ${result.tokensAfter.toLocaleString()} tokens\n` +
			`${sizeMessage}\n` +
			`🤖 **Modelo usado:** ${currentModel}`,
			{ parse_mode: 'Markdown' },
		);
	} catch (error) {
		clearInterval(typingId);
		console.error('[CompressHandler] Error:', error);

		const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
		await ctx.reply(`❌ Erro ao comprimir histórico: ${errorMessage}`);
	}
}
