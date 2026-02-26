import OpenAi from 'openai';
import { estimateTokens, shouldCompress } from '@/util/TokenEstimator.ts';

/**
 * Service responsible for compressing conversation history
 * when it approaches the context window limit.
 */
export class ContextCompressorService {
	/**
	 * Compresses the entire conversation history into a single summary entry.
	 * Uses an LLM to extract only essential information.
	 */
	static async compressHistory(
		history: OpenAi.ChatCompletionMessageParam[],
		model: string,
		openai: OpenAi,
	): Promise<OpenAi.ChatCompletionMessageParam> {
		const historyText = this.formatHistory(history);
		const prompt = `You are an expert context compressor. Your goal is to condense the following conversation history into a concise summary that preserves all critical information for an LLM to resume the conversation seamlessly.

Instructions:
1. Analyze the conversation history below.
2. Extract and preserve:
    - User preferences, personal details, and name (if mentioned).
    - Key decisions, agreed-upon plans, and established constraints.
    - Technical context: important code snippets (keep distinct), file paths, error messages, and configuration details.
    - Open questions, pending tasks, and unresolved issues.
3. Discard:
    - Phratic communication (greetings, small talk).
    - Redundant acknowledgments (e.g., "Okay", "I understand").
    - Resolved intermediate steps that are no longer relevant to the outcome.
4. Output the summary in Portuguese (pt-BR).
5. Use a structured format with bullet points.

---
Conversation History:
${historyText}
---
Summary (in Portuguese):`;

		const response = await openai.chat.completions.create({
			model,
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 2000,
			temperature: 0,
		});

		const summary = response.choices[0]?.message?.content || historyText.substring(0, 4000);

		return {
			role: 'assistant',
			content: `[Resumo do contexto anterior]\n${summary}`,
		};
	}

	/**
	 * Formats the history array into a readable text format for compression.
	 */
	private static formatHistory(history: OpenAi.ChatCompletionMessageParam[]): string {
		return history
			.map((msg) => `${msg.role}: ${typeof msg.content === 'string' ? msg.content : ''}`)
			.join('\n\n');
	}

	/**
	 * Checks if compression is needed and compresses if so.
	 * @returns Object containing the (possibly compressed) history and a boolean indicating if compression occurred.
	 */
	static async compressIfNeeded(
		history: OpenAi.ChatCompletionMessageParam[],
		maxTokens: number,
		model: string,
		openai: OpenAi,
	): Promise<{ history: OpenAi.ChatCompletionMessageParam[]; didCompress: boolean }> {
		const historyTokens = estimateTokens(history);
		if (!shouldCompress(historyTokens, maxTokens)) {
			return { history, didCompress: false };
		}
		console.log(`[ContextCompressorService] Context exceeds 80% limit (${historyTokens}/${maxTokens}), compressing...`);
		const compressedEntry = await this.compressHistory(history, model, openai);
		return { history: [compressedEntry], didCompress: true };
	}
}

export const COMPRESSION_WARNING_MSG = '⚠️ Contexto comprimido para economizar espaço.';
