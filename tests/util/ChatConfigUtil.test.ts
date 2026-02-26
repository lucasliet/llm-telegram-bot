import { assertEquals } from 'asserts';
import { convertGeminiHistoryToGPT, getSystemPrompt, mapChatToolsToResponsesTools } from '../../src/util/ChatConfigUtil.ts';
import type { Content } from '@google/generative-ai';
import type OpenAI from 'openai';

Deno.test('convertGeminiHistoryToGPT', () => {
	const history: Content[] = [
		{ role: 'user', parts: [{ text: 'Hello' }] },
		{ role: 'model', parts: [{ text: 'Hi there' }] },
	];
	const gpt = convertGeminiHistoryToGPT(history);
	assertEquals(gpt[0].role, 'user');
	assertEquals(gpt[0].content, 'Hello');
	assertEquals(gpt[1].role, 'assistant');
	assertEquals(gpt[1].content, 'Hi there');
});

Deno.test('mapChatToolsToResponsesTools', () => {
	const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
		{ type: 'function', function: { name: 'foo', parameters: { type: 'object', properties: {} } } },
	];
	const mapped = mapChatToolsToResponsesTools(tools);
	assertEquals(mapped.length, 1);
	assertEquals((mapped[0] as { name: string }).name, 'foo');
});

Deno.test('mapChatToolsToResponsesTools returns empty array when no tools', () => {
	const mapped = mapChatToolsToResponsesTools();
	assertEquals(mapped.length, 0);
});

Deno.test('mapChatToolsToResponsesTools throws on unsupported tool', () => {
	let threw = false;
	try {
		mapChatToolsToResponsesTools([{ type: 'other' } as unknown as OpenAI.Chat.Completions.ChatCompletionTool]);
	} catch {
		threw = true;
	}
	assertEquals(threw, true);
});

Deno.test('getSystemPrompt', () => {
	const prompt = getSystemPrompt('Bot', 'model', 100);
	const containsChat = prompt.includes('Bot');
	const containsModel = prompt.includes('model');
	const containsTokens = prompt.includes('100');
	assertEquals(containsChat && containsModel && containsTokens, true);
});

Deno.test('mapChatToolsToResponsesTools handles missing parameters and strict', () => {
	const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
		{ type: 'function', function: { name: 'bar', description: 'desc' } } as any,
	];
	(tools[0] as any).strict = false;
	const mapped = mapChatToolsToResponsesTools(tools);
	const params = (mapped[0] as { parameters: unknown }).parameters;
	const strict = (mapped[0] as { strict: boolean }).strict;
	const desc = (mapped[0] as { description: string }).description;
	const check = JSON.stringify(params) === JSON.stringify({ type: 'object', additionalProperties: false, properties: {}, required: [] }) && strict === false &&
		desc === 'desc';
	assertEquals(check, true);
});
