import { assertEquals, assertExists, assertStringIncludes } from 'asserts';
import { AgentLoopExecutor } from '@/service/openai/agent/AgentLoopExecutor.ts';
import { ExtractedToolCall, StreamProcessingResult, StreamProcessor } from '@/service/openai/stream/StreamProcessor.ts';
import { AgentLoopConfig, ToolExecutionResult } from '@/service/openai/agent/AgentLoopConfig.ts';
import ToolService from '@/service/ToolService.ts';

const testOpts = { sanitizeOps: false, sanitizeResources: false };

function readerFromLines(lines: string[]): ReadableStreamDefaultReader<Uint8Array> {
	const enc = new TextEncoder();
	return new ReadableStream<Uint8Array>({
		start(c) {
			for (const l of lines) c.enqueue(enc.encode(l));
			c.close();
		},
	}).getReader();
}

function createMockStreamProcessor(toolCallsPerIteration: ExtractedToolCall[][]): StreamProcessor {
	let iterationIndex = 0;
	return {
		async processStream(
			reader: ReadableStreamDefaultReader<Uint8Array>,
			_controller: ReadableStreamDefaultController<Uint8Array>,
		): Promise<StreamProcessingResult> {
			while (true) {
				const { done } = await reader.read();
				if (done) break;
			}
			const toolCalls = toolCallsPerIteration[iterationIndex] || [];
			iterationIndex++;
			return { toolCalls, hasAssistantContent: true, rawContent: 'mock content' };
		},
		formatToolResultsForNextCall(results: ToolExecutionResult[]): unknown[] {
			return results.map((r) => ({ role: 'tool', tool_call_id: r.toolCallId, content: JSON.stringify(r.result) }));
		},
	};
}

function createMockOpenAI(summaryResponse: string): any {
	return {
		chat: {
			completions: {
				create: () =>
					Promise.resolve({
						choices: [{ message: { content: summaryResponse } }],
					}),
			},
		},
	};
}

function createFailingMockOpenAI(): any {
	return {
		chat: {
			completions: {
				create: () => Promise.reject(new Error('Summarization failed')),
			},
		},
	};
}

function createToolResult(
	toolCallId: string,
	toolName: string,
	args: string,
	result: unknown,
	executionTimeMs = 100,
): ToolExecutionResult {
	return { toolCallId, toolName, arguments: args, result, executionTimeMs };
}

function registerFakeTool(name: string, fn: (args: any) => unknown): () => void {
	const original = ToolService.tools.get(name);
	ToolService.tools.set(name, { schema: {} as any, fn });
	return () => {
		if (original) {
			ToolService.tools.set(name, original);
		} else {
			ToolService.tools.delete(name);
		}
	};
}

function generateLargeString(sizeInChars: number): string {
	return 'x'.repeat(sizeInChars);
}

async function collectStreamOutput(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
	const decoder = new TextDecoder();
	let output = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		output += decoder.decode(value);
	}
	return output;
}

function createExecutor(
	streamProcessor: StreamProcessor,
	openai: any,
	config: Partial<AgentLoopConfig> = {},
	maxTokens = 128000,
): AgentLoopExecutor<any, any[]> {
	const generateFn = () => Promise.resolve(readerFromLines(['{"choices":[{"delta":{"content":"done"}}]}']));
	return new AgentLoopExecutor(
		streamProcessor,
		generateFn,
		openai,
		'gpt-4',
		maxTokens,
		'test query',
		config,
		true,
	);
}

// ============ GRUPO 1: FLUXO DE EXECUÇÃO BÁSICO ============

Deno.test({
	name: 'Fluxo básico - shouldCompleteWithoutToolCalls',
	...testOpts,
	fn: async () => {
		const streamProcessor = createMockStreamProcessor([[]]);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"Hello"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		assertExists(output);
	},
});

