import OpenAi from 'npm:openai';
import { executeToolCalls, responseMap as OpenaiResponseMap } from '../service/openai/OpenAIService.ts';

export interface ToolOptions {
	tools?: OpenAi.Chat.Completions.ChatCompletionTool[];
	tool_choice?: OpenAi.Chat.Completions.ChatCompletionToolChoiceOption;
	functions?: OpenAi.ChatCompletionCreateParams.Function[];
	function_call?: 'auto' | 'none' | { name: string };
}

export type ToolCall = {
	index?: number;
	id?: string;
	type?: string;
	function?: { name?: string; arguments?: string };
};

interface ToolCallResult {
	choices: Array<{
		delta: {
			content: string | null;
			tool_calls?: ToolCall[];
		};
		finish_reason?: string | null;
	}>;
}

export interface OpenAiStreamResponse {
	choices: Array<{
		delta: {
			content: string | null;
			tool_calls?: ToolCall[];
		};
		finish_reason: string | null;
	}>;
}

const TEXT_DECODER = new TextDecoder();
const TEXT_ENCODER = new TextEncoder();
const FUNCTION_CALL_PATTERN = /```(?:function|json)?\s*\n([\s\S]*?)\n```/g;
const TOOL_CALL_ADAPTER_KEY = '__adapter_tool_calls';
const TOOL_BLOCK_START_REGEX = /```(function|json)?\s*\n?/;
const TOOL_BLOCK_END_REGEX = /\n```/;

/**
 * Adapts tool usage for text-only Chatbots, enabling function calling
 * by formatting instructions and parsing responses.
 */
export class ToolUsageAdapter {
	/**
	 * Formats a tool definition for inclusion in the prompt.
	 */
	private _formatToolForMessage(tool: OpenAi.Chat.Completions.ChatCompletionTool) {
		if (tool.type === 'function' && tool.function) {
			return {
				name: tool.function.name,
				description: tool.function.description || '',
				parameters: tool.function.parameters,
			};
		}
		return {
			name: 'unknown_tool',
			description: '',
			parameters: undefined,
		};
	}

	/**
	 * Formats a function definition for inclusion in the prompt.
	 */
	private _formatFunctionForMessage(func: OpenAi.ChatCompletionCreateParams.Function) {
		return {
			name: func.name,
			description: func.description || '',
			parameters: func.parameters,
		};
	}

	/**
	 * Validates if an object represents a valid function call structure.
	 */
	private _isValidFunctionCall(obj: any): obj is { name: string; arguments: object } {
		return (
			typeof obj === 'object' &&
			typeof obj.name === 'string' &&
			obj.name.length > 0 &&
			typeof obj.arguments === 'object' &&
			obj.arguments !== null &&
			!Array.isArray(obj.arguments)
		);
	}

	/**
	 * Extracts structured tool calls from the model's text response.
	 * Removes the tool call blocks from the original content.
	 */
	private _extractToolCalls(content: string): {
		toolCalls: ToolCall[] | null;
		cleanedContent: string;
	} {
		const toolCalls: ToolCall[] = [];
		let cleanedContent = content;
		let match;

		FUNCTION_CALL_PATTERN.lastIndex = 0;

		while ((match = FUNCTION_CALL_PATTERN.exec(content)) !== null) {
			const functionData = match[1].trim();
			try {
				const functionObj = JSON.parse(functionData);
				if (this._isValidFunctionCall(functionObj)) {
					toolCalls.push({
						id: crypto.randomUUID(),
						type: 'function',
						function: {
							name: functionObj.name,
							arguments: JSON.stringify(functionObj.arguments),
						},
					});
					cleanedContent = cleanedContent.replace(match[0], '');
				} else {
					console.warn('Parsed function object is not valid:', functionObj);
				}
			} catch (error) {
				console.warn(
					'Failed to parse potential function call JSON:',
					functionData.substring(0, 100),
					'Error:',
					error,
				);
			}
		}

		return {
			toolCalls: toolCalls.length > 0 ? toolCalls : null,
			cleanedContent: cleanedContent.trim(),
		};
	}

	/**
	 * Converts a message with the 'tool' role to an 'assistant' role message
	 * containing the tool result, formatted for text-only models.
	 */
	private _convertToolRoleMessage(
		message: OpenAi.Chat.Completions.ChatCompletionToolMessageParam,
	): OpenAi.Chat.Completions.ChatCompletionAssistantMessageParam {
		const toolCallId = message.tool_call_id;
		const toolResult = message.content;
		const formattedContent =
			`This was the result of the tool call with ID ${toolCallId}, I will use it to formulate my next response: \`\`\`json\n${JSON.stringify(toolResult)
			}\n\`\`\``;
		return {
			role: 'assistant',
			content: formattedContent,
		};
	}

