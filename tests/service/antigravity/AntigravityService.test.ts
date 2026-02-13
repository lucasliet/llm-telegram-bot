import { assertEquals, assertStringIncludes } from 'asserts';
import AntigravityService from '../../../src/service/openai/AntigravityService.ts';

function createMockController(chunks: string[]): ReadableStreamDefaultController<Uint8Array> {
	return {
		enqueue: (chunk: Uint8Array) => {
			const decoder = new TextDecoder();
			chunks.push(decoder.decode(chunk));
		},
	} as ReadableStreamDefaultController<Uint8Array>;
}

function createDefaultContext() {
	return {
		toolCallIndex: 0,
		emittedFunctionCalls: new Set<number>(),
	};
}

Deno.test('processGeminiChunk - removes thinking blocks when keepThinking is false', async () => {
	const service = new AntigravityService('gemini-3-flash-preview');
	const chunks: string[] = [];
	const controller = createMockController(chunks);
	const encoder = new TextEncoder();
	const context = createDefaultContext();
	
	const data = {
		candidates: [{
			content: {
				parts: [
					{ text: 'My thinking process...', thought: true },
					{ text: 'The answer is 42', thought: false },
				],
			},
		}],
	};
	
	(service as any).processGeminiChunk(data, controller, encoder, context);
	
	assertEquals(chunks.length, 1);
	assertEquals(chunks[0].includes('My thinking process'), false);
	assertStringIncludes(chunks[0], 'The answer is 42');
});

Deno.test('processGeminiChunk - removes __thinking_text from functionCall args', () => {
	const service = new AntigravityService('gemini-3-flash-preview');
	const chunks: string[] = [];
	const controller = createMockController(chunks);
	const encoder = new TextEncoder();
	const context = createDefaultContext();
	
	const data = {
		candidates: [{
			content: {
				parts: [
					{
						functionCall: {
							name: 'search_searx',
							args: {
								query: 'weather tomorrow',
								__thinking_text: 'I need to search for weather...',
							},
						},
					},
				],
			},
		}],
	};
	
	(service as any).processGeminiChunk(data, controller, encoder, context);
	
	const chunk = JSON.parse(chunks[0]);
	const argsString = chunk.choices[0].delta.tool_calls[0].function.arguments;
	
	assertEquals(argsString.includes('__thinking_text'), false);
	
	const args = JSON.parse(argsString);
	assertEquals(args.query, 'weather tomorrow');
	assertEquals(args.__thinking_text, undefined);
});

Deno.test('processGeminiChunk - increments toolCallIndex correctly across chunks', () => {
	const service = new AntigravityService('gemini-3-flash-preview');
	const chunks: string[] = [];
	const controller = createMockController(chunks);
	const encoder = new TextEncoder();
	const context = createDefaultContext();
	
	// Chunk 1: Tool Call A
	const data1 = {
		candidates: [{
			content: {
				parts: [{ functionCall: { name: 'tool_a', args: { arg: 'a' } } }],
			},
		}],
	};
	
	(service as any).processGeminiChunk(data1, controller, encoder, context);
	
	// Chunk 2: Tool Call B
	const data2 = {
		candidates: [{
			content: {
				parts: [
					{ functionCall: { name: 'tool_a', args: { arg: 'a' } } }, // cumulative
					{ functionCall: { name: 'tool_b', args: { arg: 'b' } } },
				],
			},
		}],
	};
	
	(service as any).processGeminiChunk(data2, controller, encoder, context);
	
	const chunk1 = JSON.parse(chunks[0]);
	const chunk2 = JSON.parse(chunks[1]);
	
	assertEquals(chunk1.choices[0].delta.tool_calls[0].index, 0);
	assertEquals(chunk2.choices[0].delta.tool_calls[0].index, 1);
	assertEquals(context.toolCallIndex, 2);
});

