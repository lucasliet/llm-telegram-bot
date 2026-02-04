import OpenAi from 'npm:openai';
import { ExtractedToolCall, StreamProcessingResult, StreamProcessor } from './StreamProcessor.ts';
import { ToolExecutionResult } from '../agent/AgentLoopConfig.ts';

/**
 * Stream processor for OpenAI Chat Completions API.
 * Handles extraction of tool calls from the streaming response.
 */
export class ChatCompletionsStreamProcessor implements StreamProcessor {
	async processStream(
		reader: ReadableStreamDefaultReader<Uint8Array>,
		controller: ReadableStreamDefaultController<Uint8Array>,
	): Promise<StreamProcessingResult> {
		const toolCalls: Map<number, ExtractedToolCall> = new Map();
		let hasAssistantContent = false;
		let rawContent = '';
		const decoder = new TextDecoder();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			// Always enqueue to user (streaming)
			controller.enqueue(value);

			try {
				const text = decoder.decode(value, { stream: true });
				const parsed = JSON.parse(text);
				const delta = parsed?.choices?.[0]?.delta;

				// Detect text content
				if (delta?.content) {
					hasAssistantContent = true;
					rawContent += delta.content;
				}

				// Accumulate tool calls (they come in chunks)
				if (delta?.tool_calls) {
					for (const call of delta.tool_calls) {
						const index = call.index ?? 0;

						if (!toolCalls.has(index)) {
							toolCalls.set(index, {
								id: call.id || '',
								name: call.function?.name || '',
								arguments: '',
							});
						}

						const existing = toolCalls.get(index)!;
						if (call.id) existing.id = call.id;
						if (call.function?.name) existing.name = call.function.name;
						if (call.function?.arguments) {
							existing.arguments += call.function.arguments;
						}
					}
				}
			} catch {
				// Partial chunk or non-JSON, continue
			}
		}

		return {
			toolCalls: Array.from(toolCalls.values()).filter((tc) => tc.name && tc.id),
			hasAssistantContent,
			rawContent,
		};
	}

	formatToolResultsForNextCall(
		results: ToolExecutionResult[],
	): OpenAi.Chat.ChatCompletionMessageParam[] {
		const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [];

		// Group tool calls into a single assistant message
		const toolCallsForAssistant = results.map((r) => ({
			id: r.toolCallId,
			type: 'function' as const,
			function: {
				name: r.toolName,
				arguments: r.arguments,
			},
		}));

		messages.push({
			role: 'assistant',
			content: null,
			tool_calls: toolCallsForAssistant,
		});

		// Add each result as a tool message
		for (const result of results) {
			messages.push({
				role: 'tool',
				tool_call_id: result.toolCallId,
				content: JSON.stringify(result.result),
			} as OpenAi.Chat.ChatCompletionMessageParam);
		}

		return messages;
	}
}