	/**
	 * Generates the informational text about available tools and how to use them.
	 */
	private _generateToolsInfoString(toolOptions?: ToolOptions): string {
		if (!toolOptions || (!toolOptions.tools?.length && !toolOptions.functions?.length)) {
			return '';
		}

		let toolsInfo = '\n\nYou have access to the following tools:\n';

		if (toolOptions.tools?.length) {
			toolsInfo += '\nTOOLS:\n';
			toolOptions.tools.forEach((tool, index) => {
				const formattedTool = this._formatToolForMessage(tool);
				toolsInfo += `${index + 1}. ${formattedTool.name}: ${formattedTool.description}\n`;
				toolsInfo += `   Parameters: ${JSON.stringify(formattedTool.parameters, null, 2)}\n\n`;
			});
		}

		if (toolOptions.functions?.length) {
			toolsInfo += '\nFUNCTIONS:\n';
			toolOptions.functions.forEach((func, index) => {
				const formattedFunc = this._formatFunctionForMessage(func);
				toolsInfo += `${index + 1}. ${formattedFunc.name}: ${formattedFunc.description}\n`;
				toolsInfo += `   Parameters: ${JSON.stringify(formattedFunc.parameters, null, 2)}\n\n`;
			});
		}

		toolsInfo += '\nTo call a tool, respond using this exact markdown format:\n';
		toolsInfo += '```function\n';
		toolsInfo += '{\n';
		toolsInfo += '  "name": "function_name",\n';
		toolsInfo += '  "arguments": {\n';
		toolsInfo += '    "param1": "value1",\n';
		toolsInfo += '    "param2": "value2"\n';
		toolsInfo += '  }\n';
		toolsInfo += '}\n';
		toolsInfo += '```\n\n';
		toolsInfo += 'Before calling the tool, state what you are going to do. The very last part of your response must be the tool call block.\n';

		const choice = toolOptions?.tool_choice;
		const legacyFunctionCall = toolOptions?.function_call;

		if (choice) {
			if (choice === 'none') {
				toolsInfo += 'Do not use any tools unless absolutely necessary.\n\n';
			} else if (typeof choice === 'object' && choice.type === 'function' && choice.function?.name) {
				toolsInfo += `You must use the tool "${choice.function.name}" to answer this query.\n\n`;
			}
		} else if (legacyFunctionCall) {
			if (legacyFunctionCall === 'none') {
				toolsInfo += 'Do not use any functions unless absolutely necessary.\n\n';
			} else if (typeof legacyFunctionCall === 'object' && legacyFunctionCall.name) {
				toolsInfo += `You must use the function "${legacyFunctionCall.name}" to answer this query.\n\n`;
			}
		}

		return toolsInfo;
	}

	/**
	 * Modifies the message history to include tool information and adapt tool messages.
	 */
	modifyMessagesWithToolInfo(
		messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[],
		toolOptions?: ToolOptions,
	): OpenAi.Chat.Completions.ChatCompletionMessageParam[] {
		const modifiedMessages = messages.map((message) =>
			message.role === 'tool' ? this._convertToolRoleMessage(message) : message
		);

		const lastUserMessageIndex = modifiedMessages.findLastIndex(
			(message) => message.role === 'user',
		);

		if (lastUserMessageIndex >= 0) {
			const toolsInfoString = this._generateToolsInfoString(toolOptions);
			if (toolsInfoString) {
				const lastUserMessage = modifiedMessages[lastUserMessageIndex];
				const originalContent = typeof lastUserMessage.content === 'string'
					? lastUserMessage.content
					: (Array.isArray(lastUserMessage.content)
						? lastUserMessage.content.map(part => part.type === 'text' ? part.text : '').join('')
						: '');

				modifiedMessages[lastUserMessageIndex] = {
					...lastUserMessage,
					content: `${originalContent}${toolsInfoString}`,
				};
			}
		}

		return modifiedMessages;
	}

