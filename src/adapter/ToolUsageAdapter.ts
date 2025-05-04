import OpenAi from 'npm:openai';
import { executeToolCalls, responseMap as OpenaiResponseMap } from '../service/openai/OpenAIService.ts';

// Definindo interfaces para as ferramentas
export interface ToolOptions {
	tools?: OpenAi.Chat.Completions.ChatCompletionTool[];
	tool_choice?: OpenAi.Chat.Completions.ChatCompletionToolChoiceOption;
	functions?: OpenAi.ChatCompletionCreateParams.Function[];
	function_call?: 'auto' | 'none' | { name: string };
}

// Tipo utilitário para toolCalls
export type ToolCall = {
	id: string;
	type: string;
	function: { name: string; arguments: string };
};

interface ToolCallsProcessing {
	processed: boolean;
	toolCalls: ToolCall[] | null;
	results: ToolCallResult[];
}

interface ToolCallResult {
	choices: Array<{
		delta: {
			content: string;
			tool_calls?: ToolCall[];
		};
		finish_reason?: string | null;
	}>;
}

export interface OpenAiStreamResponse {
	choices: Array<{
		delta: {
			content: string;
			tool_calls?: Array<{
				index: number;
				id?: string;
				type?: string;
				function?: {
					name?: string;
					arguments?: string;
				};
			}>;
		};
		finish_reason: string | null;
	}>;
}

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/**
 * ToolUsageAdapter - Adapta e gerencia o uso de ferramentas para Chatbots somente textuais
 */
export class ToolUsageAdapter {
	/**
	 * Prepara um objeto de ferramenta para ser incluído na mensagem
	 */
	private formatToolForMessage(tool: OpenAi.Chat.Completions.ChatCompletionTool) {
		if (tool.type === 'function' && tool.function) {
			return {
				name: tool.function.name,
				description: tool.function.description || '',
				parameters: tool.function.parameters,
			};
		}
		// Para outros tipos de ferramentas, retornar uma estrutura genérica
		return {
			name: 'unknown_tool',
			description: '',
			parameters: undefined,
		};
	}

	/**
	 * Prepara uma função para ser incluída na mensagem
	 */
	private formatFunctionForMessage(func: OpenAi.ChatCompletionCreateParams.Function) {
		return {
			name: func.name,
			description: func.description || '',
			parameters: func.parameters,
		};
	}

