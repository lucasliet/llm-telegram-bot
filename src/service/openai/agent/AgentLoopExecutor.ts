import ToolService from '@/service/ToolService.ts';
import OpenAi from 'openai';
import { AgentLoopConfig, AgentLoopState, DEFAULT_AGENT_CONFIG, ToolExecutionResult } from './AgentLoopConfig.ts';
import { ExtractedToolCall, StreamProcessor } from '../stream/StreamProcessor.ts';
import { estimateTokens, shouldCompress } from '@/util/TokenEstimator.ts';

/**
 * Executor for the Agent Loop.
 * Orchestrates the iterative execution of tool calls until the model returns a final response.
 *
 * @template TMessage - Type of messages/input items (ChatCompletionMessageParam or ResponseInputItem)
 * @template TGenerateArgs - Additional arguments for the generate function
 */
export class AgentLoopExecutor<TMessage, TGenerateArgs extends unknown[]> {
	private config: AgentLoopConfig;
	private streamProcessor: StreamProcessor;
	private generateFn: (
		messages: TMessage[],
		...args: TGenerateArgs
	) => Promise<ReadableStreamDefaultReader<Uint8Array>>;
	private formatAsOpenAI: boolean;
	private openai: OpenAi;
	private userQuery: string;
	private model: string;
	private maxTokens: number;

	constructor(
		streamProcessor: StreamProcessor,
		generateFn: (
			messages: TMessage[],
			...args: TGenerateArgs
		) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
		openai: OpenAi,
		model: string,
		maxTokens: number,
		userQuery: string,
		config: Partial<AgentLoopConfig> = {},
		formatAsOpenAI = true,
	) {
		this.config = { ...DEFAULT_AGENT_CONFIG, ...config };
		this.streamProcessor = streamProcessor;
		this.generateFn = generateFn;
		this.formatAsOpenAI = formatAsOpenAI;
		this.openai = openai;
		this.model = model;
		this.maxTokens = maxTokens;
		this.userQuery = userQuery;
	}

	/**
	 * Execute the agent loop.
	 * @param initialReader - Reader from the first API call
	 * @param messages - Conversation messages/input items
	 * @param generateArgs - Additional arguments to pass to generateFn
	 * @returns A readable stream reader containing all response chunks
	 */
	execute(
		initialReader: ReadableStreamDefaultReader<Uint8Array>,
		messages: TMessage[],
		...generateArgs: TGenerateArgs
	): ReadableStreamDefaultReader<Uint8Array> {
		const state: AgentLoopState = {
			iteration: 0,
			totalTokensEstimate: 0,
			isComplete: false,
		};

		return new ReadableStream<Uint8Array>({
			start: async (controller) => {
				try {
					let currentReader = initialReader;
					let currentToolCalls: ExtractedToolCall[] = [];

					do {
						state.iteration++;
						console.log(`[AgentLoop] === Iteration ${state.iteration} started ===`);
						this.config.onIterationStart?.(state.iteration);

						if (state.iteration > this.config.maxIterations) {
							console.warn(`[AgentLoop] Max iterations (${this.config.maxIterations}) reached, stopping`);
							this.emitWarning(
								controller,
								`⚠️ Atingi o limite de ${this.config.maxIterations} iterações.`,
							);
							break;
						}

						console.log(`[AgentLoop] Processing stream...`);
						const result = await this.streamProcessor.processStream(
							currentReader,
							controller,
						);
						currentToolCalls = result.toolCalls;
						console.log(`[AgentLoop] Stream processed: ${currentToolCalls.length} tool call(s) detected`);

						if (currentToolCalls.length === 0) {
							console.log(`[AgentLoop] No tool calls, completing...`);
							state.isComplete = true;
							break;
						}

						const toolNames = currentToolCalls.map((tc) => tc.name).join(', ');
						console.log(`[AgentLoop] Executing ${currentToolCalls.length} tool(s): ${toolNames}`);

						const toolResults = await this.executeTools(currentToolCalls);
						console.log(`[AgentLoop] All ${toolResults.length} tools executed successfully`);

						console.log(`[AgentLoop] Checking if summarization is needed...`);
						const summarizedResults = await this.summarizeToolResults(toolResults, messages);
						const wasSummarized = summarizedResults.some((r) => r.result && typeof r.result === 'object' && 'summary' in r.result);
						if (wasSummarized) {
							console.log(`[AgentLoop] Results were summarized to save tokens`);
						} else {
							console.log(`[AgentLoop] Results kept as-is (not close to token limit)`);
						}

						const formattedResults = this.streamProcessor
							.formatToolResultsForNextCall(summarizedResults);
						messages.push(...(formattedResults as TMessage[]));
						console.log(`[AgentLoop] Added ${formattedResults.length} message(s) to history`);

						console.log(`[AgentLoop] Generating next response...`);
						currentReader = await this.generateFn(messages, ...generateArgs);

						console.log(`[AgentLoop] === Iteration ${state.iteration} complete ===\n`);
						this.config.onIterationComplete?.(
							state.iteration,
							currentToolCalls.length > 0,
						);
					} while (currentToolCalls.length > 0);
				} catch (error) {
					state.lastError = error instanceof Error ? error : new Error(String(error));
					this.emitError(controller, state.lastError);
				} finally {
					controller.close();
				}
			},
		}).getReader();
	}

