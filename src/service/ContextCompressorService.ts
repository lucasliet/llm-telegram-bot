import OpenAi from 'openai';
import { estimateTokens, shouldCompress } from '@/util/TokenEstimator.ts';

interface TextGenerationService {
	generateText(userKey: string, quote: string, prompt: string): Promise<{
		reader: ReadableStreamDefaultReader<Uint8Array>;
		responseMap?: (body: string) => string;
	}>;
}

/**
 * Service responsible for compressing conversation history
 * when it approaches the context window limit.
 */
export class ContextCompressorService {
	private static readonly COMPRESSION_PROMPT = `You are an expert context compressor. Your goal is to condense the following conversation history into a concise summary that preserves all critical information for an LLM to resume the conversation seamlessly.

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
{HISTORY}
---
Summary (in Portuguese):`;

	/**
	 * Compresses the entire conversation history into a single summary entry.
	 * Works with any service that has generateText().
	 */
	static async compressHistory(
		history: OpenAi.ChatCompletionMessageParam[],
		service: TextGenerationService,
		userKey: string,
	): Promise<OpenAi.ChatCompletionMessageParam> {
		const historyText = this.formatHistory(history);
		const prompt = this.COMPRESSION_PROMPT.replace('{HISTORY}', historyText);

		const summary = await this.readStreamResponse(service, prompt, userKey);

		return {
			role: 'assistant',
			content: `[Resumo do contexto anterior]\n${summary}`,
		};
	}

	/**
	 * Compresses the history forcefully without checking thresholds.
	 * Returns statistics about the compression.
	 */
	static async compressHistoryForce(
		history: OpenAi.ChatCompletionMessageParam[],
		service: TextGenerationService,
		userKey: string,
	): Promise<{ history: OpenAi.ChatCompletionMessageParam[]; tokensBefore: number; tokensAfter: number }> {
		const tokensBefore = estimateTokens(history);
		const compressedEntry = await this.compressHistory(history, service, userKey);
		const compressedHistory = [compressedEntry];
		const tokensAfter = estimateTokens(compressedHistory);

		return {
			history: compressedHistory,
			tokensBefore,
			tokensAfter,
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
	 * Reads a stream response and returns the full text.
	 */
	private static async readStreamResponse(
		service: TextGenerationService,
		prompt: string,
		userKey: string,
	): Promise<string> {
		const { reader, responseMap } = await service.generateText(userKey, '', prompt);

		let fullText = '';
		const decoder = new TextDecoder();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value);
			if (responseMap) {
				fullText += responseMap(chunk);
			} else {
				fullText += chunk;
			}
		}

		return fullText || 'Não foi possível gerar resumo.';
	}

	/**
	 * Checks if compression is needed and compresses if so.
	 * Uses OpenAI client directly for backward compatibility with existing code.
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

		const compressedEntry = await this.compressWithOpenAI(history, model, openai);
		return { history: [compressedEntry], didCompress: true };
	}

	/**
	 * Legacy method for backward compatibility with automatic compression.
	 */
	private static async compressWithOpenAI(
		history: OpenAi.ChatCompletionMessageParam[],
		model: string,
		openai: OpenAi,
	): Promise<OpenAi.ChatCompletionMessageParam> {
		const historyText = this.formatHistory(history);
		const prompt = this.COMPRESSION_PROMPT.replace('{HISTORY}', historyText);

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
}

export const COMPRESSION_WARNING_MSG = '⚠️ Contexto comprimido para economizar espaço.';