	/**
	 * Processes the model's response stream, extracts tool calls, executes them,
	 * and returns a stream compatible with the OpenAI SDK format.
	 */
	processModelResponse(
		generateTextFn: (messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
		initialModelStreamReader: ReadableStreamDefaultReader<Uint8Array>,
		messages: OpenAi.Chat.ChatCompletionMessageParam[],
		responseChunkMapFn?: (responseBody: string) => string,
		...generateTextArgs: any[]
	): ReadableStreamDefaultReader<Uint8Array> {
		const toolCallExtractionReader = this._extractToolCallsFromStream(initialModelStreamReader, responseChunkMapFn);
		const openaiFormattedReader = this._formatStreamToOpenAIInterface(toolCallExtractionReader);
		const finalResponseReader = executeToolCalls(generateTextFn, openaiFormattedReader, messages, ...generateTextArgs);
		return this.mapResponse(finalResponseReader, false, OpenaiResponseMap);
	}

	/**
	 * Maps the raw text chunks from a stream using an optional mapping function
	 * and encodes them back to Uint8Array. Optionally formats as OpenAI stream chunks.
	 */
	mapResponse(
		reader: ReadableStreamDefaultReader<Uint8Array>,
		formatAsOpenAIChunk: boolean = false,
		responseChunkMapFn?: (responseBody: string) => string,
	): ReadableStreamDefaultReader<Uint8Array> {
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						const rawChunkText = TEXT_DECODER.decode(value);
						const mappedText = responseChunkMapFn ? responseChunkMapFn(rawChunkText) : rawChunkText;

						if (!mappedText && !(formatAsOpenAIChunk && mappedText === '')) continue;

						const outputChunk = formatAsOpenAIChunk
							? ToolUsageAdapter._createOpenAIStreamChunk(mappedText)
							: mappedText;

						controller.enqueue(TEXT_ENCODER.encode(outputChunk));
					}
				} catch (error) {
					console.error('Error in mapResponse stream:', error);
					controller.error(error);
				} finally {
					controller.close();
					reader.releaseLock();
				}
			},
		}).getReader();
	}

	/**
	 * Creates a JSON string formatted as an OpenAI stream chunk.
	 */
	private static _createOpenAIStreamChunk(text: string): string {
		const response: OpenAiStreamResponse = {
			choices: [{
				delta: { content: text },
				finish_reason: text === '' ? 'stop' : null,
			}],
		};
		return JSON.stringify(response);
	}

	/**
	 * Processes a stream chunk containing the special adapter key for tool calls.
	 * Parses the JSON and formats it into OpenAI SDK compatible tool call chunks.
	 */
	private _processAdapterToolCallChunk(textChunk: string): {
		processed: boolean;
		toolCalls: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> | null;
		formattedChunks: ToolCallResult[];
	} {
		const formattedChunks: ToolCallResult[] = [];
		let toolCalls: Array<{ index: number; id?: string; type?: string; function?: { name?: string; arguments?: string } }> = [];
		let processed = false;

		if (textChunk.includes(`"${TOOL_CALL_ADAPTER_KEY}"`)) {
			try {
				const data = JSON.parse(textChunk);
				if (data[TOOL_CALL_ADAPTER_KEY]) {
					processed = true;
					const extractedToolCalls: ToolCall[] = data[TOOL_CALL_ADAPTER_KEY];

					toolCalls = extractedToolCalls.map((call, index) => ({
						index: index,
						id: call.id,
						type: call.type,
						function: call.function,
					}));

					for (const toolCall of toolCalls) {
						formattedChunks.push({
							choices: [{
								delta: { content: null, tool_calls: [toolCall] },
								finish_reason: null,
							}],
						});
					}

					formattedChunks.push({
						choices: [{
							delta: { content: null },
							finish_reason: 'tool_calls',
						}],
					});
				}
			} catch (error) {
				console.error('Error processing adapter tool call chunk:', error, 'Chunk:', textChunk);
				processed = false;
				toolCalls = [];
			}
		}

		return { processed, toolCalls: toolCalls.length > 0 ? toolCalls : null, formattedChunks };
	}

	/**
	 * Reads a stream, identifies chunks containing adapter-formatted tool calls,
	 * processes them, and passes through other chunks formatted as OpenAI stream chunks.
	 */
	private _formatStreamToOpenAIInterface(
		reader: ReadableStreamDefaultReader<Uint8Array>,
	): ReadableStreamDefaultReader<Uint8Array> {
		// deno-lint-ignore no-this-alias
		const self = this;
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				let toolCallsDetected = false;
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						const textChunk = TEXT_DECODER.decode(value);

						const toolProcessingResult = self._processAdapterToolCallChunk(textChunk);

						if (toolProcessingResult.processed) {
							toolCallsDetected = true;
							for (const result of toolProcessingResult.formattedChunks) {
								controller.enqueue(TEXT_ENCODER.encode(JSON.stringify(result)));
							}
						} else {
							controller.enqueue(TEXT_ENCODER.encode(ToolUsageAdapter._createOpenAIStreamChunk(textChunk)));
						}
					}

					if (!toolCallsDetected) {
						controller.enqueue(TEXT_ENCODER.encode(ToolUsageAdapter._createOpenAIStreamChunk('')));
					}
				} catch (error) {
					console.error('Error in _formatStreamToOpenAIInterface:', error);
					controller.error(error);
				} finally {
					controller.close();
					reader.releaseLock();
				}
			},
		}).getReader();
	}

	/**
	 * Reads a stream from the model, identifies markdown blocks potentially containing
	 * function calls, extracts them, and yields either regular text chunks or
	 * a special JSON chunk containing the extracted tool calls.
	 */
	private _extractToolCallsFromStream(
		modelStreamReader: ReadableStreamDefaultReader<Uint8Array>,
		responseChunkMapFn?: (responseBody: string) => string,
	): ReadableStreamDefaultReader<Uint8Array> {
		// deno-lint-ignore no-this-alias
		const self = this;
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				let chunkBuffer = '';
				let toolBlockBuffer = '';
				let isInsideToolBlock = false;
				let streamFinished = false;

				try {
					while (!streamFinished) {
						const { done, value } = await modelStreamReader.read();
						if (done) streamFinished = true;

						const rawChunk = value ? TEXT_DECODER.decode(value, { stream: true }) : '';
						const currentChunk = responseChunkMapFn ? responseChunkMapFn(rawChunk) : rawChunk;

						if (isInsideToolBlock) {
							toolBlockBuffer += currentChunk;
							const endMatchIndex = toolBlockBuffer.search(TOOL_BLOCK_END_REGEX);

							if (endMatchIndex !== -1) {
								const blockEndMarkerLength = toolBlockBuffer.match(TOOL_BLOCK_END_REGEX)![0].length;
								const fullBlock = toolBlockBuffer.slice(0, endMatchIndex + blockEndMarkerLength);
								const remainingChunkPart = toolBlockBuffer.slice(endMatchIndex + blockEndMarkerLength);

								const { toolCalls, cleanedContent } = self._extractToolCalls(fullBlock);
								if (cleanedContent) controller.enqueue(TEXT_ENCODER.encode(cleanedContent));
								if (toolCalls) {
									controller.enqueue(TEXT_ENCODER.encode(JSON.stringify({ [TOOL_CALL_ADAPTER_KEY]: toolCalls })));
								}

								isInsideToolBlock = false;
								toolBlockBuffer = '';
								chunkBuffer = remainingChunkPart;
							}
						} else {
							chunkBuffer += currentChunk;
							const startMatch = chunkBuffer.match(TOOL_BLOCK_START_REGEX);

							if (startMatch) {
								const blockStartIndex = chunkBuffer.indexOf(startMatch[0]);
								const textBeforeBlock = chunkBuffer.slice(0, blockStartIndex);

								if (textBeforeBlock) controller.enqueue(TEXT_ENCODER.encode(textBeforeBlock));

								isInsideToolBlock = true;
								toolBlockBuffer = chunkBuffer.slice(blockStartIndex);
								chunkBuffer = '';
							} else if (streamFinished) {
								if (chunkBuffer) controller.enqueue(TEXT_ENCODER.encode(chunkBuffer));
								chunkBuffer = '';
							} else {
								const lastPotentialStart = chunkBuffer.lastIndexOf('```');
								const safeEnqueueLength = lastPotentialStart === -1 ? chunkBuffer.length : lastPotentialStart;

								if (safeEnqueueLength > 0) {
									controller.enqueue(TEXT_ENCODER.encode(chunkBuffer.slice(0, safeEnqueueLength)));
									chunkBuffer = chunkBuffer.slice(safeEnqueueLength);
								}
							}
						}
					}

					if (isInsideToolBlock && toolBlockBuffer) {
						console.warn('Stream ended while inside a tool block. Processing incomplete block.');
						const { toolCalls, cleanedContent } = self._extractToolCalls(toolBlockBuffer);
						if (cleanedContent) controller.enqueue(TEXT_ENCODER.encode(cleanedContent));
						if (toolCalls) {
							controller.enqueue(TEXT_ENCODER.encode(JSON.stringify({ [TOOL_CALL_ADAPTER_KEY]: toolCalls })));
						}
					} else if (chunkBuffer) {
						controller.enqueue(TEXT_ENCODER.encode(chunkBuffer));
					}
				} catch (error) {
					console.error('Error in _extractToolCallsFromStream:', error);
					controller.error(error);
				} finally {
					controller.close();
					modelStreamReader.releaseLock();
				}
			},
		}).getReader();
	}
}

export default new ToolUsageAdapter();