	/**
	 * Execute all tool calls sequentially with timeout protection.
	 */
	private async executeTools(
		toolCalls: ExtractedToolCall[],
	): Promise<ToolExecutionResult[]> {
		const results: ToolExecutionResult[] = [];

		for (const call of toolCalls) {
			const startTime = Date.now();
			console.log(`[AgentLoop]   -> Executing tool: ${call.name}`);
			this.config.onToolExecution?.(call.name, call.arguments);

			try {
				const fn = ToolService.tools.get(call.name)?.fn;
				if (!fn) {
					console.warn(`[AgentLoop]   -> Tool '${call.name}' not found`);
					results.push({
						toolCallId: call.id,
						toolName: call.name,
						arguments: call.arguments,
						result: { error: `Function ${call.name} not found` },
						executionTimeMs: Date.now() - startTime,
					});
					continue;
				}

				const args = JSON.parse(call.arguments);
				const result = await Promise.race([
					fn(args),
					this.createTimeout(this.config.toolExecutionTimeout),
				]);
				const executionTimeMs = Date.now() - startTime;

				console.log(`[AgentLoop]   -> Tool '${call.name}' completed in ${executionTimeMs}ms`);
				results.push({
					toolCallId: call.id,
					toolName: call.name,
					arguments: call.arguments,
					result,
					executionTimeMs,
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const executionTimeMs = Date.now() - startTime;
				console.error(`[AgentLoop]   -> Tool '${call.name}' failed after ${executionTimeMs}ms:`, errorMessage);
				results.push({
					toolCallId: call.id,
					toolName: call.name,
					arguments: call.arguments,
					result: { error: errorMessage },
					executionTimeMs,
				});
			}
		}

		return results;
	}

	/**
	 * Create a timeout promise that rejects after the specified duration.
	 */
	private createTimeout(ms: number): Promise<never> {
		return new Promise((_, reject) => setTimeout(() => reject(new Error('Tool execution timeout')), ms));
	}

	/**
	 * Summarize tool results using LLM to extract only relevant information.
	 * Summarizes when adding tool results would exceed 80% of the context window limit.
	 * @param toolResults - Array of tool execution results
	 * @param currentMessages - Current conversation messages to estimate tokens
	 * @returns Array of tool results with summarized content
	 */
	private async summarizeToolResults(
		toolResults: ToolExecutionResult[],
		currentMessages: TMessage[],
	): Promise<ToolExecutionResult[]> {
		if (!this.config.enableToolResultSummarization) {
			return toolResults;
		}

		const currentTokens = estimateTokens(currentMessages);
		const toolResultsTokens = this.estimateToolResultsTokens(toolResults);
		const totalTokensAfterAdding = currentTokens + toolResultsTokens;

		if (!shouldCompress(totalTokensAfterAdding, this.maxTokens)) {
			return toolResults;
		}

		console.log(
			`[AgentLoop] Context would exceed 80% limit (currentTokens=${currentTokens}, toolResultsTokens=${toolResultsTokens}, total=${totalTokensAfterAdding}/${
				Math.floor(this.maxTokens * 0.8)
			}), summarizing ${toolResults.length} tool results...`,
		);

		const summarizedResults: ToolExecutionResult[] = [];

		for (const result of toolResults) {
			const resultStr = JSON.stringify(result.result);
			const resultSize = resultStr.length;

			try {
				const summary = await this.extractRelevantInfo(
					result.toolName,
					result.arguments,
					resultStr,
				);

				summarizedResults.push({
					...result,
					result: { summary, _original_size: resultSize },
				});
			} catch (error) {
				console.error(`Failed to summarize result for ${result.toolName}:`, error);
				// If summarization fails, truncate to fit within reasonable size
				const truncated = resultStr.substring(0, 4000);
				summarizedResults.push({
					...result,
					result: { truncated, _original_size: resultSize, _summarization_failed: true },
				});
			}
		}

		return summarizedResults;
	}

	/**
	 * Build the summarization prompt.
	 */
	private buildSummarizationPrompt(
		toolName: string,
		toolArgs: string,
		toolResult: string,
	): string {
		return `You are helping extract relevant information from a tool execution result.

User's original question: ${this.userQuery}

Tool that was called: ${toolName}
Tool arguments: ${toolArgs}

Tool result (may be very large):
${toolResult.substring(0, 15000)}

Extract ONLY the information from the tool result that is directly relevant to answering the user's question.
Be concise but include all important details. If the result contains structured data (like search results or weather data), preserve the key information in a clean format.

Relevant information:`;
	}

	/**
	 * Estimate token count for tool results.
	 */
	private estimateToolResultsTokens(toolResults: ToolExecutionResult[]): number {
		return estimateTokens(toolResults);
	}

	/**
	 * Use LLM to extract relevant information from tool result based on user query.
	 */
	private async extractRelevantInfo(
		toolName: string,
		toolArgs: string,
		toolResult: string,
	): Promise<string> {
		const prompt = this.buildSummarizationPrompt(toolName, toolArgs, toolResult);

		const response = await this.openai.chat.completions.create({
			model: this.model,
			messages: [{ role: 'user', content: prompt }],
			max_tokens: 1000,
			temperature: 0,
		});

		return response.choices[0]?.message?.content || toolResult.substring(0, 4000);
	}

	/**
	 * Emit a warning message to the stream.
	 */
	private emitWarning(
		controller: ReadableStreamDefaultController<Uint8Array>,
		message: string,
	): void {
		const formattedMessage = this.formatAsOpenAI ? JSON.stringify({ choices: [{ delta: { content: message } }] }) : message;
		const chunk = new TextEncoder().encode(formattedMessage);
		controller.enqueue(chunk);
	}

	/**
	 * Emit an error message to the stream.
	 */
	private emitError(
		controller: ReadableStreamDefaultController<Uint8Array>,
		error: Error,
	): void {
		const errorMessage = `Erro: ${error.message}`;
		const formattedMessage = this.formatAsOpenAI ? JSON.stringify({ choices: [{ delta: { content: errorMessage } }] }) : errorMessage;
		const errorChunk = new TextEncoder().encode(formattedMessage);
		controller.enqueue(errorChunk);
	}
}
