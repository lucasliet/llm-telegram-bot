import OpenAi from 'openai';
import { ExtractedToolCall, StreamProcessingResult, StreamProcessor } from './StreamProcessor.ts';
import { ToolExecutionResult } from '../agent/AgentLoopConfig.ts';

/**
 * Stream processor for OpenAI Responses API.
 * Handles extraction of function calls from the SSE streaming response.
 */
export class ResponsesAPIStreamProcessor implements StreamProcessor {
	async processStream(
		reader: ReadableStreamDefaultReader<Uint8Array>,
		controller: ReadableStreamDefaultController<Uint8Array>,
	): Promise<StreamProcessingResult> {
		const pendingCalls = new Map<number, ExtractedToolCall>();
		const completedCalls: ExtractedToolCall[] = [];
		let hasAssistantContent = false;
		let rawContent = '';
		let buffer = '';
		const decoder = new TextDecoder();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			// Always enqueue to user (streaming)
			controller.enqueue(value);
			buffer += decoder.decode(value, { stream: true });

			let newlineIndex;
			while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
				const line = buffer.slice(0, newlineIndex).trim();
				buffer = buffer.slice(newlineIndex + 1);

				if (!line) continue;

				let jsonPayload = line;
				if (line.startsWith('data:')) {
					jsonPayload = line.slice(5).trim();
				}

				if (!jsonPayload || jsonPayload === '[DONE]') continue;

				try {
					const event = JSON.parse(jsonPayload);

					// Detect start of function call
					if (
						event.type === 'response.output_item.added' &&
						event.item?.type === 'function_call'
					) {
						pendingCalls.set(event.output_index, {
							id: event.item.call_id || '',
							name: event.item.name || '',
							arguments: '',
						});
					}

					// Accumulate arguments
					if (event.type === 'response.function_call_arguments.delta') {
						const pending = pendingCalls.get(event.output_index);
						if (pending) {
							pending.arguments += event.delta || '';
						}
					}

					// Finalize function call
					if (event.type === 'response.function_call_arguments.done') {
						const pending = pendingCalls.get(event.output_index);
						if (pending) {
							pending.arguments = event.arguments || pending.arguments;
							completedCalls.push(pending);
							pendingCalls.delete(event.output_index);
						}
					}

					// Detect text content
					if (event.type === 'response.output_text.delta') {
						hasAssistantContent = true;
						rawContent += event.delta || '';
					}
				} catch {
					// Line is not valid JSON
				}
			}
		}

		return {
			toolCalls: completedCalls,
			hasAssistantContent,
			rawContent,
		};
	}

	formatToolResultsForNextCall(
		results: ToolExecutionResult[],
	): OpenAi.Responses.ResponseInputItem[] {
		const items: OpenAi.Responses.ResponseInputItem[] = [];

		for (const result of results) {
			// Add the original function_call
			items.push({
				type: 'function_call',
				call_id: result.toolCallId,
				name: result.toolName,
				arguments: result.arguments,
			} as OpenAi.Responses.ResponseInputItem);

			// Add the result
			items.push({
				type: 'function_call_output',
				call_id: result.toolCallId,
				output: JSON.stringify(result.result),
			} as OpenAi.Responses.ResponseInputItem);
		}

		return items;
	}
}