	/**
	 * Valida se um objeto é uma chamada de função válida
	 */
	private isValidFunctionCall(obj: any): obj is { name: string; arguments: object } {
		// Aqui você pode adicionar mais restrições se necessário
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
	 * Detecta chamadas de ferramentas na resposta do modelo e as formata
	 */
	private extractToolCalls(content: string): {
		toolCalls: ToolCall[] | null;
		cleanedContent: string;
	} {
		const functionCallPattern = /```(?:function|json)?\s*\n([\s\S]*?)\n```/g;
		const toolCalls: ToolCall[] = [];
		let cleanedContent = content;
		let match;
		while ((match = functionCallPattern.exec(content)) !== null) {
			const functionData = match[1].trim();
			try {
				const functionObj = JSON.parse(functionData);
				if (this.isValidFunctionCall(functionObj)) {
					toolCalls.push({
						id: crypto.randomUUID(),
						type: 'function',
						function: {
							name: functionObj.name,
							arguments: JSON.stringify(functionObj.arguments),
						},
					});
					cleanedContent = cleanedContent.replace(match[0], '');
				}
			} catch (error) {
				// Loga erro e contexto para debug
				console.warn('Invalid function data:', functionData.substring(0, 50), '...\nContent:', content.substring(0, 100), '\nError:', error);
				continue;
			}
		}
		return {
			toolCalls: toolCalls.length > 0 ? toolCalls : null,
			cleanedContent: cleanedContent.trim(),
		};
	}

	/**
	 * Modifica as mensagens para incluir informações sobre as ferramentas disponíveis
	 */
	modifyMessagesWithToolInfo(
		messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[],
		toolOptions?: ToolOptions,
	): OpenAi.Chat.Completions.ChatCompletionMessageParam[] {
		const modifiedMessages = [...messages];

		// Converter mensagens com role "tool" para "assistant"
		for (let i = 0; i < modifiedMessages.length; i++) {
			const message = modifiedMessages[i];
			if (message.role === 'tool') {
				// Extrair tool_call_id e content
				const toolCallId = message.tool_call_id;
				const toolResult = message.content;

				// Substituir a mensagem com nova formatação para compatibilidade com chatbox blackbox
				// isso é necessário pois o chatbox não aceita mensagens com role "tool"
				// e processa somente mensagens de texto padrão com role system, user ou assistant
				// porém essa adaptação permite que o LLM se comporte igual ao esperado pelo sdk openai
				modifiedMessages[i] = {
					role: 'assistant',
					content: `essa foi a resposta da ferramenta ${toolCallId}, usarei para compor minha próxima resposta: \`\`\`json\n${
						JSON.stringify(toolResult)
					}\n\`\`\``,
				};
			}
		}

		const lastUserMessageIndex = modifiedMessages.findLastIndex(
			(message) => message.role === 'user',
		);

		// Somente adicionar informações de ferramentas se houver ferramentas disponíveis
		if (
			lastUserMessageIndex >= 0 &&
			(toolOptions?.tools?.length || toolOptions?.functions?.length)
		) {
			const lastUserMessage = modifiedMessages[lastUserMessageIndex];
			const userContent = typeof lastUserMessage.content === 'string' ? lastUserMessage.content : '';

			let toolsInfo = '\n\nVocê tem acesso às seguintes ferramentas:\n';

			// Adicionar informações de tools
			if (toolOptions?.tools?.length) {
				toolsInfo += '\nFERRAMENTAS:\n';
				toolOptions.tools.forEach((tool, index) => {
					const formattedTool = this.formatToolForMessage(tool);
					toolsInfo += `${index + 1}. ${formattedTool.name}: ${formattedTool.description}\n`;
					toolsInfo += `   Parâmetros: ${JSON.stringify(formattedTool.parameters, null, 2)}\n\n`;
				});
			}

			// Adicionar informações de functions
			if (toolOptions?.functions?.length) {
				toolsInfo += '\nFUNÇÕES:\n';
				toolOptions.functions.forEach((func, index) => {
					const formattedFunc = this.formatFunctionForMessage(func);
					toolsInfo += `${index + 1}. ${formattedFunc.name}: ${formattedFunc.description}\n`;
					toolsInfo += `   Parâmetros: ${JSON.stringify(formattedFunc.parameters, null, 2)}\n\n`;
				});
			}

			// Adicionar instruções sobre como chamar as ferramentas
			toolsInfo += '\nPara chamar uma ferramenta, responda usando o formato exato, utilizando markdown:\n';
			toolsInfo += '```function\n';
			toolsInfo += '{\n';
			toolsInfo += '  "name": "nome_da_função",\n';
			toolsInfo += '  "arguments": {\n';
			toolsInfo += '    "parametro1": "valor1",\n';
			toolsInfo += '    "parametro2": "valor2"\n';
			toolsInfo += '  }\n';
			toolsInfo += '}\n';
			toolsInfo +=
				'```\n\n antes de chamar a ferramenta, indique o que vai fazer, a ultima coisa que disser precisa ser a chamada da ferramenta para poder usa-la\n';

			// Instruções para tool_choice
			if (toolOptions?.tool_choice && toolOptions.tool_choice !== 'auto') {
				if (toolOptions.tool_choice === 'none') {
					toolsInfo += 'Não use nenhuma ferramenta, a menos que seja absolutamente necessário.\n\n';
				} else if (typeof toolOptions.tool_choice === 'object' && toolOptions.tool_choice.function) {
					toolsInfo += `Use a ferramenta "${toolOptions.tool_choice.function.name}" para responder a esta pergunta.\n\n`;
				}
			}

			// Adicionar instruções para function_call
			if (toolOptions?.function_call) {
				if (toolOptions.function_call === 'none') {
					toolsInfo += 'Não use nenhuma função, a menos que seja absolutamente necessário.\n\n';
				} else if (typeof toolOptions.function_call === 'object' && toolOptions.function_call.name) {
					toolsInfo += `Use a função "${toolOptions.function_call.name}" para responder a esta pergunta.\n\n`;
				}
			}

			modifiedMessages[lastUserMessageIndex] = {
				...lastUserMessage,
				content: `${userContent}${toolsInfo}`,
			};
		}

		return modifiedMessages;
	}

	/**
	 * Processa a resposta do modelo para extrair chamadas de ferramentas e transformar o stream
	 */
	processModelResponse(
		generateText: (messages: OpenAi.Chat.Completions.ChatCompletionMessageParam[], ...args: any[]) => Promise<ReadableStreamDefaultReader<Uint8Array>>,
		originalReader: ReadableStreamDefaultReader<Uint8Array>,
		messages: OpenAi.Chat.ChatCompletionMessageParam[],
		responseMap?: (responseBody: string) => string,
		...generateTextArgs: any[]
	): ReadableStreamDefaultReader<Uint8Array> {
		const extractedToolCallsReader = this.extractToolCallsReader(originalReader, responseMap);

		const openaiFormatedToolCallsReader = this.formatToolCallsInOpenaiInterface(extractedToolCallsReader);

		const postToolExcecutionReader = executeToolCalls(generateText, openaiFormatedToolCallsReader, messages, ...generateTextArgs);

		return this.mapResponse(postToolExcecutionReader);
	}

	mapResponse(
		reader: ReadableStreamDefaultReader<Uint8Array>,
		exit: boolean = false,
	): ReadableStreamDefaultReader<Uint8Array> {
		// deno-lint-ignore no-this-alias
		const self = this;
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				try {

					while (true) {
						const { done, value } = await reader.read();

						if (done) {
							break;
						}

						const text = decoder.decode(value);
						const response = exit ? self.createChatFormatter(text) : OpenaiResponseMap(text);
						controller.enqueue(encoder.encode(response));
					}
				} finally {
					controller.close();
					reader.releaseLock();
				}
			},
		}).getReader();
	}

	private formatToolCallsInOpenaiInterface<T>(
		reader: ReadableStreamDefaultReader<Uint8Array>,
	): ReadableStreamDefaultReader<Uint8Array> {
		// deno-lint-ignore no-this-alias
		const self = this;

		return new ReadableStream<Uint8Array>({
			async start(controller) {
				try {
					let toolCalls: ToolCall[] | null = null;

					while (true) {
						const { done, value } = await reader.read();

						if (done) {
							break;
						}

						const text = decoder.decode(value);

						const toolCallsProcessing = self.processToolCalls(text);
						if (toolCallsProcessing.processed) {
							toolCalls = toolCallsProcessing.toolCalls;
							for (const result of toolCallsProcessing.results) {
								controller.enqueue(encoder.encode(JSON.stringify(result)));
							}
							reader.releaseLock();
							break;
						}

						controller.enqueue(encoder.encode(self.createChatFormatter(text)));
					}

					if (!toolCalls) {
						controller.enqueue(encoder.encode(self.createChatFormatter('')));
					}
				} finally {
					controller.close();
					reader.releaseLock();
				}
			},
		}).getReader();
	}

	private createChatFormatter(text: string): string {
		const response: OpenAiStreamResponse = {
			choices: [{
				delta: {
					content: text,
				},
				finish_reason: text === '' ? 'stop' : null,
			}],
		};
		return JSON.stringify(response);
	}


	private processToolCalls(text: string): ToolCallsProcessing {
		const results: ToolCallResult[] = [];
		let toolCalls: ToolCall[] = [];
		let processed = false;

		if (text.includes('"__adapter_tool_calls"')) {
			try {
				const data = JSON.parse(text);
				if (data.__adapter_tool_calls) {
					processed = true;
					const extractedToolCalls = data.__adapter_tool_calls;

					toolCalls = extractedToolCalls.map((call: ToolCall, index: number) => ({
						index,
						id: call.id,
						type: call.type,
						function: call.function,
					}));

					for (const toolCall of toolCalls) {
						results.push({
							choices: [{
								delta: {
									content: '',
									tool_calls: [toolCall],
								},
								finish_reason: null,
							}],
						});
					}

					results.push({
						choices: [{
							delta: {
								content: '',
							},
							finish_reason: 'tool_calls',
						}],
					});
				}
			} catch (error) {
				console.error('Erro ao processar chamadas de ferramentas:', error);
			}
		}

		return { processed, toolCalls, results };
	}

	private extractToolCallsReader(
		originalReader: ReadableStreamDefaultReader<Uint8Array>,
		responseMap?: (responseBody: string) => string,
	): ReadableStreamDefaultReader<Uint8Array> {
		// deno-lint-ignore no-this-alias
		const self = this;
		return new ReadableStream<Uint8Array>({
			async start(controller) {
				let buffer = '';
				let toolBlockStarted = false;
				let toolBlockBuffer = '';
				let doneReading = false;

				const toolStartRegex = /```(function|json)?\s*\n?/;
				const toolEndRegex = /\n```/;

				while (!doneReading) {
					const { done, value } = await originalReader.read();
					if (done) doneReading = true;
					const chunk = value ? decoder.decode(value, { stream: true }) : '';
					const text = responseMap ? responseMap(chunk) : chunk;
					buffer += text;

					if (toolBlockStarted) {
						toolBlockBuffer += text;
						const endIdx = toolBlockBuffer.search(toolEndRegex);
						if (endIdx !== -1) {
							const blockEnd = endIdx + 4;
							const fullBlock = toolBlockBuffer.slice(0, blockEnd);
							const rest = toolBlockBuffer.slice(blockEnd);
							const { toolCalls, cleanedContent } = self.extractToolCalls(fullBlock);
							if (cleanedContent) controller.enqueue(encoder.encode(cleanedContent));
							if (toolCalls) controller.enqueue(encoder.encode(JSON.stringify({ __adapter_tool_calls: toolCalls })));
							if (rest) controller.enqueue(encoder.encode(rest));
							toolBlockStarted = false;
							toolBlockBuffer = '';
							buffer = '';
						}
						continue;
					}

					const startMatch = buffer.match(toolStartRegex);
					if (startMatch) {
						toolBlockStarted = true;
						const idx = buffer.indexOf(startMatch[0]);
						const beforeBlock = buffer.slice(0, idx);
						if (beforeBlock) controller.enqueue(encoder.encode(beforeBlock));
						toolBlockBuffer = buffer.slice(idx);
						buffer = '';
						continue;
					}

					if (buffer) {
						controller.enqueue(encoder.encode(buffer));
						buffer = '';
					}
				}

				// Finaliza bloco se necessário
				if (toolBlockStarted && toolBlockBuffer) {
					const { toolCalls, cleanedContent } = self.extractToolCalls(toolBlockBuffer);
					if (cleanedContent) controller.enqueue(encoder.encode(cleanedContent));
					if (toolCalls) controller.enqueue(encoder.encode(JSON.stringify({ __adapter_tool_calls: toolCalls })));
				} else if (buffer) {
					controller.enqueue(encoder.encode(buffer));
				}

				controller.close();
				originalReader.releaseLock();
			},
		}).getReader();
	}
}

// Exportar uma instância singleton do adaptador
export default new ToolUsageAdapter();
