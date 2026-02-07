import { assertEquals } from 'asserts';
import OpenAi from 'npm:openai';
import { AntigravityTransformer } from '../../../src/service/antigravity/AntigravityTransformer.ts';
import { SKIP_THOUGHT_SIGNATURE } from '../../../src/service/antigravity/AntigravityTypes.ts';

Deno.test('AntigravityTransformer.toGeminiFormat converts system message to systemInstruction', () => {
	const messages = [
		{ role: 'system' as const, content: 'You are a helpful assistant.' },
		{ role: 'user' as const, content: 'Hello' },
	];

	const result = AntigravityTransformer.toGeminiFormat(messages);

	assertEquals(result.systemInstruction, 'You are a helpful assistant.');
	assertEquals(result.contents.length, 1);
	assertEquals(result.contents[0].role, 'user');
	assertEquals(result.contents[0].parts[0].text, 'Hello');
});

Deno.test('AntigravityTransformer.toGeminiFormat converts assistant role to model', () => {
	const messages = [
		{ role: 'user' as const, content: 'Hi' },
		{ role: 'assistant' as const, content: 'Hello!' },
		{ role: 'user' as const, content: 'How are you?' },
	];

	const result = AntigravityTransformer.toGeminiFormat(messages);

	assertEquals(result.contents.length, 3);
	assertEquals(result.contents[0].role, 'user');
	assertEquals(result.contents[1].role, 'model');
	assertEquals(result.contents[1].parts[0].text, 'Hello!');
	assertEquals(result.contents[2].role, 'user');
});

Deno.test('AntigravityTransformer.toGeminiFormat converts tool calls', () => {
	const messages = [
		{ role: 'user' as const, content: 'Search for cats' },
		{
			role: 'assistant' as const,
			content: null,
			tool_calls: [{
				id: 'call_1',
				type: 'function' as const,
				function: { name: 'search_searx', arguments: '{"query":"cats","num_results":3}' },
			}],
		},
		{
			role: 'tool' as const,
			tool_call_id: 'call_1',
			content: '{"results":[]}',
		} as any,
	];

	const result = AntigravityTransformer.toGeminiFormat(messages);

	assertEquals(result.contents.length, 3);
	assertEquals(result.contents[1].role, 'model');
	assertEquals(result.contents[1].parts[0].functionCall?.name, 'search_searx');
	assertEquals(result.contents[1].parts[0].functionCall?.args.query, 'cats');
	assertEquals(result.contents[1].parts[0].thoughtSignature, SKIP_THOUGHT_SIGNATURE);
	assertEquals(result.contents[2].role, 'user');
	assertEquals(result.contents[2].parts[0].functionResponse?.response.result, '{"results":[]}');
});

Deno.test('AntigravityTransformer.toGeminiFormat uses cached signature from signatureMap', () => {
	const signatureMap = new Map<string, string>();
	signatureMap.set('call_1', 'real_signature_abc123_long_enough_to_pass_validation_check_minimum_length');

	const messages = [
		{ role: 'user' as const, content: 'Search for cats' },
		{
			role: 'assistant' as const,
			content: null,
			tool_calls: [{
				id: 'call_1',
				type: 'function' as const,
				function: { name: 'search_searx', arguments: '{"query":"cats"}' },
			}],
		},
		{
			role: 'tool' as const,
			tool_call_id: 'call_1',
			content: '{"results":[]}',
		} as any,
	];

	const result = AntigravityTransformer.toGeminiFormat(messages, signatureMap);

	assertEquals(result.contents[1].parts[0].functionCall?.name, 'search_searx');
	assertEquals(result.contents[1].parts[0].thoughtSignature, 'real_signature_abc123_long_enough_to_pass_validation_check_minimum_length');
});

Deno.test('AntigravityTransformer.toGeminiTools converts OpenAI tool schemas', () => {
	const tools = [{
		type: 'function' as const,
		function: {
			name: 'search_searx',
			description: 'Search the web',
			parameters: {
				type: 'object',
				properties: {
					query: { type: 'string', description: 'Search query' },
				},
				required: ['query'],
			},
		},
	}];

	const result = AntigravityTransformer.toGeminiTools(tools);

	assertEquals(result.length, 1);
	assertEquals(result[0].functionDeclarations.length, 1);
	assertEquals(result[0].functionDeclarations[0].name, 'search_searx');
	assertEquals(result[0].functionDeclarations[0].description, 'Search the web');
});

Deno.test('AntigravityTransformer.toGeminiFormat converts images to inlineData', () => {
	const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
		{
			role: 'user',
			content: [
				{ type: 'text', text: 'O que é isso?' },
				{
					type: 'image_url',
					image_url: { url: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==' },
				},
			],
		},
	];

	const result = AntigravityTransformer.toGeminiFormat(messages);

	assertEquals(result.contents.length, 1);
	assertEquals(result.contents[0].parts.length, 2);
	assertEquals(result.contents[0].parts[0].text, 'O que é isso?');
	assertEquals(result.contents[0].parts[1].inlineData?.mimeType, 'image/jpeg');
	assertEquals(result.contents[0].parts[1].inlineData?.data, '/9j/4AAQSkZJRg==');
});

Deno.test('AntigravityTransformer.toGeminiFormat handles multiple images', () => {
	const messages: OpenAi.Chat.ChatCompletionMessageParam[] = [
		{
			role: 'user',
			content: [
				{ type: 'text', text: 'Compare estas imagens' },
				{
					type: 'image_url',
					image_url: { url: 'data:image/jpeg;base64,abc123' },
				},
				{
					type: 'image_url',
					image_url: { url: 'data:image/png;base64,xyz789' },
				},
			],
		},
	];

	const result = AntigravityTransformer.toGeminiFormat(messages);

	assertEquals(result.contents[0].parts.length, 3);
	assertEquals(result.contents[0].parts[1].inlineData?.mimeType, 'image/jpeg');
	assertEquals(result.contents[0].parts[2].inlineData?.mimeType, 'image/png');
});