Deno.test('processGeminiChunk - handles cumulative parts from Gemini correctly', () => {
	const service = new AntigravityService('gemini-3-flash-preview');
	const chunks: string[] = [];
	const controller = createMockController(chunks);
	const encoder = new TextEncoder();
	const context = createDefaultContext();

	// Event 1: First part (streaming text)
	const data1 = {
		candidates: [{
			content: {
				parts: [{ text: 'Hello' }],
			},
		}],
	};

	(service as any).processGeminiChunk(data1, controller, encoder, context);
	assertEquals(chunks.length, 1);
	assertStringIncludes(chunks[0], 'Hello');

	// Event 2: New text part (treated as delta)
	const data2 = {
		candidates: [{
			content: {
				parts: [
					{ text: 'Hello' }, // This part has content, so it emits again (if API sends full history) OR it is delta
					{ text: ' world' },
				],
			},
		}],
	};

	// Note: If Gemini sends cumulative text in parts array, we will re-emit. 
	// But our priority is NOT losing text.
	(service as any).processGeminiChunk(data2, controller, encoder, context);
	assertEquals(chunks.length, 3);
	assertStringIncludes(chunks[1], 'Hello'); // Re-emitted
	assertStringIncludes(chunks[2], ' world');

	// Event 3: Tool Call (should be emitted only once)
	const data3 = {
		candidates: [{
			content: {
				parts: [
					{ text: 'Hello' },
					{ text: ' world' },
					{
						functionCall: {
							name: 'my_tool',
							args: { x: 1 },
						},
					},
				],
			},
		}],
	};

	(service as any).processGeminiChunk(data3, controller, encoder, context);
	// Should emit text again (bad but safe) but Tool Call is new
	// chunks: 0=Hello, 1=Hello, 2=world, 3=Hello, 4=world, 5=tool
	assertStringIncludes(chunks[chunks.length - 1], 'my_tool');

	// Event 4: Cumulative again (Tool Call repeated)
	const chunksBefore = chunks.length;
	(service as any).processGeminiChunk(data3, controller, encoder, context);
	// Should emit text again, BUT TOOL CALL SHOULD NOT BE EMITTED AGAIN
	// If text is re-emitted, chunks length increases.
	// We want to verify tool deduplication specifically.
	
	const toolCalls = chunks.slice(chunksBefore).filter(c => c.includes('tool_calls'));
	assertEquals(toolCalls.length, 0); // Tool call was deduplicated!
});

Deno.test('processGeminiChunk - preserves thinking when keepThinking is true', async () => {
	const originalEnv = Deno.env.get('ANTIGRAVITY_KEEP_THINKING');
	Deno.env.set('ANTIGRAVITY_KEEP_THINKING', 'true');
	
	try {
		const service = new AntigravityService('gemini-3-flash-preview');
		const chunks: string[] = [];
		const controller = createMockController(chunks);
		const encoder = new TextEncoder();
		const context = createDefaultContext();
		
		const data = {
			candidates: [{
				content: {
					parts: [
						{ text: 'My thinking process...', thought: true },
					],
				},
			}],
		};
		
		(service as any).processGeminiChunk(data, controller, encoder, context);
		
		assertEquals(chunks.length, 1);
		assertStringIncludes(chunks[0], 'My thinking process');
	} finally {
		if (originalEnv) {
			Deno.env.set('ANTIGRAVITY_KEEP_THINKING', originalEnv);
		} else {
			Deno.env.delete('ANTIGRAVITY_KEEP_THINKING');
		}
	}
});

Deno.test('processGeminiChunk - does not affect regular text parts', () => {
	const service = new AntigravityService('gemini-3-flash-preview');
	const chunks: string[] = [];
	const controller = createMockController(chunks);
	const encoder = new TextEncoder();
	const context = createDefaultContext();
	
	const data = {
		candidates: [{
			content: {
				parts: [{ text: 'Regular text without thinking' }],
			},
		}],
	};
	
	(service as any).processGeminiChunk(data, controller, encoder, context);
	
	assertEquals(chunks.length, 1);
	assertStringIncludes(chunks[0], 'Regular text without thinking');
});