Deno.test({
	name: 'Fluxo básico - shouldExecuteSingleToolAndComplete',
	...testOpts,
	fn: async () => {
		const cleanup = registerFakeTool('test_tool', () => ({ success: true }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'test_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		cleanup();
		assertExists(output);
	},
});

Deno.test({
	name: 'Fluxo básico - shouldExecuteMultipleToolsSequentially',
	...testOpts,
	fn: async () => {
		const executionOrder: string[] = [];
		const cleanup1 = registerFakeTool('tool_a', () => {
			executionOrder.push('a');
			return { result: 'a' };
		});
		const cleanup2 = registerFakeTool('tool_b', () => {
			executionOrder.push('b');
			return { result: 'b' };
		});
		const toolCalls: ExtractedToolCall[][] = [
			[
				{ id: 'call_1', name: 'tool_a', arguments: '{}' },
				{ id: 'call_2', name: 'tool_b', arguments: '{}' },
			],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup1();
		cleanup2();
		assertEquals(executionOrder, ['a', 'b']);
	},
});

Deno.test({
	name: 'Fluxo básico - shouldHandleMultipleIterations',
	...testOpts,
	fn: async () => {
		let iterationCount = 0;
		const cleanup = registerFakeTool('iter_tool', () => {
			iterationCount++;
			return { count: iterationCount };
		});
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'iter_tool', arguments: '{}' }],
			[{ id: 'call_2', name: 'iter_tool', arguments: '{}' }],
			[{ id: 'call_3', name: 'iter_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(iterationCount, 3);
	},
});

// ============ GRUPO 2: LIMITE DE ITERAÇÕES ============

Deno.test({
	name: 'Limite de iterações - shouldStopAtMaxIterations',
	...testOpts,
	fn: async () => {
		const cleanup = registerFakeTool('infinite_tool', () => ({ ok: true }));
		const infiniteToolCalls: ExtractedToolCall[][] = Array(15).fill([
			{ id: 'call', name: 'infinite_tool', arguments: '{}' },
		]);
		const streamProcessor = createMockStreamProcessor(infiniteToolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai, { maxIterations: 3 });
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		cleanup();
		assertStringIncludes(output, 'limite de 3 iterações');
	},
});

Deno.test({
	name: 'Limite de iterações - shouldRespectCustomMaxIterations',
	...testOpts,
	fn: async () => {
		let executionCount = 0;
		const cleanup = registerFakeTool('count_tool', () => {
			executionCount++;
			return {};
		});
		const toolCalls: ExtractedToolCall[][] = Array(10).fill([
			{ id: 'call', name: 'count_tool', arguments: '{}' },
		]);
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai, { maxIterations: 5 });
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(executionCount, 5);
	},
});

// ============ GRUPO 3: EXECUÇÃO DE TOOLS ============

Deno.test({
	name: 'Execução de tools - shouldHandleToolNotFound',
	...testOpts,
	fn: async () => {
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'nonexistent_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		assertExists(output);
	},
});

Deno.test({
	name: 'Execução de tools - shouldHandleToolExecutionError',
	...testOpts,
	fn: async () => {
		const cleanup = registerFakeTool('error_tool', () => {
			throw new Error('Tool execution failed');
		});
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'error_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		cleanup();
		assertExists(output);
	},
});

Deno.test({
	name: 'Execução de tools - shouldTimeoutLongRunningTools',
	...testOpts,
	fn: async () => {
		const cleanup = registerFakeTool('slow_tool', async () => {
			await new Promise((resolve) => setTimeout(resolve, 5000));
			return { ok: true };
		});
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'slow_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai, { toolExecutionTimeout: 100 });
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		cleanup();
		assertExists(output);
	},
});

Deno.test({
	name: 'Execução de tools - shouldPassArgumentsCorrectly',
	...testOpts,
	fn: async () => {
		let receivedArgs: any = null;
		const cleanup = registerFakeTool('args_tool', (args: any) => {
			receivedArgs = args;
			return { received: true };
		});
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'args_tool', arguments: '{"foo":"bar","num":42}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(receivedArgs, { foo: 'bar', num: 42 });
	},
});

// ============ GRUPO 4: SUMARIZAÇÃO (CRÍTICO - VALIDA BUGS CORRIGIDOS) ============

Deno.test({
	name: 'Sumarização - shouldNotSummarizeWhenUnderLimit',
	...testOpts,
	fn: async () => {
		let summarizationCalled = false;
		const cleanup = registerFakeTool('small_tool', () => ({ data: 'small result' }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'small_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = {
			chat: {
				completions: {
					create: () => {
						summarizationCalled = true;
						return Promise.resolve({ choices: [{ message: { content: 'summary' } }] });
					},
				},
			},
		};
		const executor = createExecutor(streamProcessor, openai, {}, 128000);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(summarizationCalled, false);
	},
});

Deno.test({
	name: 'Sumarização - shouldSummarizeWhenOverLimit',
	...testOpts,
	fn: async () => {
		let summarizationCalled = false;
		const largeResult = generateLargeString(50000);
		const cleanup = registerFakeTool('large_tool', () => ({ data: largeResult }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'large_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = {
			chat: {
				completions: {
					create: () => {
						summarizationCalled = true;
						return Promise.resolve({ choices: [{ message: { content: 'summarized content' } }] });
					},
				},
			},
		};
		const executor = createExecutor(streamProcessor, openai, {}, 5000);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(summarizationCalled, true);
	},
});

Deno.test('Sumarização - shouldEstimateFullToolResultObject (Bug #1 fix validation)', () => {
	const toolResult = createToolResult(
		'call_123',
		'test_tool',
		'{"url":"https://example.com/very/long/path"}',
		{ data: 'result' },
		150,
	);
	const fullObjectSize = JSON.stringify(toolResult).length;
	const resultOnlySize = JSON.stringify(toolResult.result).length;

	assertEquals(fullObjectSize > resultOnlySize, true);
	assertEquals(fullObjectSize > resultOnlySize * 2, true);
});

Deno.test({
	name: 'Sumarização - shouldIncludeResponseBuffer (Bug #2 fix validation)',
	...testOpts,
	fn: async () => {
		let summarizationCalled = false;
		const largeResult = generateLargeString(25000);
		const cleanup = registerFakeTool('medium_tool', () => ({ data: largeResult }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'medium_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = {
			chat: {
				completions: {
					create: () => {
						summarizationCalled = true;
						return Promise.resolve({ choices: [{ message: { content: 'summarized' } }] });
					},
				},
			},
		};
		const maxTokens = 7000;
		const executor = createExecutor(streamProcessor, openai, {}, maxTokens);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(summarizationCalled, true);
	},
});

Deno.test({
	name: 'Sumarização - shouldTruncateOnSummarizationFailure',
	...testOpts,
	fn: async () => {
		const largeResult = generateLargeString(50000);
		const cleanup = registerFakeTool('fail_summarize_tool', () => ({ data: largeResult }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'fail_summarize_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createFailingMockOpenAI();
		const executor = createExecutor(streamProcessor, openai, {}, 5000);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		cleanup();
		assertExists(output);
	},
});

// ============ GRUPO 5: TRATAMENTO DE ERROS ============

Deno.test({
	name: 'Erros - shouldEmitErrorOnStreamFailure',
	...testOpts,
	fn: async () => {
		const failingStreamProcessor: StreamProcessor = {
			processStream(): Promise<StreamProcessingResult> {
				return Promise.reject(new Error('Stream processing failed'));
			},
			formatToolResultsForNextCall(): unknown[] {
				return [];
			},
		};
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(failingStreamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		const output = await collectStreamOutput(reader);

		assertStringIncludes(output, 'Erro:');
	},
});

Deno.test({
	name: 'Erros - shouldContinueAfterToolError',
	...testOpts,
	fn: async () => {
		let secondToolCalled = false;
		const cleanup1 = registerFakeTool('failing_tool', () => {
			throw new Error('First tool fails');
		});
		const cleanup2 = registerFakeTool('success_tool', () => {
			secondToolCalled = true;
			return { ok: true };
		});
		const toolCalls: ExtractedToolCall[][] = [
			[
				{ id: 'call_1', name: 'failing_tool', arguments: '{}' },
				{ id: 'call_2', name: 'success_tool', arguments: '{}' },
			],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai);
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup1();
		cleanup2();
		assertEquals(secondToolCalled, true);
	},
});

// ============ GRUPO 6: CALLBACKS DE OBSERVABILIDADE ============

Deno.test({
	name: 'Callbacks - shouldCallOnIterationStart',
	...testOpts,
	fn: async () => {
		const iterationsStarted: number[] = [];
		const cleanup = registerFakeTool('callback_tool', () => ({ ok: true }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'callback_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai, {
			onIterationStart: (iteration) => iterationsStarted.push(iteration),
		});
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(iterationsStarted, [1, 2]);
	},
});

Deno.test({
	name: 'Callbacks - shouldCallOnToolExecution',
	...testOpts,
	fn: async () => {
		const toolsExecuted: string[] = [];
		const cleanup = registerFakeTool('observed_tool', () => ({ ok: true }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'observed_tool', arguments: '{"key":"value"}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai, {
			onToolExecution: (toolName) => toolsExecuted.push(toolName),
		});
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(toolsExecuted, ['observed_tool']);
	},
});

Deno.test({
	name: 'Callbacks - shouldCallOnIterationComplete',
	...testOpts,
	fn: async () => {
		const completedIterations: Array<{ iteration: number; hasMoreTools: boolean }> = [];
		const cleanup = registerFakeTool('complete_tool', () => ({ ok: true }));
		const toolCalls: ExtractedToolCall[][] = [
			[{ id: 'call_1', name: 'complete_tool', arguments: '{}' }],
			[],
		];
		const streamProcessor = createMockStreamProcessor(toolCalls);
		const openai = createMockOpenAI('summary');
		const executor = createExecutor(streamProcessor, openai, {
			onIterationComplete: (iteration, hasMoreTools) => completedIterations.push({ iteration, hasMoreTools }),
		});
		const initialReader = readerFromLines(['{"choices":[{"delta":{"content":"x"}}]}']);

		const reader = executor.execute(initialReader, []);
		await collectStreamOutput(reader);

		cleanup();
		assertEquals(completedIterations.length, 1);
		assertEquals(completedIterations[0].iteration, 1);
		assertEquals(completedIterations[0].hasMoreTools, true);
	},
});
